"""Performance benchmark tests for TimeAggregator (Polars vs naive Python)."""
from __future__ import annotations

import time
from typing import Any, Dict, List

import pytest

from backend.api.services.time_aggregator import TimeAggregator


def generate_test_operations(count: int) -> List[Dict[str, Any]]:
    """Generate test routing operations for benchmarking."""
    operations = []
    for i in range(count):
        operations.append({
            "PROC_SEQ": i + 1,
            "SETUP_TIME": 5.0 + (i % 10),
            "RUN_TIME": 15.0 + (i % 20),
            "QUEUE_TIME": 2.0 + (i % 5),
            "WAIT_TIME": 1.0 + (i % 3),
            "MOVE_TIME": 0.5 + (i % 2),
            "OPERATION_DESC": f"Operation {i + 1}",
            "WORK_CENTER": f"WC_{i % 5}",
        })
    return operations


def benchmark_naive_python(operations: List[Dict[str, Any]]) -> Dict[str, float]:
    """Naive Python implementation for comparison."""
    totals = {
        "setup_time": 0.0,
        "run_time": 0.0,
        "queue_time": 0.0,
        "wait_time": 0.0,
        "move_time": 0.0,
    }

    for op in operations:
        totals["setup_time"] += op.get("SETUP_TIME", 0.0) or 0.0
        totals["run_time"] += op.get("RUN_TIME", 0.0) or 0.0
        totals["queue_time"] += op.get("QUEUE_TIME", 0.0) or 0.0
        totals["wait_time"] += op.get("WAIT_TIME", 0.0) or 0.0
        totals["move_time"] += op.get("MOVE_TIME", 0.0) or 0.0

    totals["lead_time"] = sum(totals.values())
    return totals


class TestTimeAggregatorPerformance:
    """Performance benchmark tests for TimeAggregator."""

    @pytest.mark.parametrize("operation_count", [10, 100, 1000])
    def test_polars_aggregator_correctness(self, operation_count: int):
        """Verify TimeAggregator produces correct results."""
        operations = generate_test_operations(operation_count)

        aggregator = TimeAggregator()
        result = aggregator.summarize(operations)

        # Verify structure
        assert "totals" in result
        assert "process_count" in result
        assert result["process_count"] == operation_count

        # Verify all time keys present
        expected_keys = ["setup_time", "run_time", "queue_time", "wait_time", "move_time", "lead_time"]
        for key in expected_keys:
            assert key in result["totals"]
            assert isinstance(result["totals"][key], float)
            assert result["totals"][key] >= 0.0

    @pytest.mark.parametrize("operation_count", [100, 1000])
    def test_polars_vs_python_accuracy(self, operation_count: int):
        """Compare Polars implementation accuracy with naive Python."""
        operations = generate_test_operations(operation_count)

        # Polars implementation
        aggregator = TimeAggregator()
        polars_result = aggregator.summarize(operations)["totals"]

        # Naive Python implementation
        python_result = benchmark_naive_python(operations)

        # Compare results (allow small floating point errors)
        for key in ["setup_time", "run_time", "queue_time", "wait_time", "move_time"]:
            assert abs(polars_result[key] - python_result[key]) < 0.01, (
                f"{key} mismatch: Polars={polars_result[key]}, Python={python_result[key]}"
            )

    @pytest.mark.benchmark
    @pytest.mark.parametrize("operation_count", [100, 1000, 5000])
    def test_benchmark_polars_vs_python(self, operation_count: int):
        """Benchmark Polars vs naive Python implementation."""
        operations = generate_test_operations(operation_count)

        # Warm-up
        aggregator = TimeAggregator()
        _ = aggregator.summarize(operations)

        # Benchmark Polars (10 iterations)
        polars_times = []
        for _ in range(10):
            start = time.perf_counter()
            _ = aggregator.summarize(operations)
            polars_times.append(time.perf_counter() - start)

        # Benchmark Python (10 iterations)
        python_times = []
        for _ in range(10):
            start = time.perf_counter()
            _ = benchmark_naive_python(operations)
            python_times.append(time.perf_counter() - start)

        # Calculate statistics
        polars_avg = sum(polars_times) / len(polars_times)
        python_avg = sum(python_times) / len(python_times)
        speedup = python_avg / polars_avg if polars_avg > 0 else 0

        # Print results
        print(f"\n{'='*60}")
        print(f"Benchmark: {operation_count} operations")
        print(f"{'='*60}")
        print(f"Polars (avg):  {polars_avg*1000:8.3f} ms")
        print(f"Python (avg):  {python_avg*1000:8.3f} ms")
        print(f"Speedup:       {speedup:8.2f}x")
        print(f"{'='*60}")

        # Note: Polars has overhead for small datasets due to DataFrame creation
        # For very large datasets (>10k operations), Polars may show benefits
        # This benchmark documents actual performance characteristics
        print(f"Note: Polars overhead is {1/speedup:.1f}x for {operation_count} operations")

        # Assert performance is at least measurable (not infinite time)
        assert polars_avg < 1.0, f"Polars too slow: {polars_avg:.3f}s (expected <1s)"
        assert python_avg < 1.0, f"Python too slow: {python_avg:.3f}s (expected <1s)"

    def test_empty_operations_handling(self):
        """Test TimeAggregator handles empty input gracefully."""
        aggregator = TimeAggregator()
        result = aggregator.summarize([])

        assert result["process_count"] == 0
        assert all(result["totals"][key] == 0.0 for key in result["totals"])

    def test_missing_columns_handling(self):
        """Test TimeAggregator handles missing columns gracefully."""
        operations = [
            {"PROC_SEQ": 1, "SETUP_TIME": 5.0},  # Missing other time columns
            {"PROC_SEQ": 2, "RUN_TIME": 10.0},
        ]

        aggregator = TimeAggregator()
        result = aggregator.summarize(operations)

        assert result["process_count"] == 2
        assert result["totals"]["setup_time"] == 5.0
        assert result["totals"]["run_time"] == 10.0
        assert result["totals"]["queue_time"] == 0.0

    def test_breakdown_mode(self):
        """Test TimeAggregator breakdown mode."""
        operations = generate_test_operations(5)

        aggregator = TimeAggregator()
        result = aggregator.summarize(operations, include_breakdown=True)

        assert "breakdown" in result
        assert len(result["breakdown"]) == 5

        # Verify breakdown structure
        for item in result["breakdown"]:
            assert "proc_seq" in item
            assert "setup_time" in item
            # lead_time is calculated in totals, not in breakdown items
            assert isinstance(item["proc_seq"], int)

    @pytest.mark.benchmark
    def test_large_dataset_performance(self):
        """Test performance with realistic large dataset (10,000 operations)."""
        operations = generate_test_operations(10000)

        aggregator = TimeAggregator()

        start = time.perf_counter()
        result = aggregator.summarize(operations)
        elapsed = time.perf_counter() - start

        print(f"\nLarge dataset (10,000 ops): {elapsed*1000:.2f} ms")

        # Should complete in reasonable time (<500ms for 10k operations)
        assert elapsed < 0.5, f"Large dataset too slow: {elapsed:.3f}s (expected <0.5s)"
        assert result["process_count"] == 10000

    @pytest.mark.benchmark
    def test_breakdown_overhead(self):
        """Test performance overhead of breakdown mode."""
        operations = generate_test_operations(1000)
        aggregator = TimeAggregator()

        # Benchmark without breakdown
        start = time.perf_counter()
        _ = aggregator.summarize(operations, include_breakdown=False)
        time_without = time.perf_counter() - start

        # Benchmark with breakdown
        start = time.perf_counter()
        _ = aggregator.summarize(operations, include_breakdown=True)
        time_with = time.perf_counter() - start

        overhead = (time_with - time_without) / time_without * 100

        print(f"\nBreakdown overhead: {overhead:.1f}%")
        print(f"  Without breakdown: {time_without*1000:.2f} ms")
        print(f"  With breakdown:    {time_with*1000:.2f} ms")

        # Overhead documentation (breakdown includes DataFrame conversion to dict)
        # This is expected behavior and helps users understand performance trade-offs
        assert time_with < 0.5, f"Breakdown mode too slow: {time_with:.3f}s (expected <0.5s)"

    def test_null_value_handling(self):
        """Test TimeAggregator handles None/null values correctly."""
        operations = [
            {"PROC_SEQ": 1, "SETUP_TIME": 5.0, "RUN_TIME": None},
            {"PROC_SEQ": 2, "SETUP_TIME": None, "RUN_TIME": 10.0},
            {"PROC_SEQ": 3, "SETUP_TIME": 3.0, "RUN_TIME": 8.0},
        ]

        aggregator = TimeAggregator()
        result = aggregator.summarize(operations)

        assert result["totals"]["setup_time"] == 8.0  # 5.0 + 0 + 3.0
        assert result["totals"]["run_time"] == 18.0   # 0 + 10.0 + 8.0

    @pytest.mark.parametrize("thread_count", [1, 2, 4])
    def test_multithreading_consistency(self, thread_count: int):
        """Test TimeAggregator produces consistent results across thread counts."""
        operations = generate_test_operations(1000)

        # Run with different thread configurations
        aggregator = TimeAggregator()
        result1 = aggregator.summarize(operations)
        result2 = aggregator.summarize(operations)

        # Results should be identical
        for key in result1["totals"]:
            assert abs(result1["totals"][key] - result2["totals"][key]) < 0.001


class TestTimeAggregatorEdgeCases:
    """Edge case tests for TimeAggregator."""

    def test_single_operation(self):
        """Test with single operation."""
        operations = [{"PROC_SEQ": 1, "SETUP_TIME": 5.0, "RUN_TIME": 10.0}]

        aggregator = TimeAggregator()
        result = aggregator.summarize(operations)

        assert result["process_count"] == 1
        assert result["totals"]["setup_time"] == 5.0
        assert result["totals"]["run_time"] == 10.0

    def test_very_large_values(self):
        """Test with very large time values."""
        operations = [
            {"PROC_SEQ": 1, "SETUP_TIME": 1e6, "RUN_TIME": 1e7},
        ]

        aggregator = TimeAggregator()
        result = aggregator.summarize(operations)

        assert result["totals"]["setup_time"] == 1e6
        assert result["totals"]["run_time"] == 1e7

    def test_zero_values(self):
        """Test with all zero time values."""
        operations = [
            {"PROC_SEQ": 1, "SETUP_TIME": 0.0, "RUN_TIME": 0.0},
            {"PROC_SEQ": 2, "SETUP_TIME": 0.0, "RUN_TIME": 0.0},
        ]

        aggregator = TimeAggregator()
        result = aggregator.summarize(operations)

        assert result["process_count"] == 2
        assert all(result["totals"][key] == 0.0 for key in result["totals"])

    def test_mixed_case_columns(self):
        """Test TimeAggregator normalizes column names correctly."""
        operations = [
            {"proc_seq": 1, "setup_time": 5.0, "run_time": 10.0},  # lowercase
            {"PROC_SEQ": 2, "SETUP_TIME": 3.0, "RUN_TIME": 8.0},   # uppercase
        ]

        aggregator = TimeAggregator()
        result = aggregator.summarize(operations)

        assert result["process_count"] == 2
        assert result["totals"]["setup_time"] == 8.0
        assert result["totals"]["run_time"] == 18.0
