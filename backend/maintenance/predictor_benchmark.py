"""Synthetic benchmark to monitor predictor heavy pandas workloads."""
from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict

import numpy as np
import pandas as pd

LOG_DIR = Path("logs/performance")


@dataclass
class BenchmarkConfig:
    candidate_count: int = 10
    operations_per_candidate: int = 400
    repetitions: int = 3

    @property
    def total_operations(self) -> int:
        return self.candidate_count * self.operations_per_candidate


@dataclass
class BenchmarkResult:
    config: BenchmarkConfig
    timings: Dict[str, float]

    def to_dict(self) -> Dict[str, object]:
        return {
            "config": {
                "candidate_count": self.config.candidate_count,
                "operations_per_candidate": self.config.operations_per_candidate,
                "repetitions": self.config.repetitions,
            },
            "timings": self.timings,
        }


def _generate_dataframe(config: BenchmarkConfig) -> pd.DataFrame:
    rng = np.random.default_rng(seed=42)
    rows = config.total_operations
    data = {
        "ITEM_CD": np.repeat([f"ITEM_{i:04d}" for i in range(config.candidate_count)], config.operations_per_candidate),
        "PROC_SEQ": np.tile(np.arange(config.operations_per_candidate), config.candidate_count),
        "JOB_NM": rng.choice(["CUT", "DRILL", "POLISH", "PACK"], size=rows),
        "ACT_RUN_TIME": rng.uniform(0.5, 5.0, size=rows),
        "ACT_SETUP_TIME": rng.uniform(0.1, 1.0, size=rows),
        "WAIT_TIME": rng.uniform(0, 2.0, size=rows),
    }
    return pd.DataFrame(data)


def run_benchmark(config: BenchmarkConfig | None = None) -> BenchmarkResult:
    config = config or BenchmarkConfig()
    df = _generate_dataframe(config)

    timings: Dict[str, float] = {}

    start = time.perf_counter()
    for _ in range(config.repetitions):
        grouped = df.groupby(["ITEM_CD", "JOB_NM"]).agg(
            {
                "ACT_RUN_TIME": "sum",
                "ACT_SETUP_TIME": "sum",
                "WAIT_TIME": "mean",
            }
        )
        grouped.reset_index(inplace=True)
        grouped.sort_values(by=["ITEM_CD", "JOB_NM"], inplace=True, ignore_index=True)
    timings["groupby"] = time.perf_counter() - start

    start = time.perf_counter()
    for _ in range(config.repetitions):
        merged = df.merge(
            grouped[["ITEM_CD", "JOB_NM", "ACT_RUN_TIME"]],
            on=["ITEM_CD", "JOB_NM"],
            how="left",
            suffixes=("", "_GROUPED"),
        )
        merged["RUN_RATIO"] = merged["ACT_RUN_TIME"] / merged["ACT_RUN_TIME_GROUPED"].replace({0: np.nan})
        merged.fillna(0, inplace=True)
    timings["merge"] = time.perf_counter() - start

    return BenchmarkResult(config=config, timings=timings)


def main() -> Path:
    result = run_benchmark()
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_path = LOG_DIR / f"predictor_benchmark-{timestamp}.json"
    payload = {
        "generated_at": timestamp,
        "result": result.to_dict(),
        "thresholds": {"groupby_seconds": 2.5, "merge_seconds": 2.5},
    }
    report_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(report_path)
    return report_path


if __name__ == "__main__":
    main()
