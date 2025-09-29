"""학습 오케스트레이션 상태 조회 서비스."""
from __future__ import annotations

import json
import shutil
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, List, Optional

import pandas as pd

from backend.api.config import get_settings
from backend.maintenance.model_registry import list_versions, register_version
from common.config_store import (
    DataSourceConfig,
    TrainerRuntimeConfig,
    VisualizationConfig,
    workflow_config_store,
)
from common.logger import get_logger, performance_logger
from common.training_state import (
    DEFAULT_STATUS_PATH,
    TrainingStatusPayload,
    load_status,
    save_status,
)
from models.manifest import write_manifest

if TYPE_CHECKING:
    from backend import trainer_ml

logger = get_logger("api.training")

_TRAINER_MODULE: Optional["trainer_ml"] = None


def _get_trainer_module():
    global _TRAINER_MODULE
    if _TRAINER_MODULE is None:
        from backend import trainer_ml as trainer_module

        _TRAINER_MODULE = trainer_module
    return _TRAINER_MODULE


def train_model_with_ml_improved(*args, **kwargs):
    trainer_module = _get_trainer_module()
    return trainer_module.train_model_with_ml_improved(*args, **kwargs)


def __getattr__(name: str):
    if name == "TRAINER_RUNTIME_SETTINGS":
        return _get_trainer_module().TRAINER_RUNTIME_SETTINGS
    raise AttributeError(name)


class TrainingService:
    """Expose scheduler produced training state to the API layer."""

    def __init__(self, *, status_path: Optional[Path] = None) -> None:
        self._status_path = status_path or DEFAULT_STATUS_PATH
        settings = get_settings()
        self._registry_path = settings.model_registry_path
        self._lock = threading.Lock()
        self._status = TrainingStatusPayload()

    def get_status(self) -> Dict[str, Any]:
        record = load_status(self._status_path)
        payload = record.to_dict()
        payload.setdefault("status", "idle")
        payload.setdefault("progress", 0)

        latest_version: Optional[Dict[str, Any]] = None
        try:
            versions = list_versions(db_path=self._registry_path, limit=1)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.exception("모델 레지스트리 조회 실패", extra={"error": str(exc)})
            versions = []
        if versions:
            latest_version = versions[0].to_dict()
            metrics = dict(payload.get("metrics", {}))
            metrics["latest_version"] = latest_version
            payload["metrics"] = metrics
            payload.setdefault("version_path", latest_version.get("artifact_dir"))
            payload.setdefault(
                "finished_at",
                latest_version.get("trained_at") or latest_version.get("created_at"),
            )

        payload["latest_version"] = latest_version
        return payload

    def start_training(
        self,
        *,
        requested_by: str,
        version_label: Optional[str] = None,
        projector_metadata: Optional[List[str]] = None,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        settings = get_settings()
        self._registry_path = settings.model_registry_path

        data_cfg = workflow_config_store.get_data_source_config()
        viz_cfg = workflow_config_store.get_visualization_config()
        trainer_cfg = workflow_config_store.get_trainer_runtime()

        now = datetime.utcnow()
        version_name = version_label or f"version_{now.strftime('%Y%m%d%H%M%S')}"

        base_dir = settings.model_directory or Path("models")
        base_dir = Path(base_dir)
        if base_dir.suffix.lower() == ".json":
            base_dir = base_dir.parent

        version_dir = (base_dir / version_name).expanduser().resolve()
        version_dir.mkdir(parents=True, exist_ok=True)

        job_id = f"api-train-{now.strftime('%Y%m%d%H%M%S')}"
        start_time = time.monotonic()
        projector_columns = list(projector_metadata or viz_cfg.projector_metadata_columns)

        with self._lock:
            self._status = TrainingStatusPayload(
                job_id=job_id,
                status="running",
                started_at=now.isoformat(),
                progress=5,
                message="데이터 로딩 준비",
                version_path=str(version_dir),
                metrics={},
            )

        self._update_status(
            status="running",
            progress=5,
            message="데이터 로딩 준비",
            version_path=str(version_dir),
        )

        summary = self._run_training(
            job_id=job_id,
            requested_by=requested_by,
            data_cfg=data_cfg,
            viz_cfg=viz_cfg,
            trainer_cfg=trainer_cfg,
            version_dir=version_dir,
            version_name=version_name,
            version_label=version_label,
            projector_metadata=projector_columns,
            dry_run=dry_run,
            start_time=start_time,
            started_at=now,
        )

        return summary

    def _run_training(
        self,
        *,
        job_id: str,
        requested_by: str,
        data_cfg: DataSourceConfig | None = None,
        viz_cfg: VisualizationConfig | None = None,
        trainer_cfg: TrainerRuntimeConfig | None = None,
        version_dir: Path | None = None,
        version_name: Optional[str] = None,
        version_label: Optional[str] = None,
        projector_metadata: Optional[List[str]] = None,
        dry_run: bool = False,
        start_time: Optional[float] = None,
        started_at: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        metrics: Dict[str, Any] = {}
        manifest_path: Optional[Path] = None

        try:
            data_cfg = data_cfg or workflow_config_store.get_data_source_config()
            viz_cfg = viz_cfg or workflow_config_store.get_visualization_config()
            trainer_cfg = trainer_cfg or workflow_config_store.get_trainer_runtime()

            runtime_overrides = {}
            trainer_module = sys.modules.get("backend.trainer_ml")
            if trainer_module is not None:
                runtime_overrides = getattr(
                    trainer_module, "TRAINER_RUNTIME_SETTINGS", {}
                ) or {}

            resolved_version = (
                version_name
                or version_label
                or datetime.utcnow().strftime("version_%Y%m%d%H%M%S")
            )
            if version_dir is None:
                settings = get_settings()
                base_dir = settings.model_directory or Path("models")
                base_dir = Path(base_dir)
                if base_dir.suffix.lower() == ".json":
                    base_dir = base_dir.parent
                version_dir = (base_dir / resolved_version).expanduser().resolve()
            version_dir.mkdir(parents=True, exist_ok=True)

            projector_columns = list(projector_metadata or viz_cfg.projector_metadata_columns)

            started_at_dt = started_at or datetime.utcnow()
            start_time_value = start_time or time.monotonic()

            with self._lock:
                self._status.job_id = job_id
                self._status.started_at = started_at_dt.isoformat()
                self._status.version_path = str(version_dir)
                if not self._status.metrics:
                    self._status.metrics = {}

            self._update_status(
                status="running",
                progress=10,
                message="데이터셋 로딩 준비",
                version_path=str(version_dir),
            )

            self._update_status(progress=15, message="데이터셋 로딩 중")
            dataset = self._load_dataset(data_cfg)
            sample_count = len(dataset)
            metrics.update(
                {
                    "samples": sample_count,
                    "dataset_path": data_cfg.access_path,
                }
            )
            self._update_status(progress=30, message=f"샘플 {sample_count}건 전처리", metrics=metrics)

            if dry_run:
                self._update_status(progress=50, message="드라이런 검증 실행", metrics=metrics)
                time.sleep(1.0)
            else:
                self._update_status(progress=50, message="모델 학습 실행", metrics=metrics)
                train_model_with_ml_improved(
                    dataset,
                    save_dir=version_dir,
                    export_tb_projector=viz_cfg.projector_enabled,
                    projector_metadata_cols=projector_columns,
                )

            duration = time.monotonic() - start_time_value
            completed_at = datetime.utcnow()
            metrics.update(
                {
                    "duration_sec": round(duration, 2),
                    "dry_run": dry_run,
                    "saved_dir": str(version_dir),
                    "version_name": resolved_version,
                }
            )

            self._update_status(progress=70, message="결과 아티팩트 정리", metrics=metrics)

            metrics_path = version_dir / "training_metrics.json"
            metrics_path.write_text(
                json.dumps(metrics, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            time_profiles_path = version_dir / "time_profiles.json"
            time_profiles_enabled = bool(
                trainer_cfg.time_profiles_enabled
                or runtime_overrides.get("time_profiles_enabled")
            )
            if time_profiles_enabled and not time_profiles_path.exists():
                runtime_trim_std = runtime_overrides.get(
                    "trim_std_enabled", trainer_cfg.trim_std_enabled
                )
                runtime_trim_lower = runtime_overrides.get(
                    "trim_lower_percent", trainer_cfg.trim_lower_percent
                )
                runtime_trim_upper = runtime_overrides.get(
                    "trim_upper_percent", trainer_cfg.trim_upper_percent
                )
                runtime_opt_sigma = runtime_overrides.get(
                    "time_profile_optimal_sigma",
                    trainer_cfg.time_profile_optimal_sigma,
                )
                runtime_safe_sigma = runtime_overrides.get(
                    "time_profile_safe_sigma", trainer_cfg.time_profile_safe_sigma
                )
                placeholder = {
                    "generated_at": datetime.utcnow().isoformat(),
                    "strategy": str(
                        runtime_overrides.get(
                            "time_profile_strategy", trainer_cfg.time_profile_strategy
                        )
                    ),
                    "time_columns": [],
                    "columns": {},
                    "profiles": {"OPT": {}, "STD": {}, "SAFE": {}},
                    "parameters": {
                        "trim_std_enabled": bool(runtime_trim_std),
                        "trim_lower_percent": float(runtime_trim_lower),
                        "trim_upper_percent": float(runtime_trim_upper),
                        "optimal_sigma": float(runtime_opt_sigma),
                        "safe_sigma": float(runtime_safe_sigma),
                        "min_samples": 0,
                    },
                }
                time_profiles_path.write_text(
                    json.dumps(placeholder, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                logger.info(
                    "시간 프로파일 기본 템플릿 생성",
                    extra={"job_id": job_id, "path": str(time_profiles_path)},
                )

            manifest_metadata: Dict[str, Any] = {
                "version": resolved_version,
                "source": "backend.api.training_service",
                "job": {
                    "id": job_id,
                    "requested_by": requested_by,
                    "dry_run": dry_run,
                    "started_at": started_at_dt.isoformat(),
                    "completed_at": completed_at.isoformat(),
                },
                "metrics": metrics,
            }
            if projector_columns:
                manifest_metadata["projector_metadata_columns"] = list(projector_columns)

            files_payload: Dict[str, str] = {}
            for key, filename in (
                ("training_request", "training_request.json"),
                ("training_metrics", "training_metrics.json"),
                ("time_profiles", "time_profiles.json"),
            ):
                candidate = version_dir / filename
                if candidate.exists():
                    files_payload[key] = candidate.relative_to(version_dir).as_posix()
            if files_payload:
                manifest_metadata["files"] = files_payload

            try:
                manifest_path = write_manifest(
                    version_dir,
                    strict=not dry_run,
                    metadata=manifest_metadata,
                )
                logger.info(
                    "매니페스트 생성 완료",
                    extra={"job_id": job_id, "manifest": str(manifest_path)},
                )
            except Exception as exc:  # pragma: no cover - 방어적 로깅
                logger.error(
                    "매니페스트 생성 실패",
                    extra={"job_id": job_id, "error": str(exc)},
                )
                manifest_path = version_dir / "manifest.json"

            if not dry_run:
                try:
                    register_version(
                        db_path=self._registry_path,
                        version_name=version_name,
                        artifact_dir=version_dir.resolve(),
                        manifest_path=manifest_path.resolve(),
                        requested_by=requested_by,
                        trained_at=completed_at,
                    )
                except Exception as registry_error:  # pragma: no cover - 관측 목적
                    logger.exception(
                        "모델 레지스트리 업데이트 실패",
                        extra={"job_id": job_id, "error": str(registry_error)},
                    )

            self._update_status(
                status="completed",
                progress=100,
                message="모델 학습 완료",
                version_path=str(version_dir),
                metrics=metrics,
            )
            performance_logger.info(
                "training.completed",
                extra={"job_id": job_id, **metrics},
            )
            logger.info(
                "학습 완료",
                extra={"job_id": job_id, "duration": metrics.get("duration_sec")},
            )

            summary = self._status.to_dict()
            summary.update(
                {
                    "job_id": job_id,
                    "version": resolved_version,
                    "manifest_path": str(manifest_path) if manifest_path else None,
                    "completed_at": completed_at.isoformat(),
                }
            )
            return summary
        except Exception as exc:  # pragma: no cover - 런타임 실패 보호
            logger.exception("학습 작업 실패", extra={"job_id": job_id})
            performance_logger.error(
                "training.failed", extra={"job_id": job_id, "error": str(exc)}
            )
            self._update_status(
                status="failed",
                progress=100,
                message=str(exc),
                metrics=metrics or None,
            )
            if version_dir.exists():
                shutil.rmtree(version_dir, ignore_errors=True)
            failure = self._status.to_dict()
            failure.update(
                {
                    "job_id": job_id,
                    "version": resolved_version,
                    "error": str(exc),
                }
            )
            return failure

    def _load_dataset(self, data_cfg) -> pd.DataFrame:
        access_path = Path(data_cfg.access_path)
        if access_path.exists():
            if access_path.suffix.lower() == ".csv":
                return pd.read_csv(access_path)
            if access_path.suffix.lower() == ".parquet":
                return pd.read_parquet(access_path)
        # Access 혹은 미지원 포맷일 경우 빈 데이터프레임 생성
        columns = ["ITEM_CD", "ITEM_NM"]
        columns.extend(data_cfg.column_overrides.get("features", []))
        return pd.DataFrame(columns=columns)

    def _update_status(
        self,
        *,
        status: Optional[str] = None,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        version_path: Optional[str] = None,
        metrics: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        with self._lock:
            if status is not None:
                self._status.status = status
            if progress is not None:
                self._status.progress = max(0, min(100, progress))
            if message is not None:
                self._status.message = message
            if version_path is not None:
                self._status.version_path = version_path
            if metrics is not None:
                self._status.metrics = dict(metrics)
            if status in {"failed", "completed"}:
                self._status.finished_at = datetime.utcnow().isoformat()

            save_status(self._status, self._status_path)
            return self._status.to_dict()



training_service = TrainingService()

__all__ = ["training_service", "TrainingService"]
