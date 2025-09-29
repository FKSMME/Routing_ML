"""FastAPI routes for the Rule Set Library (RSL)."""

from __future__ import annotations

from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from backend.api.config import get_settings
from backend.api.schemas import (
    AuthenticatedUser,
    RslGroupCreate,
    RslGroupListResponse,
    RslGroupModel,
    RslGroupStatus,
    RslGroupUpdate,
    RslImportRequest,
    RslImportResult,
    RslRuleRefCreate,
    RslRuleRefModel,
    RslStepCreate,
    RslStepModel,
    RslStepUpdate,
    RslValidationResponse,
)
from backend.api.security import require_auth
from backend.api.services.rsl_service import rsl_service
from common.logger import get_logger


router = APIRouter(prefix="/api/rsl", tags=["rsl"])
logger = get_logger("api.rsl")
settings = get_settings()
audit_logger = get_logger("rsl.audit", log_dir=settings.audit_log_dir, use_json=True)


def _handle_error(exc: Exception) -> None:
    if isinstance(exc, PermissionError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    logger.exception("RSL 서비스 처리 중 예상치 못한 오류", exc_info=exc)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="요청을 처리하는 중 오류가 발생했습니다",
    )


@router.get("/groups", response_model=RslGroupListResponse)
async def list_groups(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    tags: Optional[List[str]] = Query(None),
    status_filter: Optional[RslGroupStatus] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RslGroupListResponse:
    try:
        result = rsl_service.list_groups(
            page=page,
            page_size=page_size,
            owner=current_user.username,
            tags=tags,
            status=status_filter,
            search=search,
        )
    except Exception as exc:  # noqa: BLE001
        _handle_error(exc)
    audit_logger.info(
        "rsl.groups.list",
        extra={"username": current_user.username, "total": result.total},
    )
    return result


@router.post("/groups", response_model=RslGroupModel, status_code=status.HTTP_201_CREATED)
async def create_group(
    payload: RslGroupCreate,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RslGroupModel:
    try:
        result = rsl_service.create_group(payload, owner=current_user.username)
    except Exception as exc:  # noqa: BLE001
        _handle_error(exc)
    audit_logger.info(
        "rsl.group.create",
        extra={"username": current_user.username, "group_id": result.id},
    )
    return result


@router.get("/groups/{group_id}", response_model=RslGroupModel)
async def fetch_group(
    group_id: int,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RslGroupModel:
    try:
        result = rsl_service.get_group(group_id, owner=current_user.username)
    except Exception as exc:  # noqa: BLE001
        _handle_error(exc)
    audit_logger.info(
        "rsl.group.read",
        extra={"username": current_user.username, "group_id": group_id},
    )
    return result


@router.patch("/groups/{group_id}", response_model=RslGroupModel)
async def update_group(
    group_id: int,
    payload: RslGroupUpdate,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RslGroupModel:
    try:
        result = rsl_service.update_group(group_id, payload, owner=current_user.username)
    except Exception as exc:  # noqa: BLE001
        _handle_error(exc)
    audit_logger.info(
        "rsl.group.update",
        extra={"username": current_user.username, "group_id": result.id},
    )
    return result


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: int,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Response:
    try:
        rsl_service.delete_group(group_id, owner=current_user.username)
    except Exception as exc:  # noqa: BLE001
        _handle_error(exc)
    audit_logger.info(
        "rsl.group.delete",
        extra={"username": current_user.username, "group_id": group_id},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/groups/{group_id}/steps", response_model=RslStepModel, status_code=status.HTTP_201_CREATED)
async def add_step(
    group_id: int,
    payload: RslStepCreate,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RslStepModel:
    try:
        result = rsl_service.add_step(group_id, payload, owner=current_user.username)
    except Exception as exc:  # noqa: BLE001
        _handle_error(exc)
    audit_logger.info(
        "rsl.step.create",
        extra={"username": current_user.username, "group_id": group_id, "step_id": result.id},
    )
    return result


@router.patch("/groups/{group_id}/steps/{step_id}", response_model=RslStepModel)
async def update_step(
    group_id: int,
    step_id: int,
    payload: RslStepUpdate,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RslStepModel:
    try:
        result = rsl_service.update_step(group_id, step_id, payload, owner=current_user.username)
    except Exception as exc:  # noqa: BLE001
        _handle_error(exc)
    audit_logger.info(
        "rsl.step.update",
        extra={"username": current_user.username, "group_id": group_id, "step_id": result.id},
    )
    return result


@router.delete("/groups/{group_id}/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_step(
    group_id: int,
    step_id: int,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Response:
    try:
        rsl_service.delete_step(group_id, step_id, owner=current_user.username)
    except Exception as exc:  # noqa: BLE001
        _handle_error(exc)
    audit_logger.info(
        "rsl.step.delete",
        extra={"username": current_user.username, "group_id": group_id, "step_id": step_id},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/groups/{group_id}/steps/{step_id}/rules",
    response_model=RslRuleRefModel,
    status_code=status.HTTP_201_CREATED,
)
async def add_rule(
    group_id: int,
    step_id: int,
    payload: RslRuleRefCreate,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RslRuleRefModel:
    try:
        result = rsl_service.add_rule(group_id, step_id, payload, owner=current_user.username)
    except Exception as exc:  # noqa: BLE001
        _handle_error(exc)
    audit_logger.info(
        "rsl.rule.create",
        extra={
            "username": current_user.username,
            "group_id": group_id,
            "step_id": step_id,
            "rule_id": result.id,
        },
    )
    return result


@router.delete("/groups/{group_id}/steps/{step_id}/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    group_id: int,
    step_id: int,
    rule_id: int,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Response:
    try:
        rsl_service.delete_rule(group_id, step_id, rule_id, owner=current_user.username)
    except Exception as exc:  # noqa: BLE001
        _handle_error(exc)
    audit_logger.info(
        "rsl.rule.delete",
        extra={
            "username": current_user.username,
            "group_id": group_id,
            "step_id": step_id,
            "rule_id": rule_id,
        },
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/groups/{group_id}/validate", response_model=RslValidationResponse)
async def validate_group(
    group_id: int,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RslValidationResponse:
    try:
        result = rsl_service.run_validation(group_id, owner=current_user.username)
    except Exception as exc:  # noqa: BLE001
        _handle_error(exc)
    audit_logger.info(
        "rsl.group.validate",
        extra={"username": current_user.username, "group_id": group_id, "valid": result.is_valid},
    )
    return result


@router.post("/groups/{group_id}/release", response_model=RslGroupModel)
async def release_group(
    group_id: int,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RslGroupModel:
    try:
        result = rsl_service.release_group(group_id, owner=current_user.username)
    except Exception as exc:  # noqa: BLE001
        _handle_error(exc)
    audit_logger.info(
        "rsl.group.release",
        extra={"username": current_user.username, "group_id": group_id},
    )
    return result


@router.post("/groups/{group_id}/retract", response_model=RslGroupModel)
async def retract_group(
    group_id: int,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RslGroupModel:
    try:
        result = rsl_service.retract_group(group_id, owner=current_user.username)
    except Exception as exc:  # noqa: BLE001
        _handle_error(exc)
    audit_logger.info(
        "rsl.group.retract",
        extra={"username": current_user.username, "group_id": group_id},
    )
    return result


@router.get("/groups/export")
async def export_groups(
    format: Literal["json", "csv"] = Query("json"),
    include_archived: bool = Query(False),
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Response:
    try:
        bundle = rsl_service.export_groups(
            format=format,
            owner=current_user.username,
            include_archived=include_archived,
        )
    except Exception as exc:  # noqa: BLE001
        _handle_error(exc)
    media_type = "application/json" if bundle.format == "json" else "text/csv"
    audit_logger.info(
        "rsl.group.export",
        extra={
            "username": current_user.username,
            "format": bundle.format,
            "include_archived": include_archived,
        },
    )
    return Response(content=bundle.payload, media_type=media_type)


@router.post("/groups/import", response_model=RslImportResult)
async def import_groups(
    payload: RslImportRequest,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RslImportResult:
    try:
        result = rsl_service.import_groups(payload, owner=current_user.username)
    except Exception as exc:  # noqa: BLE001
        _handle_error(exc)
    audit_logger.info(
        "rsl.group.import",
        extra={
            "username": current_user.username,
            "created": result.created,
            "updated": result.updated,
            "skipped": result.skipped,
        },
    )
    return result


__all__ = ["router"]

