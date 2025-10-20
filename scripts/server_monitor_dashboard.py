"""Tkinter dashboard that visualizes Routing ML service status."""
from __future__ import annotations

import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import ssl
from dataclasses import dataclass
from queue import Empty, Queue
from typing import Dict, Tuple, List, Optional
from collections import deque
import json
import psutil

import tkinter as tk
from tkinter import ttk
import webbrowser
from functools import partial

# Version Information
__version__ = "4.0.0"
__build_date__ = "2025-10-14"
__author__ = "Routing ML Team"

POLL_INTERVAL_SECONDS = 5.0
PERFORMANCE_HISTORY_SIZE = 60  # Keep last 60 data points


@dataclass(frozen=True)
class Service:
    """Represents a single monitored endpoint."""

    key: str
    name: str
    check_url: str
    links: Tuple[Tuple[str, str], ...]
    timeout: float = 3.0


SERVICES: Tuple[Service, ...] = (
    Service(
        key="backend",
        name="Backend API",
        check_url="https://localhost:8000/api/health",
        links=(
            ("Local", "https://localhost:8000/docs"),
            ("LAN", "https://10.204.2.28:8000/docs"),
        ),
    ),
    Service(
        key="home",
        name="Home Dashboard",
        check_url="https://localhost:5176/",
        links=(
            ("Local", "https://localhost:5176"),
            ("LAN", "https://10.204.2.28:5176"),
        ),
    ),
    Service(
        key="prediction",
        name="Routing Creation UI",
        check_url="https://localhost:5173/",
        links=(
            ("Local", "https://localhost:5173"),
            ("LAN", "https://10.204.2.28:5173"),
        ),
    ),
    Service(
        key="training",
        name="Model Training UI",
        check_url="https://localhost:5174/",
        links=(
            ("Local", "https://localhost:5174"),
            ("LAN", "https://10.204.2.28:5174"),
        ),
    ),
)


def check_service(service: Service) -> Tuple[str, str]:
    """Return (state, message) for a service."""
    parsed = urllib.parse.urlparse(service.check_url)
    host = parsed.hostname or "localhost"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    request = urllib.request.Request(
        service.check_url,
        headers={"User-Agent": "RoutingML-Monitor/1.0", "Connection": "close"},
    )
    start = time.perf_counter()
    ssl_context = None
    if parsed.scheme == "https":
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(request, timeout=service.timeout, context=ssl_context) as response:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            code = response.getcode()
            state = "online" if 200 <= code < 400 else "warning"
            return state, f"HTTP {code} · {elapsed_ms:.0f}ms"
    except urllib.error.HTTPError as err:
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        state = "warning" if 400 <= err.code < 500 else "offline"
        return state, f"HTTP {err.code} · {elapsed_ms:.0f}ms"
    except Exception:  # noqa: BLE001
        try:
            with socket.create_connection((host, port), timeout=service.timeout):
                return "warning", f"TCP open · HTTP error"
        except Exception:  # noqa: BLE001
            return "offline", f"Connection refused"


class ServiceCard(tk.Frame):
    """Visual card that displays status for a single service (Cyberpunk style)."""

    COLORS: Dict[str, str] = {
        "online": "#00ff88",
        "warning": "#ffaa00",
        "offline": "#ff0055",
        "checking": "#00d4ff",
    }

    ICONS: Dict[str, str] = {
        "online": "●",
        "warning": "◐",
        "offline": "○",
        "checking": "◌",
    }

    def __init__(self, master: tk.Widget, service: Service) -> None:
        super().__init__(
            master,
            borderwidth=2,
            relief="solid",
            padx=16,
            pady=12,
            bg="#0a1628",
            highlightbackground="#00d4ff",
            highlightthickness=2,
        )
        self.service = service

        # Title with icon
        title_frame = tk.Frame(self, bg="#0a1628")
        title_frame.pack(anchor="w", fill="x")

        self.status_icon = tk.Label(
            title_frame,
            text="◌",
            font=("Consolas", 16, "bold"),
            fg="#00d4ff",
            bg="#0a1628",
        )
        self.status_icon.pack(side="left", padx=(0, 8))

        self.title_label = tk.Label(
            title_frame,
            text=service.name.upper(),
            font=("Consolas", 11, "bold"),
            fg="#00ffff",
            bg="#0a1628",
        )
        self.title_label.pack(side="left")

        # Status message (compact)
        self.status_label = tk.Label(
            self,
            text="CHECKING...",
            font=("Consolas", 9),
            fg="#00d4ff",
            bg="#0a1628",
            anchor="w",
        )
        self.status_label.pack(anchor="w", pady=(6, 8))

        # Links (more compact, cyberpunk style)
        self.links_frame = tk.Frame(self, bg="#0a1628")
        self.links_frame.pack(anchor="w", fill="x")

        for label, url in service.links:
            btn = tk.Button(
                self.links_frame,
                text=f"◢ {label.upper()} ◣",
                font=("Consolas", 8, "bold"),
                fg="#00ffff",
                bg="#1a2f4a",
                activebackground="#2a4f6a",
                activeforeground="#00ffff",
                relief="solid",
                bd=1,
                cursor="hand2",
                padx=12,
                pady=5,
                command=partial(self._open_url, url),
            )
            btn.pack(side="left", padx=(0, 6))

    def update_status(self, state: str, message: str) -> None:
        icon = self.ICONS.get(state, "?")
        color = self.COLORS.get(state, "#546e7a")

        self.status_icon.config(text=icon, fg=color)
        self.status_label.config(text=message, fg=color)

    @staticmethod
    def _open_url(url: str) -> None:
        try:
            webbrowser.open(url, new=2)
        except Exception:
            webbrowser.open(url, new=0)


class PerformanceChart(tk.Canvas):
    """Real-time performance chart widget"""

    def __init__(self, master: tk.Widget, title: str, color: str, unit: str = "%", max_value: float = 100.0) -> None:
        super().__init__(
            master,
            bg="#0a0e1a",
            highlightthickness=1,
            highlightbackground="#1a2332",
            width=300,
            height=120
        )
        self.title = title
        self.color = color
        self.unit = unit
        self.max_value = max_value
        self.data: deque = deque(maxlen=PERFORMANCE_HISTORY_SIZE)
        self.chart_padding = 30
        self.draw_chart()

    def add_data(self, value: float) -> None:
        """Add new data point and redraw chart"""
        self.data.append(value)
        self.draw_chart()

    def draw_chart(self) -> None:
        """Draw the performance chart"""
        self.delete("all")
        width = self.winfo_width() or 300
        height = self.winfo_height() or 120

        # Title
        self.create_text(
            10, 10,
            text=self.title,
            font=("Segoe UI", 9, "bold"),
            fill="#8b949e",
            anchor="nw"
        )

        # Current value
        if self.data:
            current = self.data[-1]
            self.create_text(
                width - 10, 10,
                text=f"{current:.1f}{self.unit}",
                font=("Segoe UI", 11, "bold"),
                fill=self.color,
                anchor="ne"
            )

        # Chart area
        chart_height = height - self.chart_padding - 10
        chart_width = width - 20

        if len(self.data) < 2:
            return

        # Draw grid lines
        for i in range(5):
            y = self.chart_padding + (chart_height * i / 4)
            self.create_line(
                10, y, width - 10, y,
                fill="#1a2332",
                width=1
            )

        # Draw data line
        points = []
        data_count = len(self.data)
        x_step = chart_width / max(data_count - 1, 1)

        for i, value in enumerate(self.data):
            x = 10 + (i * x_step)
            y = self.chart_padding + chart_height - (value / self.max_value * chart_height)
            y = max(self.chart_padding, min(y, height - 10))
            points.extend([x, y])

        if len(points) >= 4:
            self.create_line(
                *points,
                fill=self.color,
                width=2,
                smooth=True
            )

            # Fill area under curve
            fill_points = points + [width - 10, height - 10, 10, height - 10]
            self.create_polygon(
                *fill_points,
                fill=self.color,
                stipple="gray25",
                outline=""
            )


class MonitorApp:
    """Main window wiring Tkinter widgets with the polling thread."""

    def __init__(self, services: Tuple[Service, ...]) -> None:
        import os
        import subprocess
        from tkinter import filedialog

        self.services = services
        self.queue: Queue[Tuple[str, str, str]] = Queue()
        self.selected_folder = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

        self.root = tk.Tk()
        self.root.title(f"◢ ROUTING ML v{__version__} ◣ Cyberpunk Monitor")
        self.root.configure(bg="#000510")
        self.root.geometry("1200x750")
        self.root.resizable(True, True)

        # Cyberpunk Header with gradient effect
        header_frame = tk.Frame(self.root, bg="#000510", height=70)
        header_frame.pack(fill="x", pady=(0, 5))

        # Create gradient-like effect with multiple labels
        gradient_canvas = tk.Canvas(header_frame, bg="#000510", height=70, highlightthickness=0)
        gradient_canvas.pack(fill="x")

        # Draw gradient background
        for i in range(70):
            color_val = int(5 + i * 0.3)
            color = f"#{color_val:02x}{int(color_val * 0.5):02x}{int(color_val * 1.5):02x}"
            gradient_canvas.create_line(0, i, 1200, i, fill=color, width=1)

        # Cyberpunk title with glow effect
        title_text = f"◢ ROUTING ML v{__version__} ◣"
        gradient_canvas.create_text(
            600, 28,
            text=title_text,
            font=("Consolas", 22, "bold"),
            fill="#00ffff",
        )
        gradient_canvas.create_text(
            600, 28,
            text=title_text,
            font=("Consolas", 22, "bold"),
            fill="#0088ff",
        )

        # Version info subtitle
        version_text = f"BUILD: {__build_date__} | AUTHOR: {__author__}"
        gradient_canvas.create_text(
            600, 52,
            text=version_text,
            font=("Consolas", 8),
            fill="#00aaaa",
        )

        # Cyberpunk Tab control styling
        style = ttk.Style()
        style.theme_use('clam')
        style.configure('TNotebook', background='#000510', borderwidth=0)
        style.configure('TNotebook.Tab',
                       background='#0a1628',
                       foreground='#00d4ff',
                       padding=[25, 12],
                       font=('Consolas', 10, 'bold'),
                       borderwidth=1)
        style.map('TNotebook.Tab',
                 background=[('selected', '#1a2f4a')],
                 foreground=[('selected', '#00ffff')],
                 borderwidth=[('selected', 2)])

        tab_control = ttk.Notebook(self.root)

        # Service Monitor Tab
        service_tab = tk.Frame(tab_control, bg="#000510")
        tab_control.add(service_tab, text="◢ 서비스 모니터 ◣")

        # Performance Monitor Tab
        performance_tab = tk.Frame(tab_control, bg="#000510")
        tab_control.add(performance_tab, text="◢ 실시간 성능 ◣")

        # Backend Logs Tab
        logs_tab = tk.Frame(tab_control, bg="#000510")
        tab_control.add(logs_tab, text="◢ 백엔드 로그 ◣")

        # User Management Tab
        user_tab = tk.Frame(tab_control, bg="#000510")
        tab_control.add(user_tab, text="◢ 회원 관리 ◣")

        tab_control.pack(expand=1, fill="both", padx=10, pady=(0, 10))

        # Service Tab Content
        # Action buttons frame
        action_frame = tk.Frame(service_tab, bg="#000510")
        action_frame.pack(fill="x", padx=20, pady=(10, 10))

        # Select folder button (Cyberpunk style)
        folder_btn = tk.Button(
            action_frame,
            text="◢ SELECT FOLDER ◣",
            font=("Consolas", 9, "bold"),
            fg="#00d4ff",
            bg="#0a1628",
            activebackground="#1a2f4a",
            activeforeground="#00ffff",
            relief="solid",
            bd=2,
            cursor="hand2",
            padx=20,
            pady=10,
            command=self._select_folder,
        )
        folder_btn.pack(side="left", padx=(0, 10))

        # START_ALL button (Neon green)
        start_btn = tk.Button(
            action_frame,
            text="▶ START ALL",
            font=("Consolas", 10, "bold"),
            fg="#000000",
            bg="#00ff88",
            activebackground="#00ffaa",
            activeforeground="#000000",
            relief="solid",
            bd=2,
            cursor="hand2",
            padx=25,
            pady=10,
            command=self._start_services,
        )
        start_btn.pack(side="left", padx=(0, 10))

        # STOP_ALL button (Neon red)
        stop_btn = tk.Button(
            action_frame,
            text="■ STOP ALL",
            font=("Consolas", 10, "bold"),
            fg="#000000",
            bg="#ff0055",
            activebackground="#ff3377",
            activeforeground="#000000",
            relief="solid",
            bd=2,
            cursor="hand2",
            padx=25,
            pady=10,
            command=self._stop_services,
        )
        stop_btn.pack(side="left", padx=(0, 10))

        # Clear cache button (Neon orange)
        cache_btn = tk.Button(
            action_frame,
            text="◢ CLEAR CACHE ◣",
            font=("Consolas", 9, "bold"),
            fg="#000000",
            bg="#ffaa00",
            activebackground="#ffcc00",
            activeforeground="#000000",
            relief="solid",
            bd=2,
            cursor="hand2",
            padx=20,
            pady=10,
            command=self._clear_cache,
        )
        cache_btn.pack(side="left")

        # Service cards grid
        grid = tk.Frame(service_tab, bg="#000510")
        grid.pack(padx=20, pady=10, fill="both", expand=True)

        self.cards: Dict[str, ServiceCard] = {}
        columns = 2
        for index, service in enumerate(self.services):
            card = ServiceCard(grid, service)
            row = index // columns
            column = index % columns
            card.grid(row=row, column=column, padx=8, pady=8, sticky="nsew")
            grid.grid_columnconfigure(column, weight=1)
            grid.grid_rowconfigure(row, weight=1)
            self.cards[service.key] = card

        # Footer info for service tab (Cyberpunk style)
        service_info = tk.Label(
            service_tab,
            text="◢ ● ONLINE  ◐ DEGRADED  ○ OFFLINE • AUTO-REFRESH: 5s ◣",
            font=("Consolas", 9, "bold"),
            fg="#00d4ff",
            bg="#000510",
            pady=12,
        )
        service_info.pack(fill="x", side="bottom")

        # ==================================================================
        # Performance Monitor Tab Content
        # ==================================================================
        self._init_performance_tab(performance_tab)

        # ==================================================================
        # Backend Logs Tab Content
        # ==================================================================
        self._init_logs_tab(logs_tab)

        # ==================================================================
        # User Management Tab Content
        # ==================================================================
        self._init_user_management_tab(user_tab)

        self.root.after(200, self._drain_queue)
        self.root.after(1000, self._update_performance_charts)
        self.worker = threading.Thread(target=self._poll_loop, daemon=True)
        self.worker.start()

    def _init_performance_tab(self, parent: tk.Frame) -> None:
        """실시간 성능 모니터링 탭 초기화"""
        # Header
        header_frame = tk.Frame(parent, bg="#000510")
        header_frame.pack(fill="x", padx=20, pady=15)

        title_label = tk.Label(
            header_frame,
            text="◢ SYSTEM PERFORMANCE MONITOR ◣",
            font=("Consolas", 14, "bold"),
            fg="#00ffff",
            bg="#000510",
        )
        title_label.pack(side="left")

        # Charts container
        charts_frame = tk.Frame(parent, bg="#000510")
        charts_frame.pack(fill="both", expand=True, padx=20, pady=10)

        # Top row: CPU and Memory
        top_row = tk.Frame(charts_frame, bg="#000510")
        top_row.pack(fill="both", expand=True, pady=(0, 10))

        self.cpu_chart = PerformanceChart(
            top_row,
            title="◢ CPU USAGE ◣",
            color="#00d4ff",
            unit="%",
            max_value=100.0
        )
        self.cpu_chart.pack(side="left", fill="both", expand=True, padx=(0, 10))

        self.memory_chart = PerformanceChart(
            top_row,
            title="◢ MEMORY USAGE ◣",
            color="#ff00ff",
            unit="%",
            max_value=100.0
        )
        self.memory_chart.pack(side="left", fill="both", expand=True)

        # Bottom row: Response Time and Network
        bottom_row = tk.Frame(charts_frame, bg="#000510")
        bottom_row.pack(fill="both", expand=True)

        self.response_time_chart = PerformanceChart(
            bottom_row,
            title="◢ AVG RESPONSE TIME ◣",
            color="#00ff88",
            unit="ms",
            max_value=1000.0
        )
        self.response_time_chart.pack(side="left", fill="both", expand=True, padx=(0, 10))

        self.disk_chart = PerformanceChart(
            bottom_row,
            title="◢ DISK USAGE ◣",
            color="#ffaa00",
            unit="%",
            max_value=100.0
        )
        self.disk_chart.pack(side="left", fill="both", expand=True)

        # Info labels
        info_frame = tk.Frame(parent, bg="#000510")
        info_frame.pack(fill="x", padx=20, pady=15)

        self.system_info_label = tk.Label(
            info_frame,
            text="◢ INITIALIZING SYSTEM MONITOR... ◣",
            font=("Consolas", 9, "bold"),
            fg="#00d4ff",
            bg="#000510",
        )
        self.system_info_label.pack()

        # Bind configure event to redraw charts on resize
        self.cpu_chart.bind("<Configure>", lambda e: self.cpu_chart.draw_chart())
        self.memory_chart.bind("<Configure>", lambda e: self.memory_chart.draw_chart())
        self.response_time_chart.bind("<Configure>", lambda e: self.response_time_chart.draw_chart())
        self.disk_chart.bind("<Configure>", lambda e: self.disk_chart.draw_chart())

    def _update_performance_charts(self) -> None:
        """Update performance charts with new data"""
        try:
            # Get CPU and Memory usage
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            memory_percent = memory.percent

            # Get disk usage
            disk = psutil.disk_usage('/')
            disk_percent = disk.percent

            # Calculate average response time from recent service checks
            avg_response_time = 0.0
            response_count = 0
            for card in self.cards.values():
                status_text = card.status_label.cget("text")
                if "ms" in status_text:
                    try:
                        ms_value = float(status_text.split("·")[1].strip().replace("ms", ""))
                        avg_response_time += ms_value
                        response_count += 1
                    except:
                        pass

            if response_count > 0:
                avg_response_time /= response_count

            # Update charts
            self.cpu_chart.add_data(cpu_percent)
            self.memory_chart.add_data(memory_percent)
            self.response_time_chart.add_data(avg_response_time)
            self.disk_chart.add_data(disk_percent)

            # Update system info
            self.system_info_label.config(
                text=f"CPU: {cpu_percent:.1f}% | Memory: {memory_percent:.1f}% ({memory.used // (1024**3)}GB / {memory.total // (1024**3)}GB) | Disk: {disk_percent:.1f}% | Avg Response: {avg_response_time:.0f}ms"
            )

        except Exception as e:
            pass  # Silently fail if psutil is not available

        # Schedule next update
        self.root.after(1000, self._update_performance_charts)

    def _init_logs_tab(self, parent: tk.Frame) -> None:
        """백엔드 로그 뷰어 탭 초기화"""
        # Header with controls
        header_frame = tk.Frame(parent, bg="#000510")
        header_frame.pack(fill="x", padx=20, pady=15)

        title_label = tk.Label(
            header_frame,
            text="◢ BACKEND LOGS VIEWER ◣",
            font=("Consolas", 14, "bold"),
            fg="#00ffff",
            bg="#000510",
        )
        title_label.pack(side="left")

        # Control buttons
        btn_frame = tk.Frame(header_frame, bg="#000510")
        btn_frame.pack(side="right")

        refresh_log_btn = tk.Button(
            btn_frame,
            text="◢ REFRESH ◣",
            font=("Consolas", 9, "bold"),
            fg="#000000",
            bg="#00ff88",
            activebackground="#00ffaa",
            activeforeground="#000000",
            relief="solid",
            bd=2,
            cursor="hand2",
            padx=15,
            pady=8,
            command=self._load_backend_logs,
        )
        refresh_log_btn.pack(side="left", padx=5)

        clear_log_btn = tk.Button(
            btn_frame,
            text="◢ CLEAR ◣",
            font=("Consolas", 9, "bold"),
            fg="#000000",
            bg="#ffaa00",
            activebackground="#ffcc00",
            activeforeground="#000000",
            relief="solid",
            bd=2,
            cursor="hand2",
            padx=15,
            pady=8,
            command=self._clear_log_display,
        )
        clear_log_btn.pack(side="left", padx=5)

        # Filter frame
        filter_frame = tk.Frame(parent, bg="#000510")
        filter_frame.pack(fill="x", padx=20, pady=(0, 10))

        filter_label = tk.Label(
            filter_frame,
            text="FILTER:",
            font=("Consolas", 9, "bold"),
            fg="#00d4ff",
            bg="#000510",
        )
        filter_label.pack(side="left", padx=(0, 10))

        # Filter level buttons
        self.log_filter = tk.StringVar(value="ALL")

        for level, color in [("ALL", "#00d4ff"), ("ERROR", "#ff0055"), ("WARNING", "#ffaa00"), ("INFO", "#00ff88")]:
            filter_btn = tk.Radiobutton(
                filter_frame,
                text=level,
                variable=self.log_filter,
                value=level,
                font=("Consolas", 9, "bold"),
                fg=color,
                bg="#000510",
                selectcolor="#1a2f4a",
                activebackground="#000510",
                activeforeground=color,
                command=self._filter_logs,
            )
            filter_btn.pack(side="left", padx=5)

        # Log display area
        log_frame = tk.Frame(parent, bg="#000510")
        log_frame.pack(fill="both", expand=True, padx=20, pady=(0, 20))

        # Scrollbar
        scrollbar = tk.Scrollbar(log_frame, orient="vertical")
        scrollbar.pack(side="right", fill="y")

        # Text widget for logs (terminal-like)
        self.log_text = tk.Text(
            log_frame,
            bg="#000a1a",
            fg="#00ff00",
            font=("Consolas", 9),
            wrap="word",
            yscrollcommand=scrollbar.set,
            state="disabled",
            insertbackground="#00ffff",
            selectbackground="#1a2f4a",
            selectforeground="#00ffff",
        )
        self.log_text.pack(side="left", fill="both", expand=True)
        scrollbar.config(command=self.log_text.yview)

        # Configure text tags for different log levels
        self.log_text.tag_config("ERROR", foreground="#ff0055", font=("Consolas", 9, "bold"))
        self.log_text.tag_config("WARNING", foreground="#ffaa00", font=("Consolas", 9, "bold"))
        self.log_text.tag_config("INFO", foreground="#00ff88")
        self.log_text.tag_config("DEBUG", foreground="#00d4ff")
        self.log_text.tag_config("TIMESTAMP", foreground="#8899aa")

        # Status label
        self.log_status_label = tk.Label(
            parent,
            text="◢ LOG VIEWER READY ◣",
            font=("Consolas", 9, "bold"),
            fg="#00d4ff",
            bg="#000510",
            pady=10,
        )
        self.log_status_label.pack(fill="x", side="bottom")

        # Store all logs for filtering
        self.all_logs = []

        # Initial load
        self._load_backend_logs()

    def _load_backend_logs(self) -> None:
        """백엔드 로그 파일 로드"""
        import os

        self.log_status_label.config(text="◢ LOADING LOGS... ◣")

        # Look for common log file locations
        log_paths = [
            os.path.join(self.selected_folder, "backend.log"),
            os.path.join(self.selected_folder, "logs", "backend.log"),
            os.path.join(self.selected_folder, "logs", "app.log"),
        ]

        log_content = None
        for log_path in log_paths:
            if os.path.exists(log_path):
                try:
                    with open(log_path, 'r', encoding='utf-8') as f:
                        log_content = f.readlines()
                    break
                except Exception as e:
                    continue

        if log_content:
            self.all_logs = log_content[-500:]  # Keep last 500 lines
            self._display_logs(self.all_logs)
            self.log_status_label.config(
                text=f"◢ LOADED {len(self.all_logs)} LOG ENTRIES ◣"
            )
        else:
            self.log_text.config(state="normal")
            self.log_text.delete("1.0", "end")
            self.log_text.insert("1.0", "◢ NO LOG FILES FOUND ◣\n\n")
            self.log_text.insert("end", "Checked locations:\n")
            for path in log_paths:
                self.log_text.insert("end", f"  • {path}\n")
            self.log_text.config(state="disabled")
            self.log_status_label.config(text="◢ NO LOGS FOUND ◣")

    def _display_logs(self, logs: list) -> None:
        """로그를 텍스트 위젯에 표시"""
        self.log_text.config(state="normal")
        self.log_text.delete("1.0", "end")

        for line in logs:
            # Detect log level and apply appropriate tag
            if "ERROR" in line or "Exception" in line:
                self.log_text.insert("end", line, "ERROR")
            elif "WARNING" in line or "WARN" in line:
                self.log_text.insert("end", line, "WARNING")
            elif "INFO" in line:
                self.log_text.insert("end", line, "INFO")
            elif "DEBUG" in line:
                self.log_text.insert("end", line, "DEBUG")
            else:
                self.log_text.insert("end", line)

        self.log_text.config(state="disabled")
        self.log_text.see("end")  # Scroll to bottom

    def _filter_logs(self) -> None:
        """선택된 필터에 따라 로그 필터링"""
        filter_level = self.log_filter.get()

        if filter_level == "ALL":
            self._display_logs(self.all_logs)
        else:
            filtered = [line for line in self.all_logs if filter_level in line]
            self._display_logs(filtered)
            self.log_status_label.config(
                text=f"◢ SHOWING {len(filtered)} {filter_level} ENTRIES ◣"
            )

    def _clear_log_display(self) -> None:
        """로그 디스플레이 클리어"""
        self.log_text.config(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.insert("1.0", "◢ LOG DISPLAY CLEARED ◣\n\nPress REFRESH to reload logs.\n")
        self.log_text.config(state="disabled")
        self.all_logs = []
        self.log_status_label.config(text="◢ LOG DISPLAY CLEARED ◣")

    def _select_folder(self) -> None:
        """폴더 선택 다이얼로그를 열어 프로젝트 폴더를 선택합니다."""
        from tkinter import filedialog
        import os

        folder = filedialog.askdirectory(
            title="Select Routing ML Project Folder",
            initialdir=self.selected_folder,
        )

        if folder:
            self.selected_folder = folder
            # 선택한 폴더에 START_ALL_WINDOWS.bat이 있는지 확인
            bat_file = os.path.join(folder, "START_ALL_WINDOWS.bat")
            if os.path.exists(bat_file):
                self.root.title(f"Routing ML v4 - Service Monitor [{os.path.basename(folder)}]")
            else:
                from tkinter import messagebox
                messagebox.showwarning(
                    "Warning",
                    f"START_ALL_WINDOWS.bat not found in:\n{folder}\n\nPlease select the correct project folder."
                )

    def _start_services(self) -> None:
        """선택된 폴더에서 START_ALL_WINDOWS.bat을 백그라운드로 실행합니다."""
        import os
        import subprocess

        bat_file = os.path.join(self.selected_folder, "START_ALL_WINDOWS.bat")

        if not os.path.exists(bat_file):
            from tkinter import messagebox
            messagebox.showerror(
                "Error",
                f"START_ALL_WINDOWS.bat not found in:\n{self.selected_folder}\n\nPlease select the project folder first."
            )
            return

        try:
            # CREATE_NO_WINDOW flag를 사용하여 백그라운드에서 실행
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = subprocess.SW_HIDE

            subprocess.Popen(
                ["cmd", "/c", bat_file],
                cwd=self.selected_folder,
                startupinfo=startupinfo,
                creationflags=subprocess.CREATE_NO_WINDOW,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )

            from tkinter import messagebox
            messagebox.showinfo(
                "Services Starting",
                "All services are starting in background.\n\nPlease wait a few seconds for services to become available."
            )
        except Exception as e:
            from tkinter import messagebox
            messagebox.showerror("Error", f"Failed to start services:\n{e}")

    def _stop_services(self) -> None:
        """모든 서비스를 종료합니다 (Node.js, Python 프로세스)."""
        import subprocess
        from tkinter import messagebox

        try:
            # Kill all node processes (frontend services)
            subprocess.run(
                ["taskkill", "/F", "/IM", "node.exe"],
                capture_output=True,
                text=True
            )

            # Kill all Python processes running uvicorn (backend services)
            subprocess.run(
                ["taskkill", "/F", "/FI", "IMAGENAME eq python.exe", "/FI", "WINDOWTITLE eq *uvicorn*"],
                capture_output=True,
                text=True
            )

            messagebox.showinfo(
                "Services Stopped",
                "All Node.js and Python backend services have been terminated.\n\nYou may need to close CMD windows manually."
            )
        except Exception as e:
            messagebox.showerror("Error", f"Failed to stop services:\n{e}")

    def _clear_cache(self) -> None:
        """Vite 캐시 및 node_modules/.vite 폴더를 삭제합니다."""
        import os
        import shutil
        from tkinter import messagebox

        folders_to_check = [
            "frontend-home",
            "frontend-prediction",
            "frontend-training"
        ]

        deleted_count = 0
        errors = []

        for folder_name in folders_to_check:
            folder_path = os.path.join(self.selected_folder, folder_name)

            if not os.path.exists(folder_path):
                continue

            # Clear node_modules/.vite
            vite_cache = os.path.join(folder_path, "node_modules", ".vite")
            if os.path.exists(vite_cache):
                try:
                    shutil.rmtree(vite_cache)
                    deleted_count += 1
                except Exception as e:
                    errors.append(f"{folder_name}: {e}")

            # Clear .vite directory (if it exists at project root)
            vite_dir = os.path.join(folder_path, ".vite")
            if os.path.exists(vite_dir):
                try:
                    shutil.rmtree(vite_dir)
                    deleted_count += 1
                except Exception as e:
                    errors.append(f"{folder_name}/.vite: {e}")

        if errors:
            messagebox.showwarning(
                "Cache Cleared with Errors",
                f"Cleared {deleted_count} cache folder(s).\n\nErrors:\n" + "\n".join(errors)
            )
        elif deleted_count > 0:
            messagebox.showinfo(
                "Cache Cleared",
                f"Successfully cleared {deleted_count} Vite cache folder(s).\n\nRestart services to apply changes."
            )
        else:
            messagebox.showinfo(
                "No Cache Found",
                "No Vite cache folders were found to delete."
            )

    def _init_user_management_tab(self, parent: tk.Frame) -> None:
        """회원 관리 탭 초기화 (Cyberpunk style)"""
        # Top controls
        control_frame = tk.Frame(parent, bg="#000510")
        control_frame.pack(fill="x", padx=20, pady=15)

        # Refresh button (Cyberpunk style)
        refresh_btn = tk.Button(
            control_frame,
            text="◢ 새로고침 ◣",
            font=("Consolas", 10, "bold"),
            fg="#000000",
            bg="#00ff88",
            activebackground="#00ffaa",
            activeforeground="#000000",
            relief="solid",
            bd=2,
            cursor="hand2",
            padx=20,
            pady=10,
            command=self._load_pending_users,
        )
        refresh_btn.pack(side="left")

        # Status label
        self.user_status_label = tk.Label(
            control_frame,
            text="◢ 대기 중인 회원을 불러오는 중... ◣",
            font=("Consolas", 9, "bold"),
            fg="#00d4ff",
            bg="#000510",
        )
        self.user_status_label.pack(side="left", padx=15)

        # User list frame with scrollbar
        list_frame = tk.Frame(parent, bg="#000510")
        list_frame.pack(fill="both", expand=True, padx=20, pady=(0, 20))

        # Scrollbar
        scrollbar = tk.Scrollbar(list_frame, orient="vertical")
        scrollbar.pack(side="right", fill="y")

        # Canvas for scrolling
        self.user_canvas = tk.Canvas(
            list_frame,
            bg="#000510",
            highlightthickness=0,
            yscrollcommand=scrollbar.set,
        )
        self.user_canvas.pack(side="left", fill="both", expand=True)
        scrollbar.config(command=self.user_canvas.yview)

        # Inner frame for user cards
        self.user_list_frame = tk.Frame(self.user_canvas, bg="#000510")
        self.canvas_window = self.user_canvas.create_window(
            (0, 0), window=self.user_list_frame, anchor="nw"
        )

        # Bind resize
        self.user_list_frame.bind("<Configure>", self._on_user_frame_configure)
        self.user_canvas.bind("<Configure>", self._on_canvas_configure)

        # Initial load
        self._load_pending_users()

    def _on_user_frame_configure(self, event=None) -> None:
        """Update scroll region when frame size changes"""
        self.user_canvas.configure(scrollregion=self.user_canvas.bbox("all"))

    def _on_canvas_configure(self, event) -> None:
        """Update canvas window width when canvas is resized"""
        self.user_canvas.itemconfig(self.canvas_window, width=event.width)

    def _load_pending_users(self) -> None:
        """대기 중인 회원 목록 로드"""
        self.user_status_label.config(text="회원 목록 로딩 중...")

        # Clear existing user cards
        for widget in self.user_list_frame.winfo_children():
            widget.destroy()

        # Fetch pending users from API
        try:
            import urllib.request
            import json

            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

            request = urllib.request.Request(
                "https://localhost:8000/api/auth/admin/pending-users",
                headers={"User-Agent": "RoutingML-Monitor/1.0"},
            )
            with urllib.request.urlopen(request, timeout=5, context=ssl_context) as response:
                data = json.loads(response.read().decode("utf-8"))
                users = data.get("users", [])
                count = data.get("count", 0)

                if count == 0:
                    self.user_status_label.config(text="대기 중인 회원이 없습니다")
                    no_user_label = tk.Label(
                        self.user_list_frame,
                        text="🎉 대기 중인 회원 가입 신청이 없습니다",
                        font=("Segoe UI", 12),
                        fg="#8b949e",
                        bg="#0d1117",
                        pady=50,
                    )
                    no_user_label.pack()
                else:
                    self.user_status_label.config(text=f"대기 중인 회원: {count}명")
                    for user in users:
                        self._create_user_card(user)

        except Exception as e:
            self.user_status_label.config(text=f"오류: {str(e)}")
            error_label = tk.Label(
                self.user_list_frame,
                text=f"⚠️ 회원 목록을 불러올 수 없습니다\n\n{str(e)}\n\n백엔드 서버가 실행 중인지 확인하세요",
                font=("Segoe UI", 10),
                fg="#f85149",
                bg="#0d1117",
                pady=30,
            )
            error_label.pack()

    def _create_user_card(self, user: dict) -> None:
        """개별 회원 카드 생성 (Cyberpunk style)"""
        card = tk.Frame(
            self.user_list_frame,
            bg="#0a1628",
            highlightbackground="#00d4ff",
            highlightthickness=2,
        )
        card.pack(fill="x", padx=10, pady=8)

        # User info frame
        info_frame = tk.Frame(card, bg="#0a1628")
        info_frame.pack(side="left", fill="both", expand=True, padx=20, pady=15)

        # Username (large, cyberpunk style)
        username_label = tk.Label(
            info_frame,
            text=f"◢ USER: {user.get('username', 'N/A').upper()} ◣",
            font=("Consolas", 13, "bold"),
            fg="#00ffff",
            bg="#0a1628",
            anchor="w",
        )
        username_label.pack(anchor="w")

        # Full name
        if user.get('full_name'):
            fullname_label = tk.Label(
                info_frame,
                text=f"NAME: {user['full_name']}",
                font=("Consolas", 9),
                fg="#00d4ff",
                bg="#0a1628",
                anchor="w",
            )
            fullname_label.pack(anchor="w", pady=(5, 0))

        # Email
        if user.get('email'):
            email_label = tk.Label(
                info_frame,
                text=f"EMAIL: {user['email']}",
                font=("Consolas", 9),
                fg="#00d4ff",
                bg="#0a1628",
                anchor="w",
            )
            email_label.pack(anchor="w", pady=(2, 0))

        # Created at
        if user.get('created_at'):
            created_label = tk.Label(
                info_frame,
                text=f"CREATED: {user['created_at'][:19].replace('T', ' ')}",
                font=("Consolas", 8),
                fg="#00aaaa",
                bg="#0a1628",
                anchor="w",
            )
            created_label.pack(anchor="w", pady=(2, 0))

        # Action buttons frame
        action_frame = tk.Frame(card, bg="#0a1628")
        action_frame.pack(side="right", padx=20, pady=15)

        # Make admin checkbox (cyberpunk style)
        admin_var = tk.BooleanVar()
        admin_check = tk.Checkbutton(
            action_frame,
            text="ADMIN",
            variable=admin_var,
            font=("Consolas", 9, "bold"),
            fg="#00d4ff",
            bg="#0a1628",
            selectcolor="#1a2f4a",
            activebackground="#0a1628",
            activeforeground="#00ffff",
        )
        admin_check.pack(side="left", padx=10)

        # Approve button with admin_var captured in lambda (neon green)
        approve_btn = tk.Button(
            action_frame,
            text="✓ 승인",
            font=("Consolas", 10, "bold"),
            fg="#000000",
            bg="#00ff88",
            activebackground="#00ffaa",
            activeforeground="#000000",
            relief="solid",
            bd=2,
            cursor="hand2",
            padx=25,
            pady=10,
            command=lambda u=user, av=admin_var: self._approve_user(u['username'], av.get()),
        )
        approve_btn.pack(side="left", padx=5)

        # Reject button (neon red)
        reject_btn = tk.Button(
            action_frame,
            text="✗ 거절",
            font=("Consolas", 10, "bold"),
            fg="#000000",
            bg="#ff0055",
            activebackground="#ff3377",
            activeforeground="#000000",
            relief="solid",
            bd=2,
            cursor="hand2",
            padx=25,
            pady=10,
            command=lambda u=user: self._reject_user(u['username']),
        )
        reject_btn.pack(side="left", padx=5)

    def _approve_user(self, username: str, make_admin: bool) -> None:
        """회원 승인"""
        from tkinter import messagebox
        import urllib.request
        import json

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

            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

            request = urllib.request.Request(
                "https://localhost:8000/api/auth/admin/approve",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "RoutingML-Monitor/1.0",
                },
                method="POST",
            )

            with urllib.request.urlopen(request, timeout=5, context=ssl_context) as response:
                result = json.loads(response.read().decode("utf-8"))
                messagebox.showinfo(
                    "승인 완료",
                    f"'{username}' 회원 승인이 완료되었습니다.\n\n{result.get('message', '')}"
                )
                self._load_pending_users()

        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            try:
                error_data = json.loads(error_body)
                error_msg = error_data.get("detail", str(e))
            except:
                error_msg = str(e)
            messagebox.showerror("승인 실패", f"회원 승인 중 오류가 발생했습니다:\n\n{error_msg}")
        except Exception as e:
            messagebox.showerror("오류", f"회원 승인 중 오류가 발생했습니다:\n\n{str(e)}")

    def _reject_user(self, username: str) -> None:
        """ȸ�� ����"""
        from tkinter import messagebox, simpledialog

        reason = simpledialog.askstring(
            "ȸ�� ����",
            f"'{username}' ȸ�� ������ �����Ͻðڽ��ϱ�?

���� ������ �Է��ϼ��� (���û���):",
        )
        if reason is None:  # User clicked cancel
            return

        try:
            import urllib.request
            import json

            payload = json.dumps({
                "username": username,
                "reason": reason if reason else "���� ����"
            }).encode("utf-8")

            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

            request = urllib.request.Request(
                "https://localhost:8000/api/auth/admin/reject",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "RoutingML-Monitor/1.0",
                },
                method="POST",
            )

            with urllib.request.urlopen(request, timeout=5, context=ssl_context) as response:
                result = json.loads(response.read().decode("utf-8"))
                messagebox.showinfo(
                    "���� �Ϸ�",
                    f"'{username}' ȸ�� ������ �����Ǿ����ϴ�.

{result.get('message', '')}"
                )
                self._load_pending_users()

        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            try:
                error_data = json.loads(error_body)
                error_msg = error_data.get("detail", str(e))
            except:
                error_msg = str(e)
            messagebox.showerror("���� ����", f"ȸ�� ���� �� ������ �߻��߽��ϴ�:

{error_msg}")
        except Exception as e:
            messagebox.showerror("����", f"ȸ�� ���� �� ������ �߻��߽��ϴ�:

{str(e)}")

def _poll_loop(self) -> None:
        while True:
            for service in self.services:
                state, message = check_service(service)
                self.queue.put((service.key, state, message))
            time.sleep(POLL_INTERVAL_SECONDS)

    def _drain_queue(self) -> None:
        try:
            while True:
                key, state, message = self.queue.get_nowait()
                card = self.cards.get(key)
                if card:
                    card.update_status(state, message)
        except Empty:
            pass
        self.root.after(200, self._drain_queue)

    def run(self) -> None:
        self.root.mainloop()


def main() -> None:
    app = MonitorApp(SERVICES)
    app.run()


if __name__ == "__main__":
    main()
