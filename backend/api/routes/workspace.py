"""Workspace settings, audit, and Access connection routes."""
from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, Field

from backend.api.config import get_settings
from backend.api.routes.audit import AuditEvent, persist_ui_audit_events
from backend.api.security import require_auth
from backend.api.schemas import AuthenticatedUser
from backend.api.services.master_data_service import master_data_service
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
    access: Optional[dict[str, Any]] = None
    metadata: Optional[dict[str, Any]] = None


class WorkspaceSettingsResponse(WorkspaceSettingsPayload):
    updated_at: str
    user: Optional[str] = None


class AccessConnectionRequest(BaseModel):
    path: Path
    table: Optional[str] = None


class AccessConnectionResponse(BaseModel):
    ok: bool
    message: str
    path_hash: str
    table_profiles: list[str] = Field(default_factory=list)
    elapsed_ms: Optional[float] = None
    verified_table: Optional[str] = None


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


@router.post("/access/connection/test", response_model=AccessConnectionResponse)
async def test_access_connection(
    request: AccessConnectionRequest,
    user: AuthenticatedUser = Depends(require_auth),
) -> AccessConnectionResponse:
    path = request.path.expanduser()
    path_hash = hex(abs(hash(path.as_posix())))
    tables: list[str] = []
    elapsed_ms: Optional[float] = None
    verified_table: Optional[str] = None
    ok = False
    message = "File not found."

    try:
        import pyodbc  # type: ignore  # noqa: F401
        driver_available = True
    except ImportError:
        driver_available = False

    try:
        validated_path = master_data_service.validate_access_path(path)
    except FileNotFoundError:
        message = f"Access database not found at {path}"
    except ValueError as exc:
        message = str(exc)
    else:
        start = time.perf_counter()
        try:
            tables = master_data_service.read_access_tables(validated_path)
            ok = True
            message = f"Connection ok. {len(tables)} tables detected."
        except RuntimeError as exc:
            message = (
                "Install Microsoft Access ODBC Driver to enumerate tables."
                if not driver_available
                else str(exc)
            )
        except Exception as exc:  # pragma: no cover - diagnostics only
            message = f"Access connection failed: {exc}"
            logger.warning(
                "workspace.access.connection_failed",
                extra={
                    "user": user.username,
                    "path": str(validated_path),
                    "error": str(exc),
                },
            )
        finally:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

        if ok and request.table:
            table_name = request.table.strip()
            if table_name in tables:
                try:
                    master_data_service.get_access_metadata(table=table_name, path=str(validated_path))
                    verified_table = table_name
                    message = f"Connection ok. Table '{table_name}' verified."
                except Exception as exc:  # pragma: no cover - diagnostics only
                    ok = False
                    verified_table = None
                    message = f"Table '{table_name}' verification failed."
                    logger.warning(
                        "workspace.access.table_verification_failed",
                        extra={
                            "user": user.username,
                            "path": str(validated_path),
                            "table": table_name,
                            "error": str(exc),
                        },
                    )
            else:
                ok = False
                message = f"Table '{table_name}' not found in database."

    logger.info(
        "workspace.access.test",
        extra={
            "user": user.username,
            "path": str(path),
            "table_count": len(tables),
            "message": message,
            "elapsed_ms": elapsed_ms,
            "requested_table": request.table,
            "verified": verified_table,
            "driver_available": driver_available,
            "ok": ok,
        },
    )

    return AccessConnectionResponse(
        ok=ok,
        message=message,
        path_hash=path_hash,
        table_profiles=tables,
        elapsed_ms=elapsed_ms,
        verified_table=verified_table,
    )


__all__ = ["router"]
