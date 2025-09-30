from __future__ import annotations

from pathlib import Path
from typing import Dict, List

import pandas as pd
import pytest

from backend.cli import train_model


def test_default_output_root_points_to_deliverables_models():
    repo_root = Path(__file__).resolve().parents[3]
    expected = repo_root / "deliverables" / "models"
    assert train_model.DEFAULT_OUTPUT_ROOT == expected


def test_cli_invokes_training_pipeline(tmp_path, monkeypatch):
    dataset_path = tmp_path / "dataset.csv"
    pd.DataFrame(
        {"ITEM_CD": ["A", "B"], "ITEM_NM": ["Alpha", "Beta"]}
    ).to_csv(dataset_path, index=False)

    captured: Dict[str, Path | List[str]] = {}

    def fake_train_model(dataframe, *, save_dir, export_tb_projector, projector_metadata_cols):
        captured["columns"] = list(dataframe.columns)
        captured["save_dir"] = save_dir
        for name in (
            "similarity_engine.joblib",
            "encoder.joblib",
            "scaler.joblib",
            "feature_columns.joblib",
        ):
            (save_dir / name).write_text("stub", encoding="utf-8")
        return object()

    monkeypatch.setattr(train_model, "train_model_with_ml_improved", fake_train_model)

    custom_root = tmp_path / "artifacts"
    monkeypatch.setattr(train_model, "DEFAULT_OUTPUT_ROOT", custom_root)

    exit_code = train_model.main([str(dataset_path), "--name", "unit-test"])

    assert exit_code == 0

    target_dir = custom_root / "unit-test"
    assert target_dir.exists()
    assert captured["save_dir"] == target_dir
    assert captured["columns"] == ["ITEM_CD", "ITEM_NM"]

    for filename in (
        "similarity_engine.joblib",
        "encoder.joblib",
        "scaler.joblib",
        "feature_columns.joblib",
    ):
        assert (target_dir / filename).exists()


def test_load_dataset_rejects_unknown_extension(tmp_path):
    bogus = tmp_path / "data.txt"
    bogus.write_text("hello", encoding="utf-8")

    with pytest.raises(ValueError):
        train_model._load_dataset(bogus)


def test_automation_scripts_reference_cli():
    shell_wrapper = Path("scripts/train/run_cli.sh")
    python_wrapper = Path("scripts/train/run_cli.py")

    assert shell_wrapper.exists()
    assert python_wrapper.exists()

    shell_content = shell_wrapper.read_text(encoding="utf-8")
    python_content = python_wrapper.read_text(encoding="utf-8")

    assert "backend.cli.train_model" in shell_content
    assert "backend.cli.train_model" in python_content
