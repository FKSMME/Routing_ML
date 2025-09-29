"""Windows 인증 서비스 PoC 테스트."""
from __future__ import annotations

import hashlib
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

import pytest
import types
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover - 타입 검사 전용
    from backend.api.config import Settings

# 필요한 외부 모듈이 설치되지 않은 환경에서도 테스트가 동작하도록 최소 스텁을 주입한다.
if "ldap3" not in sys.modules:
    class _DummyConnection:
        def __init__(self, *args, **kwargs) -> None:
            pass

        def bind(self) -> bool:  # pragma: no cover - LDAP 호출은 테스트에서 사용하지 않음
            return True

        def unbind(self) -> None:  # pragma: no cover
            pass

    ldap3_stub = types.SimpleNamespace(
        ALL="ALL",
        Connection=_DummyConnection,
        NTLM="NTLM",
        Server=lambda *args, **kwargs: object(),
        Tls=lambda *args, **kwargs: object(),
    )
    sys.modules["ldap3"] = ldap3_stub
    core_module = types.ModuleType("ldap3.core")
    exceptions_module = types.ModuleType("ldap3.core.exceptions")
    exceptions_module.LDAPException = Exception
    sys.modules["ldap3.core"] = core_module
    sys.modules["ldap3.core.exceptions"] = exceptions_module


PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


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
def fallback_settings(tmp_path: Path) -> "Settings":
    """폴백 사용자만 사용하는 Settings 인스턴스."""

    from backend.api.config import Settings

    hashed = hashlib.sha256("Secr3t!".encode("utf-8")).hexdigest()
    return Settings(
        windows_auth_enabled=False,
        windows_ldap_server=None,
        windows_fallback_users={"codex": f"sha256${hashed}"},
        windows_domain="EXAMPLE",
        audit_log_dir=tmp_path / "audit",
    )


def test_windows_auth_service_fallback_success(fallback_settings: "Settings") -> None:
    """폴백 사용자로 로그인하면 세션이 발급된다."""

    from backend.api.schemas import LoginRequest
    from backend.api.services.auth_service import WindowsAuthService

    session_manager = DummySessionManager()
    service = WindowsAuthService(settings=fallback_settings, session_manager=session_manager)

    request = LoginRequest(username="codex", password="Secr3t!")
    result = service.authenticate(request, client_host="127.0.0.1")

    assert result.success is True
    assert result.session is session_manager.created[0]
    expected_username = f"{fallback_settings.windows_domain}\\codex"
    assert session_manager.created[0].username == expected_username


def test_windows_auth_service_rejects_unknown_user(fallback_settings: "Settings") -> None:
    """미등록 사용자는 인증에 실패한다."""

    from backend.api.schemas import LoginRequest
    from backend.api.services.auth_service import WindowsAuthService

    fallback_settings.windows_fallback_users = {"codex": fallback_settings.windows_fallback_users["codex"]}
    service = WindowsAuthService(settings=fallback_settings, session_manager=DummySessionManager())

    request = LoginRequest(username="intruder", password="bad")
    result = service.authenticate(request, client_host=None)

    assert result.success is False
    assert result.session is None
    assert "실패" in result.message
