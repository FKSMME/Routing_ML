from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()

from backend.api.routes import workflow as workflow_module
from backend.api.schemas import AuthenticatedUser, WorkflowConfigPatch
from common.config_store import WorkflowConfigStore


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def workflow_sync_context(tmp_path, monkeypatch):
    store_path = tmp_path / "workflow_settings.json"
    store = WorkflowConfigStore(store_path)

    monkeypatch.setattr(workflow_module, "workflow_config_store", store)
    monkeypatch.setattr("common.config_store.workflow_config_store", store)

    monkeypatch.setattr(
        workflow_module,
        "apply_trainer_runtime_config",
        lambda config: None,
    )
    monkeypatch.setattr(
        workflow_module,
        "apply_predictor_runtime_config",
        lambda config: None,
    )

    output_dir = tmp_path / "generated_code"
    monkeypatch.setattr(workflow_module.settings, "workflow_code_dir", output_dir, raising=False)

    store.update_config(
        {
            "graph": {
                "nodes": [
                    {
                        "id": "trainer",
                        "label": "Model Trainer",
                        "type": "module",
                        "category": "trainer",
                        "status": None,
                        "position": {"x": 0.0, "y": 0.0},
                        "settings": {},
                        "metrics": {},
                        "doc_refs": [],
                    },
                    {
                        "id": "predictor",
                        "label": "Model Predictor",
                        "type": "module",
                        "category": "predictor",
                        "status": None,
                        "position": {"x": 320.0, "y": 0.0},
                        "settings": {},
                        "metrics": {},
                        "doc_refs": [],
                    },
                ],
                "edges": [
                    {
                        "id": "edge-trainer-predictor",
                        "source": "trainer",
                        "target": "predictor",
                        "kind": "model-flow",
                        "label": "train->predict",
                    }
                ],
                "design_refs": [],
            }
        }
    )

    now = datetime.utcnow()
    user = AuthenticatedUser(
        username="tester",
        display_name="Tester",
        status="approved",
        is_admin=True,
        issued_at=now,
        expires_at=now + timedelta(hours=1),
    )

    return store, user, output_dir


@pytest.mark.anyio
async def test_graph_patch_updates_generated_code(workflow_sync_context):
    store, user, output_dir = workflow_sync_context

    snapshot = store.load()
    updated_nodes = []
    for node in snapshot["graph"]["nodes"]:
        node_copy = dict(node)
        if node_copy.get("id") == "trainer":
            settings = dict(node_copy.get("settings") or {})
            settings["description"] = "새로운 설명"
            node_copy["settings"] = settings
            node_copy["label"] = "모델 트레이너 v2"
        updated_nodes.append(node_copy)

    patch_model = WorkflowConfigPatch.parse_obj({"graph": {"nodes": updated_nodes}})

    await workflow_module.patch_workflow_graph(patch_model, current_user=user)

    response = await workflow_module.regenerate_workflow_code(current_user=user)

    graph_cfg = store.get_graph()
    trainer_snapshot = next(node for node in graph_cfg.nodes if node.get("id") == "trainer")
    assert trainer_snapshot["label"] == "모델 트레이너 v2"
    assert trainer_snapshot["settings"]["description"] == "새로운 설명"

    modules_by_id = {module.node_id: module for module in response.modules}
    assert "trainer" in modules_by_id

    trainer_module_path = Path(modules_by_id["trainer"].path)
    assert trainer_module_path.exists()
    trainer_source = trainer_module_path.read_text(encoding="utf-8")
    assert "모델 트레이너 v2" in trainer_source
    assert "새로운 설명" in trainer_source

    manifest_path = output_dir / "manifest.json"
    manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert any(entry["node_id"] == "trainer" for entry in manifest_data)


@pytest.mark.anyio
async def test_code_generation_response_contains_tensorboard_paths(workflow_sync_context):
    store, user, _ = workflow_sync_context

    response = await workflow_module.regenerate_workflow_code(current_user=user)

    tensorboard_paths = response.tensorboard_paths
    viz_cfg = store.get_visualization_config()
    projector_root = Path(viz_cfg.tensorboard_projector_dir)

    assert tensorboard_paths["projector_dir"] == str(projector_root)
    assert tensorboard_paths["projector_config"].endswith("projector_config.json")
    assert tensorboard_paths["vectors"].endswith("vectors.tsv")
    assert tensorboard_paths["metadata"].endswith("metadata.tsv")


@pytest.mark.anyio
async def test_patch_accepts_mdb_access_path(workflow_sync_context):
    store, user, _ = workflow_sync_context

    patch_model = WorkflowConfigPatch.parse_obj(
        {"data_source": {"access_path": "C:/data/source.mdb"}}
    )

    response = await workflow_module.patch_workflow_graph(patch_model, current_user=user)

    assert response.data_source.access_path == "C:/data/source.mdb"
    assert store.get_data_source_config().access_path == "C:/data/source.mdb"
