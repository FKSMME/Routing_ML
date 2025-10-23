"""
Sampling strategies for quality evaluation.

This module implements various sampling strategies for selecting
items to evaluate during quality assessment cycles.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import List, Optional

import pandas as pd

from backend.database import _connection_pool, VIEW_ITEM_MASTER
from .models import SamplingResult, SamplingStrategy

logger = logging.getLogger(__name__)


def random_sample(
    n: int,
    seed: Optional[int] = None,
    table_name: Optional[str] = None,
) -> SamplingResult:
    """Perform simple random sampling without replacement.

    Args:
        n: Number of items to sample
        seed: Random seed for reproducibility
        table_name: Database table/view to sample from

    Returns:
        SamplingResult with sampled item codes

    Raises:
        ValueError: If n exceeds population size
    """
    if table_name is None:
        table_name = VIEW_ITEM_MASTER

    logger.info(f"Starting random sampling: n={n}, seed={seed}")

    with _connection_pool.get_connection() as conn:
        cursor = conn.cursor()

        # Query total population
        query_count = f"SELECT COUNT(*) as total FROM {table_name}"
        cursor.execute(query_count)
        total = cursor.fetchone()[0]

        if n > total:
            raise ValueError(f"Sample size {n} exceeds population {total}")

        # SQL Server random sampling using NEWID()
        # For reproducibility with seed, use CHECKSUM for deterministic random
        if seed is not None:
            query = f"""
            SELECT TOP {n} ITEM_CD
            FROM {table_name}
            ORDER BY ABS(CHECKSUM(NEWID(), ITEM_CD) % {seed})
            """
        else:
            query = f"""
            SELECT TOP {n} ITEM_CD
            FROM {table_name}
            ORDER BY NEWID()
            """

        cursor.execute(query)
        items = [row[0] for row in cursor.fetchall()]

        logger.info(f"Random sampling complete: sampled {len(items)} items")

        return SamplingResult(
            items=items,
            strategy=SamplingStrategy.RANDOM,
            sample_size=n,
            actual_size=len(items),
            metadata={"total_population": total, "seed": seed},
        )


def stratified_sample(
    n: int,
    strata_column: str = "PART_TYPE",
    seed: Optional[int] = None,
    table_name: Optional[str] = None,
) -> SamplingResult:
    """Perform stratified sampling by a categorical column.

    Samples proportionally from each stratum (category) to maintain
    distribution of the population.

    Args:
        n: Total number of items to sample
        strata_column: Column to stratify by (e.g., PART_TYPE, ITEM_TYPE)
        seed: Random seed for reproducibility
        table_name: Database table/view to sample from

    Returns:
        SamplingResult with sampled item codes and strata counts

    Raises:
        ValueError: If n exceeds population size or strata_column invalid
    """
    if table_name is None:
        table_name = VIEW_ITEM_MASTER

    logger.info(f"Starting stratified sampling: n={n}, strata={strata_column}, seed={seed}")

    with _connection_pool.get_connection() as conn:
        cursor = conn.cursor()

        # Get stratum counts
        query_strata = f"""
        SELECT {strata_column}, COUNT(*) as count
        FROM {table_name}
        WHERE {strata_column} IS NOT NULL
        GROUP BY {strata_column}
        ORDER BY count DESC
        """
        cursor.execute(query_strata)
        strata_counts = {row[0]: row[1] for row in cursor.fetchall()}

        total = sum(strata_counts.values())
        if n > total:
            raise ValueError(f"Sample size {n} exceeds population {total}")

        # Calculate samples per stratum (proportional allocation)
        stratum_samples = {}
        for stratum, count in strata_counts.items():
            proportion = count / total
            stratum_n = max(1, int(n * proportion))  # At least 1 per stratum
            stratum_samples[stratum] = stratum_n

        # Adjust to exactly n (may have rounding errors)
        current_total = sum(stratum_samples.values())
        if current_total != n:
            # Adjust largest stratum
            largest_stratum = max(strata_counts, key=strata_counts.get)
            stratum_samples[largest_stratum] += (n - current_total)

        # Sample from each stratum
        all_items = []
        for stratum, stratum_n in stratum_samples.items():
            if seed is not None:
                query = f"""
                SELECT TOP {stratum_n} ITEM_CD
                FROM {table_name}
                WHERE {strata_column} = ?
                ORDER BY ABS(CHECKSUM(NEWID(), ITEM_CD) % {seed})
                """
            else:
                query = f"""
                SELECT TOP {stratum_n} ITEM_CD
                FROM {table_name}
                WHERE {strata_column} = ?
                ORDER BY NEWID()
                """

            cursor.execute(query, stratum)
            stratum_items = [row[0] for row in cursor.fetchall()]
            all_items.extend(stratum_items)

        logger.info(f"Stratified sampling complete: sampled {len(all_items)} items from {len(strata_counts)} strata")

        return SamplingResult(
            items=all_items,
            strategy=SamplingStrategy.STRATIFIED,
            sample_size=n,
            actual_size=len(all_items),
            metadata={
                "total_population": total,
                "strata_column": strata_column,
                "strata_counts": strata_counts,
                "stratum_samples": stratum_samples,
                "seed": seed,
            },
        )


def recent_bias_sample(
    n: int,
    days_window: int = 30,
    seed: Optional[int] = None,
    table_name: Optional[str] = None,
    date_column: str = "CREATE_DATE",
) -> SamplingResult:
    """Perform weighted sampling with bias towards recently created/updated items.

    Items created/updated within the last `days_window` days have higher
    probability of being sampled.

    Args:
        n: Number of items to sample
        days_window: Number of days to consider "recent"
        seed: Random seed for reproducibility
        table_name: Database table/view to sample from
        date_column: Date column to use for recency (CREATE_DATE or UPDATE_DATE)

    Returns:
        SamplingResult with sampled item codes and recency statistics

    Raises:
        ValueError: If n exceeds population size
    """
    if table_name is None:
        table_name = VIEW_ITEM_MASTER

    logger.info(f"Starting recent-bias sampling: n={n}, days={days_window}, seed={seed}")

    with _connection_pool.get_connection() as conn:
        cursor = conn.cursor()

        cutoff_date = datetime.utcnow() - timedelta(days=days_window)

        # Query with weighted sampling (50% from recent, 50% from all)
        recent_n = n // 2
        random_n = n - recent_n

        # Sample recent items
        if seed is not None:
            query_recent = f"""
            SELECT TOP {recent_n} ITEM_CD
            FROM {table_name}
            WHERE {date_column} >= ?
            ORDER BY ABS(CHECKSUM(NEWID(), ITEM_CD) % {seed})
            """
        else:
            query_recent = f"""
            SELECT TOP {recent_n} ITEM_CD
            FROM {table_name}
            WHERE {date_column} >= ?
            ORDER BY NEWID()
            """

        cursor.execute(query_recent, cutoff_date.strftime('%Y-%m-%d'))
        recent_items = [row[0] for row in cursor.fetchall()]

        # Sample random items (excluding already sampled recent items)
        if len(recent_items) > 0:
            placeholders = ','.join(['?' for _ in recent_items])
            exclusion_clause = f"AND ITEM_CD NOT IN ({placeholders})"
        else:
            exclusion_clause = ""
            recent_items = []

        if seed is not None:
            query_random = f"""
            SELECT TOP {random_n} ITEM_CD
            FROM {table_name}
            WHERE 1=1 {exclusion_clause}
            ORDER BY ABS(CHECKSUM(NEWID(), ITEM_CD) % {seed})
            """
        else:
            query_random = f"""
            SELECT TOP {random_n} ITEM_CD
            FROM {table_name}
            WHERE 1=1 {exclusion_clause}
            ORDER BY NEWID()
            """

        if recent_items:
            cursor.execute(query_random, *recent_items)
        else:
            cursor.execute(query_random)
        random_items = [row[0] for row in cursor.fetchall()]

        all_items = recent_items + random_items

        # Get total and recent counts for metadata
        query_total = f"SELECT COUNT(*) FROM {table_name}"
        cursor.execute(query_total)
        total = cursor.fetchone()[0]

        query_recent_count = f"SELECT COUNT(*) FROM {table_name} WHERE {date_column} >= ?"
        cursor.execute(query_recent_count, cutoff_date.strftime('%Y-%m-%d'))
        recent_count = cursor.fetchone()[0]

        logger.info(f"Recent-bias sampling complete: {len(recent_items)} recent + {len(random_items)} random = {len(all_items)} total")

        return SamplingResult(
            items=all_items,
            strategy=SamplingStrategy.RECENT_BIAS,
            sample_size=n,
            actual_size=len(all_items),
            metadata={
                "total_population": total,
                "recent_population": recent_count,
                "days_window": days_window,
                "recent_sampled": len(recent_items),
                "random_sampled": len(random_items),
                "cutoff_date": cutoff_date.isoformat(),
                "seed": seed,
            },
        )


def sample_items(
    n: int,
    strategy: SamplingStrategy = SamplingStrategy.RANDOM,
    seed: Optional[int] = None,
    **kwargs,
) -> SamplingResult:
    """Convenience function to sample items using specified strategy.

    Args:
        n: Number of items to sample
        strategy: Sampling strategy to use
        seed: Random seed for reproducibility
        **kwargs: Additional strategy-specific parameters

    Returns:
        SamplingResult with sampled item codes

    Raises:
        ValueError: If strategy invalid or sampling fails
    """
    if strategy == SamplingStrategy.RANDOM:
        return random_sample(n, seed=seed)
    elif strategy == SamplingStrategy.STRATIFIED:
        strata_column = kwargs.get("strata_column", "PART_TYPE")
        return stratified_sample(n, strata_column=strata_column, seed=seed)
    elif strategy == SamplingStrategy.RECENT_BIAS:
        days_window = kwargs.get("days_window", 30)
        return recent_bias_sample(n, days_window=days_window, seed=seed)
    else:
        raise ValueError(f"Unknown sampling strategy: {strategy}")


def sample_items_for_quality(
    sample_size: int,
    *,
    strategy: str | SamplingStrategy = SamplingStrategy.RANDOM,
    seed: Optional[int] = None,
    table_name: Optional[str] = None,
    strata_column: str = "PART_TYPE",
    days_window: int = 30,
) -> SamplingResult:
    """High-level helper used by quality cycle to obtain evaluation samples.

    Args:
        sample_size: Number of items to sample (must be > 0)
        strategy: Sampling strategy name or SamplingStrategy enum
        seed: Optional seed for repeatability
        table_name: Optional override for the source table/view
        strata_column: Column to stratify by when using STRATIFIED strategy
        days_window: Recency window when using RECENT_BIAS strategy

    Returns:
        SamplingResult describing the sampled items/metadata.

    Raises:
        ValueError: If inputs are invalid or strategy unsupported.
    """
    if sample_size <= 0:
        raise ValueError("sample_size must be positive")

    try:
        strategy_enum = (
            strategy
            if isinstance(strategy, SamplingStrategy)
            else SamplingStrategy(str(strategy))
        )
    except ValueError as exc:
        raise ValueError(f"Unsupported sampling strategy: {strategy}") from exc

    if strategy_enum is SamplingStrategy.RANDOM:
        return random_sample(sample_size, seed=seed, table_name=table_name)
    if strategy_enum is SamplingStrategy.STRATIFIED:
        return stratified_sample(
            sample_size,
            strata_column=strata_column,
            seed=seed,
            table_name=table_name,
        )
    if strategy_enum is SamplingStrategy.RECENT_BIAS:
        return recent_bias_sample(
            sample_size,
            days_window=days_window,
            seed=seed,
            table_name=table_name,
        )

    raise ValueError(f"Unsupported sampling strategy: {strategy_enum}")
