from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.api.config import get_settings
from backend.api.schemas import AuthenticatedUser
from backend.api.security import require_auth
from backend.feature_weights import FeatureWeightManager
from common.logger import get_logger
from models.manifest import read_model_manifest

router = APIRouter(prefix="/api/training", tags=["training"])
logger = get_logger("api.training.features")


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


__all__ = ["router"]
