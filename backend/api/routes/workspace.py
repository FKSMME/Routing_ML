"""Workspace settings 및 감사 로그 라우터."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, Field

from backend.api.config import get_settings
from backend.api.routes.audit import AuditEvent, persist_ui_audit_events
from backend.api.security import require_auth
from backend.api.schemas import AuthenticatedUser
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


@router.get("/settings/workspace", response_model=WorkspaceSettingsResponse)
async def get_workspace_settings(user: AuthenticatedUser = Depends(require_auth)) -> WorkspaceSettingsResponse:
    file_path = _settings_file(settings.audit_log_dir)
    if file_path.exists():
        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}
    else:
        data = {}

    return WorkspaceSettingsResponse(
        **data,
        updated_at=data.get("updated_at", datetime.utcnow().isoformat()),
        user=data.get("user", user.username),
    )


@router.put("/settings/workspace", response_model=WorkspaceSettingsResponse, status_code=status.HTTP_200_OK)
async def save_workspace_settings(
    payload: WorkspaceSettingsPayload,
    request: Request,
    user: AuthenticatedUser = Depends(require_auth),
) -> WorkspaceSettingsResponse:
    file_path = _settings_file(settings.audit_log_dir)

    record = payload.dict()
    record["updated_at"] = datetime.utcnow().isoformat()
    record["user"] = user.username
    record["ip_address"] = request.client.host if request.client else None

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
