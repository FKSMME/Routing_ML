"""학습 오케스트레이션 상태 조회 서비스."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

from backend.api.config import get_settings
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
        raise RuntimeError(message)


training_service = TrainingService()

__all__ = ["training_service", "TrainingService"]
