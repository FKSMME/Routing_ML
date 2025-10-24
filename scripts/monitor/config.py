"""
Configuration and constants for Monitor Application
"""

import os

# ============================================================================
# Version Information
# ============================================================================
__version__ = "6.1.1"
__build_date__ = "2025-10-24"
__author__ = "Routing ML Team"
__app_name__ = "라우팅 자동생성 시스템 모니터"

# ============================================================================
# General Settings
# ============================================================================
POLL_INTERVAL_SECONDS = 5.0
PERFORMANCE_HISTORY_SIZE = 60

# ============================================================================
# API Configuration
# ============================================================================
API_BASE_URL = os.getenv("ROUTING_ML_API_URL", "https://localhost:8000")
MONITOR_ADMIN_USERNAME = os.getenv("MONITOR_ADMIN_USERNAME")
MONITOR_ADMIN_PASSWORD = os.getenv("MONITOR_ADMIN_PASSWORD")
API_TIMEOUT = float(os.getenv("MONITOR_API_TIMEOUT", "8"))
USER_AGENT = "RoutingML-Monitor/6.0"

# SSL/TLS verification setting
# Set to "false" to disable SSL certificate verification (dev/self-signed certs only)
# WARNING: Disabling SSL verification makes the connection vulnerable to MITM attacks
VERIFY_SSL = os.getenv("ROUTING_ML_VERIFY_SSL", "true").lower() == "true"

# ============================================================================
# Color System - GitHub Dark + Material Design 3
# ============================================================================
BG_PRIMARY = "#0d1117"
BG_SECONDARY = "#161b22"
BG_TERTIARY = "#21262d"
BG_ELEVATED = "#2d333b"

ACCENT_PRIMARY = "#2188ff"
ACCENT_SECONDARY = "#58a6ff"
ACCENT_SUCCESS = "#3fb950"
ACCENT_WARNING = "#d29922"
ACCENT_DANGER = "#f85149"
ACCENT_INFO = "#79c0ff"
ACCENT_ERROR = "#f85149"  # Alias for ACCENT_DANGER

TEXT_PRIMARY = "#f0f6fc"
TEXT_SECONDARY = "#8b949e"
TEXT_TERTIARY = "#6e7681"

BORDER_DEFAULT = "#30363d"
BORDER_EMPHASIS = "#58a6ff"

STATUS_ONLINE = "#3fb950"
STATUS_WARNING = "#d29922"
STATUS_OFFLINE = "#6e7681"

# Node colors for workflow visualization
NODE_DEFAULT = "#2d333b"
NODE_SELECTED = "#1f6feb"
NODE_ACTIVE = "#3fb950"
NODE_DISABLED = "#1a1f24"
NODE_ENABLED = "#2d4a5d"
NODE_READY = "#3fb950"

# Chart colors
CHART_CPU = "#58a6ff"
CHART_MEMORY = "#3fb950"
CHART_DISK = "#d29922"
