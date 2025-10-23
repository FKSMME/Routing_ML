import os
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.api import create_app
from backend.api.schemas import AuthenticatedUser
from backend.api.security import require_admin


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("RSL_DATABASE_URL", "sqlite:///:memory:")
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def _make_user(*, is_admin: bool) -> AuthenticatedUser:
    now = datetime.now(timezone.utc)
    return AuthenticatedUser(
        username="test-user",
        display_name="Test User",
        status="approved",
        is_admin=is_admin,
        issued_at=now,
        expires_at=now,
        session_id="session-id",
        client_host="127.0.0.1",
    )


def test_admin_endpoints_enforce_authorization(client: TestClient) -> None:
    app = client.app
    endpoints = [
        "/api/workflow/config",
        "/api/training/features",
        "/api/logs/files",
        "/api/training/jobs",
    ]

    app.dependency_overrides[require_admin] = lambda: _make_user(is_admin=True)
    for endpoint in endpoints:
        response = client.get(endpoint)
        assert response.status_code in {200, 204}, endpoint

    app.dependency_overrides[require_admin] = lambda: (_ for _ in ()).throw(
        HTTPException(status_code=403, detail="forbidden")
    )
    for endpoint in endpoints:
        response = client.get(endpoint)
        assert response.status_code == 403, endpoint

    app.dependency_overrides.pop(require_admin, None)
