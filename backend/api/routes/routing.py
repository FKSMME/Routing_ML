"""라우팅 출력 프로파일 API."""
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends

from backend.api.schemas import AuthenticatedUser
from backend.api.security import require_auth
from common.logger import get_logger

router = APIRouter(prefix="/api/routing", tags=["routing"])
logger = get_logger("api.routing")


@router.get("/output-profiles")
async def get_output_profiles(
    current_user: AuthenticatedUser = Depends(require_auth),
) -> List[Dict[str, Any]]:
    """라우팅 출력 프로파일 목록 조회"""
    logger.debug("출력 프로파일 조회", extra={"username": current_user.username})
    return [
        {
            "id": "default",
            "name": "기본 프로파일",
            "description": "표준 라우팅 출력",
            "columns": ["ITEM_CD", "PROC_CD", "SEQ_NO", "RUN_TIME"],
        }
    ]


__all__ = ["router"]
