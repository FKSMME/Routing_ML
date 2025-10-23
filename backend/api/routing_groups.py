"""FastAPI router exposing routing group CRUD operations."""
from __future__ import annotations

import time
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.api.security import require_auth
from backend.api.schemas import AuthenticatedUser
from backend.api.routes.audit import AuditEvent, persist_ui_audit_events
from backend.models.routing_groups import (
    RoutingGroup,
    bootstrap_schema,
    session_scope,
)
from common.datetime_utils import utc_now_naive
from backend.schemas.routing_groups import (
    PaginationMeta,
    RoutingGroupCreate,
    RoutingGroupDetail,
    RoutingGroupListResponse,
    RoutingGroupResponse,
    RoutingGroupSummary,
    RoutingGroupUpdate,
    RoutingStep,
    RoutingConnection,
)
from common.logger import audit_routing_event, get_logger

bootstrap_schema()

router = APIRouter(prefix="/api/routing", tags=["routing-groups"])
logger = get_logger("api.routing_groups")


class RoutingSnapshotPayload(BaseModel):
    """Represents an uploaded routing workspace snapshot."""

    snapshot_id: str = Field(..., alias="id")
    created_at: datetime
    reason: Optional[str] = None
    version: Optional[int] = None
    state: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class RoutingSnapshotAuditPayload(BaseModel):
    """Audit entry accompanying a routing workspace flush."""

    audit_id: str = Field(..., alias="id")
    action: str
    level: Literal["info", "error"]
    message: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {"populate_by_name": True}


class RoutingSnapshotGroupResult(BaseModel):
    """Summary of group metadata updates derived from a snapshot."""

    group_id: str
    version: int
    dirty: bool
    updated_at: datetime
    snapshot_id: Optional[str] = None


class RoutingSnapshotSyncRequest(BaseModel):
    """Payload for syncing routing workspace snapshots to the backend."""

    snapshots: List[RoutingSnapshotPayload] = Field(default_factory=list)
    audits: List[RoutingSnapshotAuditPayload] = Field(default_factory=list)
    source: Optional[str] = Field(default=None, max_length=64)


class RoutingSnapshotSyncResponse(BaseModel):
    """Acknowledgement for routing workspace snapshot sync requests."""

    accepted_snapshot_ids: List[str] = Field(default_factory=list)
    accepted_audit_ids: List[str] = Field(default_factory=list)
    updated_groups: List[RoutingSnapshotGroupResult] = Field(default_factory=list)


def _serialize_steps(steps: List[RoutingStep]) -> List[Dict[str, Any]]:
    ordered = sorted(steps, key=lambda step: step.seq)
    return [step.dict() for step in ordered]

def _serialize_connections(connections: List[RoutingConnection]) -> List[Dict[str, Any]]:
    return [
        {
            'id': connection.id,
            'source_node_id': connection.source_node_id,
            'target_node_id': connection.target_node_id,
            'created_at': connection.created_at.isoformat(),
            'created_by': connection.created_by,
        }
        for connection in connections
    ]


def _to_response(model: RoutingGroup) -> RoutingGroupResponse:
    return RoutingGroupResponse(
        group_id=model.id,
        group_name=model.group_name,
        owner=model.owner,
        version=model.version,
        updated_at=model.updated_at,
    )


def _to_detail(model: RoutingGroup) -> RoutingGroupDetail:
    step_payload = [RoutingStep(**step) for step in model.steps or []]
    connection_payload = [RoutingConnection(**connection) for connection in model.connections or []]
    return RoutingGroupDetail(
        group_id=model.id,
        group_name=model.group_name,
        owner=model.owner,
        version=model.version,
        updated_at=model.updated_at,
        item_codes=list(model.item_codes or []),
        steps=step_payload,
        connections=connection_payload,
        erp_required=bool(model.erp_required),
        metadata=
        dict(model.metadata_payload or {})
        if model.metadata_payload is not None
        else None,
        created_at=model.created_at,
        deleted_at=model.deleted_at,
    )


def _ensure_owner(group: RoutingGroup, user: AuthenticatedUser) -> None:
    if group.owner != user.username and not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="그룹에 접근할 권한이 없습니다",
        )


def _load_group(session: Session, group_id: str) -> RoutingGroup:
    group = session.get(RoutingGroup, group_id)
    if group is None or group.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="요청한 라우팅 그룹을 찾을 수 없습니다",
        )
    return group


def _get_correlation_id(request: Request) -> Optional[str]:
    return getattr(request.state, "correlation_id", None)


def _extract_candidate_group_ids(state: Dict[str, Any]) -> List[str]:
    candidate_ids: List[str] = []
    active_id = state.get("activeGroupId") or state.get("active_group_id")
    if isinstance(active_id, str) and active_id:
        candidate_ids.append(active_id)
    tabs = state.get("productTabs") or state.get("product_tabs")
    if isinstance(tabs, list):
        for tab in tabs:
            if not isinstance(tab, dict):
                continue
            candidate_id = tab.get("candidateId") or tab.get("candidate_id")
            if isinstance(candidate_id, str) and candidate_id and candidate_id not in candidate_ids:
                candidate_ids.append(candidate_id)
    return candidate_ids


def _merge_snapshot(
    session: Session,
    snapshot: RoutingSnapshotPayload,
    user: AuthenticatedUser,
) -> List[RoutingSnapshotGroupResult]:
    state = snapshot.state or {}
    dirty = bool(state.get("dirty"))
    group_ids = _extract_candidate_group_ids(state)
    updates: Dict[str, RoutingSnapshotGroupResult] = {}

    for group_id in group_ids:
        group = session.get(RoutingGroup, group_id)
        if group is None or group.owner != user.username:
            continue
        metadata = dict(group.metadata_payload or {})
        workspace_state = metadata.get("workspace_state", {})
        workspace_state.update(
            {
                "snapshot_id": snapshot.snapshot_id,
                "snapshot_created_at": snapshot.created_at.isoformat(),
                "dirty": dirty,
                "active_group_id": state.get("activeGroupId"),
                "active_group_version": state.get("activeGroupVersion"),
                "active_product_id": state.get("activeProductId"),
                "last_saved_at": state.get("lastSavedAt"),
            }
        )
        metadata["workspace_state"] = workspace_state
        group.metadata_payload = metadata
        group.updated_at = utc_now_naive()
        session.add(group)
        updates[group_id] = RoutingSnapshotGroupResult(
            group_id=group.id,
            version=group.version,
            dirty=dirty,
            updated_at=group.updated_at,
            snapshot_id=snapshot.snapshot_id,
        )

    return list(updates.values())


@router.post(
    "/groups",
    response_model=RoutingGroupResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_routing_group(
    payload: RoutingGroupCreate,
    request: Request,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RoutingGroupResponse:
    start = time.perf_counter()
    with session_scope() as session:
        metadata_payload = (
            dict(payload.metadata) if payload.metadata is not None else None
        )
        group = RoutingGroup(
            group_name=payload.group_name,
            owner=current_user.username,
            item_codes=list(payload.item_codes),
            steps=_serialize_steps(payload.steps),
            connections=_serialize_connections(payload.connections),
            erp_required=payload.erp_required,
            metadata_payload=metadata_payload,
        )
        session.add(group)
        try:
            session.flush()
        except IntegrityError as exc:
            logger.info(
                "routing.group.conflict",
                extra={
                    "owner": current_user.username,
                    "group_name": payload.group_name,
                    "error": str(exc),
                },
            )
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            audit_routing_event(
                "routing.group.save",
                {
                    "group_name": payload.group_name,
                    "item_count": len(payload.item_codes),
                    "step_count": len(payload.steps),
                    "duration_ms": duration_ms,
                },
                result="error",
                username=current_user.username,
                client_host=request.client.host if request.client else None,
                correlation_id=_get_correlation_id(request),
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="동일한 이름의 라우팅 그룹이 이미 존재합니다",
            ) from exc
        session.refresh(group)
        response = _to_response(group)
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    audit_routing_event(
        "routing.group.save",
        {
            "group_id": response.group_id,
            "group_name": response.group_name,
            "item_count": len(payload.item_codes),
            "step_count": len(payload.steps),
            "duration_ms": duration_ms,
            "version": response.version,
        },
        username=current_user.username,
        client_host=request.client.host if request.client else None,
        correlation_id=_get_correlation_id(request),
    )
    return response


@router.get("/groups", response_model=RoutingGroupListResponse)
async def list_routing_groups(
    request: Request,
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    owner: Optional[str] = Query(None),
    item_code: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RoutingGroupListResponse:
    effective_owner = (owner or current_user.username).strip()
    if (
        effective_owner != current_user.username
        and not current_user.is_admin
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="다른 사용자의 그룹을 조회할 권한이 없습니다",
        )
    start = time.perf_counter()
    with session_scope() as session:
        base_stmt = select(RoutingGroup).where(RoutingGroup.deleted_at.is_(None))
        if effective_owner:
            base_stmt = base_stmt.where(RoutingGroup.owner == effective_owner)
        if item_code:
            code = item_code.strip()
            if code:
                base_stmt = base_stmt.where(
                    RoutingGroup.item_codes.contains([code])
                )
        if search:
            term = search.strip()
            if term:
                like_value = f"%{term}%"
                base_stmt = base_stmt.where(
                    RoutingGroup.group_name.ilike(like_value)
                )
        total = session.execute(
            select(func.count()).select_from(base_stmt.subquery())
        ).scalar_one()
        stmt = (
            base_stmt.order_by(RoutingGroup.updated_at.desc())
            .offset(offset)
            .limit(limit)
        )
        records = session.execute(stmt).scalars().all()
    items = [
        RoutingGroupSummary(
            group_id=record.id,
            group_name=record.group_name,
            item_codes=list(record.item_codes or []),
            step_count=len(record.steps or []),
            version=record.version,
            updated_at=record.updated_at,
        )
        for record in records
    ]
    response = RoutingGroupListResponse(
        items=items,
        pagination=PaginationMeta(limit=limit, offset=offset, total=total),
    )
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    audit_routing_event(
        "routing.group.list",
        {
            "filters": {
                "owner": effective_owner,
                "item_code": item_code,
                "search": search,
            },
            "result_count": len(items),
            "duration_ms": duration_ms,
        },
        username=current_user.username,
        client_host=request.client.host if request.client else None,
        correlation_id=_get_correlation_id(request),
    )
    return response


@router.get("/groups/{group_id}", response_model=RoutingGroupDetail)
async def get_routing_group(
    group_id: str,
    request: Request,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RoutingGroupDetail:
    start = time.perf_counter()
    with session_scope() as session:
        try:
            group = _load_group(session, group_id)
            _ensure_owner(group, current_user)
        except HTTPException as exc:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            audit_routing_event(
                "routing.group.load",
                {
                    "group_id": group_id,
                    "duration_ms": duration_ms,
                    "status_code": exc.status_code,
                },
                result="error",
                username=current_user.username,
                client_host=request.client.host if request.client else None,
                correlation_id=_get_correlation_id(request),
            )
            raise
        detail = _to_detail(group)
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    audit_routing_event(
        "routing.group.load",
        {
            "group_id": group_id,
            "version": detail.version,
            "duration_ms": duration_ms,
        },
        username=current_user.username,
        client_host=request.client.host if request.client else None,
        correlation_id=_get_correlation_id(request),
    )
    return detail


@router.put("/groups/{group_id}", response_model=RoutingGroupResponse)
async def update_routing_group(
    group_id: str,
    payload: RoutingGroupUpdate,
    request: Request,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RoutingGroupResponse:
    start = time.perf_counter()
    with session_scope() as session:
        try:
            group = _load_group(session, group_id)
            _ensure_owner(group, current_user)
        except HTTPException as exc:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            audit_routing_event(
                "routing.group.update",
                {
                    "group_id": group_id,
                    "from_version": payload.version,
                    "status_code": exc.status_code,
                },
                result="error",
                username=current_user.username,
                client_host=request.client.host if request.client else None,
                correlation_id=_get_correlation_id(request),
            )
            raise
        if payload.version != group.version:
            audit_routing_event(
                "routing.group.update",
                {
                    "group_id": group_id,
                    "from_version": group.version,
                    "attempted_version": payload.version,
                },
                result="error",
                username=current_user.username,
                client_host=request.client.host if request.client else None,
                correlation_id=_get_correlation_id(request),
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="버전 충돌이 발생했습니다",
            )
        if payload.group_name is not None:
            group.group_name = payload.group_name
        if payload.item_codes is not None:
            group.item_codes = list(payload.item_codes)
        if payload.steps is not None:
            group.steps = _serialize_steps(payload.steps)
        if payload.connections is not None:
            group.connections = _serialize_connections(payload.connections)
        if payload.erp_required is not None:
            group.erp_required = payload.erp_required
        if payload.metadata is not None:
            group.metadata_payload = dict(payload.metadata)
        group.version += 1
        group.updated_at = utc_now_naive()
        try:
            session.flush()
        except IntegrityError as exc:
            logger.info(
                "routing.group.conflict",
                extra={
                    "owner": current_user.username,
                    "group_name": payload.group_name,
                    "error": str(exc),
                },
            )
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            audit_routing_event(
                "routing.group.update",
                {
                    "group_id": group_id,
                    "from_version": payload.version,
                    "duration_ms": duration_ms,
                },
                result="error",
                username=current_user.username,
                client_host=request.client.host if request.client else None,
                correlation_id=_get_correlation_id(request),
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="동일한 이름의 라우팅 그룹이 이미 존재합니다",
            ) from exc
        session.refresh(group)
        response = _to_response(group)
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    audit_routing_event(
        "routing.group.update",
        {
            "group_id": group_id,
            "from_version": payload.version,
            "to_version": response.version,
            "duration_ms": duration_ms,
        },
        username=current_user.username,
        client_host=request.client.host if request.client else None,
        correlation_id=_get_correlation_id(request),
    )
    return response


@router.delete(
    "/groups/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_routing_group(
    group_id: str,
    request: Request,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Response:
    start = time.perf_counter()
    with session_scope() as session:
        try:
            group = _load_group(session, group_id)
            _ensure_owner(group, current_user)
        except HTTPException as exc:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            audit_routing_event(
                "routing.group.delete",
                {
                    "group_id": group_id,
                    "status_code": exc.status_code,
                },
                result="error",
                username=current_user.username,
                client_host=request.client.host if request.client else None,
                correlation_id=_get_correlation_id(request),
            )
            raise
        group.deleted_at = utc_now_naive()
        group.version += 1
        group.updated_at = utc_now_naive()
        session.flush()
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    audit_routing_event(
        "routing.group.delete",
        {
            "group_id": group_id,
            "soft_delete": True,
            "duration_ms": duration_ms,
        },
        username=current_user.username,
        client_host=request.client.host if request.client else None,
        correlation_id=_get_correlation_id(request),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/groups/snapshots", response_model=RoutingSnapshotSyncResponse)
async def sync_routing_snapshots(
    payload: RoutingSnapshotSyncRequest,
    request: Request,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RoutingSnapshotSyncResponse:
    accepted_snapshot_ids: List[str] = []
    group_updates: Dict[str, RoutingSnapshotGroupResult] = {}

    if payload.snapshots:
        with session_scope() as session:
            for snapshot in payload.snapshots:
                merged = _merge_snapshot(session, snapshot, current_user)
                for update in merged:
                    group_updates[update.group_id] = update
                accepted_snapshot_ids.append(snapshot.snapshot_id)
            session.flush()

    accepted_audit_ids: List[str] = []
    if payload.audits:
        events: List[AuditEvent] = []
        for entry in payload.audits:
            events.append(
                AuditEvent(
                    action=entry.action,
                    username=current_user.username,
                    ip_address=None,
                    payload={
                        "level": entry.level,
                        "message": entry.message,
                        "context": entry.context,
                        "created_at": entry.created_at.isoformat(),
                        "snapshot_ids": accepted_snapshot_ids,
                    },
                )
            )
        written = persist_ui_audit_events(
            events,
            request,
            source=payload.source or "routing-workspace.flush",
        )
        if written:
            accepted_audit_ids = [entry.audit_id for entry in payload.audits[:written]]

    response = RoutingSnapshotSyncResponse(
        accepted_snapshot_ids=accepted_snapshot_ids,
        accepted_audit_ids=accepted_audit_ids,
        updated_groups=list(group_updates.values()),
    )

    logger.info(
        "routing.groups.snapshots.flush",
        extra={
            "snapshot_count": len(payload.snapshots),
            "audit_count": len(payload.audits),
            "updated_groups": [update.group_id for update in response.updated_groups],
        },
    )
    return response
