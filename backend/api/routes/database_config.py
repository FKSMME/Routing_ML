"""MSSQL 데이터베이스 설정 및 연결 테스트 라우터."""
from __future__ import annotations

import os
import sys
import tempfile
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

# Windows/Unix 파일 잠금 처리
if sys.platform == "win32":
    import msvcrt
else:
    import fcntl

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
    """MSSQL 환경 변수를 갱신하고 .env 파일에 반영한다 (파일 잠금 및 원자적 쓰기 지원)."""

    logger.info(
        "데이터베이스 설정 업데이트: user=%s server=%s database=%s",
        current_user.username,
        config.server,
        config.database,
    )

    server = config.server.strip()
    password = (config.password or "").strip()
    item_view = (config.item_view or "").strip() or None
    routing_view = (config.routing_view or "").strip() or None
    work_result_view = (config.work_result_view or "").strip() or None
    purchase_order_view = (config.purchase_order_view or "").strip() or None

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
            persist=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - unexpected errors
        logger.error("데이터베이스 설정 업데이트 실패: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"설정 업데이트 실패: {exc}") from exc

    env_path = ".env"
    env_dir = os.path.dirname(os.path.abspath(env_path)) or "."

    try:
        lines: list[str] = []
        if os.path.exists(env_path):
            with open(env_path, "r+", encoding="utf-8") as handle:
                if sys.platform == "win32":
                    msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
                else:
                    fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
                try:
                    handle.seek(0)
                    lines = handle.readlines()
                finally:
                    if sys.platform == "win32":
                        handle.seek(0)
                        msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
                    else:
                        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

        prefixes = (
            "DB_TYPE=",
            "MSSQL_SERVER=",
            "MSSQL_DATABASE=",
            "MSSQL_USER=",
            "MSSQL_PASSWORD=",
            "MSSQL_ENCRYPT=",
            "MSSQL_TRUST_CERTIFICATE=",
            "MSSQL_ITEM_VIEW=",
            "MSSQL_ROUTING_VIEW=",
            "MSSQL_WORK_RESULT_VIEW=",
            "MSSQL_PURCHASE_ORDER_VIEW=",
        )
        filtered = [line for line in lines if not any(line.startswith(prefix) for prefix in prefixes)]

        filtered.extend(
            [
                "\nDB_TYPE=MSSQL\n",
                f"MSSQL_SERVER={os.environ.get('MSSQL_SERVER', server)}\n",
                f"MSSQL_DATABASE={os.environ.get('MSSQL_DATABASE', config.database)}\n",
                f"MSSQL_USER={os.environ.get('MSSQL_USER', config.user)}\n",
                f"MSSQL_PASSWORD={os.environ.get('MSSQL_PASSWORD', password)}\n",
                f"MSSQL_ENCRYPT={os.environ.get('MSSQL_ENCRYPT', str(config.encrypt))}\n",
                f"MSSQL_TRUST_CERTIFICATE={os.environ.get('MSSQL_TRUST_CERTIFICATE', str(config.trust_certificate))}\n",
                f"MSSQL_ITEM_VIEW={get_item_view_name()}\n",
                f"MSSQL_ROUTING_VIEW={get_routing_view_name()}\n",
                f"MSSQL_WORK_RESULT_VIEW={get_work_result_view_name()}\n",
                f"MSSQL_PURCHASE_ORDER_VIEW={get_purchase_order_view_name()}\n",
            ]
        )

        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=env_dir,
            delete=False,
            suffix=".tmp",
        ) as tmp_handle:
            tmp_path = tmp_handle.name
            tmp_handle.writelines(filtered)

        if sys.platform == "win32":
            if os.path.exists(env_path):
                os.replace(tmp_path, env_path)
            else:
                os.rename(tmp_path, env_path)
        else:
            os.rename(tmp_path, env_path)

        logger.info("데이터베이스 설정 저장 완료 (원자적 쓰기)")
        return {"message": "설정이 저장되었습니다. 애플리케이션을 재시작해주세요."}
    except Exception as exc:
        logger.error("데이터베이스 설정 업데이트 실패: %s", exc, exc_info=True)
        if "tmp_path" in locals() and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"설정 업데이트 실패: {exc}") from exc


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
