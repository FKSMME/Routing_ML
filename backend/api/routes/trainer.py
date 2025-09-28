"""학습 제어 API."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.api.config import get_settings
from backend.api.schemas import AuthenticatedUser
from backend.api.security import require_auth
from backend.api.services.training_service import training_service
from backend.maintenance.model_registry import (
    ModelVersion,
    VersionNotFoundError,
    activate_version,
    list_versions,
)
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


class ModelVersionModel(BaseModel):
    version_name: str
    artifact_dir: str
    manifest_path: str
    status: str
    active_flag: bool
    requested_by: Optional[str]
    created_at: str
    trained_at: Optional[str]
    activated_at: Optional[str]
    updated_at: Optional[str]

    @classmethod
    def from_domain(cls, version: ModelVersion) -> "ModelVersionModel":
        return cls(**version.to_dict())


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


@router.get("/versions", response_model=List[ModelVersionModel])
async def get_model_versions(
    limit: Optional[int] = None,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> List[ModelVersionModel]:
    if limit is not None and limit <= 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="limit must be positive")

    registry_path = settings.model_registry_path
    versions = list_versions(db_path=registry_path, limit=limit)
    logger.debug(
        "모델 버전 목록 조회",
        extra={"username": current_user.username, "count": len(versions)},
    )
    return [ModelVersionModel.from_domain(version) for version in versions]


@router.post("/versions/{version_name}/activate", response_model=ModelVersionModel)
async def activate_model_version(
    version_name: str,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> ModelVersionModel:
    try:
        record = activate_version(db_path=settings.model_registry_path, version_name=version_name)
    except VersionNotFoundError as exc:
        logger.warning(
            "존재하지 않는 모델 버전 활성화 시도",
            extra={"username": current_user.username, "version": version_name},
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    logger.info(
        "모델 버전 활성화",
        extra={"username": current_user.username, "version": version_name},
    )
    return ModelVersionModel.from_domain(record)


__all__ = ["router"]
