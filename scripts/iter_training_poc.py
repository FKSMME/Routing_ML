#!/usr/bin/env python
"""
Proof-of-Concept Script for Iterative Training Quality Evaluation.

This script demonstrates the complete quality evaluation cycle:
1. Sample 100 items
2. Generate predictions
3. Compare with actual work orders
4. Calculate quality metrics

Usage:
    python scripts/iter_training_poc.py [--sample-size N] [--strategy random|stratified|recent_bias]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.quality_evaluator import QualityEvaluator
from backend.iter_training.models import SamplingStrategy
from backend.iter_training.config_loader import load_config


def print_banner(text: str) -> None:
    """Print a formatted banner."""
    print("\n" + "=" * 80)
    print(f"  {text}")
    print("=" * 80 + "\n")


def print_metrics_summary(metrics) -> None:
    """Print quality metrics in a formatted table."""
    print(f"Cycle ID:           {metrics.cycle_id}")
    print(f"Strategy:           {metrics.strategy.value}")
    print(f"Sample Size:        {metrics.sample_size}")
    print(f"Items Evaluated:    {metrics.items_evaluated}")
    print(f"Items Failed:       {metrics.items_failed}")
    print(f"Duration:           {metrics.duration_seconds:.1f} seconds")
    print()
    print(f"{'Metric':<25} {'Value':>15} {'Unit':>10}")
    print("-" * 52)
    print(f"{'MAE (Mean Absolute Error)':<25} {metrics.mae:>15.2f} {'minutes':>10}")
    print(f"{'Trim-MAE (10% trim)':<25} {metrics.trim_mae:>15.2f} {'minutes':>10}")
    print(f"{'RMSE':<25} {metrics.rmse:>15.2f} {'minutes':>10}")
    print(f"{'Process Match Rate':<25} {metrics.process_match:>14.1%} {'':>10}")
    print(f"{'Avg Sample Count':<25} {metrics.sample_count:>15.1f} {'samples':>10}")
    print(f"{'Avg CV (variability)':<25} {metrics.cv:>15.2f} {'':>10}")
    print()

    if metrics.alerts:
        print(f"\nAlerts Triggered: {len(metrics.alerts)}")
        print(f"{'Item':<20} {'Issue':<20} {'Value':>12} {'Threshold':>12}")
        print("-" * 66)
        for alert in metrics.alerts[:10]:  # Show first 10
            item_display = alert.item_cd if len(alert.item_cd) <= 18 else alert.item_cd[:15] + "..."
            print(f"{item_display:<20} {alert.issue:<20} {alert.value:>12.2f} {alert.threshold:>12.2f}")
        if len(metrics.alerts) > 10:
            print(f"... and {len(metrics.alerts) - 10} more alerts")
    else:
        print("\nNo alerts triggered - quality within acceptable range ✓")


def main():
    """Run the proof-of-concept quality evaluation."""
    parser = argparse.ArgumentParser(
        description="PoC: Iterative Training Quality Evaluation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=100,
        help="Number of items to sample (default: 100)",
    )
    parser.add_argument(
        "--strategy",
        type=str,
        choices=["random", "stratified", "recent_bias"],
        default="random",
        help="Sampling strategy (default: random)",
    )
    parser.add_argument(
        "--config",
        type=str,
        help="Path to config file (default: config/iter_training.yaml)",
    )

    args = parser.parse_args()

    print_banner("Iterative Training Quality Evaluation - Proof of Concept")

    # Load config
    print("Loading configuration...")
    if args.config:
        config = load_config(args.config)
    else:
        config = load_config()
    print(f"  ✓ Config loaded from: {config.sampling}")

    # Initialize evaluator
    print("\nInitializing quality evaluator...")
    evaluator = QualityEvaluator(config)
    print("  ✓ Evaluator initialized")

    # Run evaluation
    print(f"\nRunning quality evaluation:")
    print(f"  Sample size: {args.sample_size}")
    print(f"  Strategy:    {args.strategy}")
    print()

    try:
        strategy = SamplingStrategy(args.strategy)
        metrics = evaluator.run_evaluation_cycle(
            sample_size=args.sample_size,
            strategy=strategy,
        )

        # Display results
        print_banner("Quality Evaluation Results")
        print_metrics_summary(metrics)

        # Validation against production baseline
        print_banner("PoC Validation")

        # Expected MAE range (based on production baseline: ~4.8 minutes)
        production_baseline_mae = 4.8
        tolerance = 0.1  # 10% tolerance

        mae_lower = production_baseline_mae * (1 - tolerance)
        mae_upper = production_baseline_mae * (1 + tolerance)

        print(f"Production Baseline MAE:  {production_baseline_mae:.2f} minutes")
        print(f"Acceptable Range:         {mae_lower:.2f} - {mae_upper:.2f} minutes (±10%)")
        print(f"Measured MAE:             {metrics.mae:.2f} minutes")
        print()

        if mae_lower <= metrics.mae <= mae_upper:
            print("✓ VALIDATION PASSED: MAE within 10% of production baseline")
            validation_status = 0
        elif metrics.mae < mae_lower:
            print("⚠ VALIDATION WARNING: MAE better than baseline (unexpected improvement)")
            print("  This could indicate:")
            print("  - Sample bias (not representative)")
            print("  - Measurement error")
            print("  - Actual model improvement")
            validation_status = 1
        else:
            print("✗ VALIDATION FAILED: MAE deviates more than 10% from baseline")
            print("  Possible causes:")
            print("  - Prediction errors")
            print("  - Data quality issues")
            print("  - Implementation bugs")
            validation_status = 2

        print()
        print(f"Items evaluated: {metrics.items_evaluated}/{metrics.sample_size}")
        if metrics.items_failed > 0:
            print(f"⚠ Warning: {metrics.items_failed} items failed prediction/evaluation")

        # Save results
        print_banner("Saving Results")
        results_file = project_root / "deliverables" / f"poc_results_{metrics.cycle_id}.json"
        results_file.parent.mkdir(parents=True, exist_ok=True)

        import json
        with open(results_file, "w", encoding="utf-8") as f:
            json.dump(metrics.to_dict(), f, indent=2, ensure_ascii=False)

        print(f"Results saved to: {results_file}")
        print()

        # Summary
        print_banner("PoC Summary")
        print("✓ Quality evaluation cycle completed successfully")
        print(f"✓ Metrics calculated for {metrics.items_evaluated} items")
        print(f"✓ MAE: {metrics.mae:.2f} min, Process Match: {metrics.process_match:.1%}")
        print(f"✓ Validation: {'PASSED' if validation_status == 0 else 'WARNING' if validation_status == 1 else 'FAILED'}")
        print()

        return validation_status

    except Exception as e:
        print(f"\n✗ ERROR: Quality evaluation failed")
        print(f"  {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return 3


if __name__ == "__main__":
    sys.exit(main())
