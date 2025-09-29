"""학습 오케스트레이션 상태 조회 서비스."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from backend.api.config import get_settings

from backend.maintenance.model_registry import register_version
from backend.trainer_ml import TRAINER_RUNTIME_SETTINGS, train_model_with_ml_improved
from common.config_store import workflow_config_store

from backend.maintenance.model_registry import list_versions

from common.logger import get_logger
from common.training_state import DEFAULT_STATUS_PATH, load_status

logger = get_logger("api.training")


class TrainingService:
    """Expose scheduler produced training state to the API layer."""

    def __init__(self, *, status_path: Optional[Path] = None) -> None:
        self._status_path = status_path or DEFAULT_STATUS_PATH
        self._registry_path = get_settings().model_registry_path

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
        projector_metadata: Optional[list[str]] = None,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        del requested_by, version_label, projector_metadata, dry_run
        message = (
            "API를 통한 학습 실행은 비활성화되었습니다. "
            "Windows 작업 스케줄러 혹은 PowerShell 서비스에서 "
            "`python scripts/train_build_index.py --dataset <path> --save-dir <dir>`을 실행해 주세요."
        )

        settings = get_settings()

        try:
            self._update_status(progress=10, message="데이터 로딩 준비")
            dataset = self._load_dataset(data_cfg)
            sample_count = len(dataset)
            self._update_status(progress=30, message=f"샘플 {sample_count}건 전처리")

            if dry_run:
                time.sleep(1.0)
                trained = None
            else:
                trained = train_model_with_ml_improved(
                    dataset,
                    save_dir=version_dir,
                    export_tb_projector=True,
                    projector_metadata_cols=projector_metadata or viz_cfg.projector_metadata_columns,
                )

            duration = time.time() - start_time
            completed_at = datetime.utcnow()
            metrics = {
                "duration_sec": round(duration, 2),
                "samples": sample_count,
                "dry_run": dry_run,
                "saved_dir": str(version_dir),
            }
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
            (version_dir / "training_metrics.json").write_text(
                json.dumps(metrics, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            time_profiles_path = version_dir / "time_profiles.json"
            if (
                TRAINER_RUNTIME_SETTINGS.get("time_profiles_enabled")
                and not time_profiles_path.exists()
            ):
                placeholder = {
                    "generated_at": datetime.utcnow().isoformat(),
                    "strategy": str(
                        TRAINER_RUNTIME_SETTINGS.get(
                            "time_profile_strategy", "sigma_profile"
                        )
                    ),
                    "time_columns": [],
                    "columns": {},
                    "profiles": {"OPT": {}, "STD": {}, "SAFE": {}},
                    "parameters": {
                        "trim_std_enabled": bool(
                            TRAINER_RUNTIME_SETTINGS.get("trim_std_enabled", True)
                        ),
                        "trim_lower_percent": float(
                            TRAINER_RUNTIME_SETTINGS.get("trim_lower_percent", 0.05)
                        ),
                        "trim_upper_percent": float(
                            TRAINER_RUNTIME_SETTINGS.get("trim_upper_percent", 0.95)
                        ),
                        "optimal_sigma": float(
                            TRAINER_RUNTIME_SETTINGS.get("time_profile_optimal_sigma", 0.67)
                        ),
                        "safe_sigma": float(
                            TRAINER_RUNTIME_SETTINGS.get("time_profile_safe_sigma", 1.28)
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
            manifest_metadata = {
                "version": version_name,
                "job": {
                    "id": job_id,
                    "requested_by": requested_by,
                    "dry_run": dry_run,
                    "started_at": meta["started_at"],
                    "completed_at": completed_at.isoformat(),
                },
                "metrics": metrics,
            }
            if projector_metadata:
                manifest_metadata["projector_metadata_columns"] = list(projector_metadata)
            files_payload = {}
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
                logger.info("매니페스트 생성 완료", extra={"job_id": job_id, "manifest": str(manifest_path)})
            except Exception as exc:
                logger.error("매니페스트 생성 실패", extra={"job_id": job_id, "error": str(exc)})
                manifest_path = version_dir / "manifest.json"

            if not dry_run:
                try:
                    register_version(
                        db_path=settings.model_registry_path,
                        version_name=version_name,
                        artifact_dir=version_dir.resolve(),
                        manifest_path=manifest_path.resolve(),
                        requested_by=requested_by,
                        trained_at=completed_at,
                    )
                except Exception as registry_error:  # pragma: no cover - 관측 목적
                    logger.exception(
                        "모델 레지스트리 업데이트 실패", extra={"job_id": job_id, "error": str(registry_error)}
                    )


            if trained is None:
                logger.info("학습 드라이런 완료", extra={"job_id": job_id})
            else:
                logger.info("학습 완료", extra={"job_id": job_id, "duration": duration})
        except Exception as exc:  # pragma: no cover - 런타임 실패 보호
            logger.exception("학습 작업 실패", extra={"job_id": job_id})
            performance_logger.error("training.failed", extra={"job_id": job_id, "error": str(exc)})
            self._update_status(status="failed", progress=100, message=str(exc))
        finally:
            with self._lock:
                self._thread = None

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
    ) -> None:
        with self._lock:
            if status:
                self._status.status = status
            if progress is not None:
                self._status.progress = progress
            if message:
                self._status.message = message
            if version_path:
                self._status.version_path = version_path
            if metrics:
                self._status.metrics = metrics
            if status in {"failed", "completed"}:
                self._status.finished_at = datetime.utcnow().isoformat()

        raise RuntimeError(message)



training_service = TrainingService()

__all__ = ["training_service", "TrainingService"]
