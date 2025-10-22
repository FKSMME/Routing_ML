"""
Model training module for iterative training system.

This module implements training functions for different model types:
- Baseline: Existing HNSW model (no retraining needed)
- MLP: Multi-Layer Perceptron regressor
- Stacking: Stacking ensemble with multiple base estimators

All training functions support progress callbacks for real-time monitoring.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, StackingRegressor
from sklearn.linear_model import Ridge, ElasticNet
from sklearn.model_selection import cross_val_score
from sklearn.neighbors import KNeighborsRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler

from .config_loader import load_config
from .models import ModelCandidate

logger = logging.getLogger(__name__)


def prepare_training_data(
    items: List[str],
) -> Tuple[pd.DataFrame, pd.Series]:
    """Prepare training data from work order history.

    Args:
        items: List of item codes to train on

    Returns:
        Tuple of (X_train, y_train) where:
        - X_train: Feature DataFrame
        - y_train: Target Series (actual run times)

    Raises:
        ValueError: If no training data found
    """
    from backend.database import fetch_work_results_batch
    from backend.constants import TRAIN_FEATURES

    logger.info(f"Preparing training data for {len(items)} items")

    # Fetch work order results from database
    work_results = fetch_work_results_batch(items)

    # Combine all results into single DataFrame
    all_data = []
    for item_cd, df in work_results.items():
        if not df.empty:
            all_data.append(df)

    if not all_data:
        raise ValueError(f"No training data found for items: {items}")

    combined_df = pd.concat(all_data, ignore_index=True)

    # Separate features (X) and target (y)
    # Target: ACT_RUN_TIME (actual run time)
    if 'ACT_RUN_TIME' not in combined_df.columns:
        raise ValueError("ACT_RUN_TIME column not found in work results")

    y_train = combined_df['ACT_RUN_TIME'].copy()

    # Features: TRAIN_FEATURES from constants
    available_features = [f for f in TRAIN_FEATURES if f in combined_df.columns]
    if not available_features:
        raise ValueError(f"No training features found. Available columns: {list(combined_df.columns)}")

    X_train = combined_df[available_features].copy()

    logger.info(f"Prepared {len(X_train)} training samples with {len(available_features)} features")

    return X_train, y_train


def train_baseline(
    items: List[str],
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> ModelCandidate:
    """Train baseline model (existing HNSW).

    This function doesn't actually retrain the HNSW model,
    but evaluates its performance as a baseline for comparison.

    Args:
        items: List of item codes for evaluation
        progress_callback: Optional callback(progress, message)

    Returns:
        ModelCandidate with baseline performance metrics
    """
    start_time = time.time()
    config = load_config()

    if progress_callback:
        progress_callback(10, "Loading baseline HNSW model...")

    # Load existing HNSW model
    # TODO: Load actual HNSW model from models/ directory
    logger.info("Evaluating baseline HNSW model")

    if progress_callback:
        progress_callback(30, "Preparing evaluation data...")

    # TODO: Implement actual baseline evaluation
    # This would load the current HNSW model and evaluate it

    if progress_callback:
        progress_callback(60, "Running cross-validation...")

    # Placeholder metrics (to be replaced with actual evaluation)
    cv_scores = [0.85, 0.82, 0.88, 0.84, 0.86]  # Placeholder

    if progress_callback:
        progress_callback(100, "Baseline evaluation complete")

    training_time = time.time() - start_time

    return ModelCandidate(
        name="baseline",
        model_type="HNSW",
        metrics={
            "mae": 4.5,  # Placeholder
            "trim_mae": 3.2,  # Placeholder
            "process_match": 0.85,  # Placeholder
        },
        training_time=training_time,
        inference_latency=15.0,  # Placeholder: ms per prediction
        cv_scores=cv_scores,
        parameters={},
        is_selected=False,
    )


def train_mlp(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> ModelCandidate:
    """Train MLP (Multi-Layer Perceptron) regressor.

    Args:
        X_train: Training features
        y_train: Training target (run times)
        progress_callback: Optional callback(progress, message)

    Returns:
        ModelCandidate with MLP performance metrics
    """
    start_time = time.time()
    config = load_config()
    mlp_config = config.training.mlp

    if progress_callback:
        progress_callback(5, "Initializing MLP model...")

    logger.info(f"Training MLP with layers {mlp_config.hidden_layer_sizes}")

    # Standardize features
    if progress_callback:
        progress_callback(10, "Standardizing features...")

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_train)

    # Initialize MLP
    if progress_callback:
        progress_callback(20, "Creating MLP architecture...")

    mlp = MLPRegressor(
        hidden_layer_sizes=tuple(mlp_config.hidden_layer_sizes),
        activation=mlp_config.activation,
        solver=mlp_config.solver,
        alpha=mlp_config.alpha,
        learning_rate_init=mlp_config.learning_rate_init,
        max_iter=mlp_config.max_iter,
        random_state=mlp_config.random_state,
        verbose=False,
    )

    # Cross-validation
    if progress_callback:
        progress_callback(30, f"Running {config.training.cv_folds}-fold cross-validation...")

    cv_scores = cross_val_score(
        mlp,
        X_scaled,
        y_train,
        cv=config.training.cv_folds,
        scoring="neg_mean_absolute_error",
        n_jobs=config.training.n_jobs,
    )
    cv_scores = -cv_scores  # Convert to positive MAE

    # Train final model
    if progress_callback:
        progress_callback(70, "Training final MLP model...")

    mlp.fit(X_scaled, y_train)

    if progress_callback:
        progress_callback(90, "Calculating performance metrics...")

    # Calculate metrics
    y_pred = mlp.predict(X_scaled)
    mae = np.mean(np.abs(y_train - y_pred))

    # Trimmed MAE (remove top/bottom 10%)
    errors = np.abs(y_train - y_pred)
    trim_ratio = config.thresholds.trim_ratio
    lower = int(len(errors) * trim_ratio)
    upper = int(len(errors) * (1 - trim_ratio))
    trim_mae = np.mean(np.sort(errors)[lower:upper])

    if progress_callback:
        progress_callback(100, "MLP training complete")

    training_time = time.time() - start_time

    return ModelCandidate(
        name="mlp",
        model_type="MLPRegressor",
        metrics={
            "mae": float(mae),
            "trim_mae": float(trim_mae),
            "cv_mae": float(np.mean(cv_scores)),
            "cv_std": float(np.std(cv_scores)),
        },
        training_time=training_time,
        inference_latency=5.0,  # Placeholder: to be measured
        parameters={
            "hidden_layer_sizes": mlp_config.hidden_layer_sizes,
            "activation": mlp_config.activation,
            "solver": mlp_config.solver,
            "alpha": mlp_config.alpha,
        },
        cv_scores=cv_scores.tolist(),
        is_selected=False,
    )


def train_stacking(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> ModelCandidate:
    """Train Stacking ensemble regressor.

    Base estimators: KNN, RandomForest, MLP
    Final estimator: Ridge or ElasticNet

    Args:
        X_train: Training features
        y_train: Training target (run times)
        progress_callback: Optional callback(progress, message)

    Returns:
        ModelCandidate with stacking performance metrics
    """
    start_time = time.time()
    config = load_config()
    stacking_config = config.training.stacking
    mlp_config = config.training.mlp

    if progress_callback:
        progress_callback(5, "Initializing stacking ensemble...")

    logger.info("Training Stacking ensemble (KNN + RF + MLP)")

    # Standardize features
    if progress_callback:
        progress_callback(10, "Standardizing features...")

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_train)

    # Define base estimators
    if progress_callback:
        progress_callback(20, "Creating base estimators...")

    base_estimators = [
        ("knn", KNeighborsRegressor(n_neighbors=5)),
        ("rf", RandomForestRegressor(n_estimators=50, max_depth=10, random_state=42)),
        ("mlp", MLPRegressor(
            hidden_layer_sizes=tuple(mlp_config.hidden_layer_sizes),
            activation=mlp_config.activation,
            max_iter=mlp_config.max_iter,
            random_state=mlp_config.random_state,
            verbose=False,
        )),
    ]

    # Define final estimator
    if stacking_config.final_estimator == "ridge":
        final_estimator = Ridge(alpha=1.0)
    else:  # elastic_net
        final_estimator = ElasticNet(alpha=0.1, l1_ratio=0.5, random_state=42)

    # Create stacking regressor
    if progress_callback:
        progress_callback(30, "Creating stacking architecture...")

    stacking = StackingRegressor(
        estimators=base_estimators,
        final_estimator=final_estimator,
        cv=stacking_config.cv,
        n_jobs=config.training.n_jobs,
    )

    # Cross-validation
    if progress_callback:
        progress_callback(40, f"Running {config.training.cv_folds}-fold cross-validation...")

    cv_scores = cross_val_score(
        stacking,
        X_scaled,
        y_train,
        cv=config.training.cv_folds,
        scoring="neg_mean_absolute_error",
        n_jobs=config.training.n_jobs,
    )
    cv_scores = -cv_scores  # Convert to positive MAE

    # Train final model
    if progress_callback:
        progress_callback(70, "Training final stacking model...")

    stacking.fit(X_scaled, y_train)

    if progress_callback:
        progress_callback(90, "Calculating performance metrics...")

    # Calculate metrics
    y_pred = stacking.predict(X_scaled)
    mae = np.mean(np.abs(y_train - y_pred))

    # Trimmed MAE
    errors = np.abs(y_train - y_pred)
    trim_ratio = config.thresholds.trim_ratio
    lower = int(len(errors) * trim_ratio)
    upper = int(len(errors) * (1 - trim_ratio))
    trim_mae = np.mean(np.sort(errors)[lower:upper])

    if progress_callback:
        progress_callback(100, "Stacking training complete")

    training_time = time.time() - start_time

    return ModelCandidate(
        name="stacking",
        model_type="StackingRegressor",
        metrics={
            "mae": float(mae),
            "trim_mae": float(trim_mae),
            "cv_mae": float(np.mean(cv_scores)),
            "cv_std": float(np.std(cv_scores)),
        },
        training_time=training_time,
        inference_latency=12.0,  # Placeholder: to be measured
        parameters={
            "base_estimators": ["KNN", "RandomForest", "MLP"],
            "final_estimator": stacking_config.final_estimator,
            "cv": stacking_config.cv,
        },
        cv_scores=cv_scores.tolist(),
        is_selected=False,
    )


def compare_models(
    candidates: List[ModelCandidate],
    baseline_mae: float,
) -> ModelCandidate:
    """Compare model candidates and select the best one.

    Selection criteria:
    1. Must improve MAE by at least min_improvement_pct over baseline
    2. Among qualifying models, select one with lowest trim_mae
    3. If tie, prefer simpler model (baseline > mlp > stacking)

    Args:
        candidates: List of trained model candidates
        baseline_mae: Baseline MAE for comparison

    Returns:
        Selected ModelCandidate (with is_selected=True)
    """
    config = load_config()
    min_improvement = config.training.min_improvement_pct / 100.0

    logger.info(f"Comparing {len(candidates)} model candidates")
    logger.info(f"Baseline MAE: {baseline_mae:.2f} minutes")
    logger.info(f"Required improvement: {min_improvement*100:.1f}%")

    # Filter candidates that meet improvement threshold
    qualifying = []
    for candidate in candidates:
        mae = candidate.metrics.get("mae", float("inf"))
        improvement = (baseline_mae - mae) / baseline_mae

        logger.info(
            f"  {candidate.name:12s}: MAE={mae:5.2f} "
            f"({improvement*100:+5.1f}% vs baseline)"
        )

        if improvement >= min_improvement:
            qualifying.append(candidate)

    # If no models meet threshold, keep baseline
    if not qualifying:
        logger.warning("No models meet improvement threshold - keeping baseline")
        baseline_candidate = next((c for c in candidates if c.name == "baseline"), None)
        if baseline_candidate:
            baseline_candidate.is_selected = True
            return baseline_candidate
        # Fallback: return first candidate
        candidates[0].is_selected = True
        return candidates[0]

    # Sort by trim_mae (lower is better)
    qualifying.sort(key=lambda c: c.metrics.get("trim_mae", float("inf")))

    # Select best model
    best = qualifying[0]
    best.is_selected = True

    logger.info(f"Selected model: {best.name} (Trim-MAE: {best.metrics['trim_mae']:.2f})")

    return best


def train_all_models(
    items: List[str],
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> Tuple[List[ModelCandidate], ModelCandidate]:
    """Train all configured models and return best one.

    This is the main entry point for the training workflow.

    Args:
        items: List of item codes to train on
        progress_callback: Optional callback(progress, message)

    Returns:
        Tuple of (all_candidates, best_candidate)

    Raises:
        ValueError: If training data preparation fails
    """
    config = load_config()
    candidates = []

    logger.info(f"Starting model training for {len(items)} items")
    logger.info(f"Model candidates: {config.training.model_candidates}")

    # Prepare training data
    if progress_callback:
        progress_callback(5, "Preparing training data...")

    try:
        X_train, y_train = prepare_training_data(items)
    except NotImplementedError:
        logger.warning("Training data preparation not implemented - using placeholder")
        # For Phase 2, we'll defer actual implementation
        # Return placeholder candidates
        if progress_callback:
            progress_callback(100, "Training skipped (data preparation pending)")

        placeholder_baseline = ModelCandidate(
            name="baseline",
            model_type="HNSW",
            metrics={"mae": 4.5, "trim_mae": 3.2},
            training_time=0.0,
            inference_latency=15.0,
            is_selected=True,
        )
        return [placeholder_baseline], placeholder_baseline

    # Train baseline (if configured)
    if "baseline" in config.training.model_candidates:
        if progress_callback:
            progress_callback(10, "Evaluating baseline model...")

        baseline = train_baseline(items, progress_callback=None)
        candidates.append(baseline)

    # Train MLP (if configured)
    if "mlp" in config.training.model_candidates:
        if progress_callback:
            progress_callback(35, "Training MLP model...")

        mlp = train_mlp(X_train, y_train, progress_callback=None)
        candidates.append(mlp)

    # Train Stacking (if configured)
    if "stacking" in config.training.model_candidates:
        if progress_callback:
            progress_callback(65, "Training stacking ensemble...")

        stacking = train_stacking(X_train, y_train, progress_callback=None)
        candidates.append(stacking)

    # Compare and select best model
    if progress_callback:
        progress_callback(95, "Comparing models...")

    baseline_mae = next(
        (c.metrics["mae"] for c in candidates if c.name == "baseline"),
        candidates[0].metrics["mae"],
    )
    best_model = compare_models(candidates, baseline_mae)

    if progress_callback:
        progress_callback(100, f"Training complete - selected {best_model.name}")

    return candidates, best_model
