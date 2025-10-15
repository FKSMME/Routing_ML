from __future__ import annotations

from datetime import timedelta

import pytest

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()

from fastapi import HTTPException, status

from backend.api.schemas import AuthenticatedUser, WorkflowConfigPatch
from backend.api.routes import workflow as workflow_module
from common.config_store import WorkflowConfigStore
from common.datetime_utils import utc_now_naive


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def workflow_test_context(tmp_path, monkeypatch):
    temp_store_path = tmp_path / "workflow_settings.json"
    store = WorkflowConfigStore(temp_store_path)

    monkeypatch.setattr(workflow_module, "workflow_config_store", store)
    monkeypatch.setattr("common.config_store.workflow_config_store", store)

    trainer_calls = []
    predictor_calls = []

    def _fake_trainer_apply(config):
        trainer_calls.append(config)

    def _fake_predictor_apply(config):
        predictor_calls.append(config)

    monkeypatch.setattr(
        workflow_module,
        "apply_trainer_runtime_config",
        _fake_trainer_apply,
    )
    monkeypatch.setattr(
        workflow_module,
        "apply_predictor_runtime_config",
        _fake_predictor_apply,
    )

    now = utc_now_naive()
    user = AuthenticatedUser(
        username="tester",
        display_name="Tester",
        status="approved",
        is_admin=True,
        issued_at=now,
        expires_at=now + timedelta(hours=1),
    )

    yield store, trainer_calls, predictor_calls, user


@pytest.mark.anyio
async def test_mixed_patch_invalid_sql_rolls_back(workflow_test_context):
    store, trainer_calls, predictor_calls, user = workflow_test_context
    original_snapshot = store.load()

    payload = {
        "graph": {
            "nodes": [{"id": "start", "label": "Start", "type": "start"}],
            "edges": [],
            "design_refs": ["ref1.png"],
        },
        "sql": {
            "available_columns": ["INVALID_COLUMN"],
            "output_columns": ["INVALID_COLUMN"],
        },
    }

    patch_model = WorkflowConfigPatch.parse_obj(payload)

    with pytest.raises(HTTPException) as excinfo:
        await workflow_module.patch_workflow_graph(patch_model, current_user=user)

    assert excinfo.value.status_code == status.HTTP_400_BAD_REQUEST
    assert store.load() == original_snapshot
    assert trainer_calls == []
    assert predictor_calls == []
