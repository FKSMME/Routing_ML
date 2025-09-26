"""FastAPI 라우터 정의."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from backend.api.config import get_settings
from backend.api.schemas import (
    AuthenticatedUser,
    CandidateSaveRequest,
    CandidateSaveResponse,
    HealthResponse,
    PredictionRequest,
    PredictionResponse,
)
from backend.api.services.prediction_service import prediction_service
from backend.api.security import require_auth
from common.logger import get_logger

router = APIRouter(prefix="/api", tags=["routing-ml"])
logger = get_logger("api.routes")
settings = get_settings()
audit_logger = get_logger("api.audit", log_dir=settings.audit_log_dir, use_json=True)


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """서비스 상태 확인."""
    logger.debug("/health 호출")
    return HealthResponse(status="ok")


@router.post("/predict", response_model=PredictionResponse)
async def predict(
    request: PredictionRequest,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> PredictionResponse:
    """라우팅 예측 엔드포인트."""
    try:
        logger.info(
            "예측 요청",
            extra={
                "username": current_user.username,
                "client_host": current_user.client_host,
                "items": request.item_codes,
            },
        )
        items, candidates, metrics = prediction_service.predict(
            request.item_codes,
            top_k=request.top_k or prediction_service.settings.default_top_k,
            similarity_threshold=request.similarity_threshold
            or prediction_service.settings.default_similarity_threshold,
            mode=request.mode,
        )
        audit_logger.info(
            "predict",
            extra={
                "username": current_user.username,
                "requested_items": request.item_codes,
                "returned_candidates": len(candidates),
                "threshold": metrics.get("threshold"),
            },
        )
        return PredictionResponse(items=items, candidates=candidates, metrics=metrics)
    except FileNotFoundError as exc:
        logger.error("모델 경로 오류: %s", exc)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - 예외 포착
        logger.exception("예측 처리 실패")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/candidates/save", response_model=CandidateSaveResponse)
async def save_candidate(
    request: CandidateSaveRequest,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> CandidateSaveResponse:
    """후보 라우팅 저장."""
    try:
        response = prediction_service.save_candidate(
            item_code=request.item_code,
            candidate_id=request.candidate_id,
            payload=request.payload,
        )
        audit_logger.info(
            "candidate.save",
            extra={
                "username": current_user.username,
                "item_code": request.item_code,
                "candidate_id": request.candidate_id,
                "saved_path": response.saved_path,
            },
        )
        return response
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        logger.exception("후보 저장 실패")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.get("/metrics")
async def get_metrics(current_user: AuthenticatedUser = Depends(require_auth)) -> dict:
    """마지막 예측 메트릭 반환."""
    metrics = prediction_service.latest_metrics()
    audit_logger.info(
        "metrics.read",
        extra={"username": current_user.username, "has_metrics": bool(metrics)},
    )
    return metrics
