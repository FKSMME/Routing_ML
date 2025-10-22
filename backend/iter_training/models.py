"""
Data models and type definitions for iterative training.

This module defines the core data structures used throughout
the iterative training pipeline, including quality metrics,
retraining jobs, and model candidates.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class SamplingStrategy(str, Enum):
    """Sampling strategy for quality evaluation.

    Attributes:
        RANDOM: Simple random sampling without replacement
        STRATIFIED: Stratified sampling by PART_TYPE/ITEM_TYPE
        RECENT_BIAS: Weighted sampling favoring recently created/updated items
    """
    RANDOM = "random"
    STRATIFIED = "stratified"
    RECENT_BIAS = "recent_bias"


class JobStatus(str, Enum):
    """Status of a retraining job.

    Attributes:
        PENDING: Job queued, waiting to start
        RUNNING: Job currently executing
        SUCCEEDED: Job completed successfully
        FAILED: Job failed with errors
        DEFERRED: Job deferred due to queue overflow
        SKIPPED: Job skipped (no improvement found)
    """
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    DEFERRED = "deferred"
    SKIPPED = "skipped"


@dataclass
class AlertItem:
    """Individual alert for quality metric violation.

    Attributes:
        item_cd: Item code that triggered the alert
        proc_cd: Process code (optional, for process-level alerts)
        issue: Type of issue (e.g., "HIGH_CV", "LOW_SAMPLES", "HIGH_MAE")
        value: Measured value that triggered the alert
        threshold: Threshold that was exceeded
        message: Human-readable alert message
    """
    item_cd: str
    issue: str
    value: float
    threshold: float
    message: str
    proc_cd: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class QualityMetrics:
    """Quality metrics for a single evaluation cycle.

    This dataclass captures all metrics calculated during a quality
    evaluation cycle, including aggregate statistics and individual alerts.

    Attributes:
        cycle_id: Unique identifier for this evaluation cycle (ISO timestamp)
        sample_size: Number of items sampled
        strategy: Sampling strategy used
        mae: Mean Absolute Error (minutes)
        trim_mae: Trimmed MAE after removing outliers
        rmse: Root Mean Squared Error (minutes)
        process_match: Percentage of predicted processes matching actual (0-1)
        outsourcing_success: Percentage of successful outsource→in-house conversions (0-1)
        cv: Coefficient of Variation (stddev/mean)
        sample_count: Average number of work order samples per item
        alerts: List of quality violations
        timestamp: When this cycle was executed
        duration_seconds: How long the evaluation took
        items_evaluated: Number of items successfully evaluated (may be < sample_size)
        items_failed: Number of items that failed prediction/evaluation
        metadata: Additional cycle-specific data
    """
    cycle_id: str
    sample_size: int
    strategy: SamplingStrategy
    mae: float
    trim_mae: float
    rmse: float
    process_match: float
    outsourcing_success: float
    cv: float
    sample_count: float
    alerts: List[AlertItem] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    duration_seconds: float = 0.0
    items_evaluated: int = 0
    items_failed: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dictionary."""
        return {
            "cycle_id": self.cycle_id,
            "sample_size": self.sample_size,
            "strategy": self.strategy.value,
            "mae": round(self.mae, 2),
            "trim_mae": round(self.trim_mae, 2),
            "rmse": round(self.rmse, 2),
            "process_match": round(self.process_match, 3),
            "outsourcing_success": round(self.outsourcing_success, 3),
            "cv": round(self.cv, 3),
            "sample_count": round(self.sample_count, 1),
            "alerts": [
                {
                    "item_cd": a.item_cd,
                    "proc_cd": a.proc_cd,
                    "issue": a.issue,
                    "value": a.value,
                    "threshold": a.threshold,
                    "message": a.message,
                    "metadata": a.metadata,
                }
                for a in self.alerts
            ],
            "timestamp": self.timestamp.isoformat(),
            "duration_seconds": round(self.duration_seconds, 1),
            "items_evaluated": self.items_evaluated,
            "items_failed": self.items_failed,
            "metadata": self.metadata,
        }


@dataclass
class RetrainingJob:
    """Retraining job for model improvement.

    Represents a single retraining job triggered by quality degradation.

    Attributes:
        queue_id: Unique job identifier
        cycle_id: Quality cycle that triggered this job
        items: List of item codes to focus retraining on (optional)
        metrics: Quality metrics that triggered retraining
        status: Current job status
        created_at: When job was created
        updated_at: When job was last updated
        started_at: When job execution started
        completed_at: When job execution finished
        error_message: Error details if status=FAILED
        retry_count: Number of retry attempts
        result: Training results (model comparison, etc.)
    """
    queue_id: str
    cycle_id: str
    metrics: Dict[str, float]
    status: JobStatus = JobStatus.PENDING
    items: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    result: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dictionary."""
        return {
            "queue_id": self.queue_id,
            "cycle_id": self.cycle_id,
            "items": self.items,
            "metrics": self.metrics,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "result": self.result,
        }


@dataclass
class ModelCandidate:
    """Model candidate for comparison during retraining.

    Attributes:
        name: Model name (e.g., "baseline", "mlp", "stacking")
        model_type: Type of model (e.g., "HNSW", "MLPRegressor", "StackingRegressor")
        metrics: Performance metrics from cross-validation
        training_time: Time taken to train (seconds)
        inference_latency: Average prediction time (milliseconds)
        parameters: Hyperparameters used
        cv_scores: Cross-validation scores per fold
        is_selected: Whether this model was selected for deployment
    """
    name: str
    model_type: str
    metrics: Dict[str, float]
    training_time: float
    inference_latency: float
    parameters: Dict[str, Any] = field(default_factory=dict)
    cv_scores: List[float] = field(default_factory=list)
    is_selected: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dictionary."""
        return {
            "name": self.name,
            "model_type": self.model_type,
            "metrics": {k: round(v, 3) for k, v in self.metrics.items()},
            "training_time": round(self.training_time, 2),
            "inference_latency": round(self.inference_latency, 2),
            "parameters": self.parameters,
            "cv_scores": [round(s, 3) for s in self.cv_scores],
            "is_selected": self.is_selected,
        }


@dataclass
class SamplingResult:
    """Result of sampling operation.

    Attributes:
        items: List of sampled item codes
        strategy: Strategy used for sampling
        sample_size: Requested sample size
        actual_size: Actual number of items sampled
        metadata: Additional sampling information (strata counts, etc.)
    """
    items: List[str]
    strategy: SamplingStrategy
    sample_size: int
    actual_size: int
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dictionary."""
        return {
            "items": self.items,
            "strategy": self.strategy.value,
            "sample_size": self.sample_size,
            "actual_size": self.actual_size,
            "metadata": self.metadata,
        }
