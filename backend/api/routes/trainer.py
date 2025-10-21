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
    latest_version: Optional[Dict[str, Any]] = None


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


@router.post("/run", status_code=status.HTTP_202_ACCEPTED)
async def run_training(
    payload: TrainingRequest,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> TrainingStatusModel:
    """모델 학습을 시작합니다."""
    logger.info(
        "모델 학습 시작 요청",
        extra={
            "username": current_user.username,
            "version_label": payload.version_label,
            "dry_run": payload.dry_run,
        },
    )

    try:
        result = training_service.start_training(
            version_label=payload.version_label,
            projector_metadata=payload.projector_metadata or [],
            requested_by=current_user.username,
            dry_run=payload.dry_run,
        )

        logger.info(
            "모델 학습 시작됨",
            extra={"job_id": result.get("job_id"), "username": current_user.username},
        )

        return TrainingStatusModel(**result)
    except Exception as exc:
        logger.error(
            "모델 학습 시작 실패",
            extra={"username": current_user.username, "error": str(exc)},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"학습 시작 실패: {str(exc)}",
        )


@router.get("/versions", response_model=List[ModelVersionModel])
async def get_model_versions(
    limit: Optional[int] = None,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> List[ModelVersionModel]:
    if limit is not None and limit <= 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="limit must be positive")

    registry_url = settings.model_registry_url
    versions = list_versions(db_url=registry_url, limit=limit)
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
        record = activate_version(db_url=settings.model_registry_url, version_name=version_name)
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


@router.get("/metrics")
async def get_trainer_metrics(
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """학습 메트릭 조회"""
    logger.debug("학습 메트릭 조회", extra={"username": current_user.username})
    return {
        "total_samples": 0,
        "avg_similarity": 0.0,
        "training_time": 0.0,
        "model_size_mb": 0.0,
    }


@router.get("/runs")
async def get_trainer_runs(
    limit: int = 15,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> List[Dict[str, Any]]:
    """학습 실행 이력 조회"""
    logger.debug("학습 실행 이력 조회", extra={"username": current_user.username, "limit": limit})
    return []


__all__ = ["router"]
