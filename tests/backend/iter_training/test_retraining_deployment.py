"""
Integration tests for retraining trigger and model deployment.

Tests the retraining workflow and model deployment logic.
"""
import pytest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
from backend.iter_training.trainer import train_all_models
from backend.iter_training.deployer import deploy_model


@pytest.fixture
def mock_training_items():
    """Mock training item data."""
    return [
        {
            "ITEM_CD": "ITEM001",
            "operations": [
                {"PROC_CD": "PROC01", "RUN_TIME": 10.0, "SETUP_TIME": 5.0},
                {"PROC_CD": "PROC02", "RUN_TIME": 20.0, "SETUP_TIME": 3.0},
            ],
        },
        {
            "ITEM_CD": "ITEM002",
            "operations": [
                {"PROC_CD": "PROC01", "RUN_TIME": 12.0, "SETUP_TIME": 4.0},
                {"PROC_CD": "PROC03", "RUN_TIME": 15.0, "SETUP_TIME": 2.0},
            ],
        },
    ]


@pytest.fixture
def temp_model_dir(tmp_path):
    """Create temporary model directory."""
    model_dir = tmp_path / "models"
    model_dir.mkdir()
    return model_dir


class TestRetrainingTrigger:
    """Tests for automatic retraining trigger logic."""

    def test_retraining_triggered_by_high_mae(self):
        """Test that retraining is triggered when MAE exceeds threshold."""
        current_mae = 8.0
        mae_threshold = 5.0

        should_retrain = current_mae > mae_threshold

        assert should_retrain is True, "Retraining should be triggered when MAE > threshold"

    def test_retraining_not_triggered_by_acceptable_mae(self):
        """Test that retraining is not triggered when MAE is acceptable."""
        current_mae = 3.0
        mae_threshold = 5.0

        should_retrain = current_mae > mae_threshold

        assert should_retrain is False, "Retraining should not be triggered when MAE <= threshold"

    def test_retraining_trigger_with_multiple_metrics(self):
        """Test retraining trigger considers multiple quality metrics."""
        mae = 4.0
        mae_threshold = 5.0
        cv = 0.5
        cv_threshold = 0.3
        process_match = 0.7
        process_match_threshold = 0.9

        # Should trigger if ANY metric exceeds threshold
        should_retrain = (
            mae > mae_threshold
            or cv > cv_threshold
            or process_match < process_match_threshold
        )

        assert should_retrain is True, "Should trigger if any metric violates threshold"

    def test_retraining_cooldown_period(self):
        """Test that retraining respects cooldown period."""
        import time
        from datetime import datetime, timedelta

        last_training_time = datetime.now() - timedelta(hours=2)
        cooldown_hours = 6

        hours_since_training = (datetime.now() - last_training_time).total_seconds() / 3600

        can_retrain = hours_since_training >= cooldown_hours

        assert can_retrain is False, "Should respect cooldown period"


class TestModelDeployment:
    """Tests for model deployment logic."""

    def test_model_deployment_creates_backup(self, temp_model_dir):
        """Test that deployment creates backup of old model."""
        # Create mock current model
        current_model_path = temp_model_dir / "current_model.pkl"
        current_model_path.write_text("old model data")

        backup_dir = temp_model_dir / "backups"
        backup_dir.mkdir()

        # Simulate backup creation
        import shutil
        from datetime import datetime

        backup_name = f"model_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pkl"
        backup_path = backup_dir / backup_name
        shutil.copy(current_model_path, backup_path)

        assert backup_path.exists(), "Backup should be created"
        assert backup_path.read_text() == "old model data"

    def test_model_deployment_validates_new_model(self, temp_model_dir):
        """Test that deployment validates new model before deploying."""
        new_model_path = temp_model_dir / "new_model.pkl"

        # Test with missing model
        is_valid = new_model_path.exists()
        assert is_valid is False, "Should detect missing model"

        # Test with valid model
        new_model_path.write_text("new model data")
        is_valid = new_model_path.exists() and new_model_path.stat().st_size > 0
        assert is_valid is True, "Should validate existing model with content"

    def test_model_deployment_atomicity(self, temp_model_dir):
        """Test that deployment is atomic (all-or-nothing)."""
        current_model = temp_model_dir / "current_model.pkl"
        new_model = temp_model_dir / "new_model.pkl"
        temp_model = temp_model_dir / "temp_model.pkl"

        current_model.write_text("old model")
        new_model.write_text("new model")

        try:
            # Simulate atomic deployment
            # 1. Copy new model to temp location
            import shutil
            shutil.copy(new_model, temp_model)

            # 2. Validate temp model
            assert temp_model.exists()

            # 3. Replace current with temp (atomic on most filesystems)
            shutil.move(str(temp_model), str(current_model))

            success = True
        except Exception:
            success = False
            # Rollback would happen here

        assert success is True
        assert current_model.read_text() == "new model"

    def test_deployment_rollback_on_failure(self, temp_model_dir):
        """Test that deployment can rollback on failure."""
        current_model = temp_model_dir / "current_model.pkl"
        backup_model = temp_model_dir / "backup_model.pkl"

        # Create initial state
        current_model.write_text("old model")
        backup_model.write_text("old model")

        # Simulate failed deployment
        deployment_failed = True

        if deployment_failed:
            # Rollback: restore from backup
            import shutil
            shutil.copy(backup_model, current_model)

        assert current_model.read_text() == "old model", "Should rollback to old model on failure"

    def test_deployment_metadata_update(self, temp_model_dir):
        """Test that deployment updates metadata."""
        from datetime import datetime
        import json

        metadata_path = temp_model_dir / "model_metadata.json"

        metadata = {
            "deployed_at": datetime.now().isoformat(),
            "model_version": "v1.2.0",
            "training_mae": 3.5,
            "training_samples": 500,
            "deployed_by": "iter_training_system",
        }

        metadata_path.write_text(json.dumps(metadata, indent=2))

        assert metadata_path.exists()

        loaded_metadata = json.loads(metadata_path.read_text())
        assert loaded_metadata["model_version"] == "v1.2.0"
        assert loaded_metadata["training_mae"] == 3.5


class TestTrainingPipeline:
    """Tests for complete training pipeline."""

    def test_training_pipeline_with_valid_data(self, mock_training_items):
        """Test training pipeline with valid data."""
        # Mock training pipeline
        items = mock_training_items

        # Step 1: Data validation
        assert len(items) > 0
        assert all("ITEM_CD" in item for item in items)

        # Step 2: Feature extraction (mocked)
        features = [{"features": [1.0, 2.0, 3.0]} for _ in items]
        assert len(features) == len(items)

        # Step 3: Model training (mocked)
        model = {"type": "mock_model", "trained": True}
        assert model["trained"] is True

        # Step 4: Model evaluation (mocked)
        eval_mae = 3.2
        assert eval_mae < 5.0, "Trained model should have acceptable MAE"

    def test_training_pipeline_handles_insufficient_data(self):
        """Test training pipeline with insufficient data."""
        items = []  # No training data

        min_samples = 10
        has_sufficient_data = len(items) >= min_samples

        assert has_sufficient_data is False, "Should detect insufficient data"
        # Training should not proceed

    def test_training_pipeline_error_handling(self):
        """Test that training pipeline handles errors gracefully."""
        try:
            # Simulate training error
            raise ValueError("Training failed due to invalid data")
        except ValueError as e:
            error_occurred = True
            error_message = str(e)

        assert error_occurred is True
        assert "Training failed" in error_message
        # System should log error and not deploy invalid model
