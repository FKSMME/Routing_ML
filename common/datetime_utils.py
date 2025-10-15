"""Datetime utility helpers used across the codebase."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal


UTC = timezone.utc


def utc_now() -> datetime:
    """Return the current UTC time as a timezone-aware datetime."""
    return datetime.now(UTC)


def utc_now_naive() -> datetime:
    """Return the current UTC time as a naive datetime (matching legacy storage)."""
    return utc_now().replace(tzinfo=None)


def utc_isoformat(*, timespec: Literal["auto", "hours", "minutes", "seconds", "milliseconds", "microseconds"] = "auto") -> str:
    """Return an ISO formatted timestamp without timezone offset (legacy friendly)."""
    return utc_now_naive().isoformat(timespec=timespec)


def utc_isoformat_z(
    *,
    timespec: Literal["auto", "hours", "minutes", "seconds", "milliseconds", "microseconds"] = "seconds",
) -> str:
    """Return an ISO formatted timestamp with a trailing Z designator."""
    iso = utc_now().isoformat(timespec=timespec)
    return iso.replace("+00:00", "Z")


def utc_timestamp(fmt: str) -> str:
    """Return a timestamp string rendered using strftime with UTC now."""
    return utc_now().strftime(fmt)
