"""
Modern Server Monitoring Dashboard
Material Design 3 + Fluent Design Style
Version 5.0.0 - Complete UI Overhaul
"""

from __future__ import annotations

import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
import json
import subprocess
import os
from dataclasses import dataclass
from queue import Empty, Queue
from typing import Dict, Tuple, List, Optional
from collections import deque
from functools import partial

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog
import psutil

# Version Information
__version__ = "5.0.0"
__build_date__ = "2025-01-15"
__author__ = "Routing ML Team"

POLL_INTERVAL_SECONDS = 5.0
PERFORMANCE_HISTORY_SIZE = 60

# ============================================================================
# Modern Color System - Material Design 3 + Fluent Design
# ============================================================================

# Base Colors - Dark Theme
BG_PRIMARY = "#0d1117"          # GitHub Dark Background
BG_SECONDARY = "#161b22"        # Slightly lighter
BG_TERTIARY = "#21262d"         # Card background
BG_ELEVATED = "#2d333b"         # Elevated surfaces

# Accent Colors - Modern Blue/Purple Gradient
ACCENT_PRIMARY = "#2188ff"      # GitHub Blue
ACCENT_SECONDARY = "#58a6ff"    # Lighter Blue
ACCENT_SUCCESS = "#3fb950"      # GitHub Green
ACCENT_WARNING = "#d29922"      # GitHub Orange
ACCENT_DANGER = "#f85149"       # GitHub Red
ACCENT_INFO = "#79c0ff"         # Light Blue

# Text Colors
TEXT_PRIMARY = "#f0f6fc"        # Brightest text
TEXT_SECONDARY = "#8b949e"      # Muted text
TEXT_TERTIARY = "#6e7681"       # Even more muted
TEXT_LINK = "#58a6ff"           # Links
TEXT_ON_ACCENT = "#ffffff"      # White text on accent

# Border Colors
BORDER_DEFAULT = "#30363d"      # Default border
BORDER_MUTED = "#21262d"        # Muted border
BORDER_EMPHASIS = "#58a6ff"     # Emphasized border

# Special Effects
SHADOW_COLOR = "#010409"        # Shadow
OVERLAY_BG = "rgba(13, 17, 23, 0.8)"  # Overlay

# Status Colors
STATUS_ONLINE = "#3fb950"
STATUS_WARNING = "#d29922"
STATUS_OFFLINE = "#6e7681"
STATUS_CHECKING = "#58a6ff"


def create_gradient(canvas: tk.Canvas, width: int, height: int, color1: str, color2: str, direction='vertical'):
    """Create a gradient on a canvas"""
    canvas.delete("gradient")

    if direction == 'vertical':
        for i in range(height):
            ratio = i / max(height - 1, 1)
            color = blend_color(color1, color2, ratio)
            canvas.create_line(0, i, width, i, fill=color, width=1, tags="gradient")
    else:  # horizontal
        for i in range(width):
            ratio = i / max(width - 1, 1)
            color = blend_color(color1, color2, ratio)
            canvas.create_line(i, 0, i, height, fill=color, width=1, tags="gradient")


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


# ============================================================================
# Data Models
# ============================================================================

@dataclass(frozen=True)
class Service:
    """Represents a single monitored endpoint"""
    key: str
    name: str
    icon: str  # Unicode icon
    check_url: str
    start_command: Optional[str] = None  # Command to start the service
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
            ("API Docs", "https://localhost:8000/docs"),
            ("Health Check", "https://localhost:8000/api/health"),
        ),
    ),
    Service(
        key="home",
        name="Home Dashboard",
        icon="🏠",
        check_url="https://localhost:5176/",
        start_command="run_frontend_home.bat",
        links=(
            ("Local", "https://localhost:5176"),
            ("LAN", "https://10.204.2.28:5176"),
        ),
    ),
    Service(
        key="prediction",
        name="Routing Creation",
        icon="🎯",
        check_url="https://localhost:5173/",
        start_command="run_frontend_prediction.bat",
        links=(
            ("Local", "https://localhost:5173"),
            ("LAN", "https://10.204.2.28:5173"),
        ),
    ),
    Service(
        key="training",
        name="Model Training",
        icon="🧠",
        check_url="https://localhost:5174/",
        start_command="run_frontend_training.bat",
        links=(
            ("Local", "https://localhost:5174"),
            ("LAN", "https://10.204.2.28:5174"),
        ),
    ),
)


def check_service(service: Service) -> Tuple[str, str]:
    """Check service status and return (state, message)"""
    parsed = urllib.parse.urlparse(service.check_url)
    host = parsed.hostname or "localhost"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    request = urllib.request.Request(
        service.check_url,
        headers={"User-Agent": "RoutingML-Monitor/5.0", "Connection": "close"},
    )
    start = time.perf_counter()

    try:
        with urllib.request.urlopen(request, timeout=service.timeout) as response:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            code = response.getcode()
            state = "online" if 200 <= code < 400 else "warning"
            return state, f"{elapsed_ms:.0f}ms"
    except urllib.error.HTTPError as err:
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        state = "warning" if 400 <= err.code < 500 else "offline"
        return state, f"HTTP {err.code}"
    except Exception:
        try:
            with socket.create_connection((host, port), timeout=service.timeout):
                return "warning", "TCP Open"
        except Exception:
            return "offline", "Offline"


# ============================================================================
# Modern UI Components
# ============================================================================

class ModernButton(tk.Canvas):
    """Modern Material Design 3 style button with hover effects"""

    def __init__(self, parent, text: str, command=None,
                 bg_color=ACCENT_PRIMARY, hover_color=ACCENT_SECONDARY,
                 text_color=TEXT_ON_ACCENT, width=120, height=36,
                 icon: str = None):
        super().__init__(parent, width=width, height=height,
                        bg=BG_PRIMARY, highlightthickness=0, cursor="hand2")

        self.text = text
        self.command = command
        self.bg_color = bg_color
        self.hover_color = hover_color
        self.text_color = text_color
        self.icon = icon
        self.is_hovered = False

        self.draw()
        self.bind("<Enter>", self.on_enter)
        self.bind("<Leave>", self.on_leave)
        self.bind("<Button-1>", self.on_click)

    def draw(self):
        """Draw the button"""
        self.delete("all")
        w, h = self.winfo_width() or 120, self.winfo_height() or 36

        # Background with rounded corners
        color = self.hover_color if self.is_hovered else self.bg_color
        radius = 6

        # Draw rounded rectangle
        self.create_polygon(
            [radius, 0, w-radius, 0, w, 0, w, radius, w, h-radius,
             w, h, w-radius, h, radius, h, 0, h, 0, h-radius, 0, radius, 0, 0],
            fill=color, smooth=True, outline=""
        )

        # Text
        text_content = f"{self.icon}  {self.text}" if self.icon else self.text
        self.create_text(
            w/2, h/2,
            text=text_content,
            fill=self.text_color,
            font=("Segoe UI", 10, "bold")
        )

    def on_enter(self, event):
        self.is_hovered = True
        self.draw()

    def on_leave(self, event):
        self.is_hovered = False
        self.draw()

    def on_click(self, event):
        if self.command:
            self.command()


class ServiceCard(tk.Frame):
    """Modern service status card with Material Design 3 styling"""

    STATUS_COLORS = {
        "online": STATUS_ONLINE,
        "warning": STATUS_WARNING,
        "offline": STATUS_OFFLINE,
        "checking": STATUS_CHECKING,
    }

    STATUS_ICONS = {
        "online": "●",
        "warning": "◐",
        "offline": "○",
        "checking": "○",
    }

    def __init__(self, parent, service: Service, start_callback=None):
        super().__init__(parent, bg=BG_TERTIARY, highlightthickness=1,
                        highlightbackground=BORDER_DEFAULT)
        self.service = service
        self.start_callback = start_callback

        # Add subtle shadow effect
        self.configure(relief="flat", padx=20, pady=16)

        # Header with icon and status
        header_frame = tk.Frame(self, bg=BG_TERTIARY)
        header_frame.pack(fill="x", pady=(0, 12))

        # Service icon (larger, more prominent)
        icon_label = tk.Label(
            header_frame,
            text=service.icon,
            font=("Segoe UI", 28),
            bg=BG_TERTIARY,
            fg=TEXT_PRIMARY
        )
        icon_label.pack(side="left", padx=(0, 12))

        # Title and status
        title_frame = tk.Frame(header_frame, bg=BG_TERTIARY)
        title_frame.pack(side="left", fill="both", expand=True)

        # Service name
        name_label = tk.Label(
            title_frame,
            text=service.name,
            font=("Segoe UI", 14, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_TERTIARY,
            anchor="w"
        )
        name_label.pack(anchor="w")

        # Status indicator
        status_frame = tk.Frame(title_frame, bg=BG_TERTIARY)
        status_frame.pack(anchor="w", pady=(4, 0))

        self.status_icon = tk.Label(
            status_frame,
            text="○",
            font=("Segoe UI", 12),
            fg=STATUS_CHECKING,
            bg=BG_TERTIARY
        )
        self.status_icon.pack(side="left", padx=(0, 6))

        self.status_label = tk.Label(
            status_frame,
            text="Checking...",
            font=("Segoe UI", 10),
            fg=TEXT_SECONDARY,
            bg=BG_TERTIARY
        )
        self.status_label.pack(side="left")

        # Separator
        separator = tk.Frame(self, height=1, bg=BORDER_MUTED)
        separator.pack(fill="x", pady=12)

        # Action buttons
        button_frame = tk.Frame(self, bg=BG_TERTIARY)
        button_frame.pack(fill="x")

        # Start button
        if service.start_command:
            start_btn = tk.Button(
                button_frame,
                text="▶ 시작",
                font=("Segoe UI", 9, "bold"),
                fg=TEXT_ON_ACCENT,
                bg=ACCENT_SUCCESS,
                activebackground=blend_color(ACCENT_SUCCESS, "#ffffff", 0.2),
                relief="flat",
                cursor="hand2",
                padx=12,
                pady=6,
                command=lambda: self.start_callback(service) if self.start_callback else None
            )
            start_btn.pack(side="left", padx=(0, 6))

        # Links
        for label, url in service.links:
            btn = tk.Button(
                button_frame,
                text=label,
                font=("Segoe UI", 9),
                fg=TEXT_LINK,
                bg=BG_ELEVATED,
                activebackground=BORDER_DEFAULT,
                relief="flat",
                cursor="hand2",
                padx=12,
                pady=6,
                command=partial(self._open_url, url)
            )
            btn.pack(side="left", padx=(0, 6))

    def update_status(self, state: str, message: str):
        """Update service status"""
        icon = self.STATUS_ICONS.get(state, "?")
        color = self.STATUS_COLORS.get(state, TEXT_SECONDARY)

        self.status_icon.config(text=icon, fg=color)

        # Format status message
        status_text = {
            "online": f"Online · {message}",
            "warning": f"Degraded · {message}",
            "offline": "Offline",
            "checking": "Checking..."
        }.get(state, message)

        self.status_label.config(text=status_text, fg=color)

        # Update card border color based on status
        border_color = {
            "online": STATUS_ONLINE,
            "warning": STATUS_WARNING,
            "offline": BORDER_DEFAULT,
            "checking": BORDER_DEFAULT
        }.get(state, BORDER_DEFAULT)

        self.configure(highlightbackground=border_color)

    @staticmethod
    def _open_url(url: str):
        """Open URL in browser"""
        try:
            webbrowser.open(url, new=2)
        except Exception:
            webbrowser.open(url, new=0)


class ModernChart(tk.Canvas):
    """Modern performance chart with smooth animations"""

    def __init__(self, parent, title: str, color: str, unit: str = "%",
                 max_value: float = 100.0, width: int = 300, height: int = 140):
        super().__init__(parent, width=width, height=height,
                        bg=BG_TERTIARY, highlightthickness=1,
                        highlightbackground=BORDER_DEFAULT)

        self.title = title
        self.color = color
        self.unit = unit
        self.max_value = max_value
        self.data: deque = deque(maxlen=PERFORMANCE_HISTORY_SIZE)
        self.padding = 40

        self.draw()

    def add_data(self, value: float):
        """Add new data point"""
        self.data.append(value)
        self.draw()

    def draw(self):
        """Draw the chart"""
        self.delete("all")
        w = self.winfo_width() or 300
        h = self.winfo_height() or 140

        # Background
        self.create_rectangle(0, 0, w, h, fill=BG_TERTIARY, outline="")

        # Title
        self.create_text(
            16, 16,
            text=self.title,
            font=("Segoe UI", 11, "bold"),
            fill=TEXT_SECONDARY,
            anchor="nw"
        )

        # Current value (large, prominent)
        if self.data:
            current = self.data[-1]
            self.create_text(
                w - 16, 16,
                text=f"{current:.1f}{self.unit}",
                font=("Segoe UI", 18, "bold"),
                fill=self.color,
                anchor="ne"
            )

        # Chart area
        chart_top = 50
        chart_bottom = h - 20
        chart_left = self.padding
        chart_right = w - 20
        chart_height = chart_bottom - chart_top
        chart_width = chart_right - chart_left

        if len(self.data) < 2:
            return

        # Grid lines (subtle)
        for i in range(5):
            y = chart_top + (chart_height * i / 4)
            self.create_line(
                chart_left, y, chart_right, y,
                fill=BORDER_MUTED,
                width=1,
                dash=(2, 4)
            )

        # Data line
        points = []
        data_count = len(self.data)
        x_step = chart_width / max(data_count - 1, 1)

        for i, value in enumerate(self.data):
            x = chart_left + (i * x_step)
            y = chart_bottom - (value / self.max_value * chart_height)
            y = max(chart_top, min(y, chart_bottom))
            points.extend([x, y])

        # Draw smooth curve
        if len(points) >= 4:
            self.create_line(
                *points,
                fill=self.color,
                width=3,
                smooth=True,
                capstyle="round",
                joinstyle="round"
            )

            # Fill area under curve
            fill_points = points + [chart_right, chart_bottom, chart_left, chart_bottom]
            self.create_polygon(
                *fill_points,
                fill=self.color,
                stipple="gray12",
                outline=""
            )


# ============================================================================
# Main Application
# ============================================================================

class ModernMonitorApp:
    """Modern server monitoring dashboard"""

    def __init__(self, services: Tuple[Service, ...]):
        self.services = services
        self.queue: Queue[Tuple[str, str, str]] = Queue()
        self.selected_folder = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

        # Create main window
        self.root = tk.Tk()
        self.root.title("🚀 MCS Server Dashboard")
        self.root.configure(bg=BG_PRIMARY)
        self.root.geometry("1400x900")
        self.root.resizable(True, True)

        # Configure styles
        self._setup_styles()

        # Create UI
        self._create_header()
        self._create_main_content()

        # Start monitoring
        self.root.after(200, self._drain_queue)
        self.root.after(1000, self._update_performance_charts)
        self.worker = threading.Thread(target=self._poll_loop, daemon=True)
        self.worker.start()

    def _setup_styles(self):
        """Setup ttk styles"""
        style = ttk.Style()
        style.theme_use('clam')

        # Notebook styles
        style.configure('Modern.TNotebook',
                       background=BG_PRIMARY,
                       borderwidth=0,
                       tabmargins=[10, 10, 10, 0])

        style.configure('Modern.TNotebook.Tab',
                       background=BG_SECONDARY,
                       foreground=TEXT_SECONDARY,
                       padding=[24, 12],
                       font=('Segoe UI', 11, 'bold'),
                       borderwidth=0)

        style.map('Modern.TNotebook.Tab',
                 background=[('selected', BG_TERTIARY)],
                 foreground=[('selected', TEXT_PRIMARY)])

    def _create_header(self):
        """Create modern header"""
        header = tk.Frame(self.root, bg=BG_SECONDARY, height=80)
        header.pack(fill="x", padx=0, pady=0)
        header.pack_propagate(False)

        # Left: Logo and title
        left_frame = tk.Frame(header, bg=BG_SECONDARY)
        left_frame.pack(side="left", padx=24, fill="y")

        title_label = tk.Label(
            left_frame,
            text="🚀 MCS Server Dashboard",
            font=("Segoe UI", 20, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_SECONDARY
        )
        title_label.pack(anchor="w", pady=(16, 4))

        subtitle_label = tk.Label(
            left_frame,
            text=f"Version {__version__} • Real-time Monitoring",
            font=("Segoe UI", 10),
            fg=TEXT_SECONDARY,
            bg=BG_SECONDARY
        )
        subtitle_label.pack(anchor="w")

        # Right: Quick actions
        right_frame = tk.Frame(header, bg=BG_SECONDARY)
        right_frame.pack(side="right", padx=24, fill="y")

        # Folder select button
        folder_btn = tk.Button(
            right_frame,
            text="📁 프로젝트 선택",
            font=("Segoe UI", 10, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_ELEVATED,
            activebackground=BORDER_DEFAULT,
            relief="flat",
            cursor="hand2",
            padx=16,
            pady=8,
            command=self._select_folder
        )
        folder_btn.pack(side="right", padx=4, pady=16)

    def _create_main_content(self):
        """Create main content area"""
        # Tab control
        self.notebook = ttk.Notebook(self.root, style='Modern.TNotebook')
        self.notebook.pack(fill="both", expand=True, padx=0, pady=0)

        # Create tabs
        self.dashboard_tab = tk.Frame(self.notebook, bg=BG_PRIMARY)
        self.user_tab = tk.Frame(self.notebook, bg=BG_PRIMARY)

        self.notebook.add(self.dashboard_tab, text="  📊 대시보드  ")
        self.notebook.add(self.user_tab, text="  👥 회원 관리  ")

        # Initialize tabs
        self._init_dashboard_tab()
        self._init_user_management_tab()

    def _init_dashboard_tab(self):
        """Initialize dashboard tab"""
        # Scrollable container
        container = tk.Frame(self.dashboard_tab, bg=BG_PRIMARY)
        container.pack(fill="both", expand=True)

        canvas = tk.Canvas(container, bg=BG_PRIMARY, highlightthickness=0)
        scrollbar = ttk.Scrollbar(container, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        content = tk.Frame(canvas, bg=BG_PRIMARY)
        canvas_window = canvas.create_window((0, 0), window=content, anchor="nw")

        def update_scroll(*args):
            canvas.configure(scrollregion=canvas.bbox("all"))

        def on_canvas_resize(event):
            canvas.itemconfig(canvas_window, width=event.width)

        content.bind("<Configure>", update_scroll)
        canvas.bind("<Configure>", on_canvas_resize)

        # Action bar
        self._create_action_bar(content)

        # Services section
        self._create_services_section(content)

        # Performance section
        self._create_performance_section(content)

        # Logs section (optional)
        # self._create_logs_section(content)

    def _create_action_bar(self, parent):
        """Create action bar with buttons"""
        action_frame = tk.Frame(parent, bg=BG_SECONDARY)
        action_frame.pack(fill="x", padx=24, pady=(20, 16))

        # Title
        title = tk.Label(
            action_frame,
            text="빠른 작업",
            font=("Segoe UI", 14, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_SECONDARY
        )
        title.pack(anchor="w", padx=20, pady=(16, 12))

        # Buttons container
        btn_container = tk.Frame(action_frame, bg=BG_SECONDARY)
        btn_container.pack(fill="x", padx=20, pady=(0, 16))

        # Start all button
        start_btn = tk.Button(
            btn_container,
            text="▶ 모든 서비스 시작",
            font=("Segoe UI", 11, "bold"),
            fg=TEXT_ON_ACCENT,
            bg=ACCENT_SUCCESS,
            activebackground=blend_color(ACCENT_SUCCESS, "#ffffff", 0.2),
            relief="flat",
            cursor="hand2",
            padx=24,
            pady=12,
            command=self._start_all_services
        )
        start_btn.pack(side="left", padx=(0, 12))

        # Stop all button
        stop_btn = tk.Button(
            btn_container,
            text="⏹ 모든 서비스 중지",
            font=("Segoe UI", 11, "bold"),
            fg=TEXT_ON_ACCENT,
            bg=ACCENT_DANGER,
            activebackground=blend_color(ACCENT_DANGER, "#ffffff", 0.2),
            relief="flat",
            cursor="hand2",
            padx=24,
            pady=12,
            command=self._stop_all_services
        )
        stop_btn.pack(side="left", padx=(0, 12))

        # Clear cache button
        cache_btn = tk.Button(
            btn_container,
            text="🗑 캐시 정리",
            font=("Segoe UI", 11, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_ELEVATED,
            activebackground=BORDER_DEFAULT,
            relief="flat",
            cursor="hand2",
            padx=24,
            pady=12,
            command=self._clear_cache
        )
        cache_btn.pack(side="left")

    def _create_services_section(self, parent):
        """Create services grid"""
        services_frame = tk.Frame(parent, bg=BG_PRIMARY)
        services_frame.pack(fill="both", expand=True, padx=24, pady=(0, 24))

        # Section title
        title = tk.Label(
            services_frame,
            text="서비스 상태",
            font=("Segoe UI", 16, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_PRIMARY
        )
        title.pack(anchor="w", pady=(0, 16))

        # Grid container
        grid = tk.Frame(services_frame, bg=BG_PRIMARY)
        grid.pack(fill="both", expand=True)

        # Create service cards in 2-column grid
        self.cards: Dict[str, ServiceCard] = {}
        columns = 2

        for index, service in enumerate(self.services):
            card = ServiceCard(grid, service, start_callback=self._start_service)
            row = index // columns
            column = index % columns
            card.grid(row=row, column=column, padx=8, pady=8, sticky="nsew")
            grid.grid_columnconfigure(column, weight=1)
            grid.grid_rowconfigure(row, weight=1)
            self.cards[service.key] = card

        # Status legend
        legend_frame = tk.Frame(services_frame, bg=BG_PRIMARY)
        legend_frame.pack(fill="x", pady=(16, 0))

        legend_items = [
            ("● Online", STATUS_ONLINE),
            ("◐ Degraded", STATUS_WARNING),
            ("○ Offline", STATUS_OFFLINE),
        ]

        for text, color in legend_items:
            label = tk.Label(
                legend_frame,
                text=text,
                font=("Segoe UI", 10),
                fg=color,
                bg=BG_PRIMARY
            )
            label.pack(side="left", padx=12)

        refresh_label = tk.Label(
            legend_frame,
            text="• 5초마다 자동 갱신",
            font=("Segoe UI", 10),
            fg=TEXT_TERTIARY,
            bg=BG_PRIMARY
        )
        refresh_label.pack(side="left", padx=12)

    def _create_performance_section(self, parent):
        """Create performance monitoring section"""
        perf_frame = tk.Frame(parent, bg=BG_PRIMARY)
        perf_frame.pack(fill="both", expand=True, padx=24, pady=(0, 24))

        # Section title
        title = tk.Label(
            perf_frame,
            text="시스템 성능",
            font=("Segoe UI", 16, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_PRIMARY
        )
        title.pack(anchor="w", pady=(0, 16))

        # Charts container
        charts_container = tk.Frame(perf_frame, bg=BG_PRIMARY)
        charts_container.pack(fill="both", expand=True)

        # Top row: CPU and Memory
        top_row = tk.Frame(charts_container, bg=BG_PRIMARY)
        top_row.pack(fill="both", expand=True, pady=(0, 12))

        self.cpu_chart = ModernChart(
            top_row,
            title="CPU 사용률",
            color=ACCENT_INFO,
            unit="%",
            max_value=100.0
        )
        self.cpu_chart.pack(side="left", fill="both", expand=True, padx=(0, 12))

        self.memory_chart = ModernChart(
            top_row,
            title="메모리 사용률",
            color=ACCENT_PRIMARY,
            unit="%",
            max_value=100.0
        )
        self.memory_chart.pack(side="left", fill="both", expand=True)

        # Bottom row: Response Time and Disk
        bottom_row = tk.Frame(charts_container, bg=BG_PRIMARY)
        bottom_row.pack(fill="both", expand=True)

        self.response_chart = ModernChart(
            bottom_row,
            title="평균 응답 시간",
            color=ACCENT_WARNING,
            unit="ms",
            max_value=1000.0
        )
        self.response_chart.pack(side="left", fill="both", expand=True, padx=(0, 12))

        self.disk_chart = ModernChart(
            bottom_row,
            title="디스크 사용률",
            color=ACCENT_SUCCESS,
            unit="%",
            max_value=100.0
        )
        self.disk_chart.pack(side="left", fill="both", expand=True)

        # System info summary
        self.system_info_label = tk.Label(
            perf_frame,
            text="시스템 정보 로딩 중...",
            font=("Segoe UI", 11),
            fg=TEXT_SECONDARY,
            bg=BG_PRIMARY,
            anchor="w"
        )
        self.system_info_label.pack(fill="x", pady=(16, 0))

    def _init_user_management_tab(self):
        """Initialize user management tab"""
        # Header
        header = tk.Frame(self.user_tab, bg=BG_SECONDARY)
        header.pack(fill="x", padx=0, pady=(0, 16))

        title = tk.Label(
            header,
            text="회원 관리",
            font=("Segoe UI", 16, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_SECONDARY
        )
        title.pack(anchor="w", padx=24, pady=16)

        # Refresh button
        refresh_btn = tk.Button(
            header,
            text="🔄 새로 고침",
            font=("Segoe UI", 10, "bold"),
            fg=TEXT_ON_ACCENT,
            bg=ACCENT_PRIMARY,
            activebackground=ACCENT_SECONDARY,
            relief="flat",
            cursor="hand2",
            padx=20,
            pady=10,
            command=self._load_pending_users
        )
        refresh_btn.pack(side="right", padx=24, pady=16)

        # User list container
        list_container = tk.Frame(self.user_tab, bg=BG_PRIMARY)
        list_container.pack(fill="both", expand=True, padx=24, pady=(0, 24))

        # Scrollbar
        scrollbar = ttk.Scrollbar(list_container, orient="vertical")
        scrollbar.pack(side="right", fill="y")

        # Canvas
        self.user_canvas = tk.Canvas(
            list_container,
            bg=BG_PRIMARY,
            highlightthickness=0,
            yscrollcommand=scrollbar.set
        )
        self.user_canvas.pack(side="left", fill="both", expand=True)
        scrollbar.config(command=self.user_canvas.yview)

        # Inner frame
        self.user_list_frame = tk.Frame(self.user_canvas, bg=BG_PRIMARY)
        self.canvas_window = self.user_canvas.create_window(
            (0, 0), window=self.user_list_frame, anchor="nw"
        )

        self.user_list_frame.bind("<Configure>",
            lambda e: self.user_canvas.configure(scrollregion=self.user_canvas.bbox("all")))
        self.user_canvas.bind("<Configure>",
            lambda e: self.user_canvas.itemconfig(self.canvas_window, width=e.width))

        # Status label
        self.user_status_label = tk.Label(
            self.user_tab,
            text="대기 중인 회원 로딩 중...",
            font=("Segoe UI", 11),
            fg=TEXT_SECONDARY,
            bg=BG_PRIMARY
        )
        self.user_status_label.pack(side="bottom", fill="x", padx=24, pady=16)

        # Load users
        self._load_pending_users()

    # ========================================================================
    # Service Management Methods
    # ========================================================================

    def _start_service(self, service: Service):
        """Start a single service in CMD popup"""
        if not service.start_command:
            messagebox.showwarning("알림", f"{service.name}은(는) 수동 시작 명령이 없습니다.")
            return

        bat_file = os.path.join(self.selected_folder, service.start_command)

        if not os.path.exists(bat_file):
            messagebox.showerror(
                "오류",
                f"시작 스크립트를 찾을 수 없습니다:\n{bat_file}"
            )
            return

        try:
            # Open in new CMD window
            subprocess.Popen(
                ["cmd.exe", "/k", bat_file],
                cwd=self.selected_folder,
                creationflags=subprocess.CREATE_NEW_CONSOLE
            )

            messagebox.showinfo(
                "서비스 시작",
                f"{service.name}이(가) 새 창에서 시작되었습니다.\n\n로그를 확인하세요."
            )
        except Exception as e:
            messagebox.showerror("오류", f"서비스 시작 실패:\n{e}")

    def _start_all_services(self):
        """Start all services in separate CMD windows"""
        bat_file = os.path.join(self.selected_folder, "START_ALL_WINDOWS.bat")

        if not os.path.exists(bat_file):
            messagebox.showerror(
                "오류",
                f"START_ALL_WINDOWS.bat을 찾을 수 없습니다:\n{self.selected_folder}"
            )
            return

        try:
            subprocess.Popen(
                ["cmd.exe", "/k", bat_file],
                cwd=self.selected_folder,
                creationflags=subprocess.CREATE_NEW_CONSOLE
            )

            messagebox.showinfo(
                "서비스 시작",
                "모든 서비스가 새 창에서 시작됩니다.\n\n각 창의 로그를 확인하세요."
            )
        except Exception as e:
            messagebox.showerror("오류", f"서비스 시작 실패:\n{e}")

    def _stop_all_services(self):
        """Stop all services"""
        result = messagebox.askyesno(
            "확인",
            "모든 Node.js 및 Python 서비스를 종료하시겠습니까?"
        )

        if not result:
            return

        try:
            # Kill Node.js processes
            subprocess.run(
                ["taskkill", "/F", "/IM", "node.exe"],
                capture_output=True
            )

            # Kill Python processes
            subprocess.run(
                ["taskkill", "/F", "/IM", "python.exe", "/FI", "WINDOWTITLE eq *uvicorn*"],
                capture_output=True
            )

            messagebox.showinfo(
                "서비스 중지",
                "모든 서비스가 종료되었습니다."
            )
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
            messagebox.showinfo(
                "캐시 정리",
                f"{deleted}개의 캐시 폴더가 삭제되었습니다.\n\n서비스를 재시작하세요."
            )
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
            self.root.title(f"🚀 MCS Server Dashboard - {os.path.basename(folder)}")

    # ========================================================================
    # User Management Methods
    # ========================================================================

    def _load_pending_users(self):
        """Load pending users"""
        self.user_status_label.config(text="회원 목록 로딩 중...")

        # Clear existing
        for widget in self.user_list_frame.winfo_children():
            widget.destroy()

        try:
            request = urllib.request.Request(
                "https://localhost:8000/api/auth/admin/pending-users",
                headers={"User-Agent": "RoutingML-Monitor/5.0"}
            )

            with urllib.request.urlopen(request, timeout=5) as response:
                data = json.loads(response.read().decode("utf-8"))
                users = data.get("users", [])
                count = data.get("count", 0)

                if count == 0:
                    self.user_status_label.config(text="대기 중인 회원이 없습니다")

                    no_users = tk.Label(
                        self.user_list_frame,
                        text="✓ 대기 중인 회원이 없습니다",
                        font=("Segoe UI", 14),
                        fg=TEXT_SECONDARY,
                        bg=BG_PRIMARY,
                        pady=50
                    )
                    no_users.pack()
                else:
                    self.user_status_label.config(text=f"대기 중인 회원: {count}명")
                    for user in users:
                        self._create_user_card(user)

        except Exception as e:
            self.user_status_label.config(text=f"오류: {str(e)}")

            error_label = tk.Label(
                self.user_list_frame,
                text=f"⚠ 회원 목록을 불러올 수 없습니다\n\n{str(e)}",
                font=("Segoe UI", 12),
                fg=ACCENT_DANGER,
                bg=BG_PRIMARY,
                pady=50
            )
            error_label.pack()

    def _create_user_card(self, user: dict):
        """Create user card"""
        card = tk.Frame(
            self.user_list_frame,
            bg=BG_TERTIARY,
            highlightthickness=1,
            highlightbackground=BORDER_DEFAULT
        )
        card.pack(fill="x", padx=8, pady=6)

        # Info section
        info_frame = tk.Frame(card, bg=BG_TERTIARY)
        info_frame.pack(side="left", fill="both", expand=True, padx=20, pady=16)

        # Username
        username_label = tk.Label(
            info_frame,
            text=user.get('username', 'N/A'),
            font=("Segoe UI", 14, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_TERTIARY,
            anchor="w"
        )
        username_label.pack(anchor="w")

        # Details
        details = []
        if user.get('full_name'):
            details.append(f"이름: {user['full_name']}")
        if user.get('email'):
            details.append(f"이메일: {user['email']}")
        if user.get('created_at'):
            created = user['created_at'][:19].replace('T', ' ')
            details.append(f"신청일: {created}")

        if details:
            details_label = tk.Label(
                info_frame,
                text=" | ".join(details),
                font=("Segoe UI", 10),
                fg=TEXT_SECONDARY,
                bg=BG_TERTIARY,
                anchor="w"
            )
            details_label.pack(anchor="w", pady=(6, 0))

        # Action section
        action_frame = tk.Frame(card, bg=BG_TERTIARY)
        action_frame.pack(side="right", padx=20, pady=16)

        # Admin checkbox
        admin_var = tk.BooleanVar()
        admin_check = tk.Checkbutton(
            action_frame,
            text="관리자",
            variable=admin_var,
            font=("Segoe UI", 10, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_TERTIARY,
            selectcolor=BG_ELEVATED,
            activebackground=BG_TERTIARY
        )
        admin_check.pack(side="left", padx=12)

        # Approve button
        approve_btn = tk.Button(
            action_frame,
            text="✓ 승인",
            font=("Segoe UI", 10, "bold"),
            fg=TEXT_ON_ACCENT,
            bg=ACCENT_SUCCESS,
            activebackground=blend_color(ACCENT_SUCCESS, "#ffffff", 0.2),
            relief="flat",
            cursor="hand2",
            padx=20,
            pady=8,
            command=lambda: self._approve_user(user['username'], admin_var.get())
        )
        approve_btn.pack(side="left", padx=4)

        # Reject button
        reject_btn = tk.Button(
            action_frame,
            text="✗ 거절",
            font=("Segoe UI", 10, "bold"),
            fg=TEXT_ON_ACCENT,
            bg=ACCENT_DANGER,
            activebackground=blend_color(ACCENT_DANGER, "#ffffff", 0.2),
            relief="flat",
            cursor="hand2",
            padx=20,
            pady=8,
            command=lambda: self._reject_user(user['username'])
        )
        reject_btn.pack(side="left", padx=4)

    def _approve_user(self, username: str, make_admin: bool):
        """Approve user"""
        confirm = messagebox.askyesno(
            "회원 승인",
            f"'{username}' 회원을 승인하시겠습니까?\n\n관리자 권한: {'예' if make_admin else '아니오'}"
        )

        if not confirm:
            return

        try:
            payload = json.dumps({
                "username": username,
                "make_admin": make_admin
            }).encode("utf-8")

            request = urllib.request.Request(
                "https://localhost:8000/api/auth/admin/approve",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "RoutingML-Monitor/5.0"
                },
                method="POST"
            )

            with urllib.request.urlopen(request, timeout=5) as response:
                result = json.loads(response.read().decode("utf-8"))
                messagebox.showinfo("승인 완료", f"'{username}' 회원이 승인되었습니다.")
                self._load_pending_users()

        except Exception as e:
            messagebox.showerror("오류", f"승인 실패:\n{e}")

    def _reject_user(self, username: str):
        """Reject user"""
        reason = simpledialog.askstring(
            "회원 거절",
            f"'{username}' 회원 가입을 거절하시겠습니까?\n\n거절 사유 (선택사항):"
        )

        if reason is None:
            return

        try:
            payload = json.dumps({
                "username": username,
                "reason": reason or "사유 없음"
            }).encode("utf-8")

            request = urllib.request.Request(
                "https://localhost:8000/api/auth/admin/reject",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "RoutingML-Monitor/5.0"
                },
                method="POST"
            )

            with urllib.request.urlopen(request, timeout=5) as response:
                messagebox.showinfo("거절 완료", f"'{username}' 회원 가입이 거절되었습니다.")
                self._load_pending_users()

        except Exception as e:
            messagebox.showerror("오류", f"거절 실패:\n{e}")

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
        """Process status updates from queue"""
        try:
            while True:
                key, state, message = self.queue.get_nowait()
                card = self.cards.get(key)
                if card:
                    card.update_status(state, message)
        except Empty:
            pass

        self.root.after(200, self._drain_queue)

    def _update_performance_charts(self):
        """Update performance charts"""
        try:
            # CPU
            cpu_percent = psutil.cpu_percent(interval=0.1)
            self.cpu_chart.add_data(cpu_percent)

            # Memory
            memory = psutil.virtual_memory()
            self.memory_chart.add_data(memory.percent)

            # Disk
            disk = psutil.disk_usage('/')
            self.disk_chart.add_data(disk.percent)

            # Response time (from service checks)
            response_times = []
            for card in self.cards.values():
                status_text = card.status_label.cget("text")
                if "ms" in status_text:
                    try:
                        ms_part = status_text.split("·")[-1].strip()
                        ms_value = float(ms_part.replace("ms", ""))
                        response_times.append(ms_value)
                    except:
                        pass

            avg_response = sum(response_times) / len(response_times) if response_times else 0
            self.response_chart.add_data(avg_response)

            # Update system info
            self.system_info_label.config(
                text=f"CPU: {cpu_percent:.1f}% | "
                     f"Memory: {memory.percent:.1f}% ({memory.used // (1024**3)}GB / {memory.total // (1024**3)}GB) | "
                     f"Disk: {disk.percent:.1f}% | "
                     f"Avg Response: {avg_response:.0f}ms"
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
    app = ModernMonitorApp(SERVICES)
    app.run()


if __name__ == "__main__":
    main()
