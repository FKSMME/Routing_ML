"""Utilities for persisting training run state for API consumption."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

DEFAULT_STATUS_PATH = Path("logs/training/status.json")


@dataclass
class TrainingStatusPayload:
    """Serializable representation of the latest training run."""

    job_id: Optional[str] = None
    status: str = "idle"
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    progress: int = 0
    message: Optional[str] = None
    version_path: Optional[str] = None
    metrics: Dict[str, Any] = field(default_factory=dict)
    updated_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["metrics"] = dict(self.metrics)
        return payload

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "TrainingStatusPayload":
        return cls(
            job_id=payload.get("job_id"),
            status=str(payload.get("status", "idle")),
            started_at=payload.get("started_at"),
            finished_at=payload.get("finished_at"),
            progress=int(payload.get("progress", 0)),
            message=payload.get("message"),
            version_path=payload.get("version_path"),
            metrics=dict(payload.get("metrics", {})),
            updated_at=payload.get("updated_at"),
        )


def load_status(path: Path = DEFAULT_STATUS_PATH) -> TrainingStatusPayload:
    """Load the most recent training status from ``path`` if it exists."""

    status_path = Path(path)
    if not status_path.exists():
        return TrainingStatusPayload()

    try:
        raw = json.loads(status_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        # Corrupted file, fall back to idle state while preserving timestamp.
        return TrainingStatusPayload(status="unknown", message="status file corrupt")

    return TrainingStatusPayload.from_dict(raw)


def save_status(record: TrainingStatusPayload, path: Path = DEFAULT_STATUS_PATH) -> None:
    """Persist ``record`` to ``path`` in JSON format."""

    status_path = Path(path)
    status_path.parent.mkdir(parents=True, exist_ok=True)
    payload = record.to_dict()
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    status_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


__all__ = [
    "DEFAULT_STATUS_PATH",
    "TrainingStatusPayload",
    "load_status",
    "save_status",
]
