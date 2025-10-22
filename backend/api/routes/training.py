from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.api.config import get_settings
from backend.api.schemas import AuthenticatedUser
from backend.api.security import require_auth
from backend.feature_weights import FeatureWeightManager
from backend.iter_training.worker import TrainingWorker
from backend.iter_training.models import JobStatus
from common.logger import get_logger
from models.manifest import read_model_manifest

router = APIRouter(prefix="/api/training", tags=["training"])
logger = get_logger("api.training.features")

# Global worker instance for iterative training
_training_worker: Optional[TrainingWorker] = None


def get_training_worker() -> TrainingWorker:
    """Get or create training worker instance."""
    global _training_worker
    if _training_worker is None:
        _training_worker = TrainingWorker(jobs_dir="data/training_jobs")
        logger.info("TrainingWorker initialized")
    return _training_worker


class TrainingFeatureModel(BaseModel):
    id: str
    label: str
    weight: float
    enabled: bool
    description: str | None = None


class TrainingFeaturePatchRequest(BaseModel):
    features: Dict[str, bool] = Field(default_factory=dict)

    class Config:
        extra = "forbid"


class TrainingFeaturePatchResponse(BaseModel):
    updated: List[str]
    disabled: List[str] = Field(default_factory=list)
    timestamp: str


# ========================================
# Iterative Training Models
# ========================================


class StartTrainingRequest(BaseModel):
    """Request model for starting training."""
    cycle_id: Optional[str] = None
    sample_size: int = Field(500, ge=10, le=10000)
    strategy: str = Field("stratified", pattern="^(random|stratified|recent_bias)$")


class StartTrainingResponse(BaseModel):
    """Response model for start training."""
    job_id: str
    status: str
    message: str


class JobStatusResponse(BaseModel):
    """Response model for job status."""
    job_id: str
    status: str
    progress: float
    current_step: str
    logs: List[Dict[str, str]]
    started_at: Optional[str]
    updated_at: Optional[str]
    completed_at: Optional[str]
    error_message: Optional[str]
    result: Optional[Dict[str, any]]


class JobListResponse(BaseModel):
    """Response model for job list."""
    jobs: List[JobStatusResponse]
    total: int


_HUMANIZE_PATTERN = re.compile(r"[A-Z]+(?=[A-Z][a-z]|[0-9]|$)|[A-Z]?[a-z]+|[0-9]+")


def _iter_model_roots() -> Iterable[Path]:
    settings = get_settings()
    candidates: List[Path] = []
    if settings.model_directory:
        candidates.append(settings.model_directory)
    candidates.extend([Path("models/default"), Path("models")])

    seen: set[Path] = set()
    for candidate in candidates:
        base = Path(candidate).expanduser()
        if base.suffix.lower() == ".json":
            base = base.parent
        base = base.resolve()
        if base in seen:
            continue
        seen.add(base)
        yield base


def _load_feature_manager() -> FeatureWeightManager:
    last_error: Exception | None = None
    for root in _iter_model_roots():
        if not root.exists():
            continue
        try:
            manifest = read_model_manifest(root, strict=False)
        except Exception as exc:  # pragma: no cover - diagnostics only
            logger.debug("Manifest load skipped", extra={"root": str(root), "error": str(exc)})
            manifest = None
        if manifest is not None:
            try:
                return FeatureWeightManager(manifest=manifest)
            except Exception as exc:  # pragma: no cover - diagnostics only
                last_error = exc
                logger.debug(
                    "FeatureWeightManager init (manifest) failed",
                    extra={"root": str(root), "error": str(exc)},
                )
                continue
        try:
            return FeatureWeightManager(root)
        except Exception as exc:  # pragma: no cover - diagnostics only
            last_error = exc
            logger.debug(
                "FeatureWeightManager init (direct) failed",
                extra={"root": str(root), "error": str(exc)},
            )
            continue
    logger.error(
        "Unable to resolve feature weight storage",
        extra={"error": str(last_error) if last_error else None},
    )
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Feature weight store unavailable")


def _humanize_feature_name(feature_id: str) -> str:
    if "_" in feature_id or "-" in feature_id:
        label = feature_id.replace("_", " ").replace("-", " ")
        if label.replace(" ", "").isupper():
            return label
    tokens = _HUMANIZE_PATTERN.findall(feature_id)
    if tokens:
        return " ".join(tokens)
    return feature_id


def _feature_group_lookup(manager: FeatureWeightManager) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for group, features in manager.FEATURE_GROUPS.items():
        for feature in features:
            mapping[feature] = group
    return mapping


@router.get("/features", response_model=List[TrainingFeatureModel])
async def list_training_features(
    current_user: AuthenticatedUser = Depends(require_auth),
) -> List[TrainingFeatureModel]:
    manager = _load_feature_manager()
    logger.debug("Feature list requested", extra={"username": current_user.username})

    feature_groups = _feature_group_lookup(manager)
    feature_ids = set(manager.feature_weights.keys()) | set(manager.active_features.keys())
    payload: List[TrainingFeatureModel] = []

    for feature_id in feature_ids:
        weight = float(manager.feature_weights.get(feature_id, 1.0))
        enabled = bool(
            manager.active_features.get(
                feature_id,
                manager.DEFAULT_ACTIVE_FEATURES.get(feature_id, True),
            )
        )
        payload.append(
            TrainingFeatureModel(
                id=feature_id,
                label=_humanize_feature_name(feature_id),
                weight=weight,
                enabled=enabled,
                description=feature_groups.get(feature_id),
            )
        )

    payload.sort(key=lambda item: (-item.weight, item.id))
    return payload


@router.patch("/features", response_model=TrainingFeaturePatchResponse)
async def update_training_features(
    request: TrainingFeaturePatchRequest,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> TrainingFeaturePatchResponse:
    if not request.features:
        timestamp = datetime.now(timezone.utc).isoformat()
        return TrainingFeaturePatchResponse(updated=[], disabled=[], timestamp=timestamp)

    manager = _load_feature_manager()
    normalized = {feature_id: bool(enabled) for feature_id, enabled in request.features.items()}

    manager.update_active_features(normalized)
    logger.info(
        "Feature toggles updated",
        extra={"username": current_user.username, "count": len(normalized)},
    )

    timestamp = datetime.now(timezone.utc).isoformat()
    updated = sorted([feature_id for feature_id, enabled in normalized.items() if enabled])
    disabled = sorted([feature_id for feature_id, enabled in normalized.items() if not enabled])

    return TrainingFeaturePatchResponse(updated=updated, disabled=disabled, timestamp=timestamp)


# ========================================
# Iterative Training Endpoints
# ========================================


def _dummy_training_function(job_id: str, params: Dict, worker: TrainingWorker):
    """Dummy training function for Phase 2.

    This is a placeholder. In Phase 3, this will be replaced with
    actual training logic that calls trainer.train_all_models().
    """
    import time
    from backend.iter_training.trainer import train_all_models

    # For Phase 2, we'll just simulate training
    items = []  # In Phase 3, this will be populated from sampler

    try:
        worker.update_progress(job_id, 10, "Sampling items...", log_message="Starting training job")

        # Placeholder: In Phase 3, call actual training
        # all_candidates, best_model = train_all_models(items, progress_callback=...)

        worker.update_progress(job_id, 50, "Training models...", log_message="Training in progress")
        time.sleep(2)  # Simulate work

        worker.update_progress(job_id, 90, "Deploying model...", log_message="Deployment phase")
        time.sleep(1)

        # Return placeholder result
        return {
            "job_id": job_id,
            "status": "SUCCESS",
            "message": "Training completed (Phase 2 placeholder)",
            "best_model": "baseline",
            "improvement": 0.0,
        }

    except Exception as e:
        worker.update_progress(
            job_id,
            0,
            f"Training failed: {str(e)}",
            status=JobStatus.FAILED,
            log_message=f"Error: {str(e)}",
        )
        raise


@router.post("/start", response_model=StartTrainingResponse)
async def start_training(
    request: StartTrainingRequest,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> StartTrainingResponse:
    """Start a background training job.

    This endpoint starts a new iterative training job in the background.
    The job runs asynchronously and can be monitored via /jobs/{job_id}/status.

    Args:
        request: Training parameters (sample_size, strategy, etc.)
        current_user: Authenticated user

    Returns:
        Job ID and initial status
    """
    worker = get_training_worker()

    # Generate job ID
    job_id = request.cycle_id or f"job_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"

    logger.info(
        "Starting training job",
        extra={
            "job_id": job_id,
            "username": current_user.username,
            "sample_size": request.sample_size,
            "strategy": request.strategy,
        },
    )

    try:
        # Start background training
        worker.start_training(
            job_id=job_id,
            training_func=_dummy_training_function,
            job_params={
                "sample_size": request.sample_size,
                "strategy": request.strategy,
                "username": current_user.username,
            },
        )

        return StartTrainingResponse(
            job_id=job_id,
            status="STARTED",
            message=f"Training job started successfully (sample_size={request.sample_size}, strategy={request.strategy})",
        )

    except ValueError as e:
        # Job already exists
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to start training job: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to start training: {str(e)}")


@router.get("/jobs/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> JobStatusResponse:
    """Get status of a training job.

    Args:
        job_id: Job identifier
        current_user: Authenticated user

    Returns:
        Current job status with progress and logs
    """
    worker = get_training_worker()

    try:
        state = worker.get_progress(job_id)

        return JobStatusResponse(
            job_id=state.job_id,
            status=state.status.value,
            progress=state.progress,
            current_step=state.current_step,
            logs=state.logs,
            started_at=state.started_at,
            updated_at=state.updated_at,
            completed_at=state.completed_at,
            error_message=state.error_message,
            result=state.result,
        )

    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job not found: {job_id}")
    except Exception as e:
        logger.error(f"Failed to get job status: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to get job status: {str(e)}")


@router.get("/jobs", response_model=JobListResponse)
async def list_jobs(
    limit: int = 100,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> JobListResponse:
    """List recent training jobs.

    Args:
        limit: Maximum number of jobs to return (default: 100)
        current_user: Authenticated user

    Returns:
        List of recent jobs with their statuses
    """
    worker = get_training_worker()

    try:
        jobs_states = worker.list_jobs(limit=limit)

        jobs = [
            JobStatusResponse(
                job_id=state.job_id,
                status=state.status.value,
                progress=state.progress,
                current_step=state.current_step,
                logs=state.logs[-5:] if state.logs else [],  # Last 5 logs only
                started_at=state.started_at,
                updated_at=state.updated_at,
                completed_at=state.completed_at,
                error_message=state.error_message,
                result=state.result,
            )
            for state in jobs_states
        ]

        return JobListResponse(jobs=jobs, total=len(jobs))

    except Exception as e:
        logger.error(f"Failed to list jobs: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to list jobs: {str(e)}")


@router.delete("/jobs/{job_id}")
async def cancel_job(
    job_id: str,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, str]:
    """Cancel a running training job.

    Args:
        job_id: Job identifier
        current_user: Authenticated user

    Returns:
        Cancellation status
    """
    worker = get_training_worker()

    logger.info(
        "Cancelling training job",
        extra={"job_id": job_id, "username": current_user.username},
    )

    try:
        cancelled = worker.cancel_job(job_id)

        if cancelled:
            return {"job_id": job_id, "status": "CANCELLED", "message": "Job cancelled successfully"}
        else:
            return {"job_id": job_id, "status": "NOT_RUNNING", "message": "Job is not running or already completed"}

    except Exception as e:
        logger.error(f"Failed to cancel job: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to cancel job: {str(e)}")


__all__ = ["router"]
