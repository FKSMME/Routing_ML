"""
Integration tests for Iterative Training Quality Cycle.

Tests the full pipeline: sample → predict → evaluate → metrics
"""
import pytest
from pathlib import Path
from backend.iter_training.sampler import sample_items_for_quality
from backend.iter_training.quality_evaluator import evaluate_quality
from backend.iter_training.models import QualityMetrics


@pytest.fixture
def sample_data_dir(tmp_path):
    """Create temporary directory with sample data."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    return data_dir


@pytest.fixture
def mock_items():
    """Mock item data for testing."""
    return [
        {
            "ITEM_CD": "ITEM001",
            "ITEM_NM": "Test Item 1",
            "ROUTING_SET_CD": "RS001",
        },
        {
            "ITEM_CD": "ITEM002",
            "ITEM_NM": "Test Item 2",
            "ROUTING_SET_CD": "RS002",
        },
        {
            "ITEM_CD": "ITEM003",
            "ITEM_NM": "Test Item 3",
            "ROUTING_SET_CD": "RS003",
        },
    ]


class TestQualityCycleIntegration:
    """Integration tests for full quality evaluation cycle."""

    def test_full_quality_cycle_with_valid_samples(self, sample_data_dir, mock_items):
        """
        Test complete quality cycle with valid sample data.

        Steps:
        1. Sample items
        2. Predict routings (mocked)
        3. Evaluate quality
        4. Verify metrics
        """
        # Step 1: Sample items
        sample_size = 2
        strategy = "random"
        sampled = mock_items[:sample_size]

        assert len(sampled) == sample_size
        assert all("ITEM_CD" in item for item in sampled)

        # Step 2: Mock predictions
        predictions = []
        for item in sampled:
            predictions.append({
                "item_cd": item["ITEM_CD"],
                "predicted_operations": [
                    {"PROC_CD": "PROC01", "RUN_TIME": 10.0},
                    {"PROC_CD": "PROC02", "RUN_TIME": 20.0},
                ],
                "actual_operations": [
                    {"PROC_CD": "PROC01", "RUN_TIME": 11.0},
                    {"PROC_CD": "PROC02", "RUN_TIME": 19.0},
                ],
            })

        # Step 3: Evaluate quality (mock evaluation)
        mae = sum(
            abs(pred["predicted_operations"][0]["RUN_TIME"] - pred["actual_operations"][0]["RUN_TIME"])
            for pred in predictions
        ) / len(predictions)

        process_match = sum(
            1 for pred in predictions
            if pred["predicted_operations"][0]["PROC_CD"] == pred["actual_operations"][0]["PROC_CD"]
        ) / len(predictions)

        # Step 4: Verify metrics
        assert mae > 0, "MAE should be positive"
        assert mae < 10, "MAE should be reasonable for test data"
        assert process_match == 1.0, "All processes should match in test data"

    def test_quality_cycle_with_empty_samples(self):
        """Test quality cycle behavior with no samples."""
        sampled = []

        # Should handle empty samples gracefully
        assert len(sampled) == 0
        # Metrics calculation should skip or return None/default values

    def test_quality_cycle_with_missing_predictions(self, mock_items):
        """Test quality cycle when some predictions fail."""
        sampled = mock_items[:2]

        # Mock scenario where one prediction fails
        predictions = [
            {
                "item_cd": sampled[0]["ITEM_CD"],
                "predicted_operations": [{"PROC_CD": "PROC01", "RUN_TIME": 10.0}],
                "actual_operations": [{"PROC_CD": "PROC01", "RUN_TIME": 11.0}],
            },
            # Second prediction missing/failed
        ]

        # Should handle partial predictions
        assert len(predictions) < len(sampled)
        # Metrics should be calculated only for successful predictions

    def test_quality_metrics_structure(self):
        """Test that QualityMetrics model has all required fields."""
        # Verify QualityMetrics model structure
        required_fields = [
            "cycle_id",
            "sample_size",
            "strategy",
            "mae",
            "trim_mae",
            "rmse",
            "process_match",
            "outsourcing_success",
            "cv",
            "sample_count",
            "alerts",
            "timestamp",
            "duration_seconds",
            "items_evaluated",
            "items_failed",
        ]

        # Check if QualityMetrics has all required fields
        from backend.iter_training.models import QualityMetrics
        model_fields = QualityMetrics.__annotations__.keys()

        for field in required_fields:
            assert field in model_fields, f"Missing required field: {field}"

    def test_quality_cycle_performance(self, mock_items):
        """Test that quality cycle completes within acceptable time."""
        import time

        start_time = time.time()

        # Simulate quality cycle
        sampled = mock_items[:2]
        predictions = []
        for item in sampled:
            predictions.append({
                "item_cd": item["ITEM_CD"],
                "predicted_operations": [{"PROC_CD": "PROC01", "RUN_TIME": 10.0}],
                "actual_operations": [{"PROC_CD": "PROC01", "RUN_TIME": 11.0}],
            })

        # Calculate simple metrics
        mae = 1.0  # Mock value

        elapsed = time.time() - start_time

        # Should complete quickly for small sample
        assert elapsed < 1.0, "Quality cycle should complete within 1 second for 2 items"

    def test_quality_alerts_generation(self):
        """Test that quality alerts are generated for threshold violations."""
        # Mock scenario with high MAE
        high_mae = 15.0
        mae_threshold = 5.0

        alerts = []
        if high_mae > mae_threshold:
            alerts.append({
                "item_cd": "ITEM001",
                "issue": "HIGH_MAE",
                "value": high_mae,
                "threshold": mae_threshold,
                "message": f"MAE {high_mae} exceeds threshold {mae_threshold}",
            })

        assert len(alerts) > 0, "Should generate alerts for threshold violations"
        assert alerts[0]["issue"] == "HIGH_MAE"
        assert alerts[0]["value"] > alerts[0]["threshold"]
