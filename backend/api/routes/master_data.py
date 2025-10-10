"""Master data 관련 API 라우터."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse

from backend.api.config import get_settings
from backend.api.schemas import (
    AuthenticatedUser,
    MasterDataItemResponse,
    MasterDataLogsResponse,
    MasterDataTreeResponse,
)
from backend.api.security import require_auth
from backend.api.services.master_data_service import master_data_service
from common.logger import get_logger

router = APIRouter(prefix="/api/master-data", tags=["master-data"])
settings = get_settings()
audit_logger = get_logger("api.audit.master_data", log_dir=settings.audit_log_dir, use_json=True)
logger = get_logger("api.master_data")


@router.get("/tree", response_model=MasterDataTreeResponse)
async def get_master_data_tree(
    query: str | None = Query(None, description="품목 검색어"),
    parent_type: Literal["group", "family"] | None = Query(None, description="상위 노드 유형"),
    parent_id: str | None = Query(None, description="상위 노드 식별자"),
    current_user: AuthenticatedUser = Depends(require_auth),
) -> MasterDataTreeResponse:
    """기준정보 트리를 반환한다 (주요 데이터소스: MSSQL, 필요 시 Access 폴백)."""

    try:
        data = master_data_service.get_tree(query=query, parent_type=parent_type, parent_id=parent_id)
        audit_logger.info(
            "master_data.tree",
            extra={
                "username": current_user.username,
                "query": query,
                "filtered_items": data.get("filtered_items"),
            },
        )
        return MasterDataTreeResponse(**data)
    except Exception as exc:  # pragma: no cover - 예외 발생 시 상세 로깅
        logger.exception("/master-data/tree 조회 실패: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="기준정보를 불러오지 못했습니다.")


@router.get("/items/{item_code}", response_model=MasterDataItemResponse)
async def get_master_data_item(
    item_code: str,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> MasterDataItemResponse:
    """특정 품목의 기준정보 행렬을 반환한다 (MSSQL 기본, Access 폴백 지원)."""

    try:
        data = master_data_service.get_item_matrix(item_code)
        audit_logger.info(
            "master_data.matrix",
            extra={
                "username": current_user.username,
                "item_code": item_code,
                "record_count": data.get("record_count"),
            },
        )
        return MasterDataItemResponse(**data)
    except ValueError as exc:
        logger.warning("/master-data/items/%s 404: %s", item_code, exc)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception:  # pragma: no cover
        logger.exception("/master-data/items/%s 조회 실패", item_code)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="품목 정보를 불러오지 못했습니다.")


@router.get("/logs", response_model=MasterDataLogsResponse)
async def get_master_data_logs(
    limit: int = Query(5, ge=1, le=50),
    current_user: AuthenticatedUser = Depends(require_auth),
) -> MasterDataLogsResponse:
    """감사 로그 및 연결 상태를 반환한다."""

    data = master_data_service.get_logs(limit=limit)
    audit_logger.info(
        "master_data.logs",
        extra={
            "username": current_user.username,
            "limit": limit,
            "returned_logs": len(data.get("logs", [])),
        },
    )
    return MasterDataLogsResponse(**data)


@router.get("/logs/download")
async def download_master_data_log(
    current_user: AuthenticatedUser = Depends(require_auth),
) -> FileResponse:
    """감사 로그 전체 파일을 다운로드한다."""

    log_file = master_data_service.get_log_path()
    if not log_file.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="로그 파일이 존재하지 않습니다.")

    audit_logger.info(
        "master_data.logs.download",
        extra={"username": current_user.username, "file": str(log_file)},
    )

    return FileResponse(
        path=log_file,
        media_type="text/plain",
        filename=log_file.name,
    )

