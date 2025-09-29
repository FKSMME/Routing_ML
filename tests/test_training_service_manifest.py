import json
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from backend.api.services.training_service import TrainingService
from backend.trainer_ml import TRAINER_RUNTIME_SETTINGS


@pytest.fixture()
def training_service(tmp_path, monkeypatch) -> TrainingService:
    monkeypatch.chdir(tmp_path)

    class DummySettings:
        def __init__(self, root: Path) -> None:
            self.model_directory = None
            self.model_registry_path = root / "registry.db"
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

    monkeypatch.setattr(
        "backend.api.services.training_service.register_version",
        lambda **_: None,
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

    return TrainingService()


def test_training_service_generates_time_profiles_manifest(training_service, monkeypatch):
    monkeypatch.setitem(TRAINER_RUNTIME_SETTINGS, "time_profiles_enabled", True)

    training_service._run_training(
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
