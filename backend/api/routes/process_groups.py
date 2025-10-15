"""FastAPI routes for process group management."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func
from sqlalchemy.exc import IntegrityError

from backend.api.schemas import AuthenticatedUser
from backend.api.security import get_current_user
from backend.models.process_groups import (
    ProcessGroup,
    bootstrap_schema,
    session_scope,
)
from backend.schemas.process_groups import (
    PaginationMeta,
    ProcessGroupCreate,
    ProcessGroupDetail,
    ProcessGroupListResponse,
    ProcessGroupResponse,
    ProcessGroupSummary,
    ProcessGroupUpdate,
)

router = APIRouter(prefix="/process-groups", tags=["process-groups"])

# Ensure database tables exist
bootstrap_schema()


@router.get("", response_model=ProcessGroupListResponse)
def list_process_groups(
    limit: int = Query(50, ge=1, le=200, description="페이지 크기"),
    offset: int = Query(0, ge=0, description="오프셋"),
    type_filter: Optional[str] = Query(None, description="그룹 유형 필터"),
    active_only: bool = Query(True, description="활성 그룹만 조회"),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    List all process groups owned by the current user.

    - **limit**: 한 페이지에 조회할 그룹 수
    - **offset**: 페이지 시작 위치
    - **type_filter**: 그룹 유형 필터 (machining/post-process)
    - **active_only**: 활성 그룹만 조회할지 여부
    """
    with session_scope() as session:
        query = session.query(ProcessGroup).filter(
            ProcessGroup.owner == current_user.username,
            ProcessGroup.deleted_at.is_(None),
        )

        if active_only:
            query = query.filter(ProcessGroup.is_active == True)

        if type_filter:
            query = query.filter(ProcessGroup.type == type_filter)

        total = query.count()
        items_db = query.order_by(desc(ProcessGroup.updated_at)).limit(limit).offset(offset).all()

        items = [
            ProcessGroupSummary(
                group_id=item.id,
                name=item.name,
                type=item.type,
                column_count=len(item.default_columns),
                is_active=item.is_active,
                version=item.version,
                updated_at=item.updated_at,
            )
            for item in items_db
        ]

        return ProcessGroupListResponse(
            items=items,
            pagination=PaginationMeta(limit=limit, offset=offset, total=total),
        )


@router.get("/{group_id}", response_model=ProcessGroupDetail)
def get_process_group(
    group_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Retrieve detailed information for a specific process group.

    - **group_id**: 프로세스 그룹 UUID
    """
    with session_scope() as session:
        group = (
            session.query(ProcessGroup)
            .filter(
                ProcessGroup.id == group_id,
                ProcessGroup.owner == current_user.username,
                ProcessGroup.deleted_at.is_(None),
            )
            .first()
        )

        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Process group '{group_id}' not found",
            )

        return ProcessGroupDetail(
            group_id=group.id,
            name=group.name,
            description=group.description,
            type=group.type,
            owner=group.owner,
            default_columns=group.default_columns,
            fixed_values=group.fixed_values,
            is_active=group.is_active,
            version=group.version,
            created_at=group.created_at,
            updated_at=group.updated_at,
            deleted_at=group.deleted_at,
        )


@router.post("", response_model=ProcessGroupResponse, status_code=status.HTTP_201_CREATED)
def create_process_group(
    payload: ProcessGroupCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Create a new process group.

    - **name**: 그룹 이름 (소유자 내에서 고유해야 함)
    - **type**: 그룹 유형 (machining 또는 post-process)
    - **default_columns**: 기본 컬럼 정의 목록
    - **fixed_values**: 고정값 설정
    """
    with session_scope() as session:
        new_group = ProcessGroup(
            owner=current_user.username,
            name=payload.name,
            description=payload.description,
            type=payload.type,
            default_columns=[col.model_dump() for col in payload.default_columns],
            fixed_values=payload.fixed_values,
            is_active=payload.is_active,
            version=1,
        )

        try:
            session.add(new_group)
            session.flush()
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Process group '{payload.name}' already exists for this user",
            )

        return ProcessGroupResponse(
            group_id=new_group.id,
            name=new_group.name,
            owner=new_group.owner,
            version=new_group.version,
            updated_at=new_group.updated_at,
        )


@router.patch("/{group_id}", response_model=ProcessGroupResponse)
def update_process_group(
    group_id: str,
    payload: ProcessGroupUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Update an existing process group with optimistic locking.

    - **group_id**: 프로세스 그룹 UUID
    - **version**: 낙관적 잠금을 위한 현재 버전
    """
    with session_scope() as session:
        group = (
            session.query(ProcessGroup)
            .filter(
                ProcessGroup.id == group_id,
                ProcessGroup.owner == current_user.username,
                ProcessGroup.deleted_at.is_(None),
            )
            .first()
        )

        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Process group '{group_id}' not found",
            )

        if group.version != payload.version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Version mismatch: the group was modified by another request",
            )

        # Update fields if provided
        if payload.name is not None:
            group.name = payload.name
        if payload.description is not None:
            group.description = payload.description
        if payload.type is not None:
            group.type = payload.type
        if payload.default_columns is not None:
            group.default_columns = [col.model_dump() for col in payload.default_columns]
        if payload.fixed_values is not None:
            group.fixed_values = payload.fixed_values
        if payload.is_active is not None:
            group.is_active = payload.is_active

        group.version += 1
        group.updated_at = datetime.utcnow()

        try:
            session.flush()
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Process group name '{payload.name}' already exists for this user",
            )

        return ProcessGroupResponse(
            group_id=group.id,
            name=group.name,
            owner=group.owner,
            version=group.version,
            updated_at=group.updated_at,
        )


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_process_group(
    group_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Soft-delete a process group.

    - **group_id**: 프로세스 그룹 UUID
    """
    with session_scope() as session:
        group = (
            session.query(ProcessGroup)
            .filter(
                ProcessGroup.id == group_id,
                ProcessGroup.owner == current_user.username,
                ProcessGroup.deleted_at.is_(None),
            )
            .first()
        )

        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Process group '{group_id}' not found",
            )

        group.deleted_at = datetime.utcnow()
        group.is_active = False
        session.flush()
