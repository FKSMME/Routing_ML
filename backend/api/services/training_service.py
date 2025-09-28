"""학습 오케스트레이션 서비스."""
from __future__ import annotations

import json
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd

from backend.api.config import get_settings
from backend.maintenance.model_registry import register_version
from backend.trainer_ml import train_model_with_ml_improved
from common.config_store import workflow_config_store
from common.logger import get_logger

performance_logger = get_logger("training.performance", log_dir=Path("logs/performance"))
logger = get_logger("api.training")


@dataclass
class TrainingStatus:
    job_id: Optional[str] = None
    status: str = "idle"
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    progress: int = 0
    message: Optional[str] = None
    version_path: Optional[str] = None
    metrics: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "progress": self.progress,
            "message": self.message,
            "version_path": self.version_path,
            "metrics": self.metrics,
        }


class TrainingService:
    """모델 학습 실행/상태 관리."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._status = TrainingStatus()
        self._thread: Optional[threading.Thread] = None

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            return self._status.to_dict()

    def start_training(
        self,
        *,
        requested_by: str,
        version_label: Optional[str] = None,
        projector_metadata: Optional[list[str]] = None,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        with self._lock:
            if self._status.status == "running":
                raise RuntimeError("이미 학습 작업이 실행 중입니다")

            job_id = datetime.utcnow().strftime("train-%Y%m%d%H%M%S")
            self._status = TrainingStatus(
                job_id=job_id,
                status="running",
                started_at=datetime.utcnow().isoformat(),
                progress=1,
                message="데이터 소스 초기화 중",
            )

            self._thread = threading.Thread(
                target=self._run_training,
                kwargs={
                    "job_id": job_id,
                    "requested_by": requested_by,
                    "version_label": version_label,
                    "projector_metadata": projector_metadata,
                    "dry_run": dry_run,
                },
                daemon=True,
            )
            self._thread.start()
            logger.info("학습 작업 시작", extra={"job_id": job_id, "requested_by": requested_by})
            return self._status.to_dict()

    def _run_training(
        self,
        *,
        job_id: str,
        requested_by: str,
        version_label: Optional[str],
        projector_metadata: Optional[list[str]],
        dry_run: bool,
    ) -> None:
        start_time = time.time()
        version_time = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        version_name = version_label or f"version_{version_time}"
        version_dir = Path("models") / version_name
        version_dir.mkdir(parents=True, exist_ok=True)

        data_cfg = workflow_config_store.get_data_source_config()
        viz_cfg = workflow_config_store.get_visualization_config()

        meta = {
            "job_id": job_id,
            "requested_by": requested_by,
            "started_at": datetime.utcnow().isoformat(),
            "data_source": data_cfg.to_dict(),
            "visualization": viz_cfg.to_dict(),
            "dry_run": dry_run,
        }
        (version_dir / "training_request.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=2),
            encoding="utf-8",
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
            manifest_path = version_dir / "manifest.json"
            manifest_payload = {
                "version": version_name,
                "job_id": job_id,
                "requested_by": requested_by,
                "started_at": meta["started_at"],
                "completed_at": completed_at.isoformat(),
                "artifacts": {
                    "metrics": str((version_dir / "training_metrics.json").resolve()),
                },
                "metrics": metrics,
            }
            manifest_path.write_text(
                json.dumps(manifest_payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
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


training_service = TrainingService()

__all__ = ["training_service", "TrainingService", "TrainingStatus"]
