import hashlib
import json
from datetime import datetime
from pathlib import Path
import sys

import joblib
import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from backend.feature_weights import FeatureWeightManager
from models.manifest import MANIFEST_SCHEMA_VERSION, ModelManifest


def _write_manifest(root: Path, payload: dict) -> Path:
    manifest_path = root / "manifest.json"
    manifest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest_path


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _build_payload(root: Path):
    weights_path = root / "custom_weights.json"
    weights_data = {
        "weights": {"FEATURE_A": 1.7, "FEATURE_B": 0.4},
        "active_features": {"FEATURE_A": True, "FEATURE_B": False},
    }
    weights_path.write_text(json.dumps(weights_data, ensure_ascii=False), encoding="utf-8")

    joblib_path = root / "custom_weights.joblib"
    joblib_data = {"FEATURE_C": 2.5}
    joblib.dump(joblib_data, joblib_path)

    active_path = root / "custom_active.json"
    active_payload = {"FEATURE_B": True, "FEATURE_D": False}
    active_path.write_text(json.dumps(active_payload, ensure_ascii=False), encoding="utf-8")

    payload = {
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "generated_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "hash_algorithm": "sha256",
        "artifacts": {
            "feature_weights_state": {
                "path": weights_path.name,
                "sha256": _hash_file(weights_path),
                "schema_version": "routing-ml/feature-weights@1",
            },
            "feature_weights": {
                "path": joblib_path.name,
                "sha256": _hash_file(joblib_path),
                "schema_version": "routing-ml/feature-weights@1",
            },
            "active_features": {
                "path": active_path.name,
                "sha256": _hash_file(active_path),
                "schema_version": "routing-ml/feature-weights@1",
            },
        },
    }
    return payload, weights_data, joblib_data, active_payload


@pytest.mark.parametrize("use_manifest", [True, False])
def test_feature_weight_manager_reads_from_manifest(tmp_path: Path, use_manifest: bool):
    model_dir = tmp_path / "version"
    model_dir.mkdir()

    payload, weights_data, joblib_data, active_payload = _build_payload(model_dir)
    manifest_path = _write_manifest(model_dir, payload)

    if use_manifest:
        manifest = ModelManifest(root_dir=model_dir, manifest_path=manifest_path, payload=payload)
        manager = FeatureWeightManager(manifest=manifest)
    else:
        (model_dir / "feature_weights.json").write_text(
            json.dumps(weights_data, ensure_ascii=False), encoding="utf-8"
        )
        joblib.dump(joblib_data, model_dir / "feature_weights.joblib")
        (model_dir / "active_features.json").write_text(
            json.dumps(active_payload, ensure_ascii=False), encoding="utf-8"
        )
        manager = FeatureWeightManager(model_dir=model_dir)

    assert pytest.approx(manager.feature_weights["FEATURE_A"], rel=1e-6) == 1.7
    assert pytest.approx(manager.feature_weights["FEATURE_C"], rel=1e-6) == 2.5
    assert manager.active_features["FEATURE_B"] is True
    assert manager.active_features["FEATURE_D"] is False

