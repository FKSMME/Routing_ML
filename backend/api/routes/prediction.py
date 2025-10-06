"""FastAPI 라우터 정의."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from backend.api.config import get_settings
from backend.api.schemas import (
    AuthenticatedUser,
    CandidateSaveRequest,
    CandidateSaveResponse,
    HealthResponse,
    PredictionRequest,
    PredictionResponse,
    RoutingInterfaceRequest,
    RoutingInterfaceResponse,
    RoutingSummary,
    GroupRecommendationRequest,
    GroupRecommendationResponse,
    RuleValidationRequest,
    RuleValidationResponse,
    SimilaritySearchRequest,
    SimilaritySearchResponse,
    TimeSummaryRequest,
    TimeSummaryResponse,
    OperationStep,
)
from backend.api.services.prediction_service import prediction_service
from backend.api.security import require_auth
from backend.models.routing_groups import RoutingGroup, session_scope
from common.logger import get_logger

router = APIRouter(prefix="/api", tags=["routing-ml"])
logger = get_logger("api.routes")
settings = get_settings()
audit_logger = get_logger("api.audit", log_dir=settings.audit_log_dir, use_json=True)


def _safe_float(value: Any) -> Optional[float]:
    """Convert arbitrary numeric input to float if possible."""

    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return float(text)
        except ValueError:
            return None
    return None


def _build_operation_steps(raw_steps: List[Dict[str, Any]]) -> List[OperationStep]:
    """Transform stored routing group steps into OperationStep payloads."""

    operations: List[OperationStep] = []
    for raw in sorted(raw_steps, key=lambda step: step.get("seq", 0) or 0):
        seq_value = raw.get("seq") or raw.get("proc_seq")
        try:
            proc_seq = int(seq_value)
        except (TypeError, ValueError):
            continue

        process_code = raw.get("process_code") or raw.get("PROC_CD") or raw.get("job_cd")
        description = raw.get("description")
        metadata = raw.get("metadata") if isinstance(raw.get("metadata"), dict) else {}
        if not description and isinstance(metadata, dict):
            description = metadata.get("description")

        operations.append(
            OperationStep(
                proc_seq=proc_seq,
                job_cd=str(process_code).strip() if process_code else None,
                job_nm=str(description).strip() if description else None,
                mach_worked_hours=_safe_float(raw.get("duration_min")),
                setup_time=_safe_float(raw.get("setup_time")),
                wait_time=_safe_float(raw.get("wait_time")),
            )
        )
    return operations


# Health endpoint moved to backend/api/routes/health.py for comprehensive monitoring


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
            feature_weights=request.feature_weights,
            weight_profile=request.weight_profile,
            with_visualization=request.with_visualization,
        )
        exported_files: List[str] = []
        export_errors: List[Dict[str, str]] = []
        if request.export_formats:
            exported_files, export_errors = prediction_service.export_predictions(
                items,
                candidates,
                request.export_formats,
            )
            if exported_files:
                metrics["exported_files"] = exported_files
            if export_errors:
                metrics["export_errors"] = export_errors
        audit_logger.info(
            "predict",
            extra={
                "username": current_user.username,
                "requested_items": request.item_codes,
                "returned_candidates": len(candidates),
                "threshold": metrics.get("threshold"),
                "exported_files": exported_files,
                "export_errors": export_errors,
            },
        )
        return PredictionResponse(items=items, candidates=candidates, metrics=metrics)
    except FileNotFoundError as exc:
        logger.error("모델 경로 오류: %s", exc)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - 예외 포착
        logger.exception("예측 처리 실패")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post(
    "/similarity/search",
    response_model=SimilaritySearchResponse,
    summary="유사 품목 후보 검색",
)
async def similarity_search(
    request: SimilaritySearchRequest,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> SimilaritySearchResponse:
    """품목별 유사 후보를 조회한다."""
    try:
        response = prediction_service.search_similar_items(request)
        audit_logger.info(
            "similarity.search",
            extra={
                "username": current_user.username,
                "items": request.item_codes,
                "total_matches": response.metrics.get("total_matches"),
            },
        )
        return response
    except FileNotFoundError as exc:
        logger.error("모델 경로 오류: %s", exc)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - 방어
        logger.exception("유사도 검색 실패")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post(
    "/groups/recommendations",
    response_model=GroupRecommendationResponse,
    summary="품목 그룹 추천",
)
async def group_recommendations(
    request: GroupRecommendationRequest,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> GroupRecommendationResponse:
    """예측 결과와 매니페스트를 바탕으로 그룹을 추천한다."""
    try:
        response = prediction_service.recommend_groups(request)
        audit_logger.info(
            "groups.recommend",
            extra={
                "username": current_user.username,
                "item_code": request.item_code,
                "count": len(response.recommendations),
            },
        )
        return response
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        logger.exception("그룹 추천 실패")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post(
    "/routing/interface",
    response_model=RoutingInterfaceResponse,
    summary="라우팅 그룹 ERP 내보내기",
)
async def trigger_routing_interface(
    payload: RoutingInterfaceRequest,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RoutingInterfaceResponse:
    """Trigger ERP export payload creation for a saved routing group."""

    with session_scope() as session:
        group: Optional[RoutingGroup] = session.get(RoutingGroup, payload.group_id)
        if group is None or group.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="요청한 라우팅 그룹을 찾을 수 없습니다",
            )
        if group.owner != current_user.username and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="그룹에 접근할 권한이 없습니다",
            )
        snapshot = {
            "id": str(group.id),
            "group_name": group.group_name,
            "version": group.version,
            "item_codes": list(group.item_codes or []),
            "steps": [dict(step) for step in group.steps or []],
            "erp_required": bool(group.erp_required),
        }

    if not snapshot["erp_required"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="ERP 인터페이스 옵션이 비활성화된 그룹입니다",
        )
    if not snapshot["item_codes"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="라우팅 그룹에 품목 코드가 없습니다",
        )

    operations = _build_operation_steps(snapshot["steps"])
    if not operations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ERP 내보내기에 사용할 공정 단계가 없습니다",
        )

    routings: List[RoutingSummary] = []
    for item_code in snapshot["item_codes"]:
        cloned_ops = [OperationStep(**operation.dict()) for operation in operations]
        summary = RoutingSummary(
            item_code=item_code,
            candidate_id=snapshot["id"],
            routing_signature=f"group:{snapshot['id']}:v{snapshot['version']}",
            priority="routing-group",
            similarity_tier="manual",
            operations=cloned_ops,
        )
        summary.generated_at = datetime.utcnow().isoformat()
        routings.append(summary)

    formats = [fmt for fmt in (payload.export_formats or []) if isinstance(fmt, str) and fmt.strip()]
    if "erp" not in {fmt.lower() for fmt in formats}:
        formats.append("erp")

    try:
        exported_files, export_errors = prediction_service.export_predictions(
            routings, [], formats
        )
    except FileNotFoundError as exc:
        logger.error("ERP 내보내기 경로 오류: %s", exc)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - 방어
        logger.exception("ERP 내보내기 실패")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    if export_errors:
        logger.warning(
            "ERP 내보내기 중 일부 파일 저장 실패", extra={"errors": export_errors}
        )

    erp_path = next(
        (path for path in exported_files if Path(path).name.startswith("routing_erp_")),
        None,
    )
    if erp_path is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ERP 인터페이스가 비활성화되어 있거나 파일 생성에 실패했습니다",
        )

    reason = (payload.reason or "save").strip() or "save"
    audit_logger.info(
        "routing.interface",
        extra={
            "username": current_user.username,
            "group_id": snapshot["id"],
            "group_name": snapshot["group_name"],
            "item_codes": snapshot["item_codes"],
            "exported_files": exported_files,
            "erp_path": erp_path,
            "reason": reason,
        },
    )

    message = f"ERP 내보내기 완료: {erp_path}"
    return RoutingInterfaceResponse(
        group_id=snapshot["id"],
        exported_files=exported_files,
        erp_path=erp_path,
        message=message,
    )


@router.post(
    "/time/summary",
    response_model=TimeSummaryResponse,
    summary="공정 시간 요약",
)
async def time_summary(
    request: TimeSummaryRequest,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> TimeSummaryResponse:
    """공정 데이터를 기반으로 리드타임을 집계한다."""
    response = prediction_service.summarize_process_times(request)
    audit_logger.info(
        "time.summary",
        extra={
            "username": current_user.username,
            "item_code": request.item_code,
            "process_count": response.process_count,
        },
    )
    return response


@router.post(
    "/rules/validate",
    response_model=RuleValidationResponse,
    summary="공정 규칙 검증",
)
async def validate_rules(
    request: RuleValidationRequest,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> RuleValidationResponse:
    """매니페스트 규칙을 기반으로 공정 데이터를 검증한다."""
    response = prediction_service.validate_rules(request)
    audit_logger.info(
        "rules.validate",
        extra={
            "username": current_user.username,
            "item_code": request.item_code,
            "evaluated": response.evaluated_rules,
            "violations": len(response.violations),
        },
    )
    return response


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
