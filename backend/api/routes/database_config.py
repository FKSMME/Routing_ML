"""MSSQL 데이터베이스 설정 및 연결 테스트 라우터."""
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from backend.api.schemas import AuthenticatedUser
from backend.api.security import require_auth
from backend.database import (
    MSSQL_CONFIG,
    VIEW_ITEM_MASTER,
    VIEW_PURCHASE_ORDER,
    VIEW_ROUTING,
    VIEW_WORK_RESULT,
    _create_mssql_connection_with_config,
    get_database_info,
    get_item_view_name,
    get_purchase_order_view_name,
    get_routing_view_name,
    get_work_result_view_name,
    refresh_view_names,
    update_mssql_runtime_config,
)
try:
    from common.config_store import workflow_config_store
except Exception:  # pragma: no cover - config store optional in some environments
    workflow_config_store = None  # type: ignore[assignment]
from common.logger import get_logger

router = APIRouter(prefix="/api/database", tags=["database"])
logger = get_logger("api.database.config")


class DatabaseConfig(BaseModel):
    """MSSQL 환경 설정 값."""

    server: str = Field(..., description="MSSQL 서버 주소 (예: host,port)")
    database: str = Field(..., description="데이터베이스 이름")
    user: str = Field(..., description="사용자 ID")
    password: str | None = Field(None, description="저장할 데이터베이스 비밀번호")
    encrypt: bool = Field(False, description="Encrypt 옵션 사용 여부")
    trust_certificate: bool = Field(True, description="TrustServerCertificate 옵션")
    item_view: str | None = Field(None, description="아이템 뷰 이름 (기본: dbo.BI_ITEM_INFO_VIEW)")
    routing_view: str | None = Field(None, description="라우팅 뷰 이름 (기본: dbo.BI_ROUTING_HIS_VIEW)")
    work_result_view: str | None = Field(None, description="실적 뷰 이름 (기본: dbo.BI_WORK_ORDER_RESULTS)")
    purchase_order_view: str | None = Field(None, description="발주 뷰 이름 (기본: dbo.BI_PUR_PO_VIEW)")

    @field_validator("server")
    @classmethod
    def _validate_server(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("서버 주소는 비워둘 수 없습니다.")
        return value


class DatabaseConnectionTest(BaseModel):
    """MSSQL 연결 테스트 요청."""

    server: str = Field(..., description="MSSQL 서버 주소 (예: host,port)")
    database: str = Field(..., description="데이터베이스 이름")
    user: str = Field(..., description="사용자 ID")
    password: str = Field(..., description="연결 테스트에 사용할 비밀번호")
    encrypt: bool = Field(False, description="Encrypt 옵션 사용 여부")
    trust_certificate: bool = Field(True, description="TrustServerCertificate 옵션")


@router.get("/config")
async def get_database_config(
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """현재 MSSQL 연결 설정을 조회한다."""

    logger.info("데이터베이스 설정 조회: user=%s", current_user.username)

    store_config = None
    if workflow_config_store is not None:
        try:
            store_config = workflow_config_store.get_data_source_config()
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("workflow_config_store 로부터 설정을 불러오지 못했습니다: %s", exc)

    if store_config is not None:
        refresh_view_names()

        def _normalize(value: str | None, default: str) -> str:
            text = (value or "").strip()
            return text or default

        server = (store_config.mssql_server or "").strip() or MSSQL_CONFIG["server"]
        database_name = (store_config.mssql_database or "").strip() or MSSQL_CONFIG["database"]
        user = (store_config.mssql_user or "").strip() or MSSQL_CONFIG["user"]
        encrypt = bool(store_config.mssql_encrypt)
        trust_certificate = bool(store_config.mssql_trust_certificate)
        item_view = _normalize(store_config.item_view, VIEW_ITEM_MASTER)
        routing_view = _normalize(store_config.routing_view, VIEW_ROUTING)
        work_result_view = _normalize(store_config.work_result_view, VIEW_WORK_RESULT)
        purchase_order_view = _normalize(
            store_config.purchase_order_view, VIEW_PURCHASE_ORDER
        )
        password_saved = bool((store_config.mssql_password or "").strip())
    else:
        refresh_view_names()
        server = MSSQL_CONFIG["server"]
        database_name = MSSQL_CONFIG["database"]
        user = MSSQL_CONFIG["user"]
        encrypt = MSSQL_CONFIG["encrypt"]
        trust_certificate = MSSQL_CONFIG["trust_certificate"]
        item_view = get_item_view_name()
        routing_view = get_routing_view_name()
        work_result_view = get_work_result_view_name()
        purchase_order_view = get_purchase_order_view_name()
        password_saved = bool(MSSQL_CONFIG.get("password"))

    return {
        "server": server,
        "database": database_name,
        "user": user,
        "encrypt": encrypt,
        "trust_certificate": trust_certificate,
        "item_view": item_view,
        "routing_view": routing_view,
        "work_result_view": work_result_view,
        "purchase_order_view": purchase_order_view,
        "password_saved": password_saved,
    }


@router.post("/config")
async def update_database_config(
    config: DatabaseConfig,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """MSSQL 설정을 workflow_config_store에 저장합니다 (.env 파일 쓰기 대신 config_store 사용)."""

    logger.info(
        "데이터베이스 설정 업데이트: user=%s server=%s database=%s",
        current_user.username,
        config.server,
        config.database,
    )

    server = config.server.strip()
    password = (config.password or "").strip()
    item_view = (config.item_view or "").strip() or VIEW_ITEM_MASTER
    routing_view = (config.routing_view or "").strip() or VIEW_ROUTING
    work_result_view = (config.work_result_view or "").strip() or VIEW_WORK_RESULT
    purchase_order_view = (config.purchase_order_view or "").strip() or VIEW_PURCHASE_ORDER

    # Step 1: Update runtime config (in-memory)
    try:
        update_mssql_runtime_config(
            server=server,
            database=config.database,
            user=config.user,
            password=password,
            encrypt=config.encrypt,
            trust_certificate=config.trust_certificate,
            item_view=item_view,
            routing_view=routing_view,
            work_result_view=work_result_view,
            purchase_order_view=purchase_order_view,
            persist=False,  # Don't write to .env - use config_store instead
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - unexpected errors
        logger.error("런타임 설정 업데이트 실패: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"런타임 설정 업데이트 실패: {exc}") from exc

    # Step 2: Save to workflow_config_store for persistence
    if workflow_config_store is not None:
        try:
            current_data_source = workflow_config_store.get_data_source_config()

            # Update only database-related fields
            current_data_source.mssql_server = server
            current_data_source.mssql_database = config.database
            current_data_source.mssql_user = config.user
            current_data_source.mssql_password = password
            current_data_source.mssql_encrypt = config.encrypt
            current_data_source.mssql_trust_certificate = config.trust_certificate
            current_data_source.item_view = item_view
            current_data_source.routing_view = routing_view
            current_data_source.work_result_view = work_result_view
            current_data_source.purchase_order_view = purchase_order_view

            workflow_config_store.update_data_source_config(current_data_source)

            logger.info("데이터베이스 설정 저장 완료 (config_store)")
            return {
                "message": "설정이 저장되었습니다.",
                "storage": "config_store",
                "requires_restart": False,
            }
        except Exception as exc:
            logger.error("config_store 저장 실패: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"config_store 저장 실패: {exc}"
            ) from exc
    else:
        logger.warning("workflow_config_store not available, configuration only applied to runtime")
        return {
            "message": "설정이 런타임에만 적용되었습니다 (재시작 시 초기화됨).",
            "storage": "runtime_only",
            "requires_restart": False,
        }


@router.post("/test-connection")
async def test_database_connection(
    payload: DatabaseConnectionTest,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """MSSQL 연결을 검증한다 (모듈 리로드 없이 직접 연결 테스트)."""

    logger.info(
        "데이터베이스 연결 테스트: user=%s server=%s database=%s",
        current_user.username,
        payload.server,
        payload.database,
    )

    try:
        # 커스텀 설정으로 연결 생성
        test_config = {
            "server": payload.server,
            "database": payload.database,
            "user": payload.user,
            "password": payload.password,
            "encrypt": payload.encrypt,
            "trust_certificate": payload.trust_certificate,
        }

        # 연결 테스트
        with _create_mssql_connection_with_config(test_config) as conn:
            cursor = conn.cursor()

            # 기본 연결 테스트
            cursor.execute("SELECT 1")
            cursor.fetchone()

            # 데이터베이스 정보 조회
            cursor.execute("SELECT @@SERVERNAME")
            server_name = cursor.fetchone()[0] if cursor.description else payload.server

            cursor.execute("SELECT DB_NAME()")
            database_name = cursor.fetchone()[0] if cursor.description else payload.database

            # 테스트 테이블 조회 (품목 마스터 뷰)
            try:
                cursor.execute(f"SELECT TOP 1 * FROM {VIEW_ITEM_MASTER}")
                cursor.fetchone()
                view_accessible = True
            except Exception:
                view_accessible = False

            connection_info = {
                "connection_status": "정상",
                "server": server_name,
                "database": database_name,
                "view_accessible": view_accessible,
            }

            logger.info("연결 테스트 성공: %s/%s", server_name, database_name)

            return {
                "success": True,
                "message": "데이터베이스 연결 성공",
                "details": connection_info,
            }

    except Exception as exc:
        logger.error("연결 테스트 실패: %s", exc, exc_info=True)
        return {
            "success": False,
            "message": f"데이터베이스 연결 실패: {str(exc)}",
            "details": {
                "connection_status": f"오류: {exc}",
                "server": payload.server,
                "database": payload.database,
            },
        }


@router.get("/info")
async def database_info(
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """현재 데이터베이스의 기본 정보를 반환한다."""

    logger.info("데이터베이스 정보 조회: user=%s", current_user.username)
    return get_database_info()


__all__ = ["router"]
