"""예측 서비스 레이어."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple
import json

import pandas as pd

from backend.api.config import get_settings
from backend.api.schemas import CandidateRouting, CandidateSaveResponse, RoutingSummary
from backend.predictor_ml import predict_items_with_ml_optimized
from backend.trainer_ml import load_optimized_model
from common.logger import get_logger

logger = get_logger("api.prediction")


class PredictionService:
    """FastAPI 라우터에서 사용하는 비즈니스 로직."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._model_lock: bool = False
        self._last_metrics: Dict[str, Any] = {}

    @property
    def model_dir(self) -> Path:
        return self.settings.model_directory

    def _ensure_model(self) -> None:
        """모델 디렉토리 유효성 검사."""
        if not self.model_dir.exists():
            raise FileNotFoundError(f"모델 디렉토리를 찾을 수 없습니다: {self.model_dir}")
        try:
            load_optimized_model(self.model_dir)
        except Exception as exc:  # pragma: no cover - 안전장치
            logger.error("모델 로드 실패", exc_info=exc)
            raise

    def predict(
        self,
        item_codes: Iterable[str],
        *,
        top_k: int,
        similarity_threshold: float,
        mode: str,
    ) -> Tuple[List[RoutingSummary], List[CandidateRouting], Dict[str, Any]]:
        """라우팅 예측 수행."""
        item_code_list = list(item_codes)
        logger.info(
            "[예측] item=%s, top_k=%s, similarity_threshold=%.2f, mode=%s",
            item_code_list,
            top_k,
            similarity_threshold,
            mode,
        )
        self._ensure_model()

        routing_df, candidates_df = predict_items_with_ml_optimized(
            item_code_list,
            self.model_dir,
            top_k=top_k,
            miss_thr=1.0 - similarity_threshold,
            mode=mode,
        )

        routing_payload = self._serialize_routing(routing_df)
        candidate_payload = self._serialize_candidates(candidates_df)

        metrics = {
            "requested_items": len(item_code_list),
            "returned_routings": len(routing_payload),
            "returned_candidates": len(candidate_payload),
            "threshold": similarity_threshold,
            "generated_at": datetime.utcnow().isoformat(),
        }
        self._last_metrics = metrics
        logger.info("[예측] 완료 - routings=%d candidates=%d", len(routing_payload), len(candidate_payload))
        return routing_payload, candidate_payload, metrics

    def save_candidate(self, item_code: str, candidate_id: str, payload: Dict[str, Any]) -> CandidateSaveResponse:
        """후보 라우팅 저장."""
        if not self.settings.enable_candidate_persistence:
            raise RuntimeError("후보 저장이 비활성화되어 있습니다")

        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        safe_item = item_code.replace("/", "-")
        filename = f"{safe_item}_{candidate_id}_{timestamp}.json"
        save_path = self.settings.candidate_store_dir / filename

        df = pd.DataFrame(payload.get("operations", []))
        data = {
            "item_code": item_code,
            "candidate_id": candidate_id,
            "saved_at": datetime.utcnow().isoformat(),
            "summary": payload.get("summary"),
            "operations": df.to_dict(orient="records"),
        }
        save_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        logger.info("[저장] %s 후보 저장 완료 -> %s", candidate_id, save_path)
        return CandidateSaveResponse(
            item_code=item_code,
            candidate_id= candidate_id,
            saved_path=str(save_path),
            saved_at=datetime.utcnow(),
        )

    def latest_metrics(self) -> Dict[str, Any]:
        """마지막 예측 메트릭 반환."""
        return self._last_metrics

    @staticmethod
    def _serialize_routing(df: pd.DataFrame) -> List[RoutingSummary]:
        if df is None or df.empty:
            return []
        grouped = df.groupby("ITEM_CD") if "ITEM_CD" in df.columns else [(None, df)]
        summaries: List[RoutingSummary] = []
        for item_cd, group in grouped:
            operations = group.to_dict(orient="records")
            summaries.append(
                RoutingSummary(
                    ITEM_CD=item_cd or (group["ITEM_CD"].iloc[0] if "ITEM_CD" in group.columns else ""),
                    CANDIDATE_ID=(
                        str(group["CANDIDATE_ID"].iloc[0])
                        if "CANDIDATE_ID" in group.columns and not group["CANDIDATE_ID"].isna().all()
                        else None
                    ),
                    operations=operations,
                )
            )
        return summaries

    @staticmethod
    def _serialize_candidates(df: pd.DataFrame) -> List[CandidateRouting]:
        if df is None or df.empty:
            return []
        sorted_df = df.sort_values(by="SIMILARITY_SCORE", ascending=False, na_position="last")
        return [CandidateRouting(**row) for row in sorted_df.to_dict(orient="records")]


prediction_service = PredictionService()

__all__ = ["prediction_service", "PredictionService"]
