"""
Service health checking functionality
"""

import socket
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Tuple

from monitor.models import Service


def check_service(service: Service) -> Tuple[str, str]:
    """Check service status"""
    parsed = urllib.parse.urlparse(service.check_url)
    host = parsed.hostname or "localhost"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    request = urllib.request.Request(
        service.check_url,
        headers={"User-Agent": "RoutingML-Monitor/5.2", "Connection": "close"},
    )
    start = time.perf_counter()

    # Create SSL context that doesn't verify self-signed certificates
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(request, timeout=service.timeout, context=ssl_context) as response:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            code = response.getcode()
            state = "online" if 200 <= code < 400 else "warning"
            return state, f"{elapsed_ms:.0f}ms"
    except urllib.error.HTTPError as err:
        state = "warning" if 400 <= err.code < 500 else "offline"
        return state, f"HTTP {err.code}"
    except Exception:
        try:
            with socket.create_connection((host, port), timeout=service.timeout):
                return "warning", "TCP Open"
        except Exception:
            return "offline", "Offline"
