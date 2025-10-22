"""
Iterative Training Module for Routing ML System.

This package provides automated quality evaluation, retraining,
and model deployment for the routing prediction system.

Components:
    - models: Data structures and type definitions
    - sampler: Sampling strategies for quality evaluation
    - config_loader: Configuration management
    - queue: Retraining job queue management
    - engine: Retraining orchestration
"""

from __future__ import annotations

__version__ = "1.0.0"
__all__ = [
    "QualityMetrics",
    "RetrainingJob",
    "SamplingStrategy",
    "ModelCandidate",
]

# Type hints will be imported from models module
try:
    from .models import (
        QualityMetrics,
        RetrainingJob,
        SamplingStrategy,
        ModelCandidate,
    )
except ImportError:
    # Allow module to be imported even if submodules not yet created
    pass
