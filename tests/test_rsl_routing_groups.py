"""Integration tests for the RSL-based routing group endpoints."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Tuple

import pytest

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()

from fastapi.testclient import TestClient

from backend.api.config import get_settings
from backend.api.schemas import LoginRequest, RegisterRequest


@pytest.fixture()
def api_client(tmp_path: Path, monkeypatch) -> Tuple[TestClient, Dict[str, str]]:
    """Provide a FastAPI test client with an isolated SQLite database."""

    db_path = tmp_path / "rsl_test.db"
    monkeypatch.setenv("ROUTING_ML_RSL_DATABASE_URL", f"sqlite:///{db_path}")

    # Ensure settings and dependent singletons pick up the temp database.
    get_settings.cache_clear()  # type: ignore[attr-defined]
    settings = get_settings()

    import backend.database_rsl as database_rsl

    database_rsl._ENGINE = None  # type: ignore[attr-defined]
    database_rsl._SESSION_FACTORY = None  # type: ignore[attr-defined]

    import backend.api.session_manager as session_manager

    session_manager._jwt_manager = None  # type: ignore[attr-defined]

    from backend.api.services.auth_service import AuthService

    auth_service = AuthService(settings=settings, jwt_manager=session_manager.get_jwt_manager())

    import backend.api.services.auth_service as auth_service_module

    auth_service_module.auth_service = auth_service

    import backend.api.security as security_module

    security_module.auth_service = auth_service

    import backend.api.routes.auth as auth_routes

    auth_routes.auth_service = auth_service
    auth_routes.login_service = auth_service.login

    import backend.api.routes.rsl as rsl_routes
    from common.logger import get_logger

    rsl_routes.settings = settings
    rsl_routes.audit_logger = get_logger("rsl.audit", log_dir=settings.audit_log_dir, use_json=True)

    from backend.api.app import create_app

    client = TestClient(create_app())

    # Register, approve, and authenticate a test user.
    auth_service.register(
        RegisterRequest(username="qa_user", password="Secret123!", display_name="QA User")
    )
    auth_service.approve_user("qa_user", make_admin=True)
    token = auth_service.login(LoginRequest(username="qa_user", password="Secret123!"), "testclient").token

    headers = {"Authorization": f"Bearer {token}"}

    yield client, headers

    client.close()


def test_create_group_success(api_client: Tuple[TestClient, Dict[str, str]]) -> None:
    client, headers = api_client

    response = client.post(
        "/api/rsl/groups",
        headers=headers,
        json={"name": "QA Routing Group", "description": "ERP off", "tags": ["qa", "erp:off"]},
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "QA Routing Group"
    assert body["owner"] == "qa_user"
    assert body["erp_required"] is False


def test_duplicate_step_sequence_conflict(api_client: Tuple[TestClient, Dict[str, str]]) -> None:
    client, headers = api_client

    group_resp = client.post(
        "/api/rsl/groups",
        headers=headers,
        json={"name": "Step Conflict", "tags": ["qa"]},
    )
    group_id = group_resp.json()["id"]

    first_step = {
        "name": "Cutting",
        "sequence": 1,
        "status": "draft",
        "tags": ["cutting"],
        "rules": [],
    }
    conflict_step = {
        "name": "Drilling",
        "sequence": 1,
        "status": "draft",
        "tags": ["drilling"],
        "rules": [],
    }

    ok_resp = client.post(
        f"/api/rsl/groups/{group_id}/steps",
        headers=headers,
        json=first_step,
    )
    assert ok_resp.status_code == 201, ok_resp.text

    conflict_resp = client.post(
        f"/api/rsl/groups/{group_id}/steps",
        headers=headers,
        json=conflict_step,
    )

    assert conflict_resp.status_code == 400
    assert "중복된 공정 순번" in conflict_resp.json()["detail"]


def test_create_group_with_erp_flag(api_client: Tuple[TestClient, Dict[str, str]]) -> None:
    client, headers = api_client

    payload = {
        "name": "ERP Required",
        "tags": ["qa"],
        "erp_required": True,
    }
    response = client.post("/api/rsl/groups", headers=headers, json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["erp_required"] is True
    assert body["tags"] == ["qa"]


def test_update_group_toggles_erp_flag(api_client: Tuple[TestClient, Dict[str, str]]) -> None:
    client, headers = api_client

    create_resp = client.post(
        "/api/rsl/groups",
        headers=headers,
        json={"name": "Toggle ERP", "tags": ["qa"]},
    )
    group = create_resp.json()
    assert group["erp_required"] is False

    update_resp = client.patch(
        f"/api/rsl/groups/{group['id']}",
        headers=headers,
        json={"erp_required": True},
    )
    assert update_resp.status_code == 200, update_resp.text
    updated = update_resp.json()
    assert updated["erp_required"] is True
