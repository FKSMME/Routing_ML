"""Workspace settings, audit, and data source connection routes."""
from __future__ import annotations

import json
import time
import hashlib
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
from backend import database
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


class DataSourceConnectionRequest(BaseModel):
    path: str | Path
    table: Optional[str] = None


class DataSourceConnectionResponse(BaseModel):
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


def _hash_identifier(raw: str) -> str:
    digest = hashlib.sha256(raw.encode("utf-8", errors="ignore")).hexdigest()
    return digest[:12]


def _normalize_table_name(name: str) -> str:
    stripped = name.strip()
    if not stripped:
        return stripped
    parts = stripped.split(".")
    if len(parts) == 1:
        return stripped
    schema = parts[0] or "dbo"
    table = parts[1]
    return f"{schema}.{table}"


def _test_mssql_connection(
    request: DataSourceConnectionRequest,
    user: AuthenticatedUser,
) -> DataSourceConnectionResponse:
    try:
        import pyodbc  # type: ignore  # noqa: F401
    except ImportError as exc:
        message = "pyodbc 모듈이 설치되어 있지 않아 MSSQL 연결을 확인할 수 없습니다."
        logger.warning(
            "workspace.mssql.driver_missing",
            extra={"user": user.username, "error": str(exc)},
        )
        return DataSourceConnectionResponse(
            ok=False,
            message=message,
            path_hash=_hash_identifier("mssql-driver-missing"),
        )

    server_input = str(request.path).strip() if request.path else ""
    server = server_input or database.MSSQL_CONFIG.get("server") or ""
    if not server:
        message = "MSSQL 서버 주소를 입력하거나 환경 변수 MSSQL_SERVER를 설정하세요."
        return DataSourceConnectionResponse(
            ok=False,
            message=message,
            path_hash=_hash_identifier("mssql-server-missing"),
        )

    conn_str = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={server};"
        f"DATABASE={database.MSSQL_CONFIG.get('database', '')};"
        f"UID={database.MSSQL_CONFIG.get('user', '')};"
        f"PWD={database.MSSQL_CONFIG.get('password', '')};"
        f"Encrypt={'yes' if database.MSSQL_CONFIG.get('encrypt') else 'no'};"
        f"TrustServerCertificate={'yes' if database.MSSQL_CONFIG.get('trust_certificate') else 'no'};"
    )

    tables: list[str] = []
    elapsed_ms: Optional[float] = None
    verified_table: Optional[str] = None
    ok = False
    message = "MSSQL 연결에 실패했습니다."

    start = time.perf_counter()
    try:
        with pyodbc.connect(conn_str, timeout=10) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT TABLE_SCHEMA, TABLE_NAME
                FROM INFORMATION_SCHEMA.VIEWS
                ORDER BY TABLE_SCHEMA, TABLE_NAME
                """
            )
            tables = [f"{row.TABLE_SCHEMA}.{row.TABLE_NAME}" for row in cursor.fetchall() if row.TABLE_NAME]
            ok = True
            message = f"MSSQL 연결 성공. {len(tables)}개 뷰를 확인했습니다."
            if request.table:
                candidate = _normalize_table_name(request.table)
                candidate_set = {entry.lower() for entry in tables}
                if candidate.lower() in candidate_set:
                    verified_table = next(
                        (entry for entry in tables if entry.lower() == candidate.lower()),
                        candidate,
                    )
                    try:
                        master_data_service.get_access_metadata(table=verified_table)
                        message = f"MSSQL 연결 성공. 뷰 '{verified_table}' 확인 완료."
                    except Exception as exc:
                        ok = False
                        verified_table = None
                        message = f"MSSQL 뷰 '{candidate}' 메타데이터 조회에 실패했습니다: {exc}"
                else:
                    ok = False
                    message = f"입력한 뷰 '{candidate}'를 MSSQL에서 찾을 수 없습니다."
    except Exception as exc:  # pragma: no cover - diagnostics only
        message = f"MSSQL 연결 확인 중 오류가 발생했습니다: {exc}"
        logger.warning(
            "workspace.mssql.connection_failed",
            extra={
                "user": user.username,
                "server": server,
                "error": str(exc),
            },
        )
    finally:
        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

    logger.info(
        "workspace.datasource.mssql.test",
        extra={
            "user": user.username,
            "server": server,
            "table_count": len(tables),
            "message": message,
            "elapsed_ms": elapsed_ms,
            "requested_table": request.table,
            "verified": verified_table,
            "ok": ok,
        },
    )

    return DataSourceConnectionResponse(
        ok=ok,
        message=message,
        path_hash=_hash_identifier(server),
        table_profiles=tables,
        elapsed_ms=elapsed_ms,
        verified_table=verified_table,
    )


def _test_access_connection(
    request: DataSourceConnectionRequest,
    user: AuthenticatedUser,
) -> DataSourceConnectionResponse:
    raw_path = request.path
    path = Path(raw_path).expanduser() if isinstance(raw_path, (str, Path)) else Path(str(raw_path)).expanduser()
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
        validated_path = None
    except ValueError as exc:
        message = str(exc)
        validated_path = None
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
                "workspace.datasource.access.connection_failed",
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
                        "workspace.datasource.access.table_verification_failed",
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
        "workspace.datasource.test",
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

    return DataSourceConnectionResponse(
        ok=ok,
        message=message,
        path_hash=path_hash,
        table_profiles=tables,
        elapsed_ms=elapsed_ms,
        verified_table=verified_table,
    )


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


@router.post("/access/connection/test", response_model=DataSourceConnectionResponse)
async def test_access_connection(
    request: DataSourceConnectionRequest,
    user: AuthenticatedUser = Depends(require_auth),
) -> DataSourceConnectionResponse:
    if database.DB_TYPE.upper() == "MSSQL":
        return _test_mssql_connection(request, user)
    return _test_access_connection(request, user)


__all__ = ["router"]
