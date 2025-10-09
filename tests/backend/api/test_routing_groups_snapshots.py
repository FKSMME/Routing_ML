from __future__ import annotations

from pathlib import Path
from typing import Dict, Tuple

import pytest

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()

from fastapi.testclient import TestClient

from backend.api.config import get_settings
from backend.api.schemas import LoginRequest, RegisterRequest
from backend.models.routing_groups import RoutingGroup, session_scope


@pytest.fixture()
def routing_api_client(tmp_path: Path, monkeypatch) -> Tuple[TestClient, Dict[str, str]]:
    group_db = tmp_path / "routing_groups.db"
    rsl_db = tmp_path / "rsl.db"
    audit_dir = tmp_path / "audit"
    monkeypatch.setenv("ROUTING_ML_ROUTING_GROUPS_DATABASE_URL", f"sqlite:///{group_db}")
    monkeypatch.setenv("ROUTING_ML_RSL_DATABASE_URL", f"sqlite:///{rsl_db}")
    monkeypatch.setenv("ROUTING_ML_AUDIT_LOG_DIR", str(audit_dir))

    get_settings.cache_clear()  # type: ignore[attr-defined]
    settings = get_settings()

    import backend.models.routing_groups as routing_models

    routing_models._ENGINE = None  # type: ignore[attr-defined]
    routing_models._SESSION_FACTORY = None  # type: ignore[attr-defined]
    routing_models.bootstrap_schema()

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

    import backend.api.routes.audit as audit_routes

    audit_routes.settings = settings
    audit_routes.logger = get_logger("api.audit.ui", log_dir=settings.audit_log_dir)

    from backend.api.app import create_app

    client = TestClient(create_app())

    # Use unique username to avoid registration conflicts
    import uuid
    unique_username = f"snapshot_user_{uuid.uuid4().hex[:8]}"

    auth_service.register(
        RegisterRequest(username=unique_username, password="Secret123!", display_name="Snapshot QA"),
    )
    auth_service.approve_user(unique_username, make_admin=True)
    token = auth_service.login(
        LoginRequest(username=unique_username, password="Secret123!"),
        "testclient",
    ).token

    headers = {"Authorization": f"Bearer {token}"}

    yield client, headers

    client.close()


def _create_group(client: TestClient, headers: Dict[str, str]) -> Dict[str, str]:
    payload = {
        "group_name": "Offline Sync QA",
        "item_codes": ["ITEM-001"],
        "steps": [
            {
                "seq": 1,
                "process_code": "CUT",
                "duration_min": 12,
            }
        ],
        "erp_required": False,
    }
    response = client.post("/api/routing/groups", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_snapshot_sync_updates_metadata(routing_api_client: Tuple[TestClient, Dict[str, str]]) -> None:
    client, headers = routing_api_client
    group = _create_group(client, headers)

    snapshot_payload = {
        "snapshots": [
            {
                "id": "snap-1",
                "created_at": "2025-10-06T01:00:00Z",
                "state": {
                    "activeGroupId": group["group_id"],
                    "activeGroupVersion": group["version"],
                    "dirty": False,
                },
            }
        ],
        "audits": [
            {
                "id": "audit-1",
                "action": "routing.snapshot.flush",
                "level": "info",
                "message": "Sync succeeded",
                "created_at": "2025-10-06T01:00:01Z",
            }
        ],
        "source": "unit-test",
    }

    response = client.post("/api/routing/groups/snapshots", headers=headers, json=snapshot_payload)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["accepted_snapshot_ids"] == ["snap-1"]
    assert body["accepted_audit_ids"] == ["audit-1"]
    assert body["updated_groups"]
    update = body["updated_groups"][0]
    assert update["group_id"] == group["group_id"]
    assert update["dirty"] is False

    with session_scope() as session:
        persisted: RoutingGroup = session.get(RoutingGroup, group["group_id"])
        assert persisted.metadata_payload is not None
        workspace_state = persisted.metadata_payload.get("workspace_state", {})
        assert workspace_state.get("snapshot_id") == "snap-1"
        assert workspace_state.get("dirty") is False


def test_snapshot_sync_marks_dirty(routing_api_client: Tuple[TestClient, Dict[str, str]]) -> None:
    client, headers = routing_api_client
    group = _create_group(client, headers)

    snapshot_payload = {
        "snapshots": [
            {
                "id": "snap-2",
                "created_at": "2025-10-06T02:00:00Z",
                "state": {
                    "activeGroupId": group["group_id"],
                    "activeGroupVersion": group["version"],
                    "dirty": True,
                },
            }
        ],
        "audits": [],
    }

    response = client.post("/api/routing/groups/snapshots", headers=headers, json=snapshot_payload)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["accepted_snapshot_ids"] == ["snap-2"]
    assert body["accepted_audit_ids"] == []
    update = body["updated_groups"][0]
    assert update["dirty"] is True

    with session_scope() as session:
        persisted: RoutingGroup = session.get(RoutingGroup, group["group_id"])
        workspace_state = persisted.metadata_payload.get("workspace_state", {})
        assert workspace_state.get("dirty") is True
        assert workspace_state.get("snapshot_id") == "snap-2"

