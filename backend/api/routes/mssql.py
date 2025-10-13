"""MSSQL 메타데이터 및 테이블 인덱스 라우터."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend import database
from backend.api.schemas import AuthenticatedUser, DatabaseMetadataResponse
from backend.api.security import require_auth
from backend.api.services.master_data_service import master_data_service
from common.logger import get_logger

router = APIRouter(prefix="/api/mssql", tags=["mssql"])
logger = get_logger("api.mssql.metadata")


@router.get("/metadata", response_model=DatabaseMetadataResponse, status_code=status.HTTP_200_OK)
async def fetch_mssql_metadata(
    table: str | None = Query(None, description="메타데이터를 조회할 테이블 또는 뷰 이름"),
    current_user: AuthenticatedUser = Depends(require_auth),
) -> DatabaseMetadataResponse:
    """지정된 MSSQL 테이블(또는 뷰)의 컬럼 메타데이터를 조회한다."""

    try:
        payload = master_data_service.get_database_metadata(table=table)
        logger.info(
            "mssql.metadata",
            extra={"username": current_user.username, "table": payload.get("table"), "column_count": len(payload.get("columns", []))},
        )
        return DatabaseMetadataResponse(**payload)
    except Exception as exc:
        logger.exception("MSSQL 메타데이터 조회 실패: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="MSSQL 메타데이터를 불러오지 못했습니다.")


@router.get("/tables", response_model=List[str], status_code=status.HTTP_200_OK)
async def list_mssql_tables(
    schema: str | None = Query(None, description="스키마 필터 (미지정 시 모든 스키마)"),
    current_user: AuthenticatedUser = Depends(require_auth),
) -> List[str]:
    """사용 가능한 테이블/뷰 목록을 반환한다."""

    try:
        tables = database.list_tables(schema=schema)
        logger.info(
            "mssql.tables",
            extra={"username": current_user.username, "schema": schema, "count": len(tables)},
        )
        return tables
    except Exception as exc:
        logger.exception("MSSQL 테이블 조회 실패: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="테이블 목록을 불러오지 못했습니다.")


__all__ = ["router"]
