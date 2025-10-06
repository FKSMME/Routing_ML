"""Health Check 및 Metrics 엔드포인트."""
from __future__ import annotations

import time
from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, Response
from pydantic import BaseModel

from backend.api.schemas import HealthResponse
from common.logger import get_logger

logger = get_logger("api.health")

router = APIRouter(prefix="/api", tags=["health"])

# 시작 시간 기록
START_TIME = time.time()

# 메트릭 저장
request_count = 0
error_count = 0
prediction_count = 0
prediction_latency_sum = 0.0


class MetricsResponse(BaseModel):
    """메트릭 응답 모델."""
    uptime_seconds: float
    request_count: int
    error_count: int
    prediction_count: int
    avg_prediction_latency: float


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Health Check 엔드포인트.

    Kubernetes, Docker, Prometheus 등에서 사용.

    Returns:
        HealthResponse: 서비스 상태 정보
    """
    global request_count
    request_count += 1

    uptime = time.time() - START_TIME

    return HealthResponse(
        status="healthy",
        version="4.0.0",
        uptime_seconds=round(uptime, 2),
        timestamp=datetime.utcnow().isoformat()
    )


@router.get("/metrics")
async def metrics() -> Response:
    """
    Prometheus 메트릭 엔드포인트.

    Prometheus 형식으로 메트릭을 반환.

    Returns:
        Response: Prometheus 텍스트 형식 메트릭
    """
    uptime = time.time() - START_TIME
    avg_latency = (
        prediction_latency_sum / prediction_count
        if prediction_count > 0
        else 0.0
    )

    metrics_text = f"""# HELP routing_ml_uptime_seconds Application uptime in seconds
# TYPE routing_ml_uptime_seconds gauge
routing_ml_uptime_seconds {uptime:.2f}

# HELP routing_ml_requests_total Total number of HTTP requests
# TYPE routing_ml_requests_total counter
routing_ml_requests_total {request_count}

# HELP routing_ml_errors_total Total number of errors
# TYPE routing_ml_errors_total counter
routing_ml_errors_total {error_count}

# HELP routing_ml_predictions_total Total number of predictions
# TYPE routing_ml_predictions_total counter
routing_ml_predictions_total {prediction_count}

# HELP routing_ml_prediction_latency_avg Average prediction latency in seconds
# TYPE routing_ml_prediction_latency_avg gauge
routing_ml_prediction_latency_avg {avg_latency:.4f}
"""

    return Response(
        content=metrics_text,
        media_type="text/plain; version=0.0.4"
    )


@router.get("/metrics/json", response_model=MetricsResponse)
async def metrics_json() -> MetricsResponse:
    """
    JSON 형식 메트릭 엔드포인트.

    Grafana 또는 커스텀 대시보드에서 사용.

    Returns:
        MetricsResponse: JSON 형식 메트릭
    """
    uptime = time.time() - START_TIME
    avg_latency = (
        prediction_latency_sum / prediction_count
        if prediction_count > 0
        else 0.0
    )

    return MetricsResponse(
        uptime_seconds=round(uptime, 2),
        request_count=request_count,
        error_count=error_count,
        prediction_count=prediction_count,
        avg_prediction_latency=round(avg_latency, 4)
    )


def increment_request_count() -> None:
    """HTTP 요청 카운트 증가."""
    global request_count
    request_count += 1


def increment_error_count() -> None:
    """에러 카운트 증가."""
    global error_count
    error_count += 1


def record_prediction(latency: float) -> None:
    """
    예측 메트릭 기록.

    Args:
        latency: 예측 소요 시간 (초)
    """
    global prediction_count, prediction_latency_sum
    prediction_count += 1
    prediction_latency_sum += latency

    logger.info(
        f"Prediction recorded: count={prediction_count}, "
        f"latency={latency:.4f}s, "
        f"avg={prediction_latency_sum/prediction_count:.4f}s"
    )


__all__ = [
    "router",
    "increment_request_count",
    "increment_error_count",
    "record_prediction",
]
