"""Concept Drift Monitoring API Endpoints."""
from __future__ import annotations

from typing import Dict, Any

from fastapi import APIRouter, Depends
from backend.api.schemas import AuthenticatedUser
from backend.api.security import require_admin
from pydantic import BaseModel

from backend.ml.concept_drift_detector import get_drift_detector
from common.logger import get_logger

logger = get_logger("api.drift")

router = APIRouter(prefix="/api/drift", tags=["drift"])


class DriftStatusResponse(BaseModel):
    """Drift detection status response."""
    drift_detected: bool
    kl_divergence: float
    threshold: float
    buffer_size: int
    buffer_mean: float
    buffer_std: float
    should_retrain: bool


class DriftSummaryResponse(BaseModel):
    """Drift summary statistics response."""
    period_days: int
    drift_count: int
    max_kl_divergence: float
    avg_kl_divergence: float
    should_retrain: bool
    events: list[Dict[str, Any]]


@router.get("/status", response_model=DriftStatusResponse)
async def get_drift_status(_admin: AuthenticatedUser = Depends(require_admin)) -> DriftStatusResponse:
    """
    Get current concept drift status.

    Returns:
        Current drift detection status and metrics
    """
    detector = get_drift_detector()

    drift_detected, kl_div = detector.check_drift()

    import numpy as np
    buffer_array = np.array(detector.prediction_buffer) if detector.prediction_buffer else np.array([])

    return DriftStatusResponse(
        drift_detected=drift_detected,
        kl_divergence=kl_div,
        threshold=detector.threshold,
        buffer_size=len(detector.prediction_buffer),
        buffer_mean=float(buffer_array.mean()) if len(buffer_array) > 0 else 0.0,
        buffer_std=float(buffer_array.std()) if len(buffer_array) > 0 else 0.0,
        should_retrain=detector.should_retrain()
    )


@router.get("/summary", response_model=DriftSummaryResponse)
async def get_drift_summary(days: int = 7) -> DriftSummaryResponse:
    """
    Get drift summary for the last N days.

    Args:
        days: Number of days to look back (default: 7)

    Returns:
        Summary of drift events and statistics
    """
    detector = get_drift_detector()
    summary = detector.get_drift_summary(days=days)

    return DriftSummaryResponse(
        period_days=summary["period_days"],
        drift_count=summary["drift_count"],
        max_kl_divergence=summary["max_kl_divergence"],
        avg_kl_divergence=summary["avg_kl_divergence"],
        should_retrain=detector.should_retrain(),
        events=summary["events"]
    )


@router.post("/reset")
async def reset_drift_detector() -> Dict[str, str]:
    """
    Reset drift detector buffer.

    Should be called after model retraining.

    Returns:
        Confirmation message
    """
    detector = get_drift_detector()
    detector.reset_buffer()

    logger.info("Drift detector buffer reset via API")

    return {
        "message": "Drift detector buffer reset successfully",
        "timestamp": detector.drift_history[-1]["timestamp"] if detector.drift_history else None
    }


__all__ = ["router"]


