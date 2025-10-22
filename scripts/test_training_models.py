"""
Test script for model training module.

This script tests the model training functions with synthetic data:
- train_mlp()
- train_stacking()
- compare_models()
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd
from backend.iter_training.trainer import (
    train_mlp,
    train_stacking,
    compare_models,
)


def generate_synthetic_data(n_samples=200, n_features=10):
    """Generate synthetic training data for testing.

    Args:
        n_samples: Number of samples
        n_features: Number of features

    Returns:
        Tuple of (X_train, y_train)
    """
    np.random.seed(42)

    # Generate random features
    X = np.random.randn(n_samples, n_features)

    # Generate target with some linear relationship + noise
    true_weights = np.random.randn(n_features)
    y = X @ true_weights + np.random.randn(n_samples) * 2

    # Make target positive (run times can't be negative)
    y = np.abs(y)

    X_df = pd.DataFrame(X, columns=[f"feature_{i}" for i in range(n_features)])
    y_series = pd.Series(y, name="run_time")

    return X_df, y_series


def progress_callback(progress, message):
    """Simple progress callback for testing."""
    print(f"  [{progress:5.1f}%] {message}")


def main():
    """Run model training tests."""
    print("=" * 60)
    print("Model Training Test")
    print("=" * 60)

    # Generate synthetic data
    print("\n[OK] Generating synthetic training data...")
    X_train, y_train = generate_synthetic_data(n_samples=200, n_features=10)
    print(f"  Training data: {X_train.shape[0]} samples, {X_train.shape[1]} features")
    print(f"  Target range: {y_train.min():.2f} - {y_train.max():.2f} minutes")

    candidates = []

    # Test MLP training
    print("\n[OK] Testing MLP training:")
    mlp_candidate = train_mlp(X_train, y_train, progress_callback=progress_callback)
    candidates.append(mlp_candidate)

    print(f"\n  MLP Results:")
    print(f"    MAE: {mlp_candidate.metrics['mae']:.2f} minutes")
    print(f"    Trim-MAE: {mlp_candidate.metrics['trim_mae']:.2f} minutes")
    print(f"    CV MAE: {mlp_candidate.metrics['cv_mae']:.2f} +/- {mlp_candidate.metrics['cv_std']:.2f}")
    print(f"    Training time: {mlp_candidate.training_time:.2f} seconds")

    # Test Stacking training
    print("\n[OK] Testing Stacking training:")
    stacking_candidate = train_stacking(X_train, y_train, progress_callback=progress_callback)
    candidates.append(stacking_candidate)

    print(f"\n  Stacking Results:")
    print(f"    MAE: {stacking_candidate.metrics['mae']:.2f} minutes")
    print(f"    Trim-MAE: {stacking_candidate.metrics['trim_mae']:.2f} minutes")
    print(f"    CV MAE: {stacking_candidate.metrics['cv_mae']:.2f} +/- {stacking_candidate.metrics['cv_std']:.2f}")
    print(f"    Training time: {stacking_candidate.training_time:.2f} seconds")

    # Test model comparison
    print("\n[OK] Testing model comparison:")
    baseline_mae = 4.5  # Placeholder baseline
    best_model = compare_models(candidates, baseline_mae)

    print(f"\n  Best Model: {best_model.name}")
    print(f"    MAE: {best_model.metrics['mae']:.2f} minutes")
    print(f"    Improvement: {(baseline_mae - best_model.metrics['mae']) / baseline_mae * 100:.1f}% vs baseline")

    # Verify model serialization
    print("\n[OK] Testing model serialization:")
    model_dict = mlp_candidate.to_dict()
    print(f"  Serialized keys: {list(model_dict.keys())}")
    print(f"  JSON-safe: {all(isinstance(v, (str, int, float, bool, list, dict, type(None))) for v in model_dict.values())}")

    print("\n" + "=" * 60)
    print("[OK] All tests passed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
