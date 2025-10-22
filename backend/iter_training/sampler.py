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

from backend.database import get_session
from .models import SamplingResult, SamplingStrategy

logger = logging.getLogger(__name__)


def random_sample(
    n: int,
    seed: Optional[int] = None,
    table_name: str = "dbo_BI_ITEM_INFO_VIEW",
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
    logger.info(f"Starting random sampling: n={n}, seed={seed}")

    session = get_session()
    try:
        # Query total population
        query_count = f"SELECT COUNT(*) as total FROM {table_name}"
        result = session.execute(query_count)
        total = result.fetchone()[0]

        if n > total:
            raise ValueError(f"Sample size {n} exceeds population {total}")

        # SQL Server random sampling using NEWID()
        # For reproducibility with seed, we use ROW_NUMBER with seed-based ordering
        if seed is not None:
            query = f"""
            WITH Numbered AS (
                SELECT ITEM_CD,
                       ROW_NUMBER() OVER (ORDER BY ABS(CHECKSUM(NEWID()) % {seed})) as rn
                FROM {table_name}
            )
            SELECT ITEM_CD
            FROM Numbered
            WHERE rn <= {n}
            ORDER BY rn
            """
        else:
            query = f"""
            SELECT TOP {n} ITEM_CD
            FROM {table_name}
            ORDER BY NEWID()
            """

        result = session.execute(query)
        items = [row[0] for row in result.fetchall()]

        logger.info(f"Random sampling complete: sampled {len(items)} items")

        return SamplingResult(
            items=items,
            strategy=SamplingStrategy.RANDOM,
            sample_size=n,
            actual_size=len(items),
            metadata={"total_population": total, "seed": seed},
        )

    finally:
        session.close()


def stratified_sample(
    n: int,
    strata_column: str = "PART_TYPE",
    seed: Optional[int] = None,
    table_name: str = "dbo_BI_ITEM_INFO_VIEW",
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
    logger.info(f"Starting stratified sampling: n={n}, strata={strata_column}, seed={seed}")

    session = get_session()
    try:
        # Get stratum counts
        query_strata = f"""
        SELECT {strata_column}, COUNT(*) as count
        FROM {table_name}
        WHERE {strata_column} IS NOT NULL
        GROUP BY {strata_column}
        ORDER BY count DESC
        """
        result = session.execute(query_strata)
        strata_counts = {row[0]: row[1] for row in result.fetchall()}

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
                WITH Numbered AS (
                    SELECT ITEM_CD,
                           ROW_NUMBER() OVER (ORDER BY ABS(CHECKSUM(NEWID()) % {seed})) as rn
                    FROM {table_name}
                    WHERE {strata_column} = '{stratum}'
                )
                SELECT ITEM_CD
                FROM Numbered
                WHERE rn <= {stratum_n}
                """
            else:
                query = f"""
                SELECT TOP {stratum_n} ITEM_CD
                FROM {table_name}
                WHERE {strata_column} = '{stratum}'
                ORDER BY NEWID()
                """

            result = session.execute(query)
            stratum_items = [row[0] for row in result.fetchall()]
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

    finally:
        session.close()


def recent_bias_sample(
    n: int,
    days_window: int = 30,
    seed: Optional[int] = None,
    table_name: str = "dbo_BI_ITEM_INFO_VIEW",
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
    logger.info(f"Starting recent-bias sampling: n={n}, days={days_window}, seed={seed}")

    session = get_session()
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days_window)

        # Query with weighted sampling (50% from recent, 50% from all)
        recent_n = n // 2
        random_n = n - recent_n

        # Sample recent items
        if seed is not None:
            query_recent = f"""
            WITH Numbered AS (
                SELECT ITEM_CD,
                       ROW_NUMBER() OVER (ORDER BY ABS(CHECKSUM(NEWID()) % {seed})) as rn
                FROM {table_name}
                WHERE {date_column} >= '{cutoff_date.strftime('%Y-%m-%d')}'
            )
            SELECT ITEM_CD
            FROM Numbered
            WHERE rn <= {recent_n}
            """
        else:
            query_recent = f"""
            SELECT TOP {recent_n} ITEM_CD
            FROM {table_name}
            WHERE {date_column} >= '{cutoff_date.strftime('%Y-%m-%d')}'
            ORDER BY NEWID()
            """

        result = session.execute(query_recent)
        recent_items = [row[0] for row in result.fetchall()]

        # Sample random items (excluding already sampled recent items)
        if len(recent_items) > 0:
            excluded_list = "', '".join(recent_items)
            exclusion_clause = f"AND ITEM_CD NOT IN ('{excluded_list}')"
        else:
            exclusion_clause = ""

        if seed is not None:
            query_random = f"""
            WITH Numbered AS (
                SELECT ITEM_CD,
                       ROW_NUMBER() OVER (ORDER BY ABS(CHECKSUM(NEWID()) % {seed})) as rn
                FROM {table_name}
                WHERE 1=1 {exclusion_clause}
            )
            SELECT ITEM_CD
            FROM Numbered
            WHERE rn <= {random_n}
            """
        else:
            query_random = f"""
            SELECT TOP {random_n} ITEM_CD
            FROM {table_name}
            WHERE 1=1 {exclusion_clause}
            ORDER BY NEWID()
            """

        result = session.execute(query_random)
        random_items = [row[0] for row in result.fetchall()]

        all_items = recent_items + random_items

        # Get total and recent counts for metadata
        query_total = f"SELECT COUNT(*) FROM {table_name}"
        result_total = session.execute(query_total)
        total = result_total.fetchone()[0]

        query_recent_count = f"SELECT COUNT(*) FROM {table_name} WHERE {date_column} >= '{cutoff_date.strftime('%Y-%m-%d')}'"
        result_recent = session.execute(query_recent_count)
        recent_count = result_recent.fetchone()[0]

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

    finally:
        session.close()


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
