"""Workspace settings 및 감사 로그 라우터."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from filelock import FileLock
from pydantic import BaseModel, Field

from backend.api.config import get_settings
from backend.api.routes.audit import AuditEvent, persist_ui_audit_events
from backend.api.security import require_auth
from backend.api.schemas import AuthenticatedUser
from common.datetime_utils import utc_isoformat
from common.logger import get_logger

router = APIRouter(prefix="/api", tags=["workspace"])
logger = get_logger("api.workspace")
settings = get_settings()
audit_logger = get_logger("api.audit.workspace", log_dir=settings.audit_log_dir, use_json=True)


class WorkspaceSettingsPayload(BaseModel):
    version: Optional[int | str] = Field(default=None)
    layout: Optional[dict[str, Any]] = None
    routing: Optional[dict[str, Any]] = None
    algorithm: Optional[dict[str, Any]] = None
    options: Optional[dict[str, Any]] = None
    database: Optional[dict[str, Any]] = None
    metadata: Optional[dict[str, Any]] = None


class WorkspaceSettingsResponse(WorkspaceSettingsPayload):
    updated_at: str
    user: Optional[str] = None


def _settings_file(settings_dir: Path) -> Path:
    target = settings_dir / "workspace_settings.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    return target

def _workspace_lock(path: Path) -> FileLock:
    return FileLock(str(path) + ".lock")

def _normalize_version(value: Optional[int | str]) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


@router.get("/settings/workspace", response_model=WorkspaceSettingsResponse)
async def get_workspace_settings(user: AuthenticatedUser = Depends(require_auth)) -> WorkspaceSettingsResponse:
    file_path = _settings_file(settings.audit_log_dir)
    lock = _workspace_lock(file_path)
    with lock:
        if file_path.exists():
            try:
                data = json.loads(file_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                data = {}
        else:
            data = {}
        version = _normalize_version(data.get("version"))
        if version is None:
            version = 0
            data["version"] = version

    return WorkspaceSettingsResponse(
        **data,
        updated_at=data.get("updated_at", utc_isoformat()),
        user=data.get("user", user.username),
    )


@router.put("/settings/workspace", response_model=WorkspaceSettingsResponse, status_code=status.HTTP_200_OK)
async def save_workspace_settings(
    payload: WorkspaceSettingsPayload,
    request: Request,
    user: AuthenticatedUser = Depends(require_auth),
) -> WorkspaceSettingsResponse:
    file_path = _settings_file(settings.audit_log_dir)
    lock = _workspace_lock(file_path)
    with lock:
        existing: dict[str, Any] = {}
        if file_path.exists():
            try:
                existing = json.loads(file_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                existing = {}
        current_version = _normalize_version(existing.get("version"))
        incoming_version = _normalize_version(payload.version)
        if current_version is not None:
            if incoming_version is None or incoming_version != current_version:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Workspace settings version conflict. Please reload before saving.",
                )
        next_version = (current_version or 0) + 1

        record = dict(existing)
        record.update({k: v for k, v in payload.dict(exclude_none=True).items()})
        record["updated_at"] = utc_isoformat()
        record["user"] = user.username
        record["ip_address"] = request.client.host if request.client else None
        record["version"] = next_version

        file_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    options = payload.options if isinstance(payload.options, dict) else {}
    mappings_raw = options.get("column_mappings")
    mapping_count = 0
    mapping_scopes: set[str] = set()
    if isinstance(mappings_raw, list):
        for entry in mappings_raw:
            if isinstance(entry, dict):
                scope = str(entry.get("scope", "")).strip()
                source = str(entry.get("source", "")).strip()
                target = str(entry.get("target", "")).strip()
                if scope or source or target:
                    mapping_count += 1
                    if scope:
                        mapping_scopes.add(scope)

    audit_logger.info(
        "workspace.settings.save",
        extra={
            "user": user.username,
            "ip_address": record.get("ip_address"),
            "options_keys": sorted(options.keys()),
            "column_mapping_count": mapping_count,
            "column_mapping_scopes": sorted(mapping_scopes),
        },
    )
    logger.info("workspace.settings.save", extra={"user": user.username})

    return WorkspaceSettingsResponse(**record)


@router.post(
    "/audit/ui",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def record_ui_audit(event: AuditEvent, request: Request) -> Response:
    persist_ui_audit_events([event], request, source="workspace.stream")
    logger.info("workspace.audit", extra={"action": event.action, "username": event.username})

    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
