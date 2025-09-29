"""Audit-related API routes for batch submission of UI events."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Sequence

from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel, Field

from backend.api.config import get_settings
from common.logger import get_logger

router = APIRouter(prefix="/api/audit", tags=["audit"])
logger = get_logger("api.audit.ui")
settings = get_settings()


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


def persist_ui_audit_events(events: Sequence[AuditEvent], request: Request) -> int:
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
    log_file = audit_dir / "ui_actions.log"
    fallback_ip = request.client.host if request.client else None

    written = 0
    with log_file.open("a", encoding="utf-8") as fp:
        for event in events:
            record = {
                "timestamp": datetime.utcnow().isoformat(),
                "action": event.action,
                "username": event.username,
                "ip_address": event.ip_address or fallback_ip,
                "payload": event.payload,
            }
            fp.write(json.dumps(record, ensure_ascii=False) + "\n")
            written += 1

    return written


@router.post(
    "/ui/batch",
    status_code=status.HTTP_202_ACCEPTED,
    response_class=Response,
)
async def record_ui_audit_batch(payload: UiAuditBatchRequest, request: Request) -> Response:
    """Persist a batch of UI audit events produced by the frontend store."""

    written = persist_ui_audit_events(payload.events, request)
    if written == 0:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    logger.info(
        "workspace.audit.batch",
        extra={"count": written, "source": payload.source},
    )
    return Response(status_code=status.HTTP_202_ACCEPTED)


__all__ = [
    "AuditEvent",
    "UiAuditBatchRequest",
    "persist_ui_audit_events",
    "record_ui_audit_batch",
    "router",
]
