"""Utility functions for evaluating iterative training quality cycles."""

from __future__ import annotations

import math
import statistics
import time
from datetime import datetime
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from .models import AlertItem, QualityMetrics, SamplingStrategy


def _ensure_strategy(strategy: str | SamplingStrategy) -> SamplingStrategy:
    if isinstance(strategy, SamplingStrategy):
        return strategy
    try:
        return SamplingStrategy(str(strategy))
    except ValueError as exc:  # pragma: no cover - defensive
        raise ValueError(f"Unsupported strategy: {strategy}") from exc


def evaluate_quality(
    predictions: Iterable[Mapping[str, Any]],
    *,
    sample_size: int,
    strategy: str | SamplingStrategy = SamplingStrategy.RANDOM,
    cycle_id: Optional[str] = None,
    mae_threshold: float = 5.0,
    process_match_threshold: float = 0.9,
) -> QualityMetrics:
    """Aggregate quality metrics for an iterative training cycle.

    Args:
        predictions: Iterable of prediction payloads with ``predicted_operations``
            and ``actual_operations`` lists.
        sample_size: Total number of sampled items.
        strategy: Sampling strategy used for this cycle.
        cycle_id: Optional identifier (defaults to ISO timestamp).
        mae_threshold: Threshold for MAE alerts.
        process_match_threshold: Threshold for process match alerts.

    Returns:
        A populated :class:`QualityMetrics` instance.
    """

    start = time.perf_counter()
    strategy_enum = _ensure_strategy(strategy)
    cycle_identifier = cycle_id or datetime.utcnow().strftime("%Y%m%dT%H%M%S")

    mae_values: List[float] = []
    rmse_values: List[float] = []
    process_matches: List[float] = []
    sample_counts: List[int] = []
    alerts: List[AlertItem] = []

    items_evaluated = 0
    items_failed = 0

    for payload in predictions:
        predicted_ops: Sequence[Mapping[str, Any]] = tuple(payload.get("predicted_operations") or ())
        actual_ops: Sequence[Mapping[str, Any]] = tuple(payload.get("actual_operations") or ())
        if not predicted_ops or not actual_ops:
            items_failed += 1
            continue

        paired = zip(predicted_ops, actual_ops)
        abs_errors: List[float] = []
        squared_errors: List[float] = []
        matches = 0
        total = 0
        for predicted, actual in paired:
            predicted_runtime = float(predicted.get("RUN_TIME", 0.0))
            actual_runtime = float(actual.get("RUN_TIME", 0.0))
            abs_errors.append(abs(predicted_runtime - actual_runtime))
            squared_errors.append((predicted_runtime - actual_runtime) ** 2)
            if predicted.get("PROC_CD") == actual.get("PROC_CD"):
                matches += 1
            total += 1

        if not abs_errors:
            items_failed += 1
            continue

        items_evaluated += 1
        mae_values.append(sum(abs_errors) / len(abs_errors))
        rmse_values.append(math.sqrt(sum(squared_errors) / len(squared_errors)))
        process_matches.append(matches / total if total else 0.0)
        sample_counts.append(len(abs_errors))

    mae = statistics.fmean(mae_values) if mae_values else 0.0
    trim_mae = statistics.median(mae_values) if mae_values else 0.0
    rmse = statistics.fmean(rmse_values) if rmse_values else 0.0
    process_match = statistics.fmean(process_matches) if process_matches else 0.0
    coefficient_variation = (
        statistics.pstdev(mae_values) / mae if mae_values and mae > 0 else 0.0
    )
    avg_sample_count = statistics.fmean(sample_counts) if sample_counts else 0.0

    if mae > mae_threshold:
        alerts.append(
            AlertItem(
                item_cd="__aggregate__",
                issue="HIGH_MAE",
                value=mae,
                threshold=mae_threshold,
                message=f"Average MAE {mae:.2f} exceeds threshold {mae_threshold:.2f}",
            )
        )

    if process_match < process_match_threshold:
        alerts.append(
            AlertItem(
                item_cd="__aggregate__",
                issue="LOW_PROCESS_MATCH",
                value=process_match,
                threshold=process_match_threshold,
                message=f"Process match {process_match:.2%} below threshold {process_match_threshold:.2%}",
            )
        )

    duration = time.perf_counter() - start
    metrics = QualityMetrics(
        cycle_id=cycle_identifier,
        sample_size=sample_size,
        strategy=strategy_enum,
        mae=mae,
        trim_mae=trim_mae,
        rmse=rmse,
        process_match=process_match,
        outsourcing_success=1.0,  # Placeholder until outsourcing data integrated
        cv=coefficient_variation,
        sample_count=avg_sample_count,
        alerts=alerts,
        timestamp=datetime.utcnow(),
        duration_seconds=duration,
        items_evaluated=items_evaluated,
        items_failed=items_failed,
        metadata={
            "mae_values": mae_values,
            "process_matches": process_matches,
        },
    )
    return metrics
