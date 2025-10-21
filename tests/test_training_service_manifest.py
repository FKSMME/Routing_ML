import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

import pandas as pd
import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from backend.api.services.training_service import TrainingService
from backend.trainer_ml import TRAINER_RUNTIME_SETTINGS


@pytest.fixture()
def training_service(
    tmp_path, monkeypatch
) -> Tuple[TrainingService, List[Dict[str, Any]]]:
    monkeypatch.chdir(tmp_path)

    class DummySettings:
        def __init__(self, root: Path) -> None:
            self.model_directory = None
            self.model_registry_url = "sqlite:///:memory:"
            self.default_top_k = 5
            self.default_similarity_threshold = 0.8
            self.enable_candidate_persistence = False
            self.candidate_store_dir = root / "candidates"
            self.candidate_store_dir.mkdir(parents=True, exist_ok=True)
            self.audit_log_dir = root / "audit"
            self.audit_log_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(
        "backend.api.services.training_service.get_settings",
        lambda: DummySettings(tmp_path),
    )

    registry_calls: List[Dict[str, Any]] = []

    def fake_register_version(**payload: Any) -> None:
        registry_calls.append(payload)

    monkeypatch.setattr(
        "backend.api.services.training_service.register_version",
        fake_register_version,
    )

    def fake_train_model(dataset, save_dir, export_tb_projector, projector_metadata_cols):
        for filename in (
            "similarity_engine.joblib",
            "encoder.joblib",
            "scaler.joblib",
            "feature_columns.joblib",
        ):
            (save_dir / filename).write_text("stub", encoding="utf-8")
        return object()

    monkeypatch.setattr(
        "backend.api.services.training_service.train_model_with_ml_improved",
        fake_train_model,
    )

    monkeypatch.setattr(
        TrainingService,
        "_load_dataset",
        lambda self, _cfg: pd.DataFrame(
            {"ITEM_CD": ["A", "B", "C"], "ITEM_NM": ["aa", "bb", "cc"]}
        ),
    )

    service = TrainingService()
    return service, registry_calls


def test_training_service_generates_time_profiles_manifest(training_service, monkeypatch):
    service, registry_calls = training_service
    monkeypatch.setitem(TRAINER_RUNTIME_SETTINGS, "time_profiles_enabled", True)

    service._run_training(
        job_id="job-1",
        requested_by="tester",
        version_label="unit_test_version",
        projector_metadata=None,
        dry_run=False,
    )

    version_dir = Path("models") / "unit_test_version"
    manifest_path = version_dir / "manifest.json"
    time_profiles_path = version_dir / "time_profiles.json"

    assert time_profiles_path.exists(), "time_profiles.json should exist"
    payload = json.loads(time_profiles_path.read_text(encoding="utf-8"))
    assert payload.get("profiles") == {"OPT": {}, "STD": {}, "SAFE": {}}

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    artifacts = manifest.get("artifacts", {})
    assert "time_profiles" in artifacts
    assert artifacts["time_profiles"]["path"] == "time_profiles.json"

    metadata_files = manifest.get("metadata", {}).get("files", {})
    assert metadata_files.get("time_profiles") == "time_profiles.json"
    assert registry_calls, "register_version should be invoked"


def test_run_training_registers_manifest_and_updates_metrics(training_service):
    service, registry_calls = training_service

    result = service._run_training(
        job_id="job-2",
        requested_by="tester",
        version_label="unit_test_version_2",
        projector_metadata=["ITEM_CD"],
        dry_run=False,
    )

    assert registry_calls, "register_version should have been called"
    call = registry_calls[0]
    assert call["db_url"] == "sqlite:///:memory:"
    assert call["version_name"] == "unit_test_version_2"
    assert Path(call["manifest_path"]).name == "manifest.json"
    assert Path(call["artifact_dir"]).name == "unit_test_version_2"
    assert result["manifest_path"].endswith("manifest.json")
    metrics = result.get("metrics", {})
    assert metrics.get("samples") == 3
