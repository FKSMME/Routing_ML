from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Generator, Tuple

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.api.config import Settings
from backend.api.schemas import AuthenticatedUser


@pytest.fixture()
def tensorboard_api_client(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Generator[Tuple[TestClient, Path], None, None]:
    """Configure a temporary projector export and return a FastAPI test client."""
    from backend.api.routes import tensorboard_projector as projector_module

    base_models_dir = tmp_path / "models"
    default_projector_root = base_models_dir / "default" / "tb_projector"
    archive_projector_root = base_models_dir / "archive" / "version_20251021083443" / "tb_projector"

    vectors = np.array(
        [
            [0.0, 0.1, 0.2],
            [0.1, 0.2, 0.3],
            [0.2, 0.3, 0.4],
            [0.3, 0.4, 0.5],
            [0.4, 0.5, 0.6],
        ],
        dtype=np.float32,
    )
    metadata_payload = (
        "ITEM_CD\tPART_TYPE\n"
        "item-0\talpha\n"
        "item-1\tbeta\n"
        "item-2\talpha\n"
        "item-3\tbeta\n"
        "item-4\talpha\n"
    )

    def seed_projector(root: Path, tensor_name: str) -> None:
        root.mkdir(parents=True, exist_ok=True)
        np.savetxt(root / "vectors.tsv", vectors, fmt="%.6f", delimiter="\t")
        (root / "metadata.tsv").write_text(metadata_payload, encoding="utf-8")
        (root / "projector_config.json").write_text(
            json.dumps({"embeddings": [{"tensorName": tensor_name}]}),
            encoding="utf-8",
        )

    seed_projector(default_projector_root, "embedding")
    seed_projector(archive_projector_root, "embedding-archive")

    settings = Settings(
        model_directory=base_models_dir / "default",
        tensorboard_projector_path=default_projector_root,
    )

    class DummyPredictionService:
        def __init__(self) -> None:
            self.model_dir = base_models_dir / "default"

    monkeypatch.setattr(projector_module, "PredictionService", lambda: DummyPredictionService())
    monkeypatch.setattr(projector_module, "BASE_MODELS_DIR", base_models_dir)
    monkeypatch.setattr(projector_module, "DEFAULT_PROJECTOR_PATH", default_projector_root)
    monkeypatch.setattr(projector_module, "get_settings", lambda: settings)
    projector_module._cached_projector.cache_clear()

    from backend.api import security

    fake_user = AuthenticatedUser(
        username="tester",
        status="approved",
        is_admin=True,
        issued_at=datetime.now(tz=timezone.utc),
        expires_at=datetime.now(tz=timezone.utc) + timedelta(hours=1),
    )
    monkeypatch.setattr(security.auth_service, "validate_token", lambda token: fake_user)

    projector_module.router.dependencies = []

    app = FastAPI()
    app.include_router(projector_module.router)
    client = TestClient(app)
    try:
        yield client, default_projector_root
    finally:
        projector_module._cached_projector.cache_clear()


def test_tsne_layout_returns_points(tensorboard_api_client: Tuple[TestClient, Path]) -> None:
    client, _ = tensorboard_api_client
    response = client.get(
        "/api/training/tensorboard/projectors/default/tsne",
        params={"limit": 100, "perplexity": 10, "iterations": 500, "steps": 4},
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["projector_id"] == "default"
    assert payload["total"] == 5
    assert payload["sampled"] == len(payload["points"])
    assert payload["requested_perplexity"] == pytest.approx(10.0)
    assert isinstance(payload["used_pca_fallback"], bool)

    assert payload["points"], "Expected T-SNE points to be returned"
    for point in payload["points"]:
        assert 0.0 <= point["progress"] <= 1.0
        assert 1 <= point["step"] <= 4
        assert "ITEM_CD" in point["metadata"]
        assert point["metadata"]["ITEM_CD"].startswith("item-")


def test_tsne_layout_applies_filters_and_stride(tensorboard_api_client: Tuple[TestClient, Path]) -> None:
    client, _ = tensorboard_api_client
    response = client.get(
        "/api/training/tensorboard/projectors/default/tsne",
        params={
            "limit": 100,
            "stride": 2,
            "steps": 3,
            "filters": json.dumps({"PART_TYPE": ["alpha"]}),
        },
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()

    # After applying filter(alpha) and stride(2) we keep indices [0, 2, 4] -> stride => [0, 4]
    assert payload["total"] == 2
    assert payload["sampled"] == len(payload["points"]) == 2
    assert payload["used_pca_fallback"] is True  # only two points -> PCA fallback

    for point in payload["points"]:
        assert point["metadata"]["PART_TYPE"] == "alpha"
        assert 0.0 <= point["progress"] <= 1.0


def test_nested_projector_id_routes(tensorboard_api_client: Tuple[TestClient, Path]) -> None:
    client, _ = tensorboard_api_client
    nested_id = "archive/version_20251021083443"

    projectors_response = client.get(
        "/api/training/tensorboard/projectors",
        headers={"Authorization": "Bearer test-token"},
    )
    assert projectors_response.status_code == 200, projectors_response.text
    projector_ids = {item["id"] for item in projectors_response.json()}
    assert nested_id in projector_ids

    base_path = f"/api/training/tensorboard/projectors/{nested_id}"

    points_response = client.get(f"{base_path}/points", headers={"Authorization": "Bearer test-token"})
    assert points_response.status_code == 200, points_response.text
    assert points_response.json()["projector_id"] == nested_id

    filters_response = client.get(f"{base_path}/filters", headers={"Authorization": "Bearer test-token"})
    assert filters_response.status_code == 200, filters_response.text

    tsne_response = client.get(
        f"{base_path}/tsne",
        params={"limit": 500, "perplexity": 30, "iterations": 500, "steps": 6},
        headers={"Authorization": "Bearer test-token"},
    )
    assert tsne_response.status_code == 200, tsne_response.text

    metrics_response = client.get(
        f"/api/training/tensorboard/metrics/{nested_id}",
        headers={"Authorization": "Bearer test-token"},
    )
    assert metrics_response.status_code == 200, metrics_response.text
    assert metrics_response.json(), "Expected metrics payload for nested projector id"
