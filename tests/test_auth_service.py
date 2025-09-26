"""Windows 인증 서비스 PoC 테스트."""
from __future__ import annotations

import hashlib
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.api.config import Settings
from backend.api.schemas import LoginRequest
from backend.api.services.auth_service import WindowsAuthService


@dataclass
class DummySessionRecord:
    token: str
    username: str
    display_name: str | None
    domain: str | None
    issued_at: datetime
    expires_at: datetime
    client_host: str | None


class DummySessionManager:
    """테스트용 인메모리 세션 매니저."""

    def __init__(self) -> None:
        self.created: list[DummySessionRecord] = []

    def create_session(
        self,
        *,
        username: str,
        display_name: str | None,
        domain: str | None,
        client_host: str | None,
    ) -> DummySessionRecord:
        record = DummySessionRecord(
            token="test-token",
            username=username,
            display_name=display_name,
            domain=domain,
            issued_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(minutes=30),
            client_host=client_host,
        )
        self.created.append(record)
        return record


@pytest.fixture()
def fallback_settings(tmp_path: Path) -> Settings:
    """폴백 사용자만 사용하는 Settings 인스턴스."""

    hashed = hashlib.sha256("Secr3t!".encode("utf-8")).hexdigest()
    return Settings(
        windows_auth_enabled=False,
        windows_ldap_server=None,
        windows_fallback_users={"codex": f"sha256${hashed}"},
        windows_domain="EXAMPLE",
        audit_log_dir=tmp_path / "audit",
    )


def test_windows_auth_service_fallback_success(fallback_settings: Settings) -> None:
    """폴백 사용자로 로그인하면 세션이 발급된다."""

    session_manager = DummySessionManager()
    service = WindowsAuthService(settings=fallback_settings, session_manager=session_manager)

    request = LoginRequest(username="codex", password="Secr3t!")
    result = service.authenticate(request, client_host="127.0.0.1")

    assert result.success is True
    assert result.session is session_manager.created[0]
    expected_username = f"{fallback_settings.windows_domain}\\codex"
    assert session_manager.created[0].username == expected_username


def test_windows_auth_service_rejects_unknown_user(fallback_settings: Settings) -> None:
    """미등록 사용자는 인증에 실패한다."""

    fallback_settings.windows_fallback_users = {"codex": fallback_settings.windows_fallback_users["codex"]}
    service = WindowsAuthService(settings=fallback_settings, session_manager=DummySessionManager())

    request = LoginRequest(username="intruder", password="bad")
    result = service.authenticate(request, client_host=None)

    assert result.success is False
    assert result.session is None
    assert "실패" in result.message
