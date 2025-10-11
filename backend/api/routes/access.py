"""Access metadata and introspection routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status

from backend.api.schemas import AccessMetadataResponse, AuthenticatedUser
from backend.api.security import require_auth
from backend.api.services.master_data_service import master_data_service
from common.logger import get_logger

router = APIRouter(prefix="/api/access", tags=["access"])
logger = get_logger("api.access")


@router.get("/metadata", response_model=AccessMetadataResponse, status_code=status.HTTP_200_OK)
async def fetch_access_metadata(
    table: str | None = Query(None, description="Access table name to inspect"),
    path_param: str | None = Query(None, alias="path", description="Absolute path to the Access database"),
    current_user: AuthenticatedUser = Depends(require_auth),
) -> AccessMetadataResponse:
    data = master_data_service.get_access_metadata(table=table, path=path_param)
    logger.info(
        "access.metadata",
        extra={
            "username": current_user.username,
            "table": data.get("table"),
            "path": data.get("path"),
            "column_count": len(data.get("columns", [])),
        },
    )
    return AccessMetadataResponse(**data)


__all__ = ["router"]
