"""MSSQL 데이터베이스 설정 및 연결 테스트 라우터."""
from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.api.schemas import AuthenticatedUser
from backend.api.security import require_auth
from backend.database import MSSQL_CONFIG, get_database_info, _create_mssql_connection_with_config, VIEW_ITEM_MASTER
from common.logger import get_logger

router = APIRouter(prefix="/api/database", tags=["database"])
logger = get_logger("api.database.config")


class DatabaseConfig(BaseModel):
    """MSSQL 환경 설정 값."""

    server: str = Field(..., description="MSSQL 서버 주소 (예: host,port)")
    database: str = Field(..., description="데이터베이스 이름")
    user: str = Field(..., description="사용자 ID")
    encrypt: bool = Field(False, description="Encrypt 옵션 사용 여부")
    trust_certificate: bool = Field(True, description="TrustServerCertificate 옵션")


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
    return {
        "server": MSSQL_CONFIG["server"],
        "database": MSSQL_CONFIG["database"],
        "user": MSSQL_CONFIG["user"],
        "encrypt": MSSQL_CONFIG["encrypt"],
        "trust_certificate": MSSQL_CONFIG["trust_certificate"],
    }


@router.post("/config")
async def update_database_config(
    config: DatabaseConfig,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """MSSQL 환경 변수를 갱신하고 .env 파일에 반영한다."""

    logger.info(
        "데이터베이스 설정 업데이트: user=%s server=%s database=%s",
        current_user.username,
        config.server,
        config.database,
    )

    try:
        os.environ["DB_TYPE"] = "MSSQL"
        os.environ["MSSQL_SERVER"] = config.server
        os.environ["MSSQL_DATABASE"] = config.database
        os.environ["MSSQL_USER"] = config.user
        os.environ["MSSQL_ENCRYPT"] = str(config.encrypt)
        os.environ["MSSQL_TRUST_CERTIFICATE"] = str(config.trust_certificate)

        env_path = ".env"
        lines: list[str] = []
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as handle:
                lines = handle.readlines()

        filtered = [
            line
            for line in lines
            if not any(
                line.startswith(prefix)
                for prefix in (
                    "DB_TYPE=",
                    "MSSQL_SERVER=",
                    "MSSQL_DATABASE=",
                    "MSSQL_USER=",
                    "MSSQL_ENCRYPT=",
                    "MSSQL_TRUST_CERTIFICATE=",
                )
            )
        ]

        filtered.append("\nDB_TYPE=MSSQL\n")
        filtered.append(f"MSSQL_SERVER={config.server}\n")
        filtered.append(f"MSSQL_DATABASE={config.database}\n")
        filtered.append(f"MSSQL_USER={config.user}\n")
        filtered.append(f"MSSQL_ENCRYPT={config.encrypt}\n")
        filtered.append(f"MSSQL_TRUST_CERTIFICATE={config.trust_certificate}\n")

        with open(env_path, "w", encoding="utf-8") as handle:
            handle.writelines(filtered)

        logger.info("데이터베이스 설정 저장 완료")
        return {"message": "설정이 저장되었습니다. 애플리케이션을 재시작해주세요."}
    except Exception as exc:
        logger.error("데이터베이스 설정 업데이트 실패: %s", exc, exc_info=True)
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
