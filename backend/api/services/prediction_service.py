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
from common.config_store import SQLColumnConfig, workflow_config_store
from common.sql_schema import DEFAULT_SQL_OUTPUT_COLUMNS


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

        operations_payload = payload.get("operations", [])
        if not operations_payload:
            raise RuntimeError("저장할 공정 데이터가 없습니다")

        sql_config = workflow_config_store.get_sql_column_config()
        try:
            sql_config.validate_columns(list(DEFAULT_SQL_OUTPUT_COLUMNS))
        except ValueError as exc:
            logger.error("SQL 컬럼 설정 검증 실패", extra={"error": str(exc)})
            raise RuntimeError("SQL 컬럼 설정이 유효하지 않습니다") from exc

        df = pd.DataFrame(operations_payload)
        warnings: List[str] = []
        allowed_columns = set(sql_config.available_columns or DEFAULT_SQL_OUTPUT_COLUMNS)

        missing_required = [col for col in sql_config.output_columns if col not in df.columns]
        if missing_required:
            for col in missing_required:
                df[col] = None
            message = "필수 컬럼이 누락되어 NULL로 채워집니다: " + ", ".join(sorted(missing_required))
            warnings.append(message)
            logger.warning(message, extra={"candidate_id": candidate_id, "item_code": item_code})

        unexpected_columns = [col for col in df.columns if col not in allowed_columns]
        if unexpected_columns:
            df = df.drop(columns=unexpected_columns)
            message = "허용되지 않은 컬럼이 제거되었습니다: " + ", ".join(sorted(unexpected_columns))
            warnings.append(message)
            logger.warning(message, extra={"candidate_id": candidate_id, "item_code": item_code})

        df = df.reindex(columns=sql_config.output_columns, fill_value=None)

        sql_preview = self._build_sql_preview(
            item_code=item_code,
            candidate_id=candidate_id,
            payload=payload,
            operations_df=df,
            warnings=warnings,
            sql_config=sql_config,
        )

        data = {
            "item_code": item_code,
            "candidate_id": candidate_id,
            "saved_at": datetime.utcnow().isoformat(),
            "summary": payload.get("summary"),
            "operations": df.to_dict(orient="records"),
            "warnings": warnings,
            "sql_preview": sql_preview,
        }
        save_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        logger.info(
            "[저장] %s 후보 저장 완료 -> %s (warnings=%d)",
            candidate_id,
            save_path,
            len(warnings),
        )
        return CandidateSaveResponse(
            item_code=item_code,
            candidate_id=candidate_id,
            saved_path=str(save_path),
            saved_at=datetime.utcnow(),
            sql_preview=sql_preview,
            warnings=warnings,
        )

    def latest_metrics(self) -> Dict[str, Any]:
        """마지막 예측 메트릭 반환."""
        return self._last_metrics

    def _build_sql_preview(
        self,
        *,
        item_code: str,
        candidate_id: str,
        payload: Dict[str, Any],
        operations_df: pd.DataFrame,
        warnings: List[str],
        sql_config: SQLColumnConfig,
    ) -> List[str]:
        if operations_df.empty:
            warnings.append("공정 데이터가 비어 있어 SQL 미리보기를 생성할 수 없습니다.")
            return []

        summary_meta = payload.get("summary") or {}
        first_row = operations_df.iloc[0].to_dict()

        def _meta(key: str) -> Any:
            return summary_meta.get(key) or first_row.get(key)

        candidate_row = {
            "item_code": item_code,
            "candidate_id": candidate_id,
            "routing_signature": _meta("ROUTING_SIGNATURE"),
            "similarity_score": _meta("SIMILARITY_SCORE"),
            "priority": _meta("PRIORITY"),
            "similarity_tier": _meta("SIMILARITY_TIER"),
            "reference_item_cd": _meta("REFERENCE_ITEM_CD"),
            "generated_at": datetime.utcnow().isoformat(),
        }

        for field_key, label in {
            "routing_signature": "ROUTING_SIGNATURE",
            "similarity_score": "SIMILARITY_SCORE",
            "priority": "PRIORITY",
            "similarity_tier": "SIMILARITY_TIER",
            "reference_item_cd": "REFERENCE_ITEM_CD",
        }.items():
            if candidate_row.get(field_key) is None:
                warning_msg = f"{label} 값을 찾을 수 없어 NULL로 저장됩니다."
                warnings.append(warning_msg)

        candidate_columns = [
            "item_code",
            "candidate_id",
            "routing_signature",
            "similarity_score",
            "priority",
            "similarity_tier",
            "reference_item_cd",
            "generated_at",
        ]
        candidate_values = ", ".join(self._sql_literal(candidate_row[col]) for col in candidate_columns)
        candidate_sql = (
            f"INSERT INTO {self.settings.sql_table_candidates} ("
            + ", ".join(candidate_columns)
            + f") VALUES ({candidate_values});"
        )

        preview_limit = self.settings.sql_preview_row_limit
        preview_df = operations_df.head(preview_limit)
        truncated = len(operations_df) > preview_limit

        operations_columns = sql_config.output_columns
        value_lines = []
        for row in preview_df.itertuples(index=False, name=None):
            value_lines.append("(" + ", ".join(self._sql_literal(value) for value in row) + ")")

        operations_sql = (
            f"INSERT INTO {self.settings.sql_table_operations} ("
            + ", ".join(operations_columns)
            + ") VALUES\n  "
            + ",\n  ".join(value_lines)
            + ";"
        )

        if truncated:
            operations_sql += (
                f"\n-- 총 {len(operations_df)}행 중 {preview_limit}행만 미리보기로 포함되었습니다."
            )
            warnings.append(
                f"SQL 미리보기는 {preview_limit}행까지만 표시되며 전체 {len(operations_df)}행이 저장 대상입니다."
            )

        return [candidate_sql, operations_sql]

    @staticmethod
    def _sql_literal(value: Any) -> str:
        if value is None:
            return "NULL"
        if isinstance(value, datetime):
            return f"'{value.isoformat()}'"
        if pd.isna(value):  # type: ignore[arg-type]
            return "NULL"
        if isinstance(value, bool):
            return "1" if value else "0"
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return str(value)
        return "'" + str(value).replace("'", "''") + "'"

    @staticmethod
    def _serialize_routing(df: pd.DataFrame) -> List[RoutingSummary]:
        if df is None or df.empty:
            return []
        grouped = df.groupby("ITEM_CD") if "ITEM_CD" in df.columns else [(None, df)]
        summaries: List[RoutingSummary] = []
        for item_cd, group in grouped:
            operations = group.to_dict(orient="records")
            meta = {}
            for key in [
                "ITEM_CD",
                "CANDIDATE_ID",
                "ROUTING_SIGNATURE",
                "PRIORITY",
                "SIMILARITY_TIER",
                "SIMILARITY_SCORE",
                "REFERENCE_ITEM_CD",
            ]:
                if key in group.columns and not group[key].isna().all():
                    meta[key] = group[key].iloc[0]

            summary_item_cd = meta.get("ITEM_CD") or (
                item_cd if item_cd is not None else ""
            )
            summaries.append(
                RoutingSummary(
                    ITEM_CD=summary_item_cd,
                    CANDIDATE_ID=str(meta.get("CANDIDATE_ID")) if meta.get("CANDIDATE_ID") else None,
                    ROUTING_SIGNATURE=meta.get("ROUTING_SIGNATURE"),
                    PRIORITY=meta.get("PRIORITY"),
                    SIMILARITY_TIER=meta.get("SIMILARITY_TIER"),
                    SIMILARITY_SCORE=meta.get("SIMILARITY_SCORE"),
                    REFERENCE_ITEM_CD=meta.get("REFERENCE_ITEM_CD"),
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
