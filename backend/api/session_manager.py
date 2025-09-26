"""세션 관리 모듈."""
from __future__ import annotations

import secrets
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Optional

from backend.api.config import get_settings
from backend.api.schemas import AuthenticatedUser
from common.logger import get_logger


@dataclass
class SessionRecord:
    token: str
    username: str
    display_name: Optional[str]
    domain: Optional[str]
    issued_at: datetime
    expires_at: datetime
    client_host: Optional[str]

    def to_user(self) -> AuthenticatedUser:
        return AuthenticatedUser(
            username=self.username,
            display_name=self.display_name,
            domain=self.domain,
            issued_at=self.issued_at,
            expires_at=self.expires_at,
            session_id=self.token,
            client_host=self.client_host,
        )


class SessionManager:
    """인메모리 세션 저장소."""

    def __init__(self, ttl_seconds: int) -> None:
        self._ttl = ttl_seconds
        self._records: Dict[str, SessionRecord] = {}
        self._lock = threading.Lock()
        self._logger = get_logger(
            "auth.session",
            log_dir=get_settings().audit_log_dir,
            use_json=True,
        )

    def create_session(
        self,
        username: str,
        *,
        display_name: Optional[str],
        domain: Optional[str],
        client_host: Optional[str],
    ) -> SessionRecord:
        with self._lock:
            now = datetime.utcnow()
            token = secrets.token_urlsafe(32)
            record = SessionRecord(
                token=token,
                username=username,
                display_name=display_name,
                domain=domain,
                issued_at=now,
                expires_at=now + timedelta(seconds=self._ttl),
                client_host=client_host,
            )
            self._records[token] = record
            self._logger.info(
                "세션 발급",
                extra={
                    "username": username,
                    "domain": domain,
                    "client_host": client_host,
                    "issued_at": record.issued_at.isoformat(),
                    "expires_at": record.expires_at.isoformat(),
                },
            )
            return record

    def validate(self, token: str) -> Optional[SessionRecord]:
        with self._lock:
            record = self._records.get(token)
            if record is None:
                return None
            if record.expires_at < datetime.utcnow():
                self._records.pop(token, None)
                self._logger.info(
                    "세션 만료",
                    extra={
                        "username": record.username,
                        "token": token,
                    },
                )
                return None
            return record

    def revoke(self, token: str) -> None:
        with self._lock:
            record = self._records.pop(token, None)
            if record:
                self._logger.info(
                    "세션 종료",
                    extra={
                        "username": record.username,
                        "token": token,
                    },
                )


_session_manager: Optional[SessionManager] = None
_session_lock = threading.Lock()


def get_session_manager() -> SessionManager:
    global _session_manager
    if _session_manager is None:
        with _session_lock:
            if _session_manager is None:
                settings = get_settings()
                _session_manager = SessionManager(ttl_seconds=settings.session_ttl_seconds)
    return _session_manager  # type: ignore[return-value]


__all__ = ["SessionRecord", "SessionManager", "get_session_manager"]
