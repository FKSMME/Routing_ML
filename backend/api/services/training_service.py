"""학습 오케스트레이션 상태 조회 서비스."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

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
