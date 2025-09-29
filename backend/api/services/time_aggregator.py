"""공정 시간 합계를 계산하는 Polars 기반 유틸리티."""
from __future__ import annotations

from multiprocessing import cpu_count
from typing import Any, Dict, Iterable, List

import numpy as np
import numexpr as ne
import polars as pl


class TimeAggregator:
    """공정 시간 합계를 계산하는 헬퍼."""

    def __init__(self) -> None:
        self._time_columns = {
            "setup_time": ["SETUP_TIME", "ACT_SETUP_TIME"],
            "run_time": ["MACH_WORKED_HOURS", "ACT_RUN_TIME", "RUN_TIME", "RUN_TIME_QTY"],
            "queue_time": ["QUEUE_TIME"],
            "wait_time": ["WAIT_TIME", "IDLE_TIME"],
            "move_time": ["MOVE_TIME"],
        }
        self._time_keys = list(self._time_columns.keys())
        self._sequence_columns = ["PROC_SEQ", "SEQ", "STEP", "ORDER"]

        self._cpu_count = max(1, cpu_count() or 1)
        try:
            pl.Config.set_global_thread_pool_size(self._cpu_count)
        except Exception:  # pragma: no cover - thread pool은 초기화 이후 재설정 불가할 수 있음
            pass
        ne.set_num_threads(self._cpu_count)
        try:
            ne.set_vml_num_threads(self._cpu_count)
        except AttributeError:  # pragma: no cover - vml 미지원 환경
            pass

    def summarize(
        self,
        operations: List[Dict[str, Any]],
        *,
        include_breakdown: bool = False,
    ) -> Dict[str, Any]:
        normalized = [self._normalize(row) for row in operations if row]
        if not normalized:
            totals = {key: 0.0 for key in self._time_keys}
            totals["lead_time"] = 0.0
            return {
                "totals": totals,
                "process_count": 0,
                "breakdown": [],
            }

        frame = pl.DataFrame(normalized)
        required_columns = {
            column.upper()
            for values in self._time_columns.values()
            for column in values
        }.union(self._sequence_columns)

        missing = [column for column in required_columns if column not in frame.columns]
        if missing:
            frame = frame.with_columns([pl.lit(None).alias(column) for column in missing])

        lazy_enriched = frame.lazy().with_columns(
            [self._time_value_expr(columns).alias(key) for key, columns in self._time_columns.items()]
            + [
                self._sequence_expr().alias("proc_seq"),
                pl.arange(0, pl.len()).alias("_row_index"),
            ]
        )

        enriched = lazy_enriched.select([*self._time_keys, "proc_seq", "_row_index"]).collect()

        totals_df = enriched.select([pl.col(key).sum().alias(key) for key in self._time_keys])
        totals = {key: float(totals_df[key][0]) for key in self._time_keys}

        if enriched.height:
            arrays = {
                key: enriched[key].to_numpy().astype(np.float64, copy=False)
                for key in self._time_keys
            }
            row_totals = ne.evaluate(" + ".join(self._time_keys), local_dict=arrays)
            totals["lead_time"] = float(row_totals.sum(dtype=np.float64))
        else:  # pragma: no cover - 빈 프레임 방어
            totals["lead_time"] = 0.0

        if include_breakdown:
            breakdown_df = (
                enriched.lazy()
                .with_columns(
                    pl.sum_horizontal([pl.col(key) for key in self._time_keys]).alias("total_time")
                )
                .group_by("_row_index", maintain_order=True)
                .agg(
                    [pl.first("proc_seq").alias("proc_seq")]
                    + [pl.col(key).sum().alias(key) for key in self._time_keys]
                    + [pl.col("total_time").sum().alias("total_time")]
                )
                .sort("_row_index")
                .drop("_row_index")
                .collect()
            )
            breakdown_records = [
                {
                    "proc_seq": row.get("proc_seq"),
                    "setup_time": float(row.get("setup_time", 0.0)),
                    "run_time": float(row.get("run_time", 0.0)),
                    "queue_time": float(row.get("queue_time", 0.0)),
                    "wait_time": float(row.get("wait_time", 0.0)),
                    "move_time": float(row.get("move_time", 0.0)),
                    "total_time": float(row.get("total_time", 0.0)),
                }
                for row in breakdown_df.to_dicts()
            ]
        else:
            breakdown_records = []

        return {
            "totals": totals,
            "process_count": enriched.height,
            "breakdown": breakdown_records,
        }

    @staticmethod
    def _normalize(row: Dict[str, Any]) -> Dict[str, Any]:
        return {str(key).upper(): value for key, value in row.items()}

    def _time_value_expr(self, columns: Iterable[str]) -> pl.Expr:
        sanitized = [
            pl.col(column.upper())
            .cast(pl.Utf8, strict=False)
            .str.strip_chars()
            .replace("", None)
            .cast(pl.Float64, strict=False)
            for column in columns
        ]
        return pl.coalesce(sanitized).fill_null(0.0)

    def _sequence_expr(self) -> pl.Expr:
        candidates = [
            pl.col(column)
            .cast(pl.Utf8, strict=False)
            .str.strip_chars()
            .replace("", None)
            .cast(pl.Float64, strict=False)
            for column in self._sequence_columns
        ]
        return (
            pl.coalesce(candidates)
            .round(0)
            .cast(pl.Int64, strict=False)
        )


__all__ = ["TimeAggregator"]
