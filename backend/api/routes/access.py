"""MSSQL data source metadata and introspection routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status

from backend.api.schemas import AuthenticatedUser, DataSourceMetadataResponse
from backend.api.security import require_auth
from backend.api.services.master_data_service import master_data_service
from common.logger import get_logger

router = APIRouter(prefix="/api/datasource", tags=["datasource"])
logger = get_logger("api.datasource")


@router.get("/metadata", response_model=DataSourceMetadataResponse, status_code=status.HTTP_200_OK)
async def fetch_access_metadata(
    table: str | None = Query(None, description="MSSQL view name to inspect"),
    path_param: str | None = Query(None, alias="path", description="MSSQL server address"),
    current_user: AuthenticatedUser = Depends(require_auth),
) -> DataSourceMetadataResponse:
    data = master_data_service.get_access_metadata(table=table, path=path_param)
    logger.info(
        "datasource.metadata",
        extra={
            "username": current_user.username,
            "table": data.get("table"),
            "path": data.get("path"),
            "column_count": len(data.get("columns", [])),
        },
    )
    return DataSourceMetadataResponse(**data)


__all__ = ["router"]
