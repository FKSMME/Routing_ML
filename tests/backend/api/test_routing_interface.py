import json
from pathlib import Path
from typing import Dict, Tuple

import pytest

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()

from fastapi.testclient import TestClient

from common.config_store import WorkflowConfigStore

pytest_plugins = ["tests.test_rsl_routing_groups"]


@pytest.fixture()
def configured_workflow_store(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> WorkflowConfigStore:
    store_path = tmp_path / "workflow_settings.json"
    store = WorkflowConfigStore(path=store_path)
    export_cfg = store.get_export_config()
    export_cfg.erp_interface_enabled = True
    export_cfg.export_directory = str(tmp_path / "erp_exports")
    export_cfg.enable_csv = False
    export_cfg.enable_excel = False
    export_cfg.enable_txt = False
    export_cfg.enable_parquet = False
    export_cfg.enable_json = False
    export_cfg.compress_on_save = False
    store.update_export_config(export_cfg)

    import backend.api.services.prediction_service as prediction_service_module

    monkeypatch.setattr(prediction_service_module, "workflow_config_store", store)
    monkeypatch.setattr("common.config_store.workflow_config_store", store)
    return store


def test_routing_interface_creates_erp_payload(
    api_client: Tuple[TestClient, Dict[str, str]], configured_workflow_store: WorkflowConfigStore
) -> None:
    client, headers = api_client

    create_resp = client.post(
        "/api/routing/groups",
        headers=headers,
        json={
            "group_name": "ERP Export QA",
            "item_codes": ["ITEM-ERP-001"],
            "steps": [
                {
                    "seq": 1,
                    "process_code": "CUTTING",
                    "duration_min": 12.5,
                    "setup_time": 2.0,
                    "wait_time": 0.5,
                }
            ],
            "erp_required": True,
        },
    )

    assert create_resp.status_code == 201, create_resp.text
    group_id = create_resp.json()["group_id"]

    interface_resp = client.post(
        "/api/routing/interface",
        headers=headers,
        json={"group_id": group_id, "reason": "pytest"},
    )

    assert interface_resp.status_code == 200, interface_resp.text
    payload = interface_resp.json()

    assert payload["group_id"] == group_id
    assert payload["exported_files"], "Expected exported files to be reported"
    assert payload["erp_path"].endswith(".json"), "ERP export should be a JSON payload"

    erp_file = Path(payload["erp_path"])
    assert erp_file.exists(), f"Expected ERP payload to exist at {erp_file}"

    document = json.loads(erp_file.read_text(encoding="utf-8"))
    assert document["payload"]["operations"], "ERP payload must include operations"
    assert document["payload"]["candidates"] == []
    assert document["payload"]["operations"][0]["PROC_SEQ"] == 1
