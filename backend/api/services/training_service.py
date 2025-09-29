"""학습 오케스트레이션 상태 조회 서비스."""
from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, TYPE_CHECKING

import pandas as pd

from backend.api.config import get_settings

from backend.maintenance.model_registry import list_versions, register_version
from common.config_store import workflow_config_store

from common.logger import get_logger
from common.training_state import (
    DEFAULT_STATUS_PATH,
    TrainingStatusPayload,
    load_status,
    save_status,
)
from models.manifest import write_manifest

if TYPE_CHECKING:  # pragma: no cover - import-time hinting only
    from backend.trainer_ml import TRAINER_RUNTIME_SETTINGS as _TrainerRuntimeSettingsType
    from backend.trainer_ml import train_model_with_ml_improved as _TrainModelFn

logger = get_logger("api.training")
performance_logger = get_logger("metrics.training")


def train_model_with_ml_improved(*args: Any, **kwargs: Any) -> Any:
    """Lazy proxy to avoid importing heavy trainer dependencies at module import."""

    from backend.trainer_ml import train_model_with_ml_improved as _impl

    return _impl(*args, **kwargs)


def _trainer_runtime_settings() -> Dict[str, Any]:
    from backend.trainer_ml import TRAINER_RUNTIME_SETTINGS

    return TRAINER_RUNTIME_SETTINGS


class TrainingService:
    """Expose scheduler produced training state to the API layer."""

    def __init__(self, *, status_path: Optional[Path] = None) -> None:
        self._status_path = status_path or DEFAULT_STATUS_PATH
        self._registry_path = get_settings().model_registry_path
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
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
        projector_metadata: Optional[list[str]] = None,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        settings = get_settings()
        self._registry_path = settings.model_registry_path

        data_cfg = workflow_config_store.get_data_source_config()
        viz_cfg = workflow_config_store.get_visualization_config()

        version_root = settings.model_directory or Path("models")
        version_root = Path(version_root)
        version_root.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now(timezone.utc)
        version_name = version_label or f"version_{timestamp.strftime('%Y%m%d%H%M%S')}"
        job_id = f"api-train-{timestamp.strftime('%Y%m%d%H%M%S')}"
        version_dir = version_root / version_name

        start_monotonic = time.monotonic()

        with self._lock:
            if self._thread and self._thread.is_alive():
                logger.warning(
                    "학습 작업이 이미 실행 중입니다", extra={"job_id": self._status.job_id}
                )
                return {
                    "status": "running",
                    "job_id": self._status.job_id,
                    "message": "이미 학습 작업이 실행 중입니다.",
                }

        version_dir.mkdir(parents=True, exist_ok=True)

        started_at = timestamp
        self._update_status(
            job_id=job_id,
            status="scheduled",
            started_at=started_at.isoformat(),
            progress=1,
            message="학습 작업을 준비 중입니다",
            version_path=str(version_dir),
        )

        def _target() -> None:
            try:
                self._run_training(
                    job_id=job_id,
                    requested_by=requested_by,
                    version_label=version_name,
                    projector_metadata=projector_metadata,
                    dry_run=dry_run,
                    data_cfg=data_cfg,
                    viz_cfg=viz_cfg,
                    version_dir=version_dir,
                    start_ts=started_at,
                    start_monotonic=start_monotonic,
                )
            finally:
                with self._lock:
                    self._thread = None

        thread = threading.Thread(target=_target, daemon=True)
        with self._lock:
            self._thread = thread
        thread.start()

        return {
            "status": "scheduled",
            "job_id": job_id,
            "version": version_name,
            "message": "학습 작업을 백그라운드에서 시작했습니다.",
        }

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

    def _run_training(
        self,
        *,
        job_id: str,
        requested_by: str,
        version_label: Optional[str],
        projector_metadata: Optional[list[str]],
        dry_run: bool,
        data_cfg=None,
        viz_cfg=None,
        version_dir: Optional[Path] = None,
        start_ts: Optional[datetime] = None,
        start_monotonic: Optional[float] = None,
    ) -> None:
        settings = get_settings()
        data_cfg = data_cfg or workflow_config_store.get_data_source_config()
        viz_cfg = viz_cfg or workflow_config_store.get_visualization_config()

        root_dir = settings.model_directory or Path("models")
        root_dir = Path(root_dir)
        root_dir.mkdir(parents=True, exist_ok=True)

        start_ts = start_ts or datetime.now(timezone.utc)
        start_monotonic = start_monotonic or time.monotonic()

        version_name = version_label or f"version_{start_ts.strftime('%Y%m%d%H%M%S')}"
        version_dir = version_dir or (root_dir / version_name)
        version_dir.mkdir(parents=True, exist_ok=True)

        projector_columns = list(
            projector_metadata or getattr(viz_cfg, "projector_metadata_columns", [])
        )
        export_projector = bool(getattr(viz_cfg, "projector_enabled", True))
        runtime_settings = _trainer_runtime_settings()

        self._update_status(
            job_id=job_id,
            status="running",
            started_at=start_ts.isoformat(),
            progress=5,
            message="데이터셋 로딩 중",
            version_path=str(version_dir),
        )

        try:
            dataset = self._load_dataset(data_cfg)
            sample_count = len(dataset)
            self._update_status(
                progress=20,
                message=f"데이터셋 로드 완료 ({sample_count}건)",
            )

            metrics: Dict[str, Any] = {
                "samples": sample_count,
                "dataset_path": str(data_cfg.access_path),
                "version_name": version_name,
                "dry_run": dry_run,
            }

            if dry_run:
                time.sleep(0.5)
                trained = None
            else:
                self._update_status(progress=40, message="학습 파이프라인 실행")
                trained = train_model_with_ml_improved(
                    dataset,
                    save_dir=version_dir,
                    export_tb_projector=export_projector,
                    projector_metadata_cols=projector_columns or None,
                )

            duration = time.monotonic() - start_monotonic
            metrics["duration_sec"] = round(duration, 2)

            request_payload = {
                "job_id": job_id,
                "requested_by": requested_by,
                "version_label": version_name,
                "dry_run": dry_run,
                "started_at": start_ts.isoformat(),
                "data_source": data_cfg.to_dict() if hasattr(data_cfg, "to_dict") else {},
                "visualization": viz_cfg.to_dict() if hasattr(viz_cfg, "to_dict") else {},
            }
            (version_dir / "training_request.json").write_text(
                json.dumps(request_payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            self._update_status(progress=60, message="산출물 저장 중")

            if not dry_run:
                metrics_path = version_dir / "training_metrics.json"
                metrics_path.write_text(
                    json.dumps(metrics, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )

            time_profiles_path = version_dir / "time_profiles.json"
            if runtime_settings.get("time_profiles_enabled") and not time_profiles_path.exists():
                placeholder = {
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "strategy": str(
                        runtime_settings.get("time_profile_strategy", "sigma_profile")
                    ),
                    "time_columns": [],
                    "columns": {},
                    "profiles": {"OPT": {}, "STD": {}, "SAFE": {}},
                    "parameters": {
                        "trim_std_enabled": bool(
                            runtime_settings.get("trim_std_enabled", True)
                        ),
                        "trim_lower_percent": float(
                            runtime_settings.get("trim_lower_percent", 0.05)
                        ),
                        "trim_upper_percent": float(
                            runtime_settings.get("trim_upper_percent", 0.95)
                        ),
                        "optimal_sigma": float(
                            runtime_settings.get("time_profile_optimal_sigma", 0.67)
                        ),
                        "safe_sigma": float(
                            runtime_settings.get("time_profile_safe_sigma", 1.28)
                        ),
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

            completed_at = datetime.now(timezone.utc)

            manifest_metadata = {
                "version": version_name,
                "job": {
                    "id": job_id,
                    "requested_by": requested_by,
                    "dry_run": dry_run,
                    "started_at": start_ts.isoformat(),
                    "completed_at": completed_at.isoformat(),
                },
                "metrics": metrics,
            }
            if projector_columns:
                manifest_metadata["projector_metadata_columns"] = projector_columns

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
                manifest_metadata.setdefault("files", files_payload)

            self._update_status(progress=80, message="매니페스트 생성 중")

            try:
                manifest_path = write_manifest(
                    version_dir,
                    strict=not dry_run,
                    metadata=manifest_metadata,
                )
                metrics["manifest_path"] = str(manifest_path)
                logger.info(
                    "매니페스트 생성 완료",
                    extra={"job_id": job_id, "manifest": str(manifest_path)},
                )
            except Exception as exc:  # pragma: no cover - manifest failures are logged
                manifest_path = version_dir / "manifest.json"
                logger.exception(
                    "매니페스트 생성 실패",
                    extra={"job_id": job_id, "error": str(exc)},
                )

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
                except Exception as registry_error:  # pragma: no cover - defensive logging
                    logger.exception(
                        "모델 레지스트리 업데이트 실패",
                        extra={"job_id": job_id, "error": str(registry_error)},
                    )

            performance_logger.info(
                "training.completed", extra={"job_id": job_id, **metrics}
            )
            self._update_status(
                status="completed",
                progress=100,
                message="모델 학습 완료",
                version_path=str(version_dir),
                metrics=metrics,
                finished_at=completed_at.isoformat(),
            )

            if trained is None:
                logger.info("학습 드라이런 완료", extra={"job_id": job_id})
            else:
                logger.info("학습 완료", extra={"job_id": job_id, "duration": duration})
        except Exception as exc:  # pragma: no cover - ensures failure persistence
            logger.exception("학습 작업 실패", extra={"job_id": job_id})
            performance_logger.error(
                "training.failed", extra={"job_id": job_id, "error": str(exc)}
            )
            self._update_status(
                status="failed",
                progress=100,
                message=str(exc),
                metrics={"error": str(exc)},
                finished_at=datetime.now(timezone.utc).isoformat(),
            )

    def _update_status(
        self,
        *,
        status: Optional[str] = None,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        version_path: Optional[str] = None,
        metrics: Optional[Dict[str, Any]] = None,
        job_id: Optional[str] = None,
        started_at: Optional[str] = None,
        finished_at: Optional[str] = None,
    ) -> None:
        with self._lock:
            if job_id is not None:
                self._status.job_id = job_id
            if status is not None:
                self._status.status = status
            if progress is not None:
                self._status.progress = progress
            if message is not None:
                self._status.message = message
            if version_path is not None:
                self._status.version_path = version_path
            if metrics is not None:
                self._status.metrics = dict(metrics)
            if started_at is not None:
                self._status.started_at = started_at
                if status not in {"completed", "failed"}:
                    self._status.finished_at = None
            if finished_at is not None:
                self._status.finished_at = finished_at
            elif status not in {"completed", "failed"}:
                self._status.finished_at = None

            snapshot = TrainingStatusPayload(**self._status.to_dict())

        save_status(snapshot, self._status_path)



training_service = TrainingService()

__all__ = ["training_service", "TrainingService"]
