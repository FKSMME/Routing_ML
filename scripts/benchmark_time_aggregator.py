"""TimeAggregator 성능 비교 스크립트."""
from __future__ import annotations

import time
from dataclasses import dataclass
from math import isclose
from typing import Any, Dict, List

import numpy as np

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.append(str(REPO_ROOT))

from backend.api.services.time_aggregator import TimeAggregator


class LegacyTimeAggregator:
    """이전 Pandas 기반 TimeAggregator 구현."""

    def __init__(self) -> None:
        self._time_columns = {
            "setup_time": ["SETUP_TIME", "ACT_SETUP_TIME"],
            "run_time": ["MACH_WORKED_HOURS", "ACT_RUN_TIME", "RUN_TIME", "RUN_TIME_QTY"],
            "queue_time": ["QUEUE_TIME"],
            "wait_time": ["WAIT_TIME", "IDLE_TIME"],
            "move_time": ["MOVE_TIME"],
        }

    def summarize(
        self,
        operations: List[Dict[str, Any]],
        *,
        include_breakdown: bool = False,
    ) -> Dict[str, Any]:
        normalized = [self._normalize(row) for row in operations if row]
        totals = {key: 0.0 for key in self._time_columns.keys()}
        breakdown_records: List[Dict[str, Any]] = []

        for row in normalized:
            entry_values: Dict[str, float] = {}
            for key, columns in self._time_columns.items():
                value = self._value_from(row, columns)
                totals[key] += value
                entry_values[key] = value

            total_time = sum(entry_values.values())
            breakdown_records.append(
                {
                    "proc_seq": self._extract_proc_seq(row),
                    "setup_time": entry_values["setup_time"],
                    "run_time": entry_values["run_time"],
                    "queue_time": entry_values["queue_time"],
                    "wait_time": entry_values["wait_time"],
                    "move_time": entry_values["move_time"],
                    "total_time": total_time,
                }
            )

        totals["lead_time"] = sum(totals.values())

        return {
            "totals": totals,
            "process_count": len(normalized),
            "breakdown": breakdown_records if include_breakdown else [],
        }

    @staticmethod
    def _normalize(row: Dict[str, Any]) -> Dict[str, Any]:
        return {str(key).upper(): value for key, value in row.items()}

    @staticmethod
    def _to_float(value: Any) -> float:
        if value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        try:
            return float(str(value).strip())
        except (TypeError, ValueError):
            return 0.0

    def _value_from(self, row: Dict[str, Any], columns: List[str]) -> float:
        for column in columns:
            upper = column.upper()
            if upper in row and row[upper] not in (None, ""):
                return self._to_float(row[upper])
            lower = upper.lower()
            if lower in row and row[lower] not in (None, ""):
                return self._to_float(row[lower])
        return 0.0

    @staticmethod
    def _extract_proc_seq(row: Dict[str, Any]) -> int | None:
        for key in ("PROC_SEQ", "SEQ", "STEP", "ORDER"):
            if key in row and row[key] not in (None, ""):
                try:
                    return int(float(row[key]))
                except (TypeError, ValueError):
                    continue
        return None


def build_operations(size: int) -> List[Dict[str, Any]]:
    rng = np.random.default_rng(42)
    setup = rng.uniform(0.0, 2.0, size)
    run = rng.uniform(1.0, 6.0, size)
    queue = rng.uniform(0.0, 0.8, size)
    wait = rng.uniform(0.0, 1.2, size)
    move = rng.uniform(0.0, 0.5, size)

    operations: List[Dict[str, Any]] = []
    for idx in range(size):
        record: Dict[str, Any] = {
            "SETUP_TIME": round(setup[idx], 6),
            "RUN_TIME": round(run[idx], 6),
            "QUEUE_TIME": round(queue[idx], 6),
            "WAIT_TIME": round(wait[idx], 6),
            "MOVE_TIME": round(move[idx], 6),
            "PROC_SEQ": idx + 1,
        }

        if idx % 5 == 0:
            record.pop("SETUP_TIME")
            record["ACT_SETUP_TIME"] = round(setup[idx], 6)
        if idx % 7 == 0:
            record.pop("RUN_TIME")
            record["ACT_RUN_TIME"] = round(run[idx], 6)
        if idx % 11 == 0:
            record["QUEUE_TIME"] = " "
        if idx % 13 == 0:
            record["WAIT_TIME"] = "0.0"
        if idx % 17 == 0:
            record["MOVE_TIME"] = None

        operations.append(record)

    return operations


@dataclass
class BenchmarkResult:
    name: str
    duration: float


def run_benchmark(aggregator, operations: List[Dict[str, Any]], repeat: int = 2) -> BenchmarkResult:
    aggregator.summarize(operations, include_breakdown=True)  # warmup
    durations = []
    for _ in range(repeat):
        start = time.perf_counter()
        aggregator.summarize(operations, include_breakdown=True)
        durations.append(time.perf_counter() - start)
    return BenchmarkResult(aggregator.__class__.__name__, sum(durations) / len(durations))


def main() -> None:
    size = 60_000
    operations = build_operations(size)

    legacy = LegacyTimeAggregator()
    optimized = TimeAggregator()

    legacy_summary = legacy.summarize(operations, include_breakdown=True)
    optimized_summary = optimized.summarize(operations, include_breakdown=True)

    ensure_totals_close(legacy_summary["totals"], optimized_summary["totals"])

    legacy_result = run_benchmark(legacy, operations)
    optimized_result = run_benchmark(optimized, operations)

    speedup = legacy_result.duration / optimized_result.duration

    print(f"Dataset size: {size:,} operations")
    print(f"Legacy average: {legacy_result.duration:.3f} s")
    print(f"Optimized average: {optimized_result.duration:.3f} s")
    print(f"Speedup: {speedup:.2f}x faster")


def ensure_totals_close(reference: Dict[str, float], comparison: Dict[str, float], tol: float = 1e-6) -> None:
    for key, value in reference.items():
        other = comparison.get(key)
        if other is None or not isclose(value, other, rel_tol=tol, abs_tol=tol):
            raise AssertionError(f"Mismatch for {key}: {value} != {other}")


if __name__ == "__main__":
    main()
