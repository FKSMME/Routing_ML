"""학습 오케스트레이션 상태 조회 서비스."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


import shutil
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, List, Optional

import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, TYPE_CHECKING


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

        settings = get_settings()
        self._registry_path = settings.model_registry_path
        self._lock = threading.Lock()

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

        version_path = self._resolve_version_path(payload, latest_version)
        metrics = self._augment_metrics(dict(payload.get("metrics", {})), version_path)
        payload["metrics"] = metrics
        payload["latest_version"] = latest_version
        return payload

    def _resolve_version_path(
        self,
        payload: Dict[str, Any],
        latest_version: Optional[Dict[str, Any]],
    ) -> Optional[Path]:
        """Return the most suitable artifact directory for the current status."""

        candidates: List[Path] = []
        version_path = payload.get("version_path")
        if isinstance(version_path, str):
            candidates.append(Path(version_path))
        if latest_version and isinstance(latest_version.get("artifact_dir"), str):
            candidates.append(Path(str(latest_version["artifact_dir"])))
        candidates.append(Path("models"))

        for candidate in candidates:
            if candidate.exists():
                return candidate
        return None

    def _augment_metrics(self, metrics: Dict[str, Any], version_path: Optional[Path]) -> Dict[str, Any]:
        """Populate metrics with artifact-backed data if available."""

        if version_path is None:
            metrics.setdefault("run_history", [])
            metrics.setdefault("metric_history", [])
            return metrics

        feature_weights = self._load_json_artifact(version_path, "feature_weights.json")
        if feature_weights:
            metrics.setdefault("feature_weights", feature_weights)

        training_metrics = self._load_json_artifact(version_path, "training_metrics.json")
        if training_metrics:
            metrics.setdefault("training_metrics", training_metrics)

        training_metadata = self._load_json_artifact(version_path, "training_metadata.json")
        if training_metadata:
            metrics.setdefault("training_metadata", training_metadata)

        feature_statistics = self._load_json_artifact(version_path, "feature_statistics.json")
        if feature_statistics:
            metrics.setdefault("feature_statistics", feature_statistics)

        metrics.setdefault("run_history", self._build_run_history())
        metrics.setdefault(
            "metric_history",
            self._build_metric_history(version_path, training_metrics, training_metadata),
        )
        return metrics

    def _load_json_artifact(self, root: Path, filename: str) -> Optional[Dict[str, Any]]:
        """Attempt to load an artifact JSON file from several known locations."""

        for candidate in self._artifact_candidates(root, filename):
            if candidate.exists():
                try:
                    return json.loads(candidate.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    logger.warning("JSON 파싱 실패", extra={"artifact": str(candidate)})
        return None

    def _artifact_candidates(self, root: Path, filename: str) -> Iterable[Path]:
        """Yield candidate paths for a specific artifact."""

        search_roots: Tuple[Path, ...] = (
            root,
            root / "default",
            Path("deliverables/v1.0/models"),
            Path("deliverables/v1.0/models/default"),
        )
        seen: set[Path] = set()
        for base in search_roots:
            candidate = base / filename
            if candidate in seen:
                continue
            seen.add(candidate)
            yield candidate

    def _build_run_history(self) -> List[Dict[str, Any]]:
        """Build a lightweight run history using the model registry."""

        try:
            versions = list_versions(db_path=self._registry_path, limit=10)
        except Exception as exc:  # pragma: no cover - diagnostics only
            logger.warning("모델 버전 이력 조회 실패", extra={"error": str(exc)})
            return []

        history: List[Dict[str, Any]] = []
        for version in versions:
            payload = version.to_dict()
            history.append(
                {
                    "version_name": payload.get("version_name"),
                    "status": payload.get("status"),
                    "artifact_dir": payload.get("artifact_dir"),
                    "trained_at": payload.get("trained_at"),
                    "requested_by": payload.get("requested_by"),
                    "activated_at": payload.get("activated_at"),
                    "active_flag": payload.get("active_flag", False),
                }
            )
        return history

    def _build_metric_history(
        self,
        version_root: Path,
        _training_metrics: Optional[Dict[str, Any]],
        _training_metadata: Optional[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Collect representative training metrics for visualization."""

        snapshots: List[Tuple[str, Dict[str, Any], Optional[Dict[str, Any]]]] = []

        def append_snapshot(label: str, root: Path) -> None:
            metrics_payload = self._load_json_artifact(root, "training_metrics.json")
            metadata_payload = self._load_json_artifact(root, "training_metadata.json")
            if metrics_payload or metadata_payload:
                snapshots.append((label, metrics_payload or {}, metadata_payload))

        append_snapshot("current", version_root)

        deliverable_root = Path("deliverables/v1.0/models")
        if deliverable_root.exists():
            append_snapshot("v1.0", deliverable_root)

        history: List[Dict[str, Any]] = []
        for label, metrics_payload, metadata_payload in snapshots:
            entry: Dict[str, Any] = {"label": label, "metrics": metrics_payload}
            if metadata_payload:
                entry["metadata"] = metadata_payload
                training_info = metadata_payload.get("training_info", {})
                entry["timestamp"] = training_info.get("timestamp")
            if metrics_payload:
                entry.setdefault("timestamp", metrics_payload.get("completed_at"))
            history.append(entry)

        seen: set[Tuple[str, Optional[str]]] = set()
        unique_history: List[Dict[str, Any]] = []
        for item in history:
            key = (str(item.get("label")), item.get("timestamp"))
            if key in seen:
                continue
            seen.add(key)
            unique_history.append(item)

        unique_history.sort(key=lambda item: item.get("timestamp") or "", reverse=True)
        return unique_history

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

            if runtime_settings.get("time_profiles_enabled") and not time_profiles_path.exists():

                placeholder = {
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "strategy": str(

                        runtime_overrides.get(
                            "time_profile_strategy", trainer_cfg.time_profile_strategy
                        )

                        runtime_settings.get("time_profile_strategy", "sigma_profile")

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

            manifest_metadata: Dict[str, Any] = {
                "version": resolved_version,
                "source": "backend.api.training_service",
            completed_at = datetime.now(timezone.utc)

            manifest_metadata = {
                "version": version_name,

                "job": {
                    "id": job_id,
                    "requested_by": requested_by,
                    "dry_run": dry_run,
                    "started_at": started_at_dt.isoformat(),
                    "started_at": start_ts.isoformat(),
                    "completed_at": completed_at.isoformat(),
                },
                "metrics": metrics,
            }
            if projector_columns:
                manifest_metadata["projector_metadata_columns"] = list(projector_columns)
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

            except Exception as exc:  # pragma: no cover - 방어적 로깅
                logger.error(
                    "매니페스트 생성 실패",
                    extra={"job_id": job_id, "error": str(exc)},
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
    ) -> Dict[str, Any]:
        with self._lock:
            if status is not None:
                self._status.status = status
            if progress is not None:
                self._status.progress = max(0, min(100, progress))
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

            if status in {"failed", "completed"}:
                self._status.finished_at = datetime.utcnow().isoformat()

            save_status(self._status, self._status_path)
            return self._status.to_dict()
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
