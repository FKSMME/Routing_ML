#!/usr/bin/env python
"""
Model Memory Profiling Script
==============================
Addresses Scenario #6: Model caching/memory consumption in multi-worker deployment

This script profiles memory usage of:
1. ManifestLoader (backend/api/services/prediction_service.py:52)
2. HNSW index loading
3. Vectorizer models

Goal: Ensure each Uvicorn worker stays under 1.5GB memory footprint

Usage:
    # Profile default model
    python scripts/profile_model_memory.py

    # Profile specific model directory
    python scripts/profile_model_memory.py --model-dir models/v1.0.0

    # Simulate multi-worker scenario
    python scripts/profile_model_memory.py --workers 4

    # Generate detailed memory report
    python scripts/profile_model_memory.py --detailed --output reports/memory_profile.json
"""

import argparse
import gc
import json
import os
import sys
import time
import tracemalloc
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional

# Add project root to path
REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

# Set minimal environment for testing
os.environ.setdefault("JWT_SECRET_KEY", "profile-secret-key-min-32-chars-long-do-not-use-prod")
os.environ.setdefault("LOG_LEVEL", "WARNING")
os.environ.setdefault("DB_TYPE", "SQLITE")
os.environ.setdefault("RSL_DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("ROUTING_GROUPS_DATABASE_URL", "sqlite:///:memory:")


@dataclass
class MemorySnapshot:
    """Memory usage snapshot at a specific point."""
    label: str
    current_mb: float
    peak_mb: float
    delta_mb: float
    timestamp: float

    def to_dict(self) -> Dict:
        return asdict(self)


class ModelMemoryProfiler:
    """Profiles memory usage of model loading and caching."""

    def __init__(self, model_dir: Optional[Path] = None):
        self.model_dir = model_dir
        self.snapshots: List[MemorySnapshot] = []
        self.baseline_mb = 0.0
        self.start_time = time.time()

    def _get_memory_mb(self) -> tuple[float, float]:
        """Get current and peak memory usage in MB."""
        current, peak = tracemalloc.get_traced_memory()
        return current / 1024 / 1024, peak / 1024 / 1024

    def snapshot(self, label: str) -> MemorySnapshot:
        """Take a memory snapshot with label."""
        current_mb, peak_mb = self._get_memory_mb()
        delta_mb = current_mb - self.baseline_mb

        snap = MemorySnapshot(
            label=label,
            current_mb=round(current_mb, 2),
            peak_mb=round(peak_mb, 2),
            delta_mb=round(delta_mb, 2),
            timestamp=time.time() - self.start_time
        )
        self.snapshots.append(snap)

        print(f"📊 {label:40s} | Current: {current_mb:8.2f} MB | Peak: {peak_mb:8.2f} MB | Delta: {delta_mb:+8.2f} MB")
        return snap

    def profile_manifest_loader(self) -> Dict:
        """Profile ManifestLoader memory usage."""
        from backend.api.services.prediction_service import ManifestLoader

        print("\n" + "="*100)
        print("🔍 PROFILING: ManifestLoader")
        print("="*100)

        # Baseline before import
        gc.collect()
        self.snapshot("Baseline (after gc.collect)")

        # Create loader instance
        loader = ManifestLoader()
        self.snapshot("ManifestLoader instantiated")

        # Load manifest (triggers file I/O and JSON parsing)
        try:
            if self.model_dir:
                manifest = loader.load(self.model_dir)
            else:
                # Load from default model registry
                from backend.api.config import get_settings
                settings = get_settings()
                model_dir = settings.model_directory
                manifest = loader.load(model_dir)

            self.snapshot("Manifest loaded from disk")

            # Load again to test caching
            manifest_cached = loader.load(self.model_dir or model_dir)
            self.snapshot("Manifest loaded from cache")

            return {
                "status": "success",
                "manifest_version": getattr(manifest, "version", "unknown"),
                "model_path": str(manifest.model_path) if hasattr(manifest, "model_path") else "N/A"
            }

        except Exception as e:
            print(f"❌ Error loading manifest: {e}")
            return {"status": "error", "error": str(e)}

    def profile_model_loading(self) -> Dict:
        """Profile full model loading (vectorizer + HNSW index)."""
        from backend.api.services.prediction_service import PredictionService
        from backend.api.config import get_settings

        print("\n" + "="*100)
        print("🔍 PROFILING: Full Model Loading (Vectorizer + HNSW)")
        print("="*100)

        gc.collect()
        self.snapshot("Baseline before PredictionService")

        try:
            # Initialize prediction service
            service = PredictionService()
            self.snapshot("PredictionService instantiated")

            # Load model (triggers vectorizer + HNSW loading)
            settings = get_settings()
            model_dir = self.model_dir or settings.model_directory

            # Force model loading by making a prediction
            test_candidates = [
                {"item_code": "TEST001", "item_name": "테스트 아이템 1", "master_group_code": "A01"},
                {"item_code": "TEST002", "item_name": "테스트 아이템 2", "master_group_code": "B02"},
            ]

            self.snapshot("Before model prediction")

            # This will trigger model loading if not already cached
            try:
                result = service.predict_batch(
                    candidates=test_candidates,
                    top_k=5,
                    similarity_threshold=0.7
                )
                self.snapshot("After model prediction (model fully loaded)")

                return {
                    "status": "success",
                    "predictions_count": len(result) if isinstance(result, list) else 0,
                    "model_loaded": True
                }
            except Exception as pred_err:
                print(f"⚠️  Prediction failed (expected if no model): {pred_err}")
                self.snapshot("After prediction attempt (failed)")
                return {
                    "status": "model_not_found",
                    "error": str(pred_err)
                }

        except Exception as e:
            print(f"❌ Error in model loading: {e}")
            traceback.print_exc()
            return {"status": "error", "error": str(e)}

    def profile_multiworker_simulation(self, num_workers: int = 4) -> Dict:
        """Simulate memory usage with multiple workers."""
        print("\n" + "="*100)
        print(f"🔍 SIMULATING: {num_workers} Uvicorn Workers")
        print("="*100)

        current_mb, _ = self._get_memory_mb()
        estimated_total_mb = current_mb * num_workers

        print(f"\n📈 Memory Estimation:")
        print(f"   Single worker peak: {current_mb:.2f} MB")
        print(f"   Estimated {num_workers} workers: {estimated_total_mb:.2f} MB")
        print(f"   Per-worker target: <1500 MB")

        if current_mb > 1500:
            print(f"   ⚠️  WARNING: Single worker exceeds 1.5GB target!")
            status = "WARNING"
        elif estimated_total_mb > 6000:  # 4 workers * 1500MB
            print(f"   ⚠️  WARNING: Total memory may exceed reasonable limits for {num_workers} workers")
            status = "WARNING"
        else:
            print(f"   ✅ Memory usage within acceptable range")
            status = "OK"

        return {
            "status": status,
            "num_workers": num_workers,
            "single_worker_peak_mb": round(current_mb, 2),
            "estimated_total_mb": round(estimated_total_mb, 2),
            "target_per_worker_mb": 1500
        }

    def generate_report(self) -> Dict:
        """Generate comprehensive memory profiling report."""
        current_mb, peak_mb = self._get_memory_mb()

        return {
            "summary": {
                "baseline_mb": round(self.baseline_mb, 2),
                "final_current_mb": round(current_mb, 2),
                "final_peak_mb": round(peak_mb, 2),
                "total_increase_mb": round(current_mb - self.baseline_mb, 2),
                "duration_seconds": round(time.time() - self.start_time, 2)
            },
            "snapshots": [s.to_dict() for s in self.snapshots],
            "recommendations": self._generate_recommendations(current_mb)
        }

    def _generate_recommendations(self, peak_mb: float) -> List[str]:
        """Generate recommendations based on profiling results."""
        recommendations = []

        if peak_mb > 1500:
            recommendations.append(
                "❌ CRITICAL: Single worker exceeds 1.5GB target. "
                "Consider model optimization or reducing workers."
            )
        elif peak_mb > 1200:
            recommendations.append(
                "⚠️  WARNING: Approaching 1.5GB limit. Monitor production closely."
            )
        else:
            recommendations.append(
                "✅ Memory usage is within acceptable limits for multi-worker deployment."
            )

        if peak_mb > 500:
            recommendations.append(
                "💡 Consider implementing shared memory for model loading across workers "
                "(e.g., using multiprocessing.shared_memory or Redis caching)."
            )

        recommendations.append(
            "💡 Use uvicorn with --workers flag cautiously. Test with 1-2 workers first."
        )

        recommendations.append(
            "💡 Monitor production memory with Prometheus metric: process_resident_memory_bytes"
        )

        return recommendations


def main():
    parser = argparse.ArgumentParser(description="Profile model memory usage")
    parser.add_argument(
        "--model-dir",
        type=Path,
        help="Path to model directory (default: from MODEL_REGISTRY)"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="Number of workers to simulate (default: 4)"
    )
    parser.add_argument(
        "--detailed",
        action="store_true",
        help="Generate detailed snapshot analysis"
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output JSON report to file"
    )

    args = parser.parse_args()

    # Start memory tracing
    tracemalloc.start()

    print("\n" + "="*100)
    print("🚀 ROUTING ML - MODEL MEMORY PROFILING")
    print("="*100)
    print(f"Model Directory: {args.model_dir or 'Default (from registry)'}")
    print(f"Workers Simulation: {args.workers}")
    print("="*100)

    profiler = ModelMemoryProfiler(model_dir=args.model_dir)

    # Set baseline
    gc.collect()
    profiler.baseline_mb, _ = profiler._get_memory_mb()

    # Profile components
    results = {}
    results["manifest_loader"] = profiler.profile_manifest_loader()
    results["model_loading"] = profiler.profile_model_loading()
    results["multiworker"] = profiler.profile_multiworker_simulation(args.workers)

    # Generate final report
    report = profiler.generate_report()
    results["report"] = report

    # Print summary
    print("\n" + "="*100)
    print("📋 MEMORY PROFILING SUMMARY")
    print("="*100)
    print(f"Baseline:        {report['summary']['baseline_mb']:8.2f} MB")
    print(f"Final Current:   {report['summary']['final_current_mb']:8.2f} MB")
    print(f"Peak:            {report['summary']['final_peak_mb']:8.2f} MB")
    print(f"Total Increase:  {report['summary']['total_increase_mb']:+8.2f} MB")
    print(f"Duration:        {report['summary']['duration_seconds']:8.2f} seconds")
    print("\n📌 RECOMMENDATIONS:")
    for rec in report["recommendations"]:
        print(f"   {rec}")

    # Save report if requested
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with open(args.output, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\n💾 Report saved to: {args.output}")

    # Stop tracing
    tracemalloc.stop()

    # Return exit code based on status
    if results["multiworker"]["status"] == "WARNING":
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
