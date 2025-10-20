from pathlib import Path
from typing import Iterator

import os
import pytest
import sys

os.environ.setdefault("TESTING", "true")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.api.config import Settings, get_settings
from backend.api.schemas import (
    AdminResetPasswordRequest,
    BulkRegisterRequest,
    BulkRegisterUser,
    LoginRequest,
    RegisterRequest,
)
from backend.api.services.auth_service import AuthService
from backend.database_rsl import Base, UserAccount, get_engine, session_scope
import backend.database_rsl as database_rsl
from common.datetime_utils import utc_now_naive


@pytest.fixture()
def isolated_settings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Settings]:
    db_path = tmp_path / "auth.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db_url = db_path.as_posix()
    monkeypatch.setenv("RSL_DATABASE_URL", f"sqlite:///{db_url}")
    monkeypatch.setenv("JWT_SECRET_KEY", "unit-test-secret")
    get_settings.cache_clear()

    database_rsl._ENGINE = None
    database_rsl._SESSION_FACTORY = None

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


def test_reset_password_admin_updates_hash(isolated_settings: Settings) -> None:
    service = AuthService(settings=isolated_settings)
    service.register(RegisterRequest(username="reset-me", password="Secret!23"))
    service.approve_user("reset-me")

    response = service.reset_password_admin(
        AdminResetPasswordRequest(
            username="reset-me",
            temp_password=None,
            force_change=True,
            notify=False,
        ),
        admin_username="tester-admin",
    )

    assert response.username == "reset-me"
    assert response.force_change is True
    user = _get_user("reset-me")
    assert user.must_change_password is True
    assert user.password_hash != "Secret!23"


def test_bulk_register_creates_and_updates(isolated_settings: Settings) -> None:
    service = AuthService(settings=isolated_settings)

    request = BulkRegisterRequest(
        users=[
            BulkRegisterUser(username="bulk-a", password=None, display_name="Bulk A"),
            BulkRegisterUser(username="bulk-b", password="Temp!23", make_admin=True),
        ],
        auto_approve=True,
        force_password_change=True,
        notify=False,
        overwrite_existing=False,
    )

    result = service.bulk_register(request, admin_username="batch-admin")
    assert len(result.successes) == 2
    assert not result.failures

    # Update existing user with overwrite flag
    update_request = BulkRegisterRequest(
        users=[BulkRegisterUser(username="bulk-a", display_name="Bulk A+", password="Another!1")],
        auto_approve=True,
        force_password_change=False,
        notify=False,
        overwrite_existing=True,
    )
    update_result = service.bulk_register(update_request, admin_username="batch-admin")
    assert update_result.successes[0].status == "updated"
    updated_user = _get_user("bulk-a")
    assert updated_user.display_name == "Bulk A+"


def test_list_users_supports_filters(isolated_settings: Settings) -> None:
    service = AuthService(settings=isolated_settings)
    service.register(RegisterRequest(username="filter-pending", password="Secret!23"))
    service.register(RegisterRequest(username="filter-approved", password="Secret!23"))
    service.approve_user("filter-approved")

    all_users = service.list_users()
    assert any(item.username == "filter-approved" for item in all_users.users)

    approved_only = service.list_users(status="approved")
    assert all(item.status == "approved" for item in approved_only.users)

    search_hit = service.list_users(search="approved")
    assert any(item.username == "filter-approved" for item in search_hit.users)
