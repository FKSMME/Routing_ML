"""Audit-related API routes for batch submission of UI events."""
from __future__ import annotations

import json
import threading
import uuid
from datetime import date, datetime
from typing import Any, Sequence

from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel, Field

from backend.api.config import get_settings
from common.datetime_utils import utc_isoformat
from common.logger import get_logger

router = APIRouter(prefix="/api/audit", tags=["audit"])
logger = get_logger("api.audit.ui")
settings = get_settings()

AUDIT_LOG_FILE_NAME = "ui_actions.log"
_AUDIT_LOG_LOCK = threading.Lock()


def _json_default(value: Any) -> Any:
    """Best-effort JSON serializer for complex objects."""

    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, set):
        return sorted(value)
    return str(value)


class AuditEvent(BaseModel):
    """Represents a single UI audit event payload."""

    action: str = Field(..., description="Short action label recorded in the audit log.")
    username: str | None = Field(
        default=None, description="Username responsible for the action if available.",
    )
    ip_address: str | None = Field(
        default=None, description="Client IP address captured by the UI.",
    )
    payload: dict[str, Any] | None = Field(
        default=None, description="Additional context to store alongside the action.",
    )


class UiAuditBatchRequest(BaseModel):
    """Batch submission payload for UI audit events."""

    events: Sequence[AuditEvent] = Field(
        default_factory=list,
        description="Collection of events captured locally before being flushed to the server.",
    )
    source: str | None = Field(
        default=None,
        max_length=64,
        description="Optional identifier describing the producer of this batch.",
    )


def persist_ui_audit_events(
    events: Sequence[AuditEvent],
    request: Request,
    *,
    batch_id: str | None = None,
    source: str | None = None,
) -> int:
    """Append UI audit events to the JSON lines log file.

    Parameters
    ----------
    events:
        List of events to persist.
    request:
        FastAPI request, used for deriving fallback client IP information.

    Returns
    -------
    int
        Number of events written to the audit log.
    """

    if not events:
        return 0

    audit_dir = settings.audit_log_dir
    audit_dir.mkdir(parents=True, exist_ok=True)
    log_file = audit_dir / AUDIT_LOG_FILE_NAME
    fallback_ip = request.client.host if request.client else None

    written = 0
    batch_identifier = batch_id or uuid.uuid4().hex
    try:
        with _AUDIT_LOG_LOCK:
            with log_file.open("a", encoding="utf-8") as fp:
                for event in events:
                    record = {
                        "timestamp": utc_isoformat(),
                        "batch_id": batch_identifier,
                        "source": source,
                        "action": event.action,
                        "username": event.username,
                        "ip_address": event.ip_address or fallback_ip,
                        "payload": event.payload,
                    }
                    fp.write(json.dumps(record, ensure_ascii=False, default=_json_default) + "\n")
                    written += 1
    except OSError as exc:  # pragma: no cover - surfaced via tests
        logger.error(
            "workspace.audit.write_failed",
            extra={"error": str(exc), "path": str(log_file)},
        )
        return 0

    return written


def read_persisted_ui_audit_events(limit: int | None = None) -> list[dict[str, Any]]:
    """Read persisted UI audit events from the JSONL log file."""

    log_file = settings.audit_log_dir / AUDIT_LOG_FILE_NAME
    if not log_file.exists():
        return []

    events: list[dict[str, Any]] = []
    with log_file.open("r", encoding="utf-8") as fp:
        for line in fp:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                logger.warning("workspace.audit.decode_failed", extra={"line": line})
                continue
            events.append(record)

    if limit is not None and limit >= 0:
        return events[-limit:]
    return events


@router.get("/ui/events")
async def get_ui_audit_events(
    limit: int | None = None,
    action_filter: str | None = None,
    username_filter: str | None = None,
) -> list[dict[str, Any]]:
    """
    Retrieve persisted UI audit events.

    Args:
        limit: Maximum number of events to return (most recent)
        action_filter: Filter events by action name (case-insensitive substring match)
        username_filter: Filter events by username (case-insensitive substring match)

    Returns:
        List of audit event records
    """
    events = read_persisted_ui_audit_events(limit=limit)

    # Apply filters if provided
    if action_filter:
        action_lower = action_filter.lower()
        events = [
            e for e in events
            if e.get("action") and action_lower in e["action"].lower()
        ]

    if username_filter:
        username_lower = username_filter.lower()
        events = [
            e for e in events
            if e.get("username") and username_lower in e["username"].lower()
        ]

    return events


@router.post(
    "/ui/batch",
    status_code=status.HTTP_202_ACCEPTED,
    response_class=Response,
)
async def record_ui_audit_batch(payload: UiAuditBatchRequest, request: Request) -> Response:
    """Persist a batch of UI audit events produced by the frontend store."""

    batch_identifier = uuid.uuid4().hex
    written = persist_ui_audit_events(
        payload.events,
        request,
        batch_id=batch_identifier,
        source=payload.source,
    )
    if written == 0:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    logger.info(
        "workspace.audit.batch",
        extra={"count": written, "source": payload.source, "batch_id": batch_identifier},
    )
    return Response(status_code=status.HTTP_202_ACCEPTED)


__all__ = [
    "AuditEvent",
    "UiAuditBatchRequest",
    "persist_ui_audit_events",
    "read_persisted_ui_audit_events",
    "record_ui_audit_batch",
    "router",
]
