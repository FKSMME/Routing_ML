"""
Routing ML Auto-Generation Dashboard v5.2.0
Node-based Workflow Visualization
Modern Compact Design
"""

from __future__ import annotations

import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import ssl
import webbrowser
import json
import subprocess
import os
import csv
import http.cookiejar as cookiejar
from dataclasses import dataclass
from pathlib import Path
from queue import Empty, Queue
from typing import Dict, Tuple, List, Optional, Set
from collections import deque
from functools import partial

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog
import psutil

# Version Information
__version__ = "5.7.0"
__build_date__ = "2025-10-24"
__author__ = "Routing ML Team"
__app_name__ = "라우팅 자동생성 시스템 모니터"

POLL_INTERVAL_SECONDS = 5.0
PERFORMANCE_HISTORY_SIZE = 60

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

TEXT_PRIMARY = "#f0f6fc"
TEXT_SECONDARY = "#8b949e"
TEXT_TERTIARY = "#6e7681"

BORDER_DEFAULT = "#30363d"
BORDER_EMPHASIS = "#58a6ff"

STATUS_ONLINE = "#3fb950"
STATUS_WARNING = "#d29922"
STATUS_OFFLINE = "#6e7681"

# Node colors
NODE_DEFAULT = "#2d333b"
NODE_SELECTED = "#1f6feb"
NODE_ACTIVE = "#3fb950"
NODE_DISABLED = "#1a1f24"  # Darker gray for disabled nodes
NODE_ENABLED = "#2d4a5d"   # Brighter blue-gray for enabled nodes
NODE_READY = "#3fb950"     # Green for ready/online state

API_BASE_URL = os.getenv("ROUTING_ML_API_URL", "https://localhost:8000")
MONITOR_ADMIN_USERNAME = os.getenv("MONITOR_ADMIN_USERNAME")
MONITOR_ADMIN_PASSWORD = os.getenv("MONITOR_ADMIN_PASSWORD")
API_TIMEOUT = float(os.getenv("MONITOR_API_TIMEOUT", "8"))
USER_AGENT = "RoutingML-Monitor/5.3"


def blend_color(hex_a: str, hex_b: str, t: float) -> str:
    """Linear interpolate between two hex colors"""
    ra = int(hex_a[1:3], 16)
    ga = int(hex_a[3:5], 16)
    ba = int(hex_a[5:7], 16)
    rb = int(hex_b[1:3], 16)
    gb = int(hex_b[3:5], 16)
    bb = int(hex_b[5:7], 16)

    r = int(ra * (1 - t) + rb * t)
    g = int(ga * (1 - t) + gb * t)
    b = int(ba * (1 - t) + bb * t)

    return f"#{r:02x}{g:02x}{b:02x}"


class ApiError(Exception):
    """Raised when API interaction fails."""


class ApiClient:
    """Simple API client with cookie support for the Routing ML backend."""

    def __init__(
        self,
        base_url: str,
        username: Optional[str],
        password: Optional[str],
        *,
        timeout: float = 8.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.timeout = timeout
        self.context = ssl.create_default_context()
        self.context.check_hostname = False
        self.context.verify_mode = ssl.CERT_NONE
        self.cookie_jar = cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=self.context),
            urllib.request.HTTPCookieProcessor(self.cookie_jar),
        )
        self.headers = {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json",
        }
        if self.username and self.password:
            self._authenticate()

    def _authenticate(self) -> None:
        payload = json.dumps(
            {"username": self.username, "password": self.password}
        ).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}/api/auth/login",
            data=payload,
            headers=self.headers,
            method="POST",
        )
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                if response.status != 200:
                    raise ApiError(f"Login failed (HTTP {response.status})")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise ApiError(f"Login failed: {exc.reason} ({exc.code}) {detail}") from exc
        except urllib.error.URLError as exc:
            raise ApiError(f"Unable to reach API server: {exc.reason}") from exc

    def _request(
        self,
        method: str,
        path: str,
        *,
        data: Optional[bytes] = None,
        params: Optional[Dict[str, Optional[str]]] = None,
    ) -> Optional[dict]:
        url = f"{self.base_url}{path}"
        if params:
            filtered = {k: v for k, v in params.items() if v not in (None, "")}
            if filtered:
                query = urllib.parse.urlencode(filtered)
                separator = "&" if "?" in url else "?"
                url = f"{url}{separator}{query}"

        request = urllib.request.Request(
            url,
            data=data,
            headers=self.headers,
            method=method.upper(),
        )
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                payload = response.read()
                if not payload:
                    return None
                try:
                    return json.loads(payload.decode("utf-8"))
                except json.JSONDecodeError:
                    return None
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise ApiError(
                f"API 요청 실패 (HTTP {exc.code}): {detail or exc.reason}"
            ) from exc
        except urllib.error.URLError as exc:
            raise ApiError(f"Unable to reach API server: {exc.reason}") from exc

    def get_json(
        self,
        path: str,
        *,
        params: Optional[Dict[str, Optional[str]]] = None,
    ) -> Optional[dict]:
        return self._request("GET", path, params=params)

    def post_json(self, path: str, payload: dict) -> Optional[dict]:
        data = json.dumps(payload).encode("utf-8")
        return self._request("POST", path, data=data)


# ============================================================================
# Data Models
# ============================================================================

@dataclass(frozen=True)
class Service:
    """Represents a single monitored endpoint"""
    key: str
    name: str
    icon: str
    check_url: str
    start_command: Optional[str] = None
    links: Tuple[Tuple[str, str], ...] = ()
    timeout: float = 3.0


SERVICES: Tuple[Service, ...] = (
    Service(
        key="backend",
        name="Backend API",
        icon="🔧",
        check_url="https://localhost:8000/api/health",
        start_command="run_backend_main.bat",
        links=(
            ("Local", "https://localhost:8000/docs"),
            ("Domain", "https://rtml.ksm.co.kr:8000/docs"),
        ),
    ),
    Service(
        key="home",
        name="Home",
        icon="🏠",
        check_url="https://localhost:5176/",
        start_command="run_frontend_home.bat",
        links=(
            ("Local", "https://localhost:5176"),
            ("Domain", "https://rtml.ksm.co.kr:5176"),
        ),
    ),
    Service(
        key="prediction",
        name="Routing",
        icon="🎯",
        check_url="https://localhost:5173/",
        start_command="run_frontend_prediction.bat",
        links=(
            ("Local", "https://localhost:5173"),
            ("Domain", "https://rtml.ksm.co.kr:5173"),
        ),
    ),
    Service(
        key="training",
        name="Training",
        icon="🧠",
        check_url="https://localhost:5174/",
        start_command="run_frontend_training.bat",
        links=(
            ("Local", "https://localhost:5174"),
            ("Domain", "https://rtml.ksm.co.kr:5174"),
        ),
    ),
)


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


# ============================================================================
# Compact Service Card
# ============================================================================

class CompactServiceCard(tk.Frame):
    """Compact service card for 4-column grid"""

    STATUS_COLORS = {
        "online": STATUS_ONLINE,
        "warning": STATUS_WARNING,
        "offline": STATUS_OFFLINE,
        "checking": STATUS_OFFLINE,
    }

    def __init__(self, parent, service: Service, start_callback=None):
        super().__init__(parent, bg=BG_TERTIARY, highlightthickness=1,
                        highlightbackground=BORDER_DEFAULT)
        self.service = service
        self.start_callback = start_callback

        # Compact padding
        self.configure(padx=12, pady=10)

        # Icon + Title (horizontal)
        header = tk.Frame(self, bg=BG_TERTIARY)
        header.pack(fill="x", pady=(0, 6))

        icon_label = tk.Label(
            header,
            text=service.icon,
            font=("Segoe UI", 20),
            bg=BG_TERTIARY,
            fg=TEXT_PRIMARY
        )
        icon_label.pack(side="left", padx=(0, 8))

        title_label = tk.Label(
            header,
            text=service.name,
            font=("Segoe UI", 11, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_TERTIARY,
            anchor="w"
        )
        title_label.pack(side="left", fill="x", expand=True)

        # Status indicator (compact)
        status_frame = tk.Frame(self, bg=BG_TERTIARY)
        status_frame.pack(fill="x", pady=(0, 6))

        self.status_icon = tk.Label(
            status_frame,
            text="○",
            font=("Segoe UI", 10),
            fg=STATUS_OFFLINE,
            bg=BG_TERTIARY
        )
        self.status_icon.pack(side="left", padx=(0, 4))

        self.status_label = tk.Label(
            status_frame,
            text="Checking...",
            font=("Segoe UI", 9),
            fg=TEXT_SECONDARY,
            bg=BG_TERTIARY
        )
        self.status_label.pack(side="left")

        # Compact button row
        button_frame = tk.Frame(self, bg=BG_TERTIARY)
        button_frame.pack(fill="x")

        if service.start_command:
            start_btn = tk.Button(
                button_frame,
                text="▶",
                font=("Segoe UI", 9, "bold"),
                fg=TEXT_PRIMARY,
                bg=ACCENT_SUCCESS,
                activebackground=blend_color(ACCENT_SUCCESS, "#ffffff", 0.2),
                relief="flat",
                cursor="hand2",
                width=3,
                command=lambda: self.start_callback(service) if self.start_callback else None
            )
            start_btn.pack(side="left", padx=(0, 4))

        for label, url in service.links:
            btn = tk.Button(
                button_frame,
                text=label,
                font=("Segoe UI", 8),
                fg=TEXT_SECONDARY,
                bg=BG_ELEVATED,
                activebackground=BORDER_DEFAULT,
                relief="flat",
                cursor="hand2",
                padx=8,
                pady=4,
                command=partial(self._open_url, url)
            )
            btn.pack(side="left", padx=(0, 4))

    def update_status(self, state: str, message: str):
        """Update service status"""
        color = self.STATUS_COLORS.get(state, TEXT_SECONDARY)
        icon = "●" if state == "online" else "◐" if state == "warning" else "○"

        self.status_icon.config(text=icon, fg=color)
        self.status_label.config(text=message, fg=color)

        border_color = color if state in ("online", "warning") else BORDER_DEFAULT
        self.configure(highlightbackground=border_color)

    @staticmethod
    def _open_url(url: str):
        try:
            webbrowser.open(url, new=2)
        except Exception:
            webbrowser.open(url, new=0)


# ============================================================================
# Node-based Workflow Canvas
# ============================================================================

class WorkflowCanvas(tk.Canvas):
    """Node-based workflow visualization"""

    def __init__(self, parent, width=800, height=200):
        super().__init__(parent, width=width, height=height,
                        bg=BG_PRIMARY, highlightthickness=1,
                        highlightbackground=BORDER_DEFAULT)

        self.nodes = []
        self.selected_node = None

        # Workflow nodes with state tracking
        self.workflow_nodes = [
            {"id": "folder", "label": "📁\n폴더 선택", "color": NODE_ENABLED, "enabled": True},
            {"id": "start", "label": "▶\n서버 시작", "color": NODE_ENABLED, "enabled": True},
            {"id": "stop", "label": "⏹\n일괄 정지", "color": NODE_DISABLED, "enabled": False},
            {"id": "clear", "label": "🗑\n캐시 정리", "color": NODE_ENABLED, "enabled": True},
        ]

        self.bind("<Configure>", self._on_resize)
        self.draw_workflow()

    def _on_resize(self, event):
        """Handle canvas resize"""
        self.draw_workflow()

    def draw_workflow(self):
        """Draw workflow nodes"""
        self.delete("all")

        width = self.winfo_width() or 800
        height = self.winfo_height() or 200

        num_nodes = len(self.workflow_nodes)
        node_width = 100
        node_height = 80
        spacing = (width - num_nodes * node_width) / (num_nodes + 1)

        y_center = height / 2

        for i, node in enumerate(self.workflow_nodes):
            x = spacing + i * (node_width + spacing)
            y = y_center

            # Node rectangle
            x1, y1 = x, y - node_height / 2
            x2, y2 = x + node_width, y + node_height / 2

            color = node.get("color", NODE_DEFAULT)

            rect = self.create_rectangle(
                x1, y1, x2, y2,
                fill=color,
                outline=BORDER_EMPHASIS,
                width=2,
                tags=("node", node["id"])
            )

            # Label
            text = self.create_text(
                x + node_width / 2, y,
                text=node["label"],
                fill=TEXT_PRIMARY,
                font=("Segoe UI", 10, "bold"),
                tags=("node", node["id"])
            )

            # Arrow to next node
            if i < num_nodes - 1:
                arrow_x1 = x2 + 5
                arrow_x2 = x2 + spacing - 5
                self.create_line(
                    arrow_x1, y, arrow_x2, y,
                    arrow=tk.LAST,
                    fill=TEXT_TERTIARY,
                    width=2
                )

            # Store node info
            self.nodes.append({
                "id": node["id"],
                "rect": rect,
                "text": text,
                "bounds": (x1, y1, x2, y2)
            })

        # Bind clicks
        self.tag_bind("node", "<Button-1>", self._on_node_click)

    def _on_node_click(self, event):
        """Handle node click"""
        clicked = self.find_withtag("current")
        if clicked:
            tags = self.gettags(clicked[0])
            for tag in tags:
                if tag.startswith(("folder", "start", "stop", "clear")):
                    # Check if node is enabled before triggering action
                    node_enabled = True
                    for workflow_node in self.workflow_nodes:
                        if workflow_node["id"] == tag:
                            node_enabled = workflow_node.get("enabled", True)
                            break

                    if node_enabled:
                        self.highlight_node(tag)
                        self.event_generate("<<NodeClicked>>", data=tag)
                    break

    def highlight_node(self, node_id: str):
        """Highlight a node temporarily"""
        for i, workflow_node in enumerate(self.workflow_nodes):
            if workflow_node["id"] == node_id:
                for node in self.nodes:
                    if node["id"] == node_id:
                        original_color = workflow_node["color"]
                        self.itemconfig(node["rect"], fill=NODE_ACTIVE)
                        self.after(300, lambda n=node, c=original_color: self.itemconfig(n["rect"], fill=c))
                        break
                break

    def update_node_state(self, node_id: str, enabled: bool, color: str = None):
        """Update node enabled state and color"""
        for i, workflow_node in enumerate(self.workflow_nodes):
            if workflow_node["id"] == node_id:
                workflow_node["enabled"] = enabled
                if color:
                    workflow_node["color"] = color

                # Update visual representation
                for node in self.nodes:
                    if node["id"] == node_id:
                        self.itemconfig(node["rect"], fill=workflow_node["color"])
                        # Update cursor based on enabled state
                        # Note: Canvas items don't support cursor option directly
                        # cursor = "hand2" if enabled else "arrow"
                        # self.itemconfig(node["rect"], cursor=cursor)
                        # self.itemconfig(node["text"], cursor=cursor)
                        break
                break


# ============================================================================
# Compact Performance Chart
# ============================================================================

class CompactChart(tk.Canvas):
    """Compact performance chart"""

    def __init__(self, parent, title: str, color: str, unit: str = "%",
                 max_value: float = 100.0):
        super().__init__(parent, bg=BG_TERTIARY, highlightthickness=1,
                        highlightbackground=BORDER_DEFAULT)

        self.title = title
        self.color = color
        self.unit = unit
        self.max_value = max_value
        self.data: deque = deque(maxlen=PERFORMANCE_HISTORY_SIZE)

        self.bind("<Configure>", lambda e: self.draw())

    def add_data(self, value: float):
        """Add new data point"""
        self.data.append(value)
        self.draw()

    def draw(self):
        """Draw compact chart"""
        self.delete("all")
        w = self.winfo_width() or 200
        h = self.winfo_height() or 80

        # Background
        self.create_rectangle(0, 0, w, h, fill=BG_TERTIARY, outline="")

        # Title and current value
        if self.data:
            current = self.data[-1]
            label_text = f"{self.title}: {current:.1f}{self.unit}"
        else:
            label_text = f"{self.title}: --{self.unit}"

        self.create_text(
            w / 2, 12,
            text=label_text,
            font=("Segoe UI", 9, "bold"),
            fill=self.color,
            anchor="n"
        )

        # Chart area
        chart_top = 28
        chart_bottom = h - 8
        chart_left = 10
        chart_right = w - 10
        chart_height = chart_bottom - chart_top
        chart_width = chart_right - chart_left

        if len(self.data) < 2:
            return

        # Data line
        points = []
        data_count = len(self.data)
        x_step = chart_width / max(data_count - 1, 1)

        for i, value in enumerate(self.data):
            x = chart_left + (i * x_step)
            y = chart_bottom - (value / self.max_value * chart_height)
            y = max(chart_top, min(y, chart_bottom))
            points.extend([x, y])

        if len(points) >= 4:
            self.create_line(
                *points,
                fill=self.color,
                width=2,
                smooth=True
            )


# ============================================================================
# Main Application
# ============================================================================

class RoutingMLDashboard:
    """Routing ML Auto-Generation System Monitor"""

    def __init__(self, services: Tuple[Service, ...]):
        self.services = services
        self.queue: Queue[Tuple[str, str, str]] = Queue()
        self.selected_folder = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

        # Service status tracking for workflow nodes
        self.service_states: Dict[str, str] = {service.key: "offline" for service in services}

        # Create main window
        self.root = tk.Tk()
        self.root.title(f"🚀 {__app_name__} v{__version__}")
        self.root.configure(bg=BG_PRIMARY)
        self.root.geometry("1200x800")

        self.api_client: Optional[ApiClient] = None

        # Setup styles
        self._setup_styles()

        # Create UI
        self._create_header()
        self._create_workflow_section()
        self._create_tabs()

        # Start monitoring
        self.root.after(200, self._drain_queue)
        self.root.after(1000, self._update_performance_charts)

        # Initial workflow node update (assume all services offline at start)
        self.root.after(100, self._update_workflow_nodes)

        self.worker = threading.Thread(target=self._poll_loop, daemon=True)
        self.worker.start()

    def _ensure_api_client(self) -> bool:
        """Ensure API client is available; authentication is optional."""
        if self.api_client is None:
            self.api_client = ApiClient(
                API_BASE_URL,
                MONITOR_ADMIN_USERNAME or None,
                MONITOR_ADMIN_PASSWORD or None,
                timeout=API_TIMEOUT,
            )
        return True


    def _setup_styles(self):
        """Setup ttk styles"""
        style = ttk.Style()
        style.theme_use('clam')

        # Tab style with shading effect
        style.configure('Custom.TNotebook',
                       background=BG_PRIMARY,
                       borderwidth=0)

        style.configure('Custom.TNotebook.Tab',
                       background=BG_SECONDARY,
                       foreground=TEXT_SECONDARY,
                       padding=[20, 10],
                       font=('Segoe UI', 10, 'bold'),
                       borderwidth=0)

        # Selected tab is elevated with shading
        style.map('Custom.TNotebook.Tab',
                 background=[('selected', BG_TERTIARY), ('active', BG_ELEVATED)],
                 foreground=[('selected', TEXT_PRIMARY), ('active', TEXT_PRIMARY)],
                 expand=[('selected', [2, 2, 2, 2])])

    def _create_header(self):
        """Create compact header"""
        header = tk.Frame(self.root, bg=BG_SECONDARY, height=60)
        header.pack(fill="x")
        header.pack_propagate(False)

        # Title
        title = tk.Label(
            header,
            text=f"🚀 {__app_name__}",
            font=("Segoe UI", 16, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_SECONDARY
        )
        title.pack(side="left", padx=20, pady=12)

        # Version
        version = tk.Label(
            header,
            text=f"v{__version__}",
            font=("Segoe UI", 9),
            fg=TEXT_TERTIARY,
            bg=BG_SECONDARY
        )
        version.pack(side="left")

    def _create_workflow_section(self):
        """Create workflow visualization section"""
        workflow_frame = tk.Frame(self.root, bg=BG_PRIMARY)
        workflow_frame.pack(fill="x", padx=20, pady=10)

        # Workflow canvas
        self.workflow_canvas = WorkflowCanvas(workflow_frame, width=1160, height=120)
        self.workflow_canvas.pack(fill="both", expand=True)
        self.workflow_canvas.bind("<<NodeClicked>>", self._on_workflow_node_click)

    def _on_workflow_node_click(self, event):
        """Handle workflow node click"""
        node_id = event.widget.gettags("current")[1] if len(event.widget.gettags("current")) > 1 else None

        if node_id == "folder":
            self._select_folder()
        elif node_id == "start":
            self._start_all_services()
        elif node_id == "stop":
            self._stop_all_services()
        elif node_id == "clear":
            self._clear_cache()

    def _create_tabs(self):
        """Create tab control"""
        self.notebook = ttk.Notebook(self.root, style='Custom.TNotebook')
        self.notebook.pack(fill="both", expand=True, padx=20, pady=(0, 20))

        # Dashboard tab
        self.dashboard_tab = tk.Frame(self.notebook, bg=BG_PRIMARY)
        self.user_tab = tk.Frame(self.notebook, bg=BG_PRIMARY)

        self.notebook.add(self.dashboard_tab, text="  대시보드  ")
        self.notebook.add(self.user_tab, text="  회원 관리  ")

        self._init_dashboard_tab()
        self._init_user_management_tab()

    def _init_dashboard_tab(self):
        """Initialize dashboard with scrolling"""
        # Scrollable container
        canvas = tk.Canvas(self.dashboard_tab, bg=BG_PRIMARY, highlightthickness=0)
        scrollbar = ttk.Scrollbar(self.dashboard_tab, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        content = tk.Frame(canvas, bg=BG_PRIMARY)
        canvas_window = canvas.create_window((0, 0), window=content, anchor="nw")

        def update_scroll(*args):
            canvas.configure(scrollregion=canvas.bbox("all"))

        def on_resize(event):
            canvas.itemconfig(canvas_window, width=event.width)

        content.bind("<Configure>", update_scroll)
        canvas.bind("<Configure>", on_resize)

        # Enable mouse wheel scrolling
        def _on_mousewheel(event):
            canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

        canvas.bind_all("<MouseWheel>", _on_mousewheel)

        # Services section (4 columns)
        self._create_services_section(content)

        # Performance section (single row)
        self._create_performance_section(content)

    def _create_services_section(self, parent):
        """Create services in 4-column grid"""
        services_frame = tk.Frame(parent, bg=BG_PRIMARY)
        services_frame.pack(fill="both", padx=0, pady=(10, 10))

        # Grid (4 columns)
        self.cards: Dict[str, CompactServiceCard] = {}
        columns = 4

        for index, service in enumerate(self.services):
            card = CompactServiceCard(services_frame, service, start_callback=self._start_service)
            row = index // columns
            column = index % columns
            card.grid(row=row, column=column, padx=6, pady=6, sticky="nsew")
            services_frame.grid_columnconfigure(column, weight=1, uniform="service")
            self.cards[service.key] = card

    def _create_performance_section(self, parent):
        """Create performance charts in single row"""
        perf_frame = tk.Frame(parent, bg=BG_PRIMARY)
        perf_frame.pack(fill="x", padx=0, pady=(10, 10))

        # Single row layout
        row_frame = tk.Frame(perf_frame, bg=BG_PRIMARY)
        row_frame.pack(fill="both", expand=True)

        charts_config = [
            ("CPU", ACCENT_INFO, "%", 100.0),
            ("메모리", ACCENT_PRIMARY, "%", 100.0),
            ("응답시간", ACCENT_WARNING, "ms", 1000.0),
            ("디스크", ACCENT_SUCCESS, "%", 100.0),
        ]

        charts = []
        for title, color, unit, max_val in charts_config:
            chart = CompactChart(row_frame, title, color, unit, max_val)
            chart.pack(side="left", fill="both", expand=True, padx=3)
            charts.append(chart)

        self.cpu_chart = charts[0]
        self.memory_chart = charts[1]
        self.response_chart = charts[2]
        self.disk_chart = charts[3]

        # System info
        self.system_info_label = tk.Label(
            perf_frame,
            text="시스템 정보 로딩 중...",
            font=("Segoe UI", 9),
            fg=TEXT_TERTIARY,
            bg=BG_PRIMARY,
            anchor="w"
        )
        self.system_info_label.pack(fill="x", pady=(8, 0))

    def _init_user_management_tab(self):
        """Initialize user management tab"""
        # Header
        header = tk.Frame(self.user_tab, bg=BG_SECONDARY, height=60)
        header.pack(fill="x")
        header.pack_propagate(False)

        title = tk.Label(
            header,
            text="회원 관리",
            font=("Segoe UI", 14, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_SECONDARY
        )
        title.pack(side="left", padx=20, pady=16)

        refresh_btn = tk.Button(
            header,
            text="🔄 새로 고침",
            font=("Segoe UI", 9, "bold"),
            fg=TEXT_PRIMARY,
            bg=ACCENT_PRIMARY,
            activebackground=ACCENT_SECONDARY,
            relief="flat",
            cursor="hand2",
            padx=16,
            pady=8,
            command=self._load_pending_users
        )
        refresh_btn.pack(side="right", padx=20, pady=16)

        action_bar = tk.Frame(self.user_tab, bg=BG_PRIMARY)
        action_bar.pack(fill="x", padx=20, pady=(12, 0))

        tk.Button(
            action_bar,
            text="전체 사용자 보기",
            font=("Segoe UI", 9, "bold"),
            fg=TEXT_PRIMARY,
            bg=ACCENT_INFO,
            activebackground=ACCENT_SECONDARY,
            relief="flat",
            cursor="hand2",
            padx=14,
            pady=6,
            command=self._open_user_browser,
        ).pack(side="left", padx=4)

        tk.Button(
            action_bar,
            text="비밀번호 초기화",
            font=("Segoe UI", 9, "bold"),
            fg=TEXT_PRIMARY,
            bg=ACCENT_WARNING,
            activebackground=ACCENT_SECONDARY,
            relief="flat",
            cursor="hand2",
            padx=14,
            pady=6,
            command=self._prompt_reset_password,
        ).pack(side="left", padx=4)

        tk.Button(
            action_bar,
            text="CSV 일괄 등록",
            font=("Segoe UI", 9, "bold"),
            fg=TEXT_PRIMARY,
            bg=ACCENT_PRIMARY,
            activebackground=ACCENT_SECONDARY,
            relief="flat",
            cursor="hand2",
            padx=14,
            pady=6,
            command=self._bulk_register_csv,
        ).pack(side="left", padx=4)

        # User list container with scroll
        list_container = tk.Frame(self.user_tab, bg=BG_PRIMARY)
        list_container.pack(fill="both", expand=True, padx=20, pady=(0, 20))

        scrollbar = ttk.Scrollbar(list_container, orient="vertical")
        scrollbar.pack(side="right", fill="y")

        self.user_canvas = tk.Canvas(
            list_container,
            bg=BG_PRIMARY,
            highlightthickness=0,
            yscrollcommand=scrollbar.set
        )
        self.user_canvas.pack(side="left", fill="both", expand=True)
        scrollbar.config(command=self.user_canvas.yview)

        self.user_list_frame = tk.Frame(self.user_canvas, bg=BG_PRIMARY)
        self.canvas_window = self.user_canvas.create_window(
            (0, 0), window=self.user_list_frame, anchor="nw"
        )

        self.user_list_frame.bind("<Configure>",
            lambda e: self.user_canvas.configure(scrollregion=self.user_canvas.bbox("all")))
        self.user_canvas.bind("<Configure>",
            lambda e: self.user_canvas.itemconfig(self.canvas_window, width=e.width))

        # Enable mouse wheel for user tab
        def _on_mousewheel_user(event):
            self.user_canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

        self.user_canvas.bind_all("<MouseWheel>", _on_mousewheel_user)

        # Status label
        self.user_status_label = tk.Label(
            self.user_tab,
            text="대기 중인 회원 로딩 중...",
            font=("Segoe UI", 10),
            fg=TEXT_SECONDARY,
            bg=BG_PRIMARY
        )
        self.user_status_label.pack(side="bottom", fill="x", padx=20, pady=16)

        self._load_pending_users()

    # ========================================================================
    # Service Management
    # ========================================================================

    def _start_service(self, service: Service):
        """Start a single service in CMD popup"""
        if not service.start_command:
            messagebox.showwarning("알림", f"{service.name}은(는) 시작 명령이 없습니다.")
            return

        bat_file = os.path.join(self.selected_folder, service.start_command)

        if not os.path.exists(bat_file):
            messagebox.showerror("오류", f"시작 스크립트를 찾을 수 없습니다:\n{bat_file}")
            return

        try:
            subprocess.Popen(
                ["cmd.exe", "/k", bat_file],
                cwd=self.selected_folder,
                creationflags=subprocess.CREATE_NEW_CONSOLE
            )
            messagebox.showinfo("서비스 시작", f"{service.name}이(가) 시작되었습니다.")
        except Exception as e:
            messagebox.showerror("오류", f"서비스 시작 실패:\n{e}")

    def _start_all_services(self):
        """Start all services"""
        bat_file = os.path.join(self.selected_folder, "START_ALL_WINDOWS.bat")

        if not os.path.exists(bat_file):
            messagebox.showerror("오류", f"START_ALL_WINDOWS.bat을 찾을 수 없습니다.")
            return

        try:
            subprocess.Popen(
                ["cmd.exe", "/k", bat_file],
                cwd=self.selected_folder,
                creationflags=subprocess.CREATE_NEW_CONSOLE
            )
            messagebox.showinfo("서비스 시작", "모든 서비스가 시작되었습니다.")
        except Exception as e:
            messagebox.showerror("오류", f"서비스 시작 실패:\n{e}")

    def _stop_all_services(self):
        """Stop all services"""
        result = messagebox.askyesno("확인", "모든 서비스를 중지하시겠습니까?")

        if not result:
            return

        try:
            target_ports = set()
            for service in self.services:
                parsed = urllib.parse.urlparse(service.check_url)
                if parsed.port:
                    target_ports.add(parsed.port)

            target_ports.update({8000, 8001, 8002, 5173, 5174, 5176})

            active_pids = set()
            for conn in psutil.net_connections(kind="inet"):
                try:
                    if conn.laddr and conn.laddr.port in target_ports and conn.pid:
                        active_pids.add(conn.pid)
                except Exception:
                    continue

            project_root = Path(self.selected_folder).resolve()
            allowed_names = {
                "python.exe",
                "python",
                "uvicorn.exe",
                "uvicorn",
                "node.exe",
                "npm.cmd",
                "cmd.exe",
                "powershell.exe",
                "pwsh.exe",
            }

            candidate_pids = set()
            for pid in sorted(active_pids):
                if pid == os.getpid():
                    continue
                try:
                    proc = psutil.Process(pid)
                    exe_path = None
                    try:
                        exe_path = Path(proc.exe())
                    except (psutil.AccessDenied, psutil.NoSuchProcess, OSError):
                        exe_path = None

                    name = (proc.name() or "").lower()
                    within_project = bool(exe_path and project_root in exe_path.parents)
                    allowed = within_project or name in allowed_names
                    if not allowed:
                        continue

                    candidate_pids.add(pid)
                    for child in proc.children(recursive=True):
                        if child.pid != os.getpid():
                            candidate_pids.add(child.pid)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue

            terminated = []
            for pid in sorted(candidate_pids):
                if pid == os.getpid():
                    continue
                try:
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True)
                    terminated.append(pid)
                except Exception:
                    continue

            if not terminated:
                message = "종료할 서버 프로세스를 찾지 못했습니다. 이미 내려가 있거나 다른 계정에서 실행 중일 수 있습니다."
            else:
                message = "다음 PID를 포함한 프로세스를 종료했습니다:\n" + ", ".join(str(pid) for pid in terminated)
            message += "\n대상 포트: " + ", ".join(str(port) for port in sorted(target_ports))
            messagebox.showinfo("서버 정지", message)
        except Exception as e:
            messagebox.showerror("오류", f"서비스 중지 실패:\n{e}")

    def _clear_cache(self):
        """Clear Vite cache"""
        folders = ["frontend-home", "frontend-prediction", "frontend-training"]
        deleted = 0

        for folder_name in folders:
            folder_path = os.path.join(self.selected_folder, folder_name)
            for cache_dir in ["node_modules/.vite", ".vite"]:
                cache_path = os.path.join(folder_path, cache_dir)
                if os.path.exists(cache_path):
                    try:
                        import shutil
                        shutil.rmtree(cache_path)
                        deleted += 1
                    except Exception:
                        pass

        if deleted > 0:
            messagebox.showinfo("캐시 정리", f"{deleted}개의 캐시 폴더가 삭제되었습니다.")
        else:
            messagebox.showinfo("캐시 정리", "삭제할 캐시가 없습니다.")

    def _select_folder(self):
        """Select project folder"""
        folder = filedialog.askdirectory(
            title="프로젝트 폴더 선택",
            initialdir=self.selected_folder
        )

        if folder:
            self.selected_folder = folder
            self.root.title(f"🚀 {__app_name__} v{__version__} - {os.path.basename(folder)}")
            messagebox.showinfo("폴더 선택", f"선택된 폴더:\n{folder}")

    # ========================================================================
    # User Management
    # ========================================================================

    def _load_pending_users(self):
        """Load pending users"""
        self.user_status_label.config(text="회원 목록 로딩 중...")

        for widget in self.user_list_frame.winfo_children():
            widget.destroy()

        if not self._ensure_api_client():
            self.user_status_label.config(text="관리자 인증이 필요합니다")
            return

        try:
            data = self.api_client.get_json("/api/auth/admin/pending-users") or {}
            users = data.get("users", []) or []
            count = data.get("count", len(users))
        except ApiError as exc:
            self.user_status_label.config(text=f"오류: {exc}")
            error_label = tk.Label(
                self.user_list_frame,
                text=f"회원 정보를 불러올 수 없습니다\n\n{exc}",
                font=("Segoe UI", 11),
                fg=ACCENT_DANGER,
                bg=BG_PRIMARY,
                pady=50
            )
            error_label.pack()
            return

        if count == 0:
            self.user_status_label.config(text="대기 중인 회원이 없습니다")
            no_users = tk.Label(
                self.user_list_frame,
                text="대기 중인 회원이 없습니다",
                font=("Segoe UI", 12),
                fg=TEXT_SECONDARY,
                bg=BG_PRIMARY,
                pady=50
            )
            no_users.pack()
        else:
            self.user_status_label.config(text=f"대기 중 회원: {count}명")
            for user in users:
                self._create_user_card(user)

    def _create_user_card(self, user: dict):
        """Create compact user card"""
        card = tk.Frame(
            self.user_list_frame,
            bg=BG_TERTIARY,
            highlightthickness=1,
            highlightbackground=BORDER_DEFAULT
        )
        card.pack(fill="x", padx=4, pady=4)

        info_frame = tk.Frame(card, bg=BG_TERTIARY)
        info_frame.pack(side="left", fill="both", expand=True, padx=16, pady=12)

        username_label = tk.Label(
            info_frame,
            text=user.get('username', 'N/A'),
            font=("Segoe UI", 12, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_TERTIARY,
            anchor="w"
        )
        username_label.pack(anchor="w")

        details = []
        if user.get('full_name'):
            details.append(f"이름: {user['full_name']}")
        if user.get('email'):
            details.append(f"이메일: {user['email']}")

        if details:
            details_label = tk.Label(
                info_frame,
                text=" | ".join(details),
                font=("Segoe UI", 9),
                fg=TEXT_SECONDARY,
                bg=BG_TERTIARY,
                anchor="w"
            )
            details_label.pack(anchor="w", pady=(4, 0))

        action_frame = tk.Frame(card, bg=BG_TERTIARY)
        action_frame.pack(side="right", padx=16, pady=12)

        admin_var = tk.BooleanVar()
        admin_check = tk.Checkbutton(
            action_frame,
            text="관리자",
            variable=admin_var,
            font=("Segoe UI", 9),
            fg=TEXT_PRIMARY,
            bg=BG_TERTIARY,
            selectcolor=BG_ELEVATED,
            activebackground=BG_TERTIARY
        )
        admin_check.pack(side="left", padx=8)

        approve_btn = tk.Button(
            action_frame,
            text="✓ 승인",
            font=("Segoe UI", 9, "bold"),
            fg=TEXT_PRIMARY,
            bg=ACCENT_SUCCESS,
            activebackground=blend_color(ACCENT_SUCCESS, "#ffffff", 0.2),
            relief="flat",
            cursor="hand2",
            padx=16,
            pady=6,
            command=lambda: self._approve_user(user['username'], admin_var.get())
        )
        approve_btn.pack(side="left", padx=3)

        reject_btn = tk.Button(
            action_frame,
            text="✗ 거절",
            font=("Segoe UI", 9, "bold"),
            fg=TEXT_PRIMARY,
            bg=ACCENT_DANGER,
            activebackground=blend_color(ACCENT_DANGER, "#ffffff", 0.2),
            relief="flat",
            cursor="hand2",
            padx=16,
            pady=6,
            command=lambda: self._reject_user(user['username'])
        )
        reject_btn.pack(side="left", padx=3)

    @staticmethod
    def _csv_value_to_bool(value: Optional[str]) -> bool:
        if value is None:
            return False
        return str(value).strip().lower() in {"1", "true", "yes", "y", "t", "on"}


    def _open_user_browser(self) -> None:
        if not self._ensure_api_client():
            return

        window = tk.Toplevel(self.root)
        window.title("전체 사용자 목록")
        window.configure(bg=BG_PRIMARY)
        window.geometry("760x540")
        window.transient(self.root)

        search_var = tk.StringVar()
        status_var = tk.StringVar()
        total_var = tk.StringVar(value="0명")

        control = tk.Frame(window, bg=BG_PRIMARY)
        control.pack(fill="x", padx=16, pady=12)

        tk.Label(control, text="검색", font=("Segoe UI", 9), fg=TEXT_SECONDARY, bg=BG_PRIMARY).pack(side="left")
        search_entry = tk.Entry(control, textvariable=search_var, font=("Segoe UI", 10))
        search_entry.pack(side="left", padx=(6, 12))
        search_entry.focus_set()

        tk.Label(control, text="상태", font=("Segoe UI", 9), fg=TEXT_SECONDARY, bg=BG_PRIMARY).pack(side="left")
        status_box = ttk.Combobox(control, textvariable=status_var, values=["", "approved", "pending", "rejected"], width=12, state="readonly")
        status_box.pack(side="left", padx=(6, 12))
        status_box.set("")

        def refresh_users() -> None:
            params = {
                "search": search_var.get().strip() or None,
                "status": status_var.get() or None,
                "limit": "100",
                "offset": "0",
            }
            try:
                data = self.api_client.get_json("/api/auth/admin/users", params=params) or {}
            except ApiError as exc:
                messagebox.showerror("조회 실패", str(exc))
                return

            tree.delete(*tree.get_children())
            users = data.get("users", []) or []

            def fmt(ts: Optional[str]) -> str:
                if not ts or ts == "None":
                    return "-"
                return ts.replace("T", " ")[:19]

            for user in users:
                tree.insert(
                    "",
                    "end",
                    values=(
                        user.get("username", "-"),
                        user.get("status", "-"),
                        "Y" if user.get("is_admin") else "N",
                        "Y" if user.get("must_change_password") else "N",
                        user.get("invited_by") or "-",
                        fmt(str(user.get("created_at"))),
                        fmt(str(user.get("last_login_at"))),
                    ),
                )

            total = data.get("total", len(users))
            total_var.set(f"{total}명")

        tk.Button(
            control,
            text="조회",
            font=("Segoe UI", 9, "bold"),
            bg=ACCENT_PRIMARY,
            fg=TEXT_PRIMARY,
            activebackground=ACCENT_SECONDARY,
            relief="flat",
            cursor="hand2",
            padx=12,
            pady=6,
            command=refresh_users,
        ).pack(side="left")

        tk.Button(
            control,
            text="닫기",
            font=("Segoe UI", 9),
            bg=BG_SECONDARY,
            fg=TEXT_PRIMARY,
            relief="flat",
            cursor="hand2",
            padx=12,
            pady=6,
            command=window.destroy,
        ).pack(side="right")

        tree_frame = tk.Frame(window, bg=BG_PRIMARY)
        tree_frame.pack(fill="both", expand=True, padx=16, pady=(0, 12))

        columns = ("username", "status", "admin", "force", "invited", "created", "last_login")
        tree = ttk.Treeview(tree_frame, columns=columns, show="headings", height=16)
        headings = {
            "username": "아이디",
            "status": "상태",
            "admin": "관리자",
            "force": "변경필요",
            "invited": "등록자",
            "created": "등록일",
            "last_login": "최근 로그인",
        }
        widths = {
            "username": 140,
            "status": 90,
            "admin": 80,
            "force": 90,
            "invited": 110,
            "created": 140,
            "last_login": 150,
        }
        for key, title in headings.items():
            tree.heading(key, text=title)
            tree.column(key, width=widths[key], anchor="center")

        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)
        tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        footer = tk.Frame(window, bg=BG_PRIMARY)
        footer.pack(fill="x", padx=16, pady=(0, 12))
        tk.Label(footer, textvariable=total_var, font=("Segoe UI", 9), fg=TEXT_TERTIARY, bg=BG_PRIMARY).pack(side="left")

        refresh_users()

    def _prompt_reset_password(self) -> None:
        if not self._ensure_api_client():
            return

        username = simpledialog.askstring("비밀번호 초기화", "초기화할 사용자 ID를 입력하세요:")
        if not username:
            return

        temp_password = simpledialog.askstring(
            "임시 비밀번호",
            "직접 임시 비밀번호를 지정하시겠습니까? (미입력 시 자동 생성)",
            show="*",
        )
        force_change = messagebox.askyesno("비밀번호 초기화", "다음 로그인 시 비밀번호 변경을 강제할까요?")
        notify = messagebox.askyesno("비밀번호 초기화", "사용자에게 이메일 알림을 보낼까요?")

        payload = {
            "username": username.strip(),
            "temp_password": (temp_password.strip() if temp_password else None),
            "force_change": force_change,
            "notify": notify,
        }

        try:
            result = self.api_client.post_json("/api/auth/admin/reset-password", payload) or {}
        except ApiError as exc:
            messagebox.showerror("초기화 실패", str(exc))
            return

        temp_display = result.get("temporary_password") or payload["temp_password"]
        messagebox.showinfo(
            "비밀번호 초기화 완료",
            f"사용자 '{username}'의 비밀번호가 초기화되었습니다.\n임시 비밀번호: {temp_display}",
        )

    def _bulk_register_csv(self) -> None:
        if not self._ensure_api_client():
            return

        file_path = filedialog.askopenfilename(
            title="CSV 파일 선택",
            filetypes=[("CSV 파일", "*.csv"), ("모든 파일", "*.*")],
        )
        if not file_path:
            return

        try:
            with open(file_path, newline="", encoding="utf-8-sig") as csvfile:
                reader = csv.DictReader(csvfile)
                users: List[dict] = []
                for row in reader:
                    username = (row.get("username") or "").strip()
                    if not username:
                        continue
                    users.append(
                        {
                            "username": username,
                            "display_name": (row.get("display_name") or "").strip() or None,
                            "full_name": (row.get("full_name") or "").strip() or None,
                            "email": (row.get("email") or "").strip() or None,
                            "password": (row.get("password") or "").strip() or None,
                            "make_admin": self._csv_value_to_bool(row.get("is_admin")),
                        }
                    )
        except Exception as exc:
            messagebox.showerror("CSV 읽기 실패", str(exc))
            return

        if not users:
            messagebox.showwarning("일괄 등록", "유효한 사용자 레코드가 없습니다.")
            return

        auto_approve = messagebox.askyesno("일괄 등록", "등록된 사용자를 즉시 승인할까요?")
        force_change = messagebox.askyesno("일괄 등록", "최초 로그인 시 비밀번호 변경을 강제할까요?")
        notify = messagebox.askyesno("일괄 등록", "사용자에게 이메일 알림을 보낼까요?")
        overwrite = messagebox.askyesno("일괄 등록", "기존 사용자가 존재하면 덮어쓸까요?")

        payload = {
            "users": users,
            "auto_approve": auto_approve,
            "force_password_change": force_change,
            "notify": notify,
            "overwrite_existing": overwrite,
            "invited_by": self.api_client.username,
        }

        try:
            result = self.api_client.post_json("/api/auth/admin/bulk-register", payload) or {}
        except ApiError as exc:
            messagebox.showerror("일괄 등록 실패", str(exc))
            return

        successes = result.get("successes", [])
        failures = result.get("failures", [])
        messagebox.showinfo(
            "일괄 등록 완료",
            f"요청: {len(payload['users'])}명\n성공: {len(successes)}명\n실패/스킵: {len(failures)}명",
        )

    def _approve_user(self, username: str, make_admin: bool):
        """Approve user"""
        confirm = messagebox.askyesno("회원 승인", f"'{username}' 회원을 승인하시겠습니까?")

        if not confirm:
            return
        if not self._ensure_api_client():
            return

        payload = {"username": username, "make_admin": make_admin}
        try:
            self.api_client.post_json("/api/auth/admin/approve", payload)
        except ApiError as exc:
            messagebox.showerror("승인 실패", str(exc))
            return

        messagebox.showinfo("승인 완료", f"'{username}' 회원이 승인되었습니다.")
        self._load_pending_users()

    def _reject_user(self, username: str):
        """Reject user"""
        reason = simpledialog.askstring("회원 거절", f"'{username}' 회원 승인을 거절하시겠습니까?\n\n거절 사유 (선택 입력):")

        if reason is None:
            return
        if not self._ensure_api_client():
            return

        payload = {"username": username, "reason": (reason or "사유 없음")}
        try:
            self.api_client.post_json("/api/auth/admin/reject", payload)
        except ApiError as exc:
            messagebox.showerror("거절 실패", str(exc))
            return

        messagebox.showinfo("거절 완료", f"'{username}' 회원이 거절 처리되었습니다.")
        self._load_pending_users()

    # ========================================================================
    # Background Tasks
    # ========================================================================

    def _poll_loop(self):
        """Background polling loop"""
        while True:
            for service in self.services:
                state, message = check_service(service)
                self.queue.put((service.key, state, message))
            time.sleep(POLL_INTERVAL_SECONDS)

    def _drain_queue(self):
        """Process status updates"""
        status_changed = False
        try:
            while True:
                key, state, message = self.queue.get_nowait()
                card = self.cards.get(key)
                if card:
                    card.update_status(state, message)

                # Track service state changes
                if self.service_states.get(key) != state:
                    self.service_states[key] = state
                    status_changed = True
        except Empty:
            pass

        # Update workflow nodes if service states changed
        if status_changed:
            self._update_workflow_nodes()

        self.root.after(200, self._drain_queue)

    def _update_workflow_nodes(self):
        """Update workflow node states based on service status"""
        # Count service states
        online_count = sum(1 for state in self.service_states.values() if state == "online")
        offline_count = sum(1 for state in self.service_states.values() if state == "offline")
        total_count = len(self.service_states)

        all_online = online_count == total_count
        all_offline = offline_count == total_count
        any_online = online_count > 0

        # Update "start" node: ALWAYS enabled for user convenience
        # User can try to start services anytime
        self.workflow_canvas.update_node_state("start", enabled=True, color=NODE_ENABLED)

        # Update "stop" node: enabled only when at least one service is online
        if any_online:
            self.workflow_canvas.update_node_state("stop", enabled=True, color=NODE_ENABLED)
        else:
            self.workflow_canvas.update_node_state("stop", enabled=False, color=NODE_DISABLED)

        # "folder" and "clear" nodes are always enabled
        # (already set in initial state, but we can refresh if needed)

    def _update_performance_charts(self):
        """Update performance charts"""
        try:
            cpu_percent = psutil.cpu_percent(interval=0.1)
            self.cpu_chart.add_data(cpu_percent)

            memory = psutil.virtual_memory()
            self.memory_chart.add_data(memory.percent)

            disk = psutil.disk_usage('/')
            self.disk_chart.add_data(disk.percent)

            response_times = []
            for card in self.cards.values():
                status_text = card.status_label.cget("text")
                if "ms" in status_text:
                    try:
                        ms_value = float(status_text.replace("ms", ""))
                        response_times.append(ms_value)
                    except:
                        pass

            avg_response = sum(response_times) / len(response_times) if response_times else 0
            self.response_chart.add_data(avg_response)

            self.system_info_label.config(
                text=f"CPU: {cpu_percent:.1f}% | Memory: {memory.percent:.1f}% | Disk: {disk.percent:.1f}% | Avg Response: {avg_response:.0f}ms"
            )

        except Exception:
            pass

        self.root.after(1000, self._update_performance_charts)

    def run(self):
        """Run the application"""
        self.root.mainloop()


# ============================================================================
# Entry Point
# ============================================================================

def main():
    """Main entry point"""
    app = RoutingMLDashboard(SERVICES)
    app.run()


if __name__ == "__main__":
    main()
