"""데이터베이스 설정 API."""
from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.api.schemas import AuthenticatedUser
from backend.api.security import require_auth
from backend.database import test_connection, get_database_info, DB_TYPE, MSSQL_CONFIG
from common.logger import get_logger

router = APIRouter(prefix="/api/database", tags=["database"])
logger = get_logger("api.database")


class DatabaseConnectionTest(BaseModel):
    """데이터베이스 연결 테스트 요청"""

    db_type: str = Field(..., description="데이터베이스 타입 (ACCESS or MSSQL)")
    server: str | None = Field(None, description="MSSQL 서버 주소")
    database: str | None = Field(None, description="데이터베이스 이름")
    user: str | None = Field(None, description="사용자 ID")
    password: str | None = Field(None, description="비밀번호")


class DatabaseConfig(BaseModel):
    """데이터베이스 설정"""

    db_type: str = Field(..., description="데이터베이스 타입 (ACCESS or MSSQL)")
    server: str | None = Field(None, description="MSSQL 서버 주소")
    database: str | None = Field(None, description="데이터베이스 이름")
    user: str | None = Field(None, description="사용자 ID")
    encrypt: bool = Field(False, description="암호화 사용 여부")
    trust_certificate: bool = Field(True, description="서버 인증서 신뢰 여부")


@router.get("/config")
async def get_database_config(
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """현재 데이터베이스 설정 조회"""
    logger.info(f"데이터베이스 설정 조회: user={current_user.username}")

    config = {
        "db_type": DB_TYPE,
        "server": MSSQL_CONFIG["server"] if DB_TYPE == "MSSQL" else None,
        "database": MSSQL_CONFIG["database"] if DB_TYPE == "MSSQL" else None,
        "user": MSSQL_CONFIG["user"] if DB_TYPE == "MSSQL" else None,
        "encrypt": MSSQL_CONFIG["encrypt"] if DB_TYPE == "MSSQL" else False,
        "trust_certificate": MSSQL_CONFIG["trust_certificate"] if DB_TYPE == "MSSQL" else True,
    }

    return config


@router.post("/config")
async def update_database_config(
    config: DatabaseConfig,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """데이터베이스 설정 업데이트 (환경 변수 업데이트)"""
    logger.info(f"데이터베이스 설정 업데이트: user={current_user.username}, db_type={config.db_type}")

    try:
        # 환경 변수 업데이트
        os.environ["DB_TYPE"] = config.db_type

        if config.db_type == "MSSQL":
            if not all([config.server, config.database, config.user]):
                raise HTTPException(
                    status_code=400,
                    detail="MSSQL 연결에는 server, database, user가 필요합니다."
                )

            os.environ["MSSQL_SERVER"] = config.server or ""
            os.environ["MSSQL_DATABASE"] = config.database or ""
            os.environ["MSSQL_USER"] = config.user or ""
            os.environ["MSSQL_ENCRYPT"] = str(config.encrypt)
            os.environ["MSSQL_TRUST_CERTIFICATE"] = str(config.trust_certificate)

        # .env 파일 업데이트 (영구 저장)
        env_path = ".env"
        env_lines = []

        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                env_lines = f.readlines()

        # 기존 설정 제거
        env_lines = [line for line in env_lines if not any([
            line.startswith('DB_TYPE='),
            line.startswith('MSSQL_SERVER='),
            line.startswith('MSSQL_DATABASE='),
            line.startswith('MSSQL_USER='),
            line.startswith('MSSQL_ENCRYPT='),
            line.startswith('MSSQL_TRUST_CERTIFICATE='),
        ])]

        # 새 설정 추가
        env_lines.append(f"\nDB_TYPE={config.db_type}\n")
        if config.db_type == "MSSQL":
            env_lines.append(f"MSSQL_SERVER={config.server}\n")
            env_lines.append(f"MSSQL_DATABASE={config.database}\n")
            env_lines.append(f"MSSQL_USER={config.user}\n")
            env_lines.append(f"MSSQL_ENCRYPT={config.encrypt}\n")
            env_lines.append(f"MSSQL_TRUST_CERTIFICATE={config.trust_certificate}\n")

        with open(env_path, 'w', encoding='utf-8') as f:
            f.writelines(env_lines)

        logger.info("데이터베이스 설정 저장 완료")
        return {"message": "설정이 저장되었습니다. 애플리케이션을 재시작해주세요."}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"데이터베이스 설정 업데이트 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"설정 업데이트 실패: {str(e)}")


@router.post("/test-connection")
async def test_database_connection(
    test_config: DatabaseConnectionTest,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """데이터베이스 연결 테스트"""
    logger.info(f"데이터베이스 연결 테스트: user={current_user.username}, db_type={test_config.db_type}")

    try:
        # 임시로 환경 변수 백업
        original_env = {
            "DB_TYPE": os.getenv("DB_TYPE"),
            "MSSQL_SERVER": os.getenv("MSSQL_SERVER"),
            "MSSQL_DATABASE": os.getenv("MSSQL_DATABASE"),
            "MSSQL_USER": os.getenv("MSSQL_USER"),
            "MSSQL_PASSWORD": os.getenv("MSSQL_PASSWORD"),
        }

        # 테스트용 환경 변수 설정
        os.environ["DB_TYPE"] = test_config.db_type

        if test_config.db_type == "MSSQL":
            if not all([test_config.server, test_config.database, test_config.user, test_config.password]):
                raise HTTPException(
                    status_code=400,
                    detail="MSSQL 연결 테스트에는 server, database, user, password가 필요합니다."
                )

            os.environ["MSSQL_SERVER"] = test_config.server
            os.environ["MSSQL_DATABASE"] = test_config.database
            os.environ["MSSQL_USER"] = test_config.user
            os.environ["MSSQL_PASSWORD"] = test_config.password

        # 연결 테스트
        # Note: database 모듈을 다시 import하여 새 환경 변수를 반영
        import importlib
        import backend.database as db_module
        importlib.reload(db_module)

        success = db_module.test_connection()

        # 환경 변수 복원
        for key, value in original_env.items():
            if value is not None:
                os.environ[key] = value
            elif key in os.environ:
                del os.environ[key]

        # 모듈 다시 로드하여 원래 설정으로 복원
        importlib.reload(db_module)

        if success:
            return {
                "success": True,
                "message": "데이터베이스 연결 성공"
            }
        else:
            raise HTTPException(status_code=500, detail="데이터베이스 연결 실패")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"연결 테스트 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"연결 테스트 실패: {str(e)}")


@router.post("/password")
async def update_database_password(
    password: str,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """데이터베이스 비밀번호 업데이트 (환경 변수에만 저장, .env 파일에는 저장 안함)"""
    logger.info(f"데이터베이스 비밀번호 업데이트: user={current_user.username}")

    try:
        os.environ["MSSQL_PASSWORD"] = password
        logger.info("데이터베이스 비밀번호 세션에 저장됨 (재시작 시 삭제됨)")

        return {
            "message": "비밀번호가 현재 세션에 저장되었습니다. 애플리케이션 재시작 시 재입력이 필요합니다."
        }

    except Exception as e:
        logger.error(f"비밀번호 업데이트 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"비밀번호 업데이트 실패: {str(e)}")


@router.get("/info")
async def get_database_status(
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """데이터베이스 정보 및 상태 조회"""
    logger.info(f"데이터베이스 정보 조회: user={current_user.username}")

    try:
        info = get_database_info()
        info["db_type"] = DB_TYPE

        return info

    except Exception as e:
        logger.error(f"데이터베이스 정보 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"정보 조회 실패: {str(e)}")


__all__ = ["router"]
