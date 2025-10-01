from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from backend.api.services.training_service import TrainingService
from common.config_store import DataSourceConfig, TrainerRuntimeConfig, VisualizationConfig


@pytest.fixture()
def training_service(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TrainingService:
    class DummySettings:
        def __init__(self, root: Path) -> None:
            self.model_directory = root / "models"
            self.model_directory.mkdir(parents=True, exist_ok=True)
            self.model_registry_path = root / "registry.db"
            self.default_top_k = 5
            self.default_similarity_threshold = 0.8
            self.enable_candidate_persistence = False
            self.candidate_store_dir = root / "candidates"
            self.candidate_store_dir.mkdir(parents=True, exist_ok=True)
            self.audit_log_dir = root / "audit"
            self.audit_log_dir.mkdir(parents=True, exist_ok=True)

    dummy_settings = DummySettings(tmp_path)
    monkeypatch.setattr(
        "backend.api.services.training_service.get_settings", lambda: dummy_settings
    )

    return TrainingService(status_path=tmp_path / "status.json")


def test_load_dataset_reads_csv(training_service: TrainingService, tmp_path: Path) -> None:
    csv_path = tmp_path / "dataset.csv"
    source = pd.DataFrame({"ITEM_CD": ["A"], "ITEM_NM": ["Alpha"]})
    source.to_csv(csv_path, index=False)

    cfg = DataSourceConfig(access_path=str(csv_path))
    result = training_service._load_dataset(cfg)

    pd.testing.assert_frame_equal(result, source)


def test_load_dataset_reads_parquet(monkeypatch: pytest.MonkeyPatch, training_service: TrainingService, tmp_path: Path) -> None:
    parquet_path = tmp_path / "dataset.parquet"
    parquet_path.touch()
    expected = pd.DataFrame({"ITEM_CD": ["B"], "ITEM_NM": ["Beta"]})

    monkeypatch.setattr(pd, "read_parquet", lambda path: expected if Path(path) == parquet_path else None)

    cfg = DataSourceConfig(access_path=str(parquet_path))
    result = training_service._load_dataset(cfg)

    pd.testing.assert_frame_equal(result, expected)


def test_run_training_missing_access_database_marks_failure(training_service: TrainingService, tmp_path: Path) -> None:
    missing_access = tmp_path / "missing.accdb"
    data_cfg = DataSourceConfig(access_path=str(missing_access))

    with pytest.raises(FileNotFoundError):
        training_service._run_training(
            job_id="job-missing-access",
            requested_by="tester",
            data_cfg=data_cfg,
            viz_cfg=VisualizationConfig(),
            trainer_cfg=TrainerRuntimeConfig(),
            version_dir=tmp_path / "run-output",
            version_label="missing-access",
            dry_run=True,
        )

    status = training_service._status.to_dict()
    assert status.get("status") == "failed"
    assert "Access 파일을 찾을 수 없습니다" in (status.get("message") or "")
