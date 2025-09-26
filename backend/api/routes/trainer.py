"""학습 제어 API."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.api.config import get_settings
from backend.api.schemas import AuthenticatedUser
from backend.api.security import require_auth
from backend.api.services.training_service import training_service
from common.logger import get_logger

router = APIRouter(prefix="/api/trainer", tags=["trainer"])
settings = get_settings()
logger = get_logger("api.trainer")


class TrainingRequest(BaseModel):
    version_label: Optional[str] = Field(None, max_length=64)
    projector_metadata: Optional[List[str]] = None
    dry_run: bool = False


class TrainingStatusModel(BaseModel):
    job_id: Optional[str]
    status: str
    started_at: Optional[str]
    finished_at: Optional[str]
    progress: int
    message: Optional[str] = None
    version_path: Optional[str] = None
    metrics: Dict[str, Any] = Field(default_factory=dict)


@router.get("/status", response_model=TrainingStatusModel)
async def get_training_status(
    current_user: AuthenticatedUser = Depends(require_auth),
) -> TrainingStatusModel:
    status_payload = training_service.get_status()
    logger.debug("학습 상태 조회", extra={"username": current_user.username, "status": status_payload.get("status")})
    return TrainingStatusModel(**status_payload)


@router.post("/run", response_model=TrainingStatusModel, status_code=status.HTTP_202_ACCEPTED)
async def run_training(
    payload: TrainingRequest,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> TrainingStatusModel:
    try:
        status_payload = training_service.start_training(
            requested_by=current_user.username,
            version_label=payload.version_label,
            projector_metadata=payload.projector_metadata,
            dry_run=payload.dry_run,
        )
        logger.info(
            "학습 요청 수락",
            extra={"username": current_user.username, "job_id": status_payload.get("job_id")},
        )
        return TrainingStatusModel(**status_payload)
    except RuntimeError as exc:
        logger.warning("학습 요청 거부", extra={"reason": str(exc)})
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


__all__ = ["router"]
