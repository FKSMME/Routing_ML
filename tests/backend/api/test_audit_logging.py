from __future__ import annotations

import importlib
from pathlib import Path
from types import ModuleType
from typing import Generator, Tuple

import pytest

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()

from fastapi.testclient import TestClient

from backend.api.config import get_settings


@pytest.fixture()
def audit_test_client(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Generator[Tuple[TestClient, Path, ModuleType], None, None]:
    """Provide a FastAPI client configured with an isolated audit log directory."""

    log_dir = tmp_path / "audit"
    monkeypatch.setenv("ROUTING_ML_AUDIT_LOG_DIR", str(log_dir))
    get_settings.cache_clear()  # type: ignore[attr-defined]

    audit_module = importlib.import_module("backend.api.routes.audit")
    workspace_module = importlib.import_module("backend.api.routes.workspace")
    app_module = importlib.import_module("backend.api.app")

    audit_module = importlib.reload(audit_module)
    importlib.reload(workspace_module)
    app_module = importlib.reload(app_module)

    client = TestClient(app_module.create_app())

    try:
        yield client, log_dir, audit_module
    finally:
        client.close()
        get_settings.cache_clear()  # type: ignore[attr-defined]


def test_audit_batch_persists_events(audit_test_client: Tuple[TestClient, Path, ModuleType]) -> None:
    client, log_dir, audit_module = audit_test_client

    payload = {
        "source": "routing.ui",
        "events": [
            {
                "action": "routing.snapshot.save",
                "username": "qa_user",
                "ip_address": "192.168.1.10",
                "payload": {"tabCount": 3, "activeProduct": "ITEM-001"},
            },
            {
                "action": "routing.snapshot.restore",
                "username": "qa_user",
                "payload": {"snapshotId": "snap-001"},
            },
        ],
    }

    response = client.post("/api/audit/ui/batch", json=payload)

    assert response.status_code == 202, response.text
    assert log_dir.exists()

    records = audit_module.read_persisted_ui_audit_events()
    assert len(records) == 2
    assert {record["action"] for record in records} == {
        "routing.snapshot.save",
        "routing.snapshot.restore",
    }
    assert all(record["source"] == "routing.ui" for record in records)
    assert records[0]["batch_id"] == records[1]["batch_id"]
    assert records[0]["payload"] == payload["events"][0]["payload"]


def test_audit_log_retrieval_limit(audit_test_client: Tuple[TestClient, Path, ModuleType]) -> None:
    client, _, audit_module = audit_test_client

    first_payload = {
        "source": "routing.ui",
        "events": [
            {
                "action": "routing.timeline.insert",
                "username": "qa_user",
                "payload": {"index": 2},
            }
        ],
    }
    second_payload = {
        "source": "routing.ui",
        "events": [
            {
                "action": "routing.timeline.undo",
                "username": "qa_user",
                "payload": {"pastSnapshots": 4},
            }
        ],
    }

    first_response = client.post("/api/audit/ui/batch", json=first_payload)
    second_response = client.post("/api/audit/ui/batch", json=second_payload)

    assert first_response.status_code == 202
    assert second_response.status_code == 202

    latest_record = audit_module.read_persisted_ui_audit_events(limit=1)
    assert len(latest_record) == 1
    assert latest_record[0]["action"] == "routing.timeline.undo"
    assert latest_record[0]["payload"] == {"pastSnapshots": 4}
