from pathlib import Path
from typing import Iterator

import pytest

import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.api.config import Settings, get_settings
from backend.api.schemas import LoginRequest, RegisterRequest
from backend.api.services.auth_service import AuthService
from backend.database_rsl import Base, UserAccount, get_engine, session_scope
from common.datetime_utils import utc_now_naive


@pytest.fixture()
def isolated_settings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Settings]:
    db_path = tmp_path / "auth.db"
    monkeypatch.setenv("ROUTING_ML_RSL_DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("ROUTING_ML_JWT_SECRET_KEY", "unit-test-secret")
    get_settings.cache_clear()
    settings = get_settings()

    engine = get_engine()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    yield settings

    get_settings.cache_clear()


def _get_user(username: str) -> UserAccount:
    with session_scope() as session:
        user = (
            session.query(UserAccount)
            .filter(UserAccount.username == username)
            .one()
        )
        session.expunge(user)
        return user


def test_register_creates_pending_user(isolated_settings: Settings) -> None:
    service = AuthService(settings=isolated_settings)

    response = service.register(
        RegisterRequest(username="tester", password="Secret!23", display_name="Tester"),
    )

    assert response.status == "pending"
    user = _get_user("tester")
    assert user.status == "pending"
    assert user.display_name == "Tester"
    assert user.password_hash != "Secret!23"


def test_login_requires_approval(isolated_settings: Settings) -> None:
    service = AuthService(settings=isolated_settings)
    service.register(RegisterRequest(username="pending", password="Secret!23"))

    with pytest.raises(PermissionError):
        service.login(LoginRequest(username="pending", password="Secret!23"), client_host=None)


def test_approve_and_login_success(isolated_settings: Settings) -> None:
    service = AuthService(settings=isolated_settings)
    service.register(RegisterRequest(username="active", password="Secret!23"))
    service.approve_user("active")

    response = service.login(
        LoginRequest(username="active", password="Secret!23"),
        client_host="127.0.0.1",
    )

    assert response.status == "approved"
    assert response.token
    assert response.issued_at <= utc_now_naive()
    assert response.expires_at > response.issued_at


def test_reject_sets_status(isolated_settings: Settings) -> None:
    service = AuthService(settings=isolated_settings)
    service.register(RegisterRequest(username="reject-me", password="Secret!23"))
    service.reject_user("reject-me", reason="mismatch")

    user = _get_user("reject-me")
    assert user.status == "rejected"
    assert user.rejected_at is not None
