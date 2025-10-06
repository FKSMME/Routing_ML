"""Concept Drift Detection for Routing ML Model.

Monitors prediction distribution changes using KL Divergence to detect
when the model's predictions are drifting from the training data distribution.
When drift is detected, triggers retraining automatically.
"""
from __future__ import annotations

import json
import pickle
from collections import deque
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Tuple

import numpy as np
from scipy.stats import entropy

from common.logger import get_logger

logger = get_logger("ml.concept_drift")


class ConceptDriftDetector:
    """
    Monitors prediction distributions and detects concept drift.

    Uses KL Divergence to compare recent prediction distribution
    with baseline (training) distribution.

    Attributes:
        baseline_dist: Reference distribution from training data
        window_size: Number of recent predictions to track
        threshold: KL Divergence threshold for drift detection
        prediction_buffer: Rolling window of recent predictions
    """

    def __init__(
        self,
        baseline_dist: Optional[np.ndarray] = None,
        window_size: int = 1000,
        kl_threshold: float = 0.5,
        storage_path: Optional[Path] = None,
    ):
        """
        Initialize Concept Drift Detector.

        Args:
            baseline_dist: Baseline probability distribution (from training)
            window_size: Size of rolling window for recent predictions
            kl_threshold: KL Divergence threshold (default: 0.5)
            storage_path: Path to save/load detector state
        """
        self.baseline_dist = baseline_dist
        self.window_size = window_size
        self.threshold = kl_threshold
        self.storage_path = storage_path or Path("data/drift_detector.pkl")

        # Rolling window of recent prediction probabilities
        self.prediction_buffer: Deque[float] = deque(maxlen=window_size)

        # Drift detection history
        self.drift_history: List[Dict[str, Any]] = []

        # Load previous state if exists
        if self.storage_path.exists():
            self.load_state()

    def set_baseline(self, predictions: np.ndarray) -> None:
        """
        Set baseline distribution from training data.

        Args:
            predictions: Array of prediction scores from training/validation
        """
        # Create histogram to get probability distribution
        hist, bin_edges = np.histogram(predictions, bins=50, density=True)
        # Normalize to get probabilities
        self.baseline_dist = hist / hist.sum()

        logger.info(
            f"Baseline distribution set: mean={predictions.mean():.3f}, "
            f"std={predictions.std():.3f}, samples={len(predictions)}"
        )

        self.save_state()

    def add_prediction(self, score: float) -> Tuple[bool, float]:
        """
        Add a new prediction score and check for drift.

        Args:
            score: Prediction score (similarity/confidence)

        Returns:
            Tuple of (drift_detected: bool, kl_divergence: float)
        """
        self.prediction_buffer.append(score)

        # Need enough samples to compute distribution
        if len(self.prediction_buffer) < self.window_size // 2:
            return False, 0.0

        # Check for drift
        drift_detected, kl_div = self.check_drift()

        if drift_detected:
            self.log_drift_event(kl_div)

        return drift_detected, kl_div

    def check_drift(self) -> Tuple[bool, float]:
        """
        Check if concept drift has occurred.

        Returns:
            Tuple of (drift_detected: bool, kl_divergence: float)
        """
        if self.baseline_dist is None:
            logger.warning("No baseline distribution set - cannot detect drift")
            return False, 0.0

        if len(self.prediction_buffer) < 10:
            return False, 0.0

        # Compute current distribution from recent predictions
        current_predictions = np.array(self.prediction_buffer)
        hist, _ = np.histogram(
            current_predictions,
            bins=50,
            range=(0, 1),  # Assuming scores are 0-1
            density=True
        )
        current_dist = hist / hist.sum() if hist.sum() > 0 else hist

        # Add small epsilon to avoid log(0)
        epsilon = 1e-10
        baseline_dist_smooth = self.baseline_dist + epsilon
        current_dist_smooth = current_dist + epsilon

        # Normalize after adding epsilon
        baseline_dist_smooth /= baseline_dist_smooth.sum()
        current_dist_smooth /= current_dist_smooth.sum()

        # Compute KL Divergence: D_KL(P || Q) where P=current, Q=baseline
        kl_divergence = entropy(current_dist_smooth, baseline_dist_smooth)

        drift_detected = kl_divergence > self.threshold

        if drift_detected:
            logger.warning(
                f"🚨 Concept Drift Detected! KL Divergence: {kl_divergence:.4f} "
                f"(threshold: {self.threshold})"
            )

        return drift_detected, float(kl_divergence)

    def log_drift_event(self, kl_divergence: float) -> None:
        """
        Log a drift detection event.

        Args:
            kl_divergence: KL divergence value at detection
        """
        event = {
            "timestamp": datetime.now().isoformat(),
            "kl_divergence": kl_divergence,
            "threshold": self.threshold,
            "buffer_size": len(self.prediction_buffer),
            "buffer_mean": float(np.mean(self.prediction_buffer)),
            "buffer_std": float(np.std(self.prediction_buffer)),
        }

        self.drift_history.append(event)

        # Save state after drift event
        self.save_state()

        # Log to file for monitoring
        logger.error(
            f"Drift Event Logged: {json.dumps(event, indent=2)}"
        )

    def get_drift_summary(self, days: int = 7) -> Dict[str, Any]:
        """
        Get summary of drift events in the last N days.

        Args:
            days: Number of days to look back

        Returns:
            Dictionary with drift summary statistics
        """
        cutoff = datetime.now() - timedelta(days=days)

        recent_events = [
            e for e in self.drift_history
            if datetime.fromisoformat(e["timestamp"]) > cutoff
        ]

        if not recent_events:
            return {
                "period_days": days,
                "drift_count": 0,
                "max_kl_divergence": 0.0,
                "avg_kl_divergence": 0.0,
                "events": []
            }

        kl_values = [e["kl_divergence"] for e in recent_events]

        return {
            "period_days": days,
            "drift_count": len(recent_events),
            "max_kl_divergence": max(kl_values),
            "avg_kl_divergence": sum(kl_values) / len(kl_values),
            "events": recent_events[-10:],  # Last 10 events
        }

    def should_retrain(self) -> bool:
        """
        Determine if model retraining should be triggered.

        Based on:
        - Number of drift events in last 7 days
        - Severity of recent drift (KL divergence)

        Returns:
            True if retraining is recommended
        """
        summary = self.get_drift_summary(days=7)

        # Trigger if:
        # 1. More than 5 drift events in last 7 days
        # 2. Or max KL divergence > 1.0 (severe drift)
        if summary["drift_count"] > 5:
            logger.warning(
                f"⚠️  Retraining recommended: {summary['drift_count']} drift events in last 7 days"
            )
            return True

        if summary["max_kl_divergence"] > 1.0:
            logger.warning(
                f"⚠️  Retraining recommended: Severe drift detected (KL={summary['max_kl_divergence']:.3f})"
            )
            return True

        return False

    def reset_buffer(self) -> None:
        """Reset the prediction buffer (after retraining)."""
        self.prediction_buffer.clear()
        logger.info("Prediction buffer reset")

    def save_state(self) -> None:
        """Save detector state to disk."""
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)

        state = {
            "baseline_dist": self.baseline_dist,
            "window_size": self.window_size,
            "threshold": self.threshold,
            "prediction_buffer": list(self.prediction_buffer),
            "drift_history": self.drift_history,
        }

        with open(self.storage_path, "wb") as f:
            pickle.dump(state, f)

        logger.debug(f"Drift detector state saved to {self.storage_path}")

    def load_state(self) -> None:
        """Load detector state from disk."""
        try:
            with open(self.storage_path, "rb") as f:
                state = pickle.load(f)

            self.baseline_dist = state.get("baseline_dist")
            self.window_size = state.get("window_size", 1000)
            self.threshold = state.get("threshold", 0.5)
            self.prediction_buffer = deque(
                state.get("prediction_buffer", []),
                maxlen=self.window_size
            )
            self.drift_history = state.get("drift_history", [])

            logger.info(
                f"Drift detector state loaded: {len(self.drift_history)} events, "
                f"buffer={len(self.prediction_buffer)}/{self.window_size}"
            )
        except Exception as e:
            logger.error(f"Failed to load drift detector state: {e}")


# Global singleton instance
_drift_detector: Optional[ConceptDriftDetector] = None


def get_drift_detector() -> ConceptDriftDetector:
    """Get the global drift detector instance."""
    global _drift_detector
    if _drift_detector is None:
        _drift_detector = ConceptDriftDetector()
    return _drift_detector


def initialize_baseline_from_model(model_dir: Path) -> None:
    """
    Initialize baseline distribution from model validation results.

    Args:
        model_dir: Path to model directory containing validation results
    """
    detector = get_drift_detector()

    # Try to load validation scores
    validation_file = model_dir / "validation_scores.npy"
    if validation_file.exists():
        scores = np.load(validation_file)
        detector.set_baseline(scores)
        logger.info(f"Initialized drift detector from {validation_file}")
    else:
        logger.warning(
            f"No validation scores found at {validation_file}. "
            "Drift detection will not be available."
        )


__all__ = [
    "ConceptDriftDetector",
    "get_drift_detector",
    "initialize_baseline_from_model",
]
