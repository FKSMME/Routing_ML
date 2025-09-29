"""Utility functions for aggregating manufacturing time statistics.

This module centralises the logic that was outlined in the predictor plan
regarding z-score analysis, trimmed standard deviation, and sigma-based
profiles.  The trainer can use it to pre-compute default OPT/STD/SAFE
profiles that the predictor consumes during inference.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Iterable, List, Optional

import numpy as np
import pandas as pd

from common.logger import get_logger

logger = get_logger("time_aggregator")


class AggregationStrategy:
    """Supported aggregation strategies."""

    Z_SCORE = "z_score"
    TRIMMED_STD = "trimmed_std"
    SIGMA_PROFILE = "sigma_profile"


DEFAULT_TIME_COLUMNS: List[str] = [
    "SETUP_TIME",
    "ACT_SETUP_TIME",
    "ACT_RUN_TIME",
    "MACH_WORKED_HOURS",
    "WAIT_TIME",
    "MOVE_TIME",
    "QUEUE_TIME",
    "MFG_LT",
]


@dataclass
class TimeAggregationConfig:
    """Configuration for time profile aggregation."""

    strategy: str = AggregationStrategy.SIGMA_PROFILE
    trim_std_enabled: bool = True
    trim_lower_percent: float = 0.05
    trim_upper_percent: float = 0.95
    optimal_sigma: float = 0.67
    safe_sigma: float = 1.28
    min_samples: int = 3


def _to_numeric(series: pd.Series) -> np.ndarray:
    numeric = pd.to_numeric(series, errors="coerce").replace([np.inf, -np.inf], np.nan)
    numeric = numeric.dropna()
    if numeric.empty:
        return np.array([], dtype=np.float64)
    return numeric.to_numpy(dtype=np.float64)


def _z_score_stats(values: np.ndarray) -> Dict[str, float]:
    if values.size == 0:
        return {"mean": 0.0, "std": 0.0, "max_abs_z": 0.0, "outliers_gt3": 0}

    mean = float(values.mean())
    std = float(values.std(ddof=0))
    if std == 0:
        return {"mean": mean, "std": 0.0, "max_abs_z": 0.0, "outliers_gt3": 0}

    z_scores = np.abs((values - mean) / std)
    max_abs_z = float(np.max(z_scores))
    outliers_gt3 = int(np.sum(z_scores > 3.0))
    return {
        "mean": mean,
        "std": std,
        "max_abs_z": max_abs_z,
        "outliers_gt3": outliers_gt3,
    }


def _trimmed_stats(values: np.ndarray, lower: float, upper: float) -> Dict[str, float]:
    if values.size == 0:
        return {"mean": 0.0, "std": 0.0, "samples": 0, "removed": 0}

    lower = float(np.clip(lower, 0.0, 0.5))
    upper = float(np.clip(upper, 0.5, 1.0))
    if upper <= lower or values.size < 3:
        mean = float(values.mean())
        std = float(values.std(ddof=0))
        return {"mean": mean, "std": std, "samples": int(values.size), "removed": 0}

    sorted_vals = np.sort(values)
    lower_idx = int(np.floor(lower * len(sorted_vals)))
    upper_idx = int(np.ceil(upper * len(sorted_vals)))
    trimmed = sorted_vals[lower_idx:upper_idx]
    if trimmed.size == 0:
        trimmed = sorted_vals

    removed = len(sorted_vals) - len(trimmed)
    mean = float(trimmed.mean())
    std = float(trimmed.std(ddof=0))
    return {"mean": mean, "std": std, "samples": int(trimmed.size), "removed": int(removed)}


def _sigma_profile(mean: float, std: float, *, optimal_sigma: float, safe_sigma: float) -> Dict[str, float]:
    if mean is None:
        mean = 0.0
    if std is None:
        std = 0.0
    return {
        "optimal": float(mean + optimal_sigma * std),
        "standard": float(mean),
        "safe": float(mean + safe_sigma * std),
        "optimal_sigma": float(optimal_sigma),
        "safe_sigma": float(safe_sigma),
    }


def generate_time_profiles(
    frame: pd.DataFrame,
    *,
    config: Optional[TimeAggregationConfig] = None,
    time_columns: Optional[Iterable[str]] = None,
) -> Dict[str, object]:
    """Generate OPT/STD/SAFE profiles for manufacturing time fields."""

    if config is None:
        config = TimeAggregationConfig()

    columns_to_use = list(dict.fromkeys(time_columns or DEFAULT_TIME_COLUMNS))
    present_columns = [col for col in columns_to_use if col in frame.columns]

    column_results: Dict[str, Dict[str, object]] = {}
    profile_values = {"OPT": {}, "STD": {}, "SAFE": {}}

    for column in present_columns:
        values = _to_numeric(frame[column])
        if values.size < config.min_samples:
            logger.debug("열 %s 은 샘플 수 부족(%d/%d)으로 프로파일에서 제외", column, values.size, config.min_samples)
            continue

        z_stats = _z_score_stats(values)
        trimmed_stats = None
        if config.trim_std_enabled:
            trimmed_stats = _trimmed_stats(values, config.trim_lower_percent, config.trim_upper_percent)

        base_source = "raw"
        base_mean = z_stats["mean"]
        base_std = z_stats["std"]

        if config.strategy == AggregationStrategy.TRIMMED_STD and trimmed_stats:
            base_mean = trimmed_stats["mean"]
            base_std = trimmed_stats["std"]
            base_source = "trimmed"
        elif config.strategy == AggregationStrategy.SIGMA_PROFILE and trimmed_stats:
            base_mean = trimmed_stats["mean"]
            base_std = trimmed_stats["std"]
            base_source = "trimmed"
        elif config.strategy == AggregationStrategy.Z_SCORE:
            base_source = "raw"
        elif trimmed_stats and trimmed_stats["samples"] > 0 and trimmed_stats["std"] > 0:
            base_mean = trimmed_stats["mean"]
            base_std = trimmed_stats["std"]
            base_source = "trimmed"

        sigma_stats = _sigma_profile(
            base_mean,
            base_std,
            optimal_sigma=config.optimal_sigma,
            safe_sigma=config.safe_sigma,
        )

        column_results[column] = {
            "samples": int(values.size),
            "raw": z_stats,
            "trimmed": trimmed_stats,
            "profile_source": base_source,
            "profile": sigma_stats,
        }

        profile_values["OPT"][column] = sigma_stats["optimal"]
        profile_values["STD"][column] = sigma_stats["standard"]
        profile_values["SAFE"][column] = sigma_stats["safe"]

    result = {
        "generated_at": datetime.utcnow().isoformat(),
        "strategy": config.strategy,
        "time_columns": present_columns,
        "columns": column_results,
        "profiles": profile_values,
        "parameters": {
            "trim_std_enabled": config.trim_std_enabled,
            "trim_lower_percent": config.trim_lower_percent,
            "trim_upper_percent": config.trim_upper_percent,
            "optimal_sigma": config.optimal_sigma,
            "safe_sigma": config.safe_sigma,
            "min_samples": config.min_samples,
        },
    }

    return result


__all__ = [
    "AggregationStrategy",
    "TimeAggregationConfig",
    "generate_time_profiles",
    "DEFAULT_TIME_COLUMNS",
]
