from __future__ import annotations

from datetime import datetime, timedelta
from common.datetime_utils import utc_now
import os
import sys
import types
from typing import Dict, Tuple

import pytest
from fastapi.testclient import TestClient

class _StubPasswordHasher:
    def hash(self, password: str) -> str:
        return f"stub:{password}"

    def verify(self, hashed: str, password: str) -> bool:
        return True


argon2_stub = types.SimpleNamespace(
    PasswordHasher=_StubPasswordHasher,
    exceptions=types.SimpleNamespace(VerifyMismatchError=Exception, VerificationError=Exception),
)
sys.modules.setdefault("argon2", argon2_stub)
sys.modules.setdefault("argon2.exceptions", argon2_stub.exceptions)

security_stub = types.ModuleType("backend.api.security")

async def _require_auth(user=None):
    return user

security_stub.require_auth = _require_auth
sys.modules.setdefault("backend.api.security", security_stub)

sys.modules.setdefault(
    "pyodbc",
    types.SimpleNamespace(
        Error=Exception,
        drivers=lambda: [],
        Connection=object,
        connect=lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("pyodbc stub: no connection")),
    ),
)

import backend.database as database_module
from fastapi import FastAPI
from backend.api.routes import database_config as database_route
from backend.api.schemas import AuthenticatedUser
from common.config_store import DataSourceConfig, WorkflowConfigStore
import common.config_store as config_store_module


@pytest.fixture()
def database_api_client(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> Tuple[TestClient, WorkflowConfigStore]:
    """Provide an API client backed by an isolated workflow_config_store."""

    store_path = tmp_path / "workflow_settings.json"
    store = WorkflowConfigStore(store_path)
    store.update_data_source_config(DataSourceConfig())

    original_config = database_module.MSSQL_CONFIG.copy()
    tracked_env = [
        "MSSQL_SERVER",
        "MSSQL_DATABASE",
        "MSSQL_USER",
        "MSSQL_PASSWORD",
        "MSSQL_ENCRYPT",
        "MSSQL_TRUST_CERTIFICATE",
        "MSSQL_ITEM_VIEW",
        "MSSQL_ROUTING_VIEW",
        "MSSQL_WORK_RESULT_VIEW",
        "MSSQL_PURCHASE_ORDER_VIEW",
    ]
    original_env = {key: os.environ.get(key) for key in tracked_env}

    monkeypatch.setattr(config_store_module, "workflow_config_store", store, raising=False)
    monkeypatch.setattr(database_module, "workflow_config_store", store, raising=False)
    monkeypatch.setattr(database_route, "workflow_config_store", store, raising=False)
    database_module._bootstrap_runtime_config_from_store()

    app = FastAPI()
    app.include_router(database_route.router)

    def fake_user() -> AuthenticatedUser:
        now = utc_now()
        return AuthenticatedUser(
            username="tester",
            display_name="Test User",
            status="approved",
            is_admin=True,
            issued_at=now,
            expires_at=now + timedelta(hours=1),
            session_id="test-session",
        )

    app.dependency_overrides[database_route.require_auth] = fake_user
    client = TestClient(app)
    try:
        yield client, store
    finally:
        client.close()
        database_module.MSSQL_CONFIG.update(original_config)
        for key, value in original_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        database_module.refresh_view_names()


def test_get_database_config_returns_config_store_values(
    database_api_client: Tuple[TestClient, WorkflowConfigStore],
) -> None:
    client, store = database_api_client
    config = store.get_data_source_config()
    config.mssql_server = "test-db.local,1433"
    config.mssql_database = "Routing"
    config.mssql_user = "svc_user"
    config.mssql_password = "s3cr3t!"
    config.mssql_encrypt = True
    config.mssql_trust_certificate = False
    config.item_view = "dbo.CUSTOM_ITEM_VIEW"
    config.routing_view = "dbo.CUSTOM_ROUTING_VIEW"
    config.work_result_view = "dbo.CUSTOM_WORK_RESULT_VIEW"
    config.purchase_order_view = "dbo.CUSTOM_PURCHASE_ORDER_VIEW"
    store.update_data_source_config(config)

    response = client.get("/api/database/config")

    assert response.status_code == 200
    payload = response.json()
    assert payload == {
        "server": "test-db.local,1433",
        "database": "Routing",
        "user": "svc_user",
        "encrypt": True,
        "trust_certificate": False,
        "item_view": "dbo.CUSTOM_ITEM_VIEW",
        "routing_view": "dbo.CUSTOM_ROUTING_VIEW",
        "work_result_view": "dbo.CUSTOM_WORK_RESULT_VIEW",
        "purchase_order_view": "dbo.CUSTOM_PURCHASE_ORDER_VIEW",
        "password_saved": True,
    }


def test_update_database_config_updates_store_and_runtime(
    database_api_client: Tuple[TestClient, WorkflowConfigStore],
) -> None:
    client, store = database_api_client

    payload: Dict[str, object] = {
        "server": "prod-db.internal,14330",
        "database": "ProdRouting",
        "user": "prod_user",
        "password": "ProdPass!123",
        "encrypt": True,
        "trust_certificate": True,
        "item_view": "dbo.PROD_ITEM_VIEW",
        "routing_view": "dbo.PROD_ROUTING_VIEW",
        "work_result_view": "dbo.PROD_WORK_RESULT_VIEW",
        "purchase_order_view": "dbo.PROD_PO_VIEW",
    }

    response = client.post("/api/database/config", json=payload)
    assert response.status_code == 200
    assert response.json()["message"]

    updated = store.get_data_source_config()
    assert updated.mssql_server == "prod-db.internal,14330"
    assert updated.mssql_database == "ProdRouting"
    assert updated.mssql_user == "prod_user"
    assert updated.mssql_password == "ProdPass!123"
    assert updated.mssql_encrypt is True
    assert updated.mssql_trust_certificate is True
    assert updated.item_view == "dbo.PROD_ITEM_VIEW"
    assert updated.routing_view == "dbo.PROD_ROUTING_VIEW"
    assert updated.work_result_view == "dbo.PROD_WORK_RESULT_VIEW"
    assert updated.purchase_order_view == "dbo.PROD_PO_VIEW"

    assert database_module.MSSQL_CONFIG["server"] == "prod-db.internal,14330"
    assert database_module.MSSQL_CONFIG["database"] == "ProdRouting"
    assert database_module.MSSQL_CONFIG["user"] == "prod_user"
    assert database_module.MSSQL_CONFIG["encrypt"] is True
    assert database_module.MSSQL_CONFIG["trust_certificate"] is True
    assert database_module.get_routing_view_name() == "dbo.PROD_ROUTING_VIEW"
    assert database_module.get_purchase_order_view_name() == "dbo.PROD_PO_VIEW"


def test_update_database_config_rejects_blank_server(
    database_api_client: Tuple[TestClient, WorkflowConfigStore],
) -> None:
    client, _ = database_api_client

    bad_payload: Dict[str, object] = {
        "server": "  ",
        "database": "Routing",
        "user": "svc_user",
        "password": "Test1234!",
        "encrypt": False,
        "trust_certificate": True,
        "item_view": "dbo.MY_ITEM_VIEW",
        "routing_view": "dbo.MY_ROUTING_VIEW",
        "work_result_view": "dbo.MY_WORK_RESULT_VIEW",
        "purchase_order_view": "dbo.MY_PO_VIEW",
    }

    response = client.post("/api/database/config", json=bad_payload)

    assert response.status_code == 422
