"""
Post-processing utilities for routing recommendations.

This module enriches raw routing and work-order data for recommended candidates, applying
outsourcing replacement policies and statistical summarisation so that the final payload
reflects real operational history instead of placeholder ML-only values.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd

from backend.database import fetch_routing_for_item, fetch_work_results_for_item

# 기본 아웃소싱 -> 사내 대체 규칙 (패턴: 치환 문자열)
OUTSOURCING_REPLACEMENTS: Dict[str, str] = {
    "외주8": "사내8",
    "외주02": "사내02",
    "외주2": "사내2",
    "OUTSOURCING_8": "INHOUSE_8",
    "OUTSOURCING_2": "INHOUSE_2",
}

OUTSOURCING_PATTERNS: Tuple[str, ...] = tuple(OUTSOURCING_REPLACEMENTS.keys())


@dataclass
class StatisticConfig:
    trim_ratio: float = 0.1
    minimum_samples: int = 3


@dataclass
class CandidateInput:
    reference_item_cd: str
    similarity: float
    priority: str
    source: str


@dataclass
class CandidateResult:
    ITEM_CD: str
    CANDIDATE_ID: str
    REFERENCE_ITEM_CD: str
    SIMILARITY_SCORE: float
    RANK: int
    HAS_ROUTING: bool
    PROCESS_COUNT: int
    ROUTING_SOURCE: str
    OUTSOURCING_REPLACED: bool
    WORK_ORDER_COUNT: int
    WORK_ORDER_CONFIDENCE: float


def _detect_outsourcing(value: str) -> bool:
    needle = str(value or "").upper()
    return any(pattern.upper() in needle for pattern in OUTSOURCING_PATTERNS)


def _replace_outsourcing(value: str) -> Tuple[str, bool]:
    original = str(value or "")
    replaced = original
    replaced_flag = False
    for pattern, target in OUTSOURCING_REPLACEMENTS.items():
        if pattern in replaced:
            replaced = replaced.replace(pattern, target)
            replaced_flag = True
    return replaced, replaced_flag


def _to_datetime(series: pd.Series) -> pd.Series:
    try:
        return pd.to_datetime(series, errors="coerce")
    except Exception:
        return pd.to_datetime(pd.Series(dtype="datetime64[ns]"))


def _select_preferred_route(route_df: pd.DataFrame) -> pd.DataFrame:
    if route_df.empty:
        return route_df

    # Safety guard: Check if ROUT_NO column exists
    if "ROUT_NO" not in route_df.columns:
        return route_df

    work_df = route_df.copy()
    # Safety guard: Check if JOB_CD column exists before accessing
    if "JOB_CD" in work_df.columns:
        work_df["__outsourcing_count"] = work_df["JOB_CD"].apply(lambda x: 1 if _detect_outsourcing(x) else 0)
    else:
        work_df["__outsourcing_count"] = 0
    work_df["__insrt_dt"] = _to_datetime(work_df.get("INSRT_DT")) if "INSRT_DT" in work_df else pd.Series(pd.NaT, index=work_df.index)

    grouped = (
        work_df.groupby("ROUT_NO")
        .agg(
            outsourcing_count=("__outsourcing_count", "sum"),
            last_used=("__insrt_dt", "max"),
            row_count=("ROUT_NO", "count"),
        )
        .reset_index()
    )

    grouped = grouped.sort_values(
        ["outsourcing_count", "last_used", "row_count"],
        ascending=[True, False, False],
    )
    best_rout_no = grouped["ROUT_NO"].iloc[0]
    return work_df[work_df["ROUT_NO"] == best_rout_no].drop(columns=["__outsourcing_count", "__insrt_dt"], errors="ignore")


def _trimmed_mean(values: pd.Series, trim_ratio: float) -> Optional[float]:
    series = pd.to_numeric(values, errors="coerce").dropna()
    if series.empty:
        return None
    if trim_ratio <= 0:
        return float(series.mean())
    sorted_values = series.sort_values().reset_index(drop=True)
    n = len(sorted_values)
    k = int(n * trim_ratio)
    if 2 * k >= n:
        trimmed = sorted_values
    else:
        trimmed = sorted_values.iloc[k : n - k]
    if trimmed.empty:
        return None
    return float(trimmed.mean())


def _aggregate_work_stats(
    work_df: pd.DataFrame,
    proc_seq: Optional[int],
    job_cd: str,
    config: StatisticConfig,
) -> Dict[str, Optional[float]]:
    if work_df.empty:
        return {
            "setup": None,
            "run": None,
            "wait": None,
            "move": None,
            "samples": 0,
            "run_std": None,
            "setup_std": None,
            "confidence": 0.0,
        }

    filtered = work_df.copy()
    if "OPERATION_CD" in filtered.columns:
        filtered = filtered[filtered["OPERATION_CD"] == job_cd]
    if proc_seq is not None and "PROC_SEQ" in filtered.columns:
        filtered = filtered[filtered["PROC_SEQ"] == proc_seq]

    numeric_cols = ["ACT_SETUP_TIME", "ACT_RUN_TIME", "WAIT_TIME", "MOVE_TIME", "SETUP_TIME", "RUN_TIME"]
    if filtered.empty:
        return {
            "setup": None,
            "run": None,
            "wait": None,
            "move": None,
            "samples": 0,
            "run_std": None,
            "setup_std": None,
            "confidence": 0.0,
        }

    stats: Dict[str, Optional[float]] = {}
    sample_count = len(filtered)

    def compute(column: str) -> Optional[float]:
        if column not in filtered.columns:
            return None
        return _trimmed_mean(filtered[column], config.trim_ratio)

    def compute_std(column: str) -> Optional[float]:
        if column not in filtered.columns:
            return None
        series = pd.to_numeric(filtered[column], errors="coerce").dropna()
        if series.empty:
            return None
        return float(series.std(ddof=0))

    setup_mean = compute("ACT_SETUP_TIME") or compute("SETUP_TIME")
    run_mean_raw = compute("ACT_RUN_TIME") or compute("RUN_TIME")

    hold_columns = [c for c in filtered.columns if c.upper() in {"HOLD_TIME", "HOLD_DURATION", "HOLDING_TIME"}]
    hold_adjustment = 0.0
    for col in hold_columns:
        adj = compute(col)
        if adj:
            hold_adjustment += adj

    run_mean: Optional[float] = None
    if run_mean_raw is not None:
        run_mean = max(run_mean_raw - hold_adjustment, 0.0)

    stats["setup"] = setup_mean
    stats["run"] = run_mean
    stats["wait"] = compute("WAIT_TIME")
    stats["move"] = compute("MOVE_TIME")
    stats["samples"] = sample_count
    stats["run_std"] = compute_std("ACT_RUN_TIME") or compute_std("RUN_TIME")
    stats["setup_std"] = compute_std("ACT_SETUP_TIME") or compute_std("SETUP_TIME")

    if sample_count < config.minimum_samples:
        base_conf = 0.0
    else:
        base_conf = min(1.0, sample_count / (sample_count + 2))
    variability_penalty = 0.0
    if stats["run_std"] and stats["run"] and stats["run"] > 0:
        cv = stats["run_std"] / stats["run"]
        variability_penalty = min(0.3, cv)
    confidence = max(0.0, round(base_conf - variability_penalty, 3))
    stats["confidence"] = confidence
    return stats


def build_candidate_routing_frames(
    target_item_cd: str,
    candidates: Sequence[CandidateInput],
    *,
    predicted_routing: Optional[pd.DataFrame] = None,
    statistic_config: Optional[StatisticConfig] = None,
    max_variants: int = 4,
    normalizer=None,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Build enriched routing DataFrame and candidate summary based on actual routing/work data.
    """

    if statistic_config is None:
        statistic_config = StatisticConfig()

    routing_frames: List[pd.DataFrame] = []
    candidate_summaries: List[CandidateResult] = []

    seen_candidates = 0
    rank_counter = 1

    for candidate in candidates:
        if seen_candidates >= max_variants:
            break

        reference_item = candidate.reference_item_cd
        routing_df = fetch_routing_for_item(reference_item, latest_only=False, selection_mode="latest")
        outsourcing_replaced = False

        if routing_df.empty and reference_item == target_item_cd and predicted_routing is not None:
            routing_df = predicted_routing.copy()

        if routing_df.empty:
            continue

        selected_route = _select_preferred_route(routing_df)

        selected_route = selected_route.reset_index(drop=True)
        if "JOB_CD" in selected_route.columns:
            replaced_codes = []
            for idx, value in selected_route["JOB_CD"].items():
                new_value, replaced = _replace_outsourcing(value)
                if replaced:
                    outsourcing_replaced = True
                    replaced_codes.append(True)
                selected_route.at[idx, "JOB_CD"] = new_value
            if outsourcing_replaced and "JOB_NM" in selected_route.columns:
                selected_route["JOB_NM"] = selected_route["JOB_CD"]
        else:
            replaced_codes = []

        work_results = fetch_work_results_for_item(reference_item)

        op_stats: Dict[int, Dict[str, Optional[float]]] = {}
        if "PROC_SEQ" in selected_route.columns:
            proc_values = selected_route["PROC_SEQ"].tolist()
        else:
            proc_values = list(range(len(selected_route)))

        for idx, proc_seq in enumerate(proc_values):
            job_cd = (
                selected_route["JOB_CD"].iloc[idx]
                if "JOB_CD" in selected_route.columns
                else str(selected_route.get("PROC_CD", "")).strip()
            )
            stats = _aggregate_work_stats(work_results, proc_seq, job_cd, statistic_config)
            stats["outsourcing_replaced"] = bool(outsourcing_replaced)
            op_stats[int(proc_seq) if proc_seq is not None else idx] = stats

        candidate_id = f"{target_item_cd}_C{rank_counter:02d}"
        if normalizer is None:
            raise ValueError("normalizer callable must be provided")

        normalized = normalizer(
            target_item=target_item_cd,
            candidate_id=candidate_id,
            base_df=selected_route,
            similarity=candidate.similarity,
            reference_item=reference_item,
            priority=candidate.priority,
            signature="+".join(selected_route.get("JOB_CD", pd.Series(dtype=str)).astype(str).head(4).tolist()),
        )

        if normalized.empty:
            continue

        normalized["HAS_WORK_DATA"] = False
        normalized["WORK_ORDER_COUNT"] = 0
        normalized["WORK_ORDER_CONFIDENCE"] = 0.0
        normalized["OUTSOURCING_REPLACED"] = outsourcing_replaced

        for proc_seq, stats in op_stats.items():
            mask = normalized["PROC_SEQ"] == proc_seq
            if stats.get("setup") is not None:
                normalized.loc[mask, "SETUP_TIME"] = stats["setup"]
                normalized.loc[mask, "ACT_SETUP_TIME"] = stats["setup"]
            if stats.get("run") is not None:
                normalized.loc[mask, "RUN_TIME"] = stats["run"]
                normalized.loc[mask, "ACT_RUN_TIME"] = stats["run"]
                normalized.loc[mask, "MACH_WORKED_HOURS"] = stats["run"]
            if stats.get("wait") is not None:
                normalized.loc[mask, "WAIT_TIME"] = stats["wait"]
            if stats.get("move") is not None:
                normalized.loc[mask, "MOVE_TIME"] = stats["move"]
            normalized.loc[mask, "HAS_WORK_DATA"] = stats["samples"] > 0
            normalized.loc[mask, "WORK_ORDER_COUNT"] = stats["samples"]
            normalized.loc[mask, "WORK_ORDER_CONFIDENCE"] = stats["confidence"]
            if stats.get("run_std") is not None:
                normalized.loc[mask, "TIME_STD"] = stats["run_std"]
                if stats.get("run") not in (None, 0):
                    normalized.loc[mask, "TIME_CV"] = (
                        stats["run_std"] / stats["run"] if stats["run"] else 0.0
                    )
            if stats.get("setup_std") is not None:
                normalized.loc[mask, "SETUP_STD"] = stats["setup_std"]

        routing_frames.append(normalized)
        process_count = normalized["PROC_SEQ"].nunique()
        work_samples = int(sum(stats["samples"] for stats in op_stats.values()))
        confidence = float(np.mean([stats["confidence"] for stats in op_stats.values() if stats["confidence"] is not None])) if op_stats else 0.0

        candidate_summaries.append(
            CandidateResult(
                ITEM_CD=target_item_cd,
                CANDIDATE_ID=candidate_id,
                REFERENCE_ITEM_CD=reference_item,
                SIMILARITY_SCORE=float(candidate.similarity),
                RANK=rank_counter,
                HAS_ROUTING="Y",
                PROCESS_COUNT=process_count,
                ROUTING_SOURCE=candidate.source,
                OUTSOURCING_REPLACED=outsourcing_replaced,
                WORK_ORDER_COUNT=work_samples,
                WORK_ORDER_CONFIDENCE=confidence,
            )
        )

        seen_candidates += 1
        rank_counter += 1

    routing_df = pd.concat(routing_frames, ignore_index=True) if routing_frames else pd.DataFrame()
    candidates_df = pd.DataFrame([c.__dict__ for c in candidate_summaries]) if candidate_summaries else pd.DataFrame()
    return routing_df, candidates_df
