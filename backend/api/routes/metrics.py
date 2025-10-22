"""Prometheus metrics endpoint for system monitoring."""
from __future__ import annotations

import os
import psutil
import threading
import time
from collections import defaultdict
from typing import DefaultDict, Dict

from fastapi import APIRouter, Response

router = APIRouter(prefix="/metrics", tags=["metrics"])

# Startup time for uptime calculation
_START_TIME = time.time()

# Cached CPU metrics for non-blocking access
_cpu_metrics_lock = threading.Lock()
_cached_process_cpu = 0.0
_cached_system_cpu = 0.0
_last_cpu_update = 0.0
_CPU_CACHE_SECONDS = 2.0  # Cache CPU values for 2 seconds

# Request outcome metrics
_request_metrics_lock = threading.Lock()
_auth_401_total = 0
_auth_401_by_endpoint: DefaultDict[str, int] = defaultdict(int)
_prediction_401_total = 0
_request_duration_sum: DefaultDict[str, float] = defaultdict(float)
_request_duration_count: DefaultDict[str, int] = defaultdict(int)


def _update_cpu_metrics() -> None:
    """Update cached CPU metrics in a non-blocking way."""
    global _cached_process_cpu, _cached_system_cpu, _last_cpu_update

    now = time.time()
    with _cpu_metrics_lock:
        # Only update if cache is stale
        if now - _last_cpu_update < _CPU_CACHE_SECONDS:
            return

        try:
            process = psutil.Process(os.getpid())
            # Use interval=None for non-blocking calls
            _cached_process_cpu = process.cpu_percent(interval=None)
            _cached_system_cpu = psutil.cpu_percent(interval=None)
            _last_cpu_update = now
        except Exception:
            # Keep previous values on error
            pass


def get_system_metrics() -> Dict[str, float]:
    """Collect system-level metrics without blocking.

    CPU metrics are cached and updated periodically to avoid blocking calls.
    """
    _update_cpu_metrics()

    process = psutil.Process(os.getpid())

    with _cpu_metrics_lock:
        process_cpu = _cached_process_cpu
        system_cpu = _cached_system_cpu

    return {
        "process_cpu_percent": process_cpu,
        "process_memory_mb": process.memory_info().rss / 1024 / 1024,
        "process_threads": process.num_threads(),
        "system_cpu_percent": system_cpu,
        "system_memory_percent": psutil.virtual_memory().percent,
        "system_disk_percent": psutil.disk_usage("/").percent,
        "uptime_seconds": time.time() - _START_TIME,
    }


def record_request_metrics(path: str, status_code: int, duration_ms: float) -> None:
    """Record per-request metrics for Prometheus exposition.

    Args:
        path: Request path (already stripped of query params)
        status_code: Response status code
        duration_ms: Request processing time in milliseconds
    """
    global _auth_401_total, _prediction_401_total
    normalized_path = path.rstrip("/") or "/"
    with _request_metrics_lock:
        _request_duration_sum[normalized_path] += duration_ms
        _request_duration_count[normalized_path] += 1
        if status_code == 401:
            _auth_401_total += 1
            _auth_401_by_endpoint[normalized_path] += 1
            if normalized_path.startswith("/api/predict"):
                _prediction_401_total += 1


def format_prometheus_metrics() -> str:
    """Format metrics in Prometheus exposition format.

    Returns:
        Prometheus-formatted metrics string

    Example output:
        # HELP routing_ml_process_cpu_percent Process CPU usage
        # TYPE routing_ml_process_cpu_percent gauge
        routing_ml_process_cpu_percent 5.2

        # HELP routing_ml_process_memory_mb Process memory usage in MB
        # TYPE routing_ml_process_memory_mb gauge
        routing_ml_process_memory_mb 245.8
    """
    metrics = get_system_metrics()

    lines = []

    # Process CPU
    lines.append("# HELP routing_ml_process_cpu_percent Process CPU usage percentage")
    lines.append("# TYPE routing_ml_process_cpu_percent gauge")
    lines.append(f"routing_ml_process_cpu_percent {metrics['process_cpu_percent']}")

    # Process Memory
    lines.append("# HELP routing_ml_process_memory_mb Process memory usage in MB")
    lines.append("# TYPE routing_ml_process_memory_mb gauge")
    lines.append(f"routing_ml_process_memory_mb {metrics['process_memory_mb']:.2f}")

    # Process Threads
    lines.append("# HELP routing_ml_process_threads Number of process threads")
    lines.append("# TYPE routing_ml_process_threads gauge")
    lines.append(f"routing_ml_process_threads {metrics['process_threads']}")

    # System CPU
    lines.append("# HELP routing_ml_system_cpu_percent System CPU usage percentage")
    lines.append("# TYPE routing_ml_system_cpu_percent gauge")
    lines.append(f"routing_ml_system_cpu_percent {metrics['system_cpu_percent']}")

    # System Memory
    lines.append("# HELP routing_ml_system_memory_percent System memory usage percentage")
    lines.append("# TYPE routing_ml_system_memory_percent gauge")
    lines.append(f"routing_ml_system_memory_percent {metrics['system_memory_percent']}")

    # System Disk
    lines.append("# HELP routing_ml_system_disk_percent System disk usage percentage")
    lines.append("# TYPE routing_ml_system_disk_percent gauge")
    lines.append(f"routing_ml_system_disk_percent {metrics['system_disk_percent']}")

    # Uptime
    lines.append("# HELP routing_ml_uptime_seconds Application uptime in seconds")
    lines.append("# TYPE routing_ml_uptime_seconds counter")
    lines.append(f"routing_ml_uptime_seconds {metrics['uptime_seconds']:.0f}")

    # Application info
    lines.append('# HELP routing_ml_info Application information')
    lines.append('# TYPE routing_ml_info gauge')
    lines.append('routing_ml_info{version="4.0.0",python_version="3.11"} 1')

    with _request_metrics_lock:
        # 401 counters
        lines.append("# HELP routing_ml_auth_401_total Total number of 401 responses")
        lines.append("# TYPE routing_ml_auth_401_total counter")
        lines.append(f"routing_ml_auth_401_total {_auth_401_total}")

        lines.append("# HELP routing_ml_prediction_401_total Total number of 401 responses on prediction APIs")
        lines.append("# TYPE routing_ml_prediction_401_total counter")
        lines.append(f"routing_ml_prediction_401_total {_prediction_401_total}")

        lines.append("# HELP routing_ml_auth_401_endpoint_total 401 responses grouped by endpoint")
        lines.append("# TYPE routing_ml_auth_401_endpoint_total counter")
        for endpoint, count in _auth_401_by_endpoint.items():
            lines.append(f'routing_ml_auth_401_endpoint_total{{endpoint="{endpoint}"}} {count}')

        # Average latency per tracked endpoint
        lines.append("# HELP routing_ml_request_duration_ms_average Average request duration in milliseconds per endpoint")
        lines.append("# TYPE routing_ml_request_duration_ms_average gauge")
        for endpoint, total in _request_duration_sum.items():
            count = _request_duration_count[endpoint]
            if count == 0:
                continue
            avg = total / count
            lines.append(f'routing_ml_request_duration_ms_average{{endpoint="{endpoint}"}} {avg:.2f}')

    return "\n".join(lines) + "\n"


@router.get("", response_class=Response)
@router.get("/", response_class=Response)
async def get_prometheus_metrics() -> Response:
    """
    Prometheus metrics endpoint.

    Returns system and application metrics in Prometheus exposition format.

    **Prometheus Scraping Configuration**:
    ```yaml
    scrape_configs:
      - job_name: 'routing_ml'
        scrape_interval: 15s
        static_configs:
          - targets: ['localhost:8000']
        metrics_path: '/metrics'
    ```

    **Available Metrics**:
    - `routing_ml_process_cpu_percent`: Process CPU usage (%)
    - `routing_ml_process_memory_mb`: Process memory usage (MB)
    - `routing_ml_process_threads`: Number of threads
    - `routing_ml_system_cpu_percent`: System CPU usage (%)
    - `routing_ml_system_memory_percent`: System memory usage (%)
    - `routing_ml_system_disk_percent`: System disk usage (%)
    - `routing_ml_uptime_seconds`: Application uptime (seconds)
    - `routing_ml_info`: Application version information

    **Grafana Dashboard Queries**:
    ```promql
    # CPU usage over time
    routing_ml_process_cpu_percent

    # Memory usage trend
    routing_ml_process_memory_mb

    # Uptime
    routing_ml_uptime_seconds / 3600  # Convert to hours
    ```

    **Example Response**:
    ```
    # HELP routing_ml_process_cpu_percent Process CPU usage percentage
    # TYPE routing_ml_process_cpu_percent gauge
    routing_ml_process_cpu_percent 5.2

    # HELP routing_ml_process_memory_mb Process memory usage in MB
    # TYPE routing_ml_process_memory_mb gauge
    routing_ml_process_memory_mb 245.8
    ```
    """
    metrics_text = format_prometheus_metrics()
    return Response(
        content=metrics_text,
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


__all__ = ["router", "get_system_metrics", "format_prometheus_metrics", "record_request_metrics"]
