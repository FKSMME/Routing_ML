"""
Quality Evaluator for Routing ML System.

This module implements the quality evaluation worker that periodically
samples items, compares predictions with actual work order results,
and triggers retraining when quality degrades.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sqlalchemy import text

from backend.database import get_session, VIEW_WORK_RESULT
from backend.predictor_ml import predict_items_with_ml_optimized
from backend.iter_training.models import (
    AlertItem,
    QualityMetrics,
    SamplingResult,
    SamplingStrategy,
)
from backend.iter_training.sampler import sample_items
from backend.iter_training.config_loader import get_config

logger = logging.getLogger(__name__)


class QualityEvaluator:
    """Evaluates prediction quality against actual work order results.

    This class orchestrates the quality evaluation cycle:
    1. Sample items from ITEM_INFO
    2. Generate predictions using current model
    3. Compare with actual WORK_ORDER_RESULTS
    4. Calculate quality metrics
    5. Generate alerts and reports
    """

    def __init__(self, config=None):
        """Initialize quality evaluator.

        Args:
            config: Optional IterTrainingConfig. If None, loads from default location.
        """
        self.config = config or get_config()
        self._prediction_cache: Dict[str, Any] = {}
        logger.info("Quality evaluator initialized")

    def run_evaluation_cycle(
        self,
        cycle_id: Optional[str] = None,
        sample_size: Optional[int] = None,
        strategy: Optional[SamplingStrategy] = None,
    ) -> QualityMetrics:
        """Run a complete quality evaluation cycle.

        Args:
            cycle_id: Unique identifier for this cycle. If None, generates timestamp.
            sample_size: Number of items to sample. If None, uses config default.
            strategy: Sampling strategy. If None, uses config default.

        Returns:
            QualityMetrics object with evaluation results.
        """
        start_time = time.time()

        if cycle_id is None:
            cycle_id = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

        if sample_size is None:
            sample_size = self.config.sampling.sample_size

        if strategy is None:
            strategy = SamplingStrategy(self.config.sampling.strategy)

        logger.info(f"Starting evaluation cycle: {cycle_id}, n={sample_size}, strategy={strategy}")

        # Step 1: Sample items
        sampling_result = self.sample(sample_size, strategy)
        logger.info(f"Sampled {sampling_result.actual_size} items")

        # Step 2: Predict
        predictions = self.predict(sampling_result.items)
        logger.info(f"Generated predictions for {len(predictions)} items")

        # Step 3: Evaluate against actual data
        evaluation_results = self.evaluate(predictions)
        logger.info(f"Evaluated {len(evaluation_results)} items")

        # Step 4: Calculate metrics
        metrics = self.calculate_metrics(
            cycle_id=cycle_id,
            sampling_result=sampling_result,
            evaluation_results=evaluation_results,
        )
        metrics.duration_seconds = time.time() - start_time
        logger.info(f"Cycle {cycle_id} complete: MAE={metrics.mae:.2f}, ProcessMatch={metrics.process_match:.2%}")

        # Step 5: Log results
        self.log_results(metrics)

        return metrics

    def sample(
        self,
        n: int,
        strategy: SamplingStrategy = SamplingStrategy.RANDOM,
    ) -> SamplingResult:
        """Sample items for quality evaluation.

        Args:
            n: Number of items to sample
            strategy: Sampling strategy to use

        Returns:
            SamplingResult with sampled item codes
        """
        seed = self.config.sampling.seed
        kwargs = {}

        if strategy == SamplingStrategy.STRATIFIED:
            kwargs["strata_column"] = self.config.sampling.strata_column
        elif strategy == SamplingStrategy.RECENT_BIAS:
            kwargs["days_window"] = self.config.sampling.recent_days_window

        return sample_items(n, strategy, seed, **kwargs)

    def predict(self, item_codes: List[str]) -> Dict[str, Any]:
        """Generate predictions for sampled items.

        Args:
            item_codes: List of item codes to predict

        Returns:
            Dictionary mapping item_code to prediction results
        """
        # Check cache first
        cached_items = []
        uncached_items = []

        if self.config.cache.enabled:
            for item_cd in item_codes:
                if item_cd in self._prediction_cache:
                    cached_items.append(item_cd)
                else:
                    uncached_items.append(item_cd)
            logger.debug(f"Cache: {len(cached_items)} hits, {len(uncached_items)} misses")
        else:
            uncached_items = item_codes

        predictions = {}

        # Add cached predictions
        for item_cd in cached_items:
            predictions[item_cd] = self._prediction_cache[item_cd]

        # Generate new predictions
        if uncached_items:
            try:
                routing_df, candidates_df = predict_items_with_ml_optimized(uncached_items)

                # Parse predictions into structured format
                for item_cd in uncached_items:
                    item_routing = routing_df[routing_df["ITEM_CD"] == item_cd] if not routing_df.empty else pd.DataFrame()
                    item_candidates = candidates_df[candidates_df["ITEM_CD"] == item_cd] if not candidates_df.empty else pd.DataFrame()

                    prediction = {
                        "routing": item_routing.to_dict("records") if not item_routing.empty else [],
                        "candidates": item_candidates.to_dict("records") if not item_candidates.empty else [],
                    }

                    predictions[item_cd] = prediction

                    # Cache if enabled
                    if self.config.cache.enabled:
                        self._prediction_cache[item_cd] = prediction

            except Exception as e:
                logger.error(f"Prediction failed for batch: {e}", exc_info=True)
                # Return empty predictions for failed items
                for item_cd in uncached_items:
                    predictions[item_cd] = {"routing": [], "candidates": [], "error": str(e)}

        return predictions

    def evaluate(self, predictions: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Compare predictions with actual work order results.

        Args:
            predictions: Dictionary of predictions by item_code

        Returns:
            List of evaluation results with actual vs predicted comparisons
        """
        session_gen = get_session()
        session = next(session_gen)
        evaluation_results = []

        try:
            for item_cd, prediction in predictions.items():
                if "error" in prediction:
                    # Skip items with prediction errors
                    evaluation_results.append({
                        "item_cd": item_cd,
                        "status": "prediction_failed",
                        "error": prediction["error"],
                    })
                    continue

                # Query actual work order results
                query = text(f"""
                    SELECT
                        "ITEM_CD",
                        "PROC_SEQ",
                        "PROC_CD",
                        AVG("ACT_SETUP_TIME") as avg_setup,
                        AVG("ACT_RUN_TIME") as avg_run,
                        AVG("ACT_WAIT_TIME") as avg_wait,
                        COUNT(*) as sample_count,
                        STDDEV("ACT_RUN_TIME") as stddev_run
                    FROM {VIEW_WORK_RESULT}
                    WHERE "ITEM_CD" = :item_cd
                      AND "ACT_RUN_TIME" IS NOT NULL
                    GROUP BY "ITEM_CD", "PROC_SEQ", "PROC_CD"
                    ORDER BY "PROC_SEQ"
                """)

                result = session.execute(query, {"item_cd": item_cd})
                actual_processes = result.fetchall()

                if not actual_processes:
                    # No actual data for this item
                    evaluation_results.append({
                        "item_cd": item_cd,
                        "status": "no_actual_data",
                        "predicted_processes": len(prediction["routing"]),
                    })
                    continue

                # Compare predicted vs actual
                predicted_routing = prediction["routing"]
                process_comparison = []

                for actual in actual_processes:
                    proc_seq = actual[1]
                    proc_cd = actual[2]

                    # Find matching predicted process
                    predicted_proc = next(
                        (p for p in predicted_routing if p.get("PROC_SEQ") == proc_seq),
                        None
                    )

                    comparison = {
                        "proc_seq": proc_seq,
                        "proc_cd": proc_cd,
                        "actual_setup": actual[3],
                        "actual_run": actual[4],
                        "actual_wait": actual[5],
                        "sample_count": actual[6],
                        "stddev_run": actual[7],
                        "predicted_setup": predicted_proc.get("SETUP_TIME") if predicted_proc else None,
                        "predicted_run": predicted_proc.get("RUN_TIME") if predicted_proc else None,
                        "predicted_wait": predicted_proc.get("WAIT_TIME") if predicted_proc else None,
                        "matched": predicted_proc is not None,
                    }

                    # Calculate errors
                    if predicted_proc and actual[4] is not None:  # actual_run
                        predicted_run = predicted_proc.get("RUN_TIME") or 0
                        comparison["run_error"] = abs(predicted_run - actual[4])

                    process_comparison.append(comparison)

                evaluation_results.append({
                    "item_cd": item_cd,
                    "status": "success",
                    "process_comparison": process_comparison,
                    "actual_process_count": len(actual_processes),
                    "predicted_process_count": len(predicted_routing),
                })

        finally:
            session.close()

        return evaluation_results

    def calculate_metrics(
        self,
        cycle_id: str,
        sampling_result: SamplingResult,
        evaluation_results: List[Dict[str, Any]],
    ) -> QualityMetrics:
        """Calculate quality metrics from evaluation results.

        Args:
            cycle_id: Cycle identifier
            sampling_result: Sampling results
            evaluation_results: Evaluation comparison results

        Returns:
            QualityMetrics object
        """
        all_errors = []
        matched_processes = 0
        total_processes = 0
        sample_counts = []
        cvs = []
        alerts = []

        items_evaluated = 0
        items_failed = 0

        for result in evaluation_results:
            item_cd = result["item_cd"]
            status = result["status"]

            if status == "prediction_failed":
                items_failed += 1
                continue
            elif status == "no_actual_data":
                # Alert: insufficient actual data
                alerts.append(AlertItem(
                    item_cd=item_cd,
                    issue="NO_ACTUAL_DATA",
                    value=0,
                    threshold=self.config.thresholds.sample_count_min,
                    message=f"No work order data found for {item_cd}",
                ))
                continue

            items_evaluated += 1
            process_comparison = result.get("process_comparison", [])

            for comp in process_comparison:
                total_processes += 1
                if comp["matched"]:
                    matched_processes += 1

                # Collect errors
                if comp.get("run_error") is not None:
                    all_errors.append(comp["run_error"])

                # Collect sample counts
                if comp["sample_count"] is not None:
                    sample_counts.append(comp["sample_count"])

                    # Alert on low sample count
                    if comp["sample_count"] < self.config.thresholds.sample_count_min:
                        alerts.append(AlertItem(
                            item_cd=item_cd,
                            proc_cd=comp["proc_cd"],
                            issue="LOW_SAMPLES",
                            value=comp["sample_count"],
                            threshold=self.config.thresholds.sample_count_min,
                            message=f"Low sample count for {item_cd}/{comp['proc_cd']}: {comp['sample_count']}",
                        ))

                # Collect CV
                if comp["stddev_run"] is not None and comp["actual_run"] is not None and comp["actual_run"] > 0:
                    cv = comp["stddev_run"] / comp["actual_run"]
                    cvs.append(cv)

                    # Alert on high CV
                    if cv > self.config.thresholds.cv_max:
                        alerts.append(AlertItem(
                            item_cd=item_cd,
                            proc_cd=comp["proc_cd"],
                            issue="HIGH_CV",
                            value=cv,
                            threshold=self.config.thresholds.cv_max,
                            message=f"High variability for {item_cd}/{comp['proc_cd']}: CV={cv:.2f}",
                        ))

        # Calculate aggregate metrics
        mae = np.mean(all_errors) if all_errors else 0.0
        trim_mae = self._calculate_trim_mae(all_errors)
        rmse = np.sqrt(np.mean([e**2 for e in all_errors])) if all_errors else 0.0
        process_match = matched_processes / total_processes if total_processes > 0 else 0.0
        avg_sample_count = np.mean(sample_counts) if sample_counts else 0.0
        avg_cv = np.mean(cvs) if cvs else 0.0

        # Outsourcing success (placeholder - requires additional data)
        outsourcing_success = 0.0

        # Create metrics object
        metrics = QualityMetrics(
            cycle_id=cycle_id,
            sample_size=sampling_result.sample_size,
            strategy=sampling_result.strategy,
            mae=mae,
            trim_mae=trim_mae,
            rmse=rmse,
            process_match=process_match,
            outsourcing_success=outsourcing_success,
            cv=avg_cv,
            sample_count=avg_sample_count,
            alerts=alerts,
            items_evaluated=items_evaluated,
            items_failed=items_failed,
            metadata={
                "total_processes": total_processes,
                "matched_processes": matched_processes,
                "error_count": len(all_errors),
            }
        )

        # Check thresholds and add alerts
        if mae > self.config.thresholds.mae_max:
            metrics.alerts.append(AlertItem(
                item_cd="AGGREGATE",
                issue="HIGH_MAE",
                value=mae,
                threshold=self.config.thresholds.mae_max,
                message=f"MAE {mae:.2f} exceeds threshold {self.config.thresholds.mae_max}",
            ))

        if process_match < self.config.thresholds.process_match_min:
            metrics.alerts.append(AlertItem(
                item_cd="AGGREGATE",
                issue="LOW_PROCESS_MATCH",
                value=process_match,
                threshold=self.config.thresholds.process_match_min,
                message=f"Process match {process_match:.2%} below threshold {self.config.thresholds.process_match_min:.2%}",
            ))

        return metrics

    def _calculate_trim_mae(self, errors: List[float]) -> float:
        """Calculate trimmed MAE after removing outliers.

        Args:
            errors: List of absolute errors

        Returns:
            Trimmed mean of errors
        """
        if not errors:
            return 0.0

        trim_ratio = self.config.thresholds.trim_ratio
        errors_sorted = sorted(errors)
        n = len(errors_sorted)
        trim_count = int(n * trim_ratio)

        if trim_count * 2 >= n:
            # Not enough data to trim
            return np.mean(errors)

        trimmed = errors_sorted[trim_count : n - trim_count]
        return np.mean(trimmed) if trimmed else 0.0

    def log_results(self, metrics: QualityMetrics) -> None:
        """Log evaluation results to console and files.

        Args:
            metrics: Quality metrics to log
        """
        # Console logging
        logger.info(f"=== Quality Evaluation Cycle {metrics.cycle_id} ===")
        logger.info(f"Sample: {metrics.items_evaluated}/{metrics.sample_size} items ({metrics.strategy.value})")
        logger.info(f"MAE: {metrics.mae:.2f} min (Trim: {metrics.trim_mae:.2f} min)")
        logger.info(f"RMSE: {metrics.rmse:.2f} min")
        logger.info(f"Process Match: {metrics.process_match:.1%}")
        logger.info(f"Avg CV: {metrics.cv:.2f}")
        logger.info(f"Avg Samples: {metrics.sample_count:.1f}")
        logger.info(f"Alerts: {len(metrics.alerts)}")

        if metrics.alerts:
            logger.warning(f"Quality alerts triggered:")
            for alert in metrics.alerts[:5]:  # Show first 5
                logger.warning(f"  - {alert.issue}: {alert.message}")

        # TODO: Write to log files (stream log, cycle log)
        # TODO: Generate reports (JSON, CSV, Markdown)

    def clear_cache(self) -> None:
        """Clear prediction cache."""
        self._prediction_cache.clear()
        logger.info("Prediction cache cleared")
