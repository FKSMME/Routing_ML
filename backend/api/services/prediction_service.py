"""예측 서비스 레이어."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
import json

import pandas as pd

from backend.api.config import get_settings
from backend.api.schemas import CandidateRouting, CandidateSaveResponse, RoutingSummary
from backend.predictor_ml import predict_items_with_ml_optimized
from backend.feature_weights import FeatureWeightManager
from backend.trainer_ml import load_optimized_model
from models.manifest import ModelManifest, read_model_manifest
from common.logger import get_logger
from common.config_store import (
    ExportFormatConfig,
    SQLColumnConfig,
    VisualizationConfig,
    workflow_config_store,
)
from common.sql_schema import DEFAULT_SQL_OUTPUT_COLUMNS


logger = get_logger("api.prediction")


class PredictionService:
    """FastAPI 라우터에서 사용하는 비즈니스 로직."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._model_lock: bool = False
        self._last_metrics: Dict[str, Any] = {}
        self._model_reference = self.settings.model_directory
        self._model_manifest: Optional[ModelManifest] = None
        self._model_root: Optional[Path] = None

    @property
    def model_dir(self) -> Path:
        if self._model_root is not None:
            return self._model_root
        reference = self._model_reference
        if reference.suffix.lower() == ".json":
            return reference.parent
        return reference

    def _refresh_manifest(self, *, strict: bool = True) -> ModelManifest:
        manifest = read_model_manifest(self._model_reference, strict=strict)
        self._model_manifest = manifest
        self._model_root = manifest.root_dir
        return manifest

    def _get_manifest(self) -> ModelManifest:
        if self._model_manifest is None:
            return self._refresh_manifest(strict=False)
        return self._model_manifest

    def _ensure_model(self) -> None:
        """모델 디렉토리 유효성 검사."""
        try:
            manifest = self._refresh_manifest(strict=True)
            load_dir = manifest.require_optimized_model_dir()
        except Exception as exc:
            logger.error("모델 매니페스트 검증 실패", exc_info=exc)
            raise
        try:
            load_optimized_model(load_dir)
        except Exception as exc:  # pragma: no cover - 안전장치
            logger.error("모델 로드 실패", exc_info=exc)
            raise

    def _apply_feature_weights(
        self,
        *,
        manual_weights: Optional[Dict[str, float]] = None,
        profile_name: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        try:
            manifest = self._get_manifest()
            manager = FeatureWeightManager(manifest.root_dir)
        except Exception as exc:  # pragma: no cover - 안전장치
            logger.warning("FeatureWeightManager 초기화 실패: %s", exc)
            return None

        snapshot: Optional[Dict[str, Any]] = None
        if profile_name:
            try:
                manager.apply_profile(profile_name, persist=True)
                snapshot = manager.export_state()
            except KeyError:
                logger.warning("정의되지 않은 가중치 프로파일: %s", profile_name)
        if manual_weights:
            manager.apply_manual_weights(manual_weights, persist=True)
            snapshot = manager.export_state()

        if snapshot is None:
            snapshot = manager.export_state()
        return snapshot

    def predict(
        self,
        item_codes: Iterable[str],
        *,
        top_k: int,
        similarity_threshold: float,
        mode: str,
        feature_weights: Optional[Dict[str, float]] = None,
        weight_profile: Optional[str] = None,
        with_visualization: bool = False,
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

        weight_snapshot: Optional[Dict[str, Any]] = None
        if feature_weights or weight_profile:
            weight_snapshot = self._apply_feature_weights(
                manual_weights=feature_weights,
                profile_name=weight_profile,
            )

        routing_df, candidates_df = predict_items_with_ml_optimized(
            item_code_list,
            self._get_manifest().root_dir,
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
        if weight_snapshot:
            metrics["feature_weights"] = weight_snapshot

        if with_visualization:
            viz_payload = self.prepare_visualization_snapshot(routing_df, candidates_df)
            if viz_payload:
                metrics["visualization"] = viz_payload

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

    def export_predictions(
        self,
        routings: List[RoutingSummary],
        candidates: List[CandidateRouting],
        formats: Iterable[str],
    ) -> List[str]:
        export_cfg = workflow_config_store.get_export_config()
        requested = {fmt.lower() for fmt in formats}
        exported_paths: List[str] = []
        if not requested:
            return exported_paths

        export_dir = Path(export_cfg.export_directory)
        export_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")

        routing_records: List[Dict[str, Any]] = []
        for summary in routings:
            summary_dict = summary.dict(by_alias=True)
            operations = summary_dict.pop("operations", [])
            if not operations:
                routing_records.append(summary_dict)
                continue
            for operation in operations:
                merged = dict(summary_dict)
                merged.update(operation)
                routing_records.append(merged)

        candidate_records = [candidate.dict(by_alias=True) for candidate in candidates]
        routing_df = pd.DataFrame(routing_records)
        candidate_df = pd.DataFrame(candidate_records)

        encoding = export_cfg.default_encoding or "utf-8"

        def _safe_export(action, path: Path) -> None:
            try:
                action()
                exported_paths.append(str(path))
                logger.info("예측 결과 내보내기 완료: %s", path)
            except Exception as exc:  # pragma: no cover - 파일 쓰기 실패 보호
                logger.warning("예측 결과 내보내기 실패 (%s): %s", path, exc)

        if "csv" in requested and export_cfg.enable_csv and not routing_df.empty:
            csv_path = export_dir / f"routing_operations_{timestamp}.csv"
            _safe_export(lambda: routing_df.to_csv(csv_path, index=False, encoding=encoding), csv_path)

        if "txt" in requested and export_cfg.enable_txt and not routing_df.empty:
            txt_path = export_dir / f"routing_operations_{timestamp}.txt"
            _safe_export(lambda: routing_df.to_csv(txt_path, index=False, sep="\t", encoding=encoding), txt_path)

        if "excel" in requested and export_cfg.enable_excel:
            excel_path = export_dir / f"routing_bundle_{timestamp}.xlsx"

            def _write_excel() -> None:
                with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:  # type: ignore[arg-type]
                    routing_df.to_excel(writer, sheet_name="operations", index=False)
                    candidate_df.to_excel(writer, sheet_name="candidates", index=False)

            _safe_export(_write_excel, excel_path)

        if "json" in requested and export_cfg.enable_json:
            json_path = export_dir / f"routing_bundle_{timestamp}.json"
            payload = {
                "routings": routing_records,
                "candidates": candidate_records,
                "generated_at": timestamp,
            }
            _safe_export(
                lambda: json_path.write_text(
                    json.dumps(payload, ensure_ascii=False, indent=2), encoding=encoding
                ),
                json_path,
            )

        if "parquet" in requested and export_cfg.enable_parquet and not routing_df.empty:
            parquet_path = export_dir / f"routing_operations_{timestamp}.parquet"

            def _write_parquet() -> None:
                routing_df.to_parquet(parquet_path, index=False)

            _safe_export(_write_parquet, parquet_path)

        if "cache" in requested and export_cfg.enable_cache_save:
            cache_path = export_dir / f"routing_cache_{timestamp}.json"
            cache_payload = {
                "routings": routing_records,
                "candidates": candidate_records,
                "generated_at": timestamp,
            }
            _safe_export(
                lambda: cache_path.write_text(
                    json.dumps(cache_payload, ensure_ascii=False, indent=2), encoding=encoding
                ),
                cache_path,
            )

        if "erp" in requested and export_cfg.erp_interface_enabled:
            erp_path = export_dir / f"routing_erp_{timestamp}.json"
            erp_payload = {
                "protocol": export_cfg.erp_protocol,
                "endpoint": export_cfg.erp_endpoint,
                "payload": {
                    "candidates": candidate_records,
                    "operations": routing_records,
                },
            }
            _safe_export(
                lambda: erp_path.write_text(
                    json.dumps(erp_payload, ensure_ascii=False, indent=2), encoding=encoding
                ),
                erp_path,
            )

        if export_cfg.compress_on_save and exported_paths:
            # 간단한 압축: pandas to_csv gzip 옵션 활용
            gz_path = export_dir / f"routing_operations_{timestamp}.csv.gz"
            if not routing_df.empty:
                _safe_export(
                    lambda: routing_df.to_csv(gz_path, index=False, encoding=encoding, compression="gzip"),
                    gz_path,
                )

        return exported_paths

    def prepare_visualization_snapshot(
        self,
        routing_df: Optional[pd.DataFrame],
        candidates_df: Optional[pd.DataFrame],
    ) -> Dict[str, Any]:
        viz_cfg = workflow_config_store.get_visualization_config()
        snapshot: Dict[str, Any] = {}
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")

        def _safe_dataframe(df: Optional[pd.DataFrame]) -> pd.DataFrame:
            if df is None or df.empty:
                return pd.DataFrame()
            return df.copy()

        routing_df = _safe_dataframe(routing_df)
        candidates_df = _safe_dataframe(candidates_df)

        if viz_cfg.projector_enabled:
            projector_root = Path(viz_cfg.tensorboard_projector_dir)
            version_dir = projector_root / f"projector_{timestamp}"
            version_dir.mkdir(parents=True, exist_ok=True)

            if routing_df.empty:
                meta_df = pd.DataFrame(columns=["ITEM_CD", "process_count", "avg_setup", "avg_run"])
            else:
                meta_df = routing_df.groupby("ITEM_CD").agg(
                    process_count=("PROC_SEQ", "count") if "PROC_SEQ" in routing_df.columns else ("ITEM_CD", "count"),
                    avg_setup=("SETUP_TIME", "mean") if "SETUP_TIME" in routing_df.columns else ("ITEM_CD", "size"),
                    avg_run=("MACH_WORKED_HOURS", "mean") if "MACH_WORKED_HOURS" in routing_df.columns else ("ITEM_CD", "size"),
                ).reset_index()

            metadata_path = version_dir / "metadata.tsv"
            vectors_path = version_dir / "vectors.tsv"

            if meta_df.empty:
                metadata_path.write_text("ITEM_CD\tprocess_count\tavg_setup\tavg_run\n", encoding="utf-8")
                vectors_path.write_text("0\t0\t0\n", encoding="utf-8")
            else:
                meta_df.to_csv(metadata_path, sep="\t", index=False, encoding="utf-8")
                vector_df = meta_df.select_dtypes(include=["number"]).fillna(0.0)
                vector_df.to_csv(vectors_path, sep="\t", index=False, encoding="utf-8")

            projector_config = {
                "generated_at": timestamp,
                "metadata_file": metadata_path.name,
                "vector_file": vectors_path.name,
                "columns": viz_cfg.projector_metadata_columns,
            }
            (version_dir / "projector_config.json").write_text(
                json.dumps(projector_config, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            snapshot["tensorboard"] = str(version_dir)

        if viz_cfg.neo4j_enabled:
            neo4j_dir = Path(viz_cfg.tensorboard_projector_dir) / "neo4j"
            neo4j_dir.mkdir(parents=True, exist_ok=True)
            graph_path = neo4j_dir / f"routing_graph_{timestamp}.json"
            nodes: List[Dict[str, Any]] = []
            edges: List[Dict[str, Any]] = []

            for candidate in candidates_df.to_dict(orient="records"):
                node_id = candidate.get("CANDIDATE_ITEM_CD") or candidate.get("ITEM_CD")
                if not node_id:
                    continue
                nodes.append(
                    {
                        "id": node_id,
                        "label": candidate.get("CANDIDATE_ITEM_CD", "candidate"),
                        "similarity": candidate.get("SIMILARITY_SCORE"),
                    }
                )

            if not routing_df.empty and "ITEM_CD" in routing_df.columns and "CANDIDATE_ITEM_CD" in routing_df.columns:
                for row in routing_df.to_dict(orient="records"):
                    source = row.get("ITEM_CD")
                    target = row.get("CANDIDATE_ITEM_CD")
                    if not source or not target:
                        continue
                    edges.append(
                        {
                            "source": source,
                            "target": target,
                            "weight": row.get("SIMILARITY_SCORE"),
                        }
                    )

            graph_payload = {
                "workspace": viz_cfg.neo4j_workspace,
                "generated_at": timestamp,
                "nodes": nodes,
                "edges": edges,
            }
            graph_path.write_text(
                json.dumps(graph_payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            snapshot["neo4j"] = {
                "workspace": viz_cfg.neo4j_workspace,
                "browser_url": viz_cfg.neo4j_browser_url,
                "graph_file": str(graph_path),
            }

        if snapshot:
            logger.info("시각화 아티팩트 생성 완료", extra={"payload": snapshot})
        return snapshot

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
