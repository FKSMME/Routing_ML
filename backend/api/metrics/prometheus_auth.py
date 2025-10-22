"""Prometheus metrics for authentication behaviour."""
from __future__ import annotations

from prometheus_client import Counter, Histogram

AUTH_401_COUNTER = Counter(
    "routing_ml_auth_401_total",
    "Number of HTTP 401 responses grouped by endpoint",
    ["endpoint"],
)

AUTH_HANDSHAKE_SECONDS = Histogram(
    "routing_ml_auth_handshake_seconds",
    "Latency of /api/auth/me handshake requests",
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0),
)

__all__ = ["AUTH_401_COUNTER", "AUTH_HANDSHAKE_SECONDS"]
