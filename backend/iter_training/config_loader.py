"""
Configuration loader for iterative training system.

This module handles loading and validating the iter_training.yaml
configuration file using pydantic for type safety.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import yaml
from pydantic import BaseModel, Field, validator


class SamplingConfig(BaseModel):
    """Sampling configuration."""
    sample_size: int = Field(500, ge=10, le=10000, description="Number of items to sample")
    strategy: Literal["random", "stratified", "recent_bias"] = "stratified"
    seed: Optional[int] = 42
    strata_column: str = "PART_TYPE"
    recent_days_window: int = Field(30, ge=1, le=365)
    min_population: int = Field(100, ge=1)


class ThresholdsConfig(BaseModel):
    """Quality threshold configuration."""
    mae_max: float = Field(5.0, gt=0)
    trim_mae_max: float = Field(3.5, gt=0)
    process_match_min: float = Field(0.80, ge=0, le=1)
    cv_max: float = Field(0.5, gt=0)
    sample_count_min: int = Field(3, ge=1)
    trim_ratio: float = Field(0.10, ge=0, le=0.5)


class QueueConfig(BaseModel):
    """Retraining queue configuration."""
    max_size: int = Field(3, ge=1, le=10)
    max_retries: int = Field(2, ge=0, le=5)
    retry_backoff_seconds: int = Field(60, ge=1)
    queue_file: str = "data/retraining_queue.json"


class MLPConfig(BaseModel):
    """MLP model configuration."""
    hidden_layer_sizes: List[int] = Field([128, 64])
    activation: Literal["relu", "tanh", "logistic"] = "relu"
    solver: Literal["adam", "lbfgs", "sgd"] = "adam"
    alpha: float = Field(0.0001, ge=0)
    learning_rate_init: float = Field(0.001, gt=0)
    max_iter: int = Field(200, ge=10)
    random_state: int = 42


class StackingConfig(BaseModel):
    """Stacking model configuration."""
    final_estimator: Literal["ridge", "elastic_net"] = "ridge"
    cv: int = Field(3, ge=2, le=10)


class TrainingConfig(BaseModel):
    """Model training configuration."""
    cv_folds: int = Field(5, ge=2, le=10)
    n_jobs: int = -1
    min_improvement_pct: float = Field(5.0, ge=0, le=100)
    model_candidates: List[Literal["baseline", "mlp", "stacking"]] = ["baseline", "mlp", "stacking"]
    mlp: MLPConfig = Field(default_factory=MLPConfig)
    stacking: StackingConfig = Field(default_factory=StackingConfig)


class TuningSearchSpace(BaseModel):
    """Hyperparameter search space for tuning."""
    hidden_layer_sizes: List[List[int]] = [[128, 64], [256, 128, 64], [256, 128]]
    alpha: List[float] = [0.0001, 0.001, 0.01]
    learning_rate_init: List[float] = [0.001, 0.01]


class TuningConfig(BaseModel):
    """Hyperparameter tuning configuration."""
    enabled: bool = False
    max_trials: int = Field(5, ge=1, le=20)
    time_budget_seconds: int = Field(7200, ge=0)
    search_method: Literal["grid", "random"] = "random"
    mlp_search_space: TuningSearchSpace = Field(default_factory=TuningSearchSpace)


class LoggingConfig(BaseModel):
    """Logging configuration."""
    level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    stream_log_file: str = "logs/performance/performance.quality.log"
    cycle_log_pattern: str = "logs/performance/performance.quality_{cycle_id}.log"
    color_output: bool = True
    format: str = "[{timestamp}] {level:8s} cycle={cycle_id} {message}"


class ReportsConfig(BaseModel):
    """Report generation configuration."""
    output_dir: str = "deliverables"
    generate_json: bool = True
    generate_csv: bool = True
    generate_markdown: bool = True
    keep_last_n: int = Field(30, ge=0)


class ScheduleConfig(BaseModel):
    """Automated scheduling configuration."""
    enabled: bool = False
    cron_expression: str = "0 2 * * *"
    max_execution_time: int = Field(3600, ge=60)


class CacheConfig(BaseModel):
    """Caching configuration."""
    enabled: bool = True
    ttl_seconds: int = Field(3600, ge=60)
    max_size: int = Field(1000, ge=10)


class IterTrainingConfig(BaseModel):
    """Complete iterative training configuration.

    This is the root configuration model that combines all subsections.
    """
    sampling: SamplingConfig = Field(default_factory=SamplingConfig)
    thresholds: ThresholdsConfig = Field(default_factory=ThresholdsConfig)
    queue: QueueConfig = Field(default_factory=QueueConfig)
    training: TrainingConfig = Field(default_factory=TrainingConfig)
    tuning: TuningConfig = Field(default_factory=TuningConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    reports: ReportsConfig = Field(default_factory=ReportsConfig)
    schedule: ScheduleConfig = Field(default_factory=ScheduleConfig)
    cache: CacheConfig = Field(default_factory=CacheConfig)

    @validator("sampling")
    def validate_sampling(cls, v: SamplingConfig) -> SamplingConfig:
        """Validate sampling configuration."""
        if v.strategy == "stratified" and not v.strata_column:
            raise ValueError("strata_column required for stratified sampling")
        return v

    @validator("thresholds")
    def validate_thresholds(cls, v: ThresholdsConfig) -> ThresholdsConfig:
        """Validate threshold configuration."""
        if v.trim_mae_max > v.mae_max:
            raise ValueError("trim_mae_max should be <= mae_max")
        return v


def load_config(config_path: Optional[str] = None) -> IterTrainingConfig:
    """Load and validate iterative training configuration.

    Args:
        config_path: Path to config file. If None, uses default location.

    Returns:
        Validated configuration object.

    Raises:
        FileNotFoundError: If config file not found.
        ValueError: If config validation fails.
    """
    if config_path is None:
        # Default to config/iter_training.yaml in project root
        project_root = Path(__file__).parent.parent.parent
        config_path = project_root / "config" / "iter_training.yaml"
    else:
        config_path = Path(config_path)

    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(config_path, "r", encoding="utf-8") as f:
        config_data = yaml.safe_load(f)

    return IterTrainingConfig(**config_data)


def get_config() -> IterTrainingConfig:
    """Get the current iterative training configuration.

    This function caches the config on first load for performance.

    Returns:
        Validated configuration object.
    """
    global _cached_config
    if _cached_config is None:
        _cached_config = load_config()
    return _cached_config


def reload_config(config_path: Optional[str] = None) -> IterTrainingConfig:
    """Reload configuration from disk.

    Args:
        config_path: Path to config file. If None, uses default location.

    Returns:
        Freshly loaded configuration object.
    """
    global _cached_config
    _cached_config = load_config(config_path)
    return _cached_config


# Global config cache
_cached_config: Optional[IterTrainingConfig] = None
