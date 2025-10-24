"""
Main dashboard application class
"""

import os
import csv
import json
import subprocess
import threading
import time
import urllib.parse
from pathlib import Path
from queue import Empty, Queue
from typing import Dict, List, Optional, Set, Tuple

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog
import psutil

from monitor.config import (
    __version__, __build_date__, __author__, __app_name__,
    POLL_INTERVAL_SECONDS, PERFORMANCE_HISTORY_SIZE,
    API_BASE_URL, MONITOR_ADMIN_USERNAME, MONITOR_ADMIN_PASSWORD, API_TIMEOUT,
    BG_PRIMARY, BG_SECONDARY, BG_TERTIARY, BG_ELEVATED,
    TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
    BORDER_DEFAULT, BORDER_EMPHASIS,
    ACCENT_PRIMARY, ACCENT_SECONDARY, ACCENT_SUCCESS, ACCENT_WARNING, ACCENT_ERROR,
    ACCENT_INFO, ACCENT_DANGER,
    STATUS_ONLINE, STATUS_WARNING, STATUS_OFFLINE,
    CHART_CPU, CHART_MEMORY, CHART_DISK,
    NODE_DEFAULT, NODE_ACTIVE, NODE_ENABLED, NODE_DISABLED
)
from monitor.models import Service
from monitor.api import ApiClient, ApiError
from monitor.services import check_service
from monitor.ui.components import CompactServiceCard, WorkflowCanvas, CompactChart
from monitor.utils import blend_color

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

    def _ensure_api_client(self, require_auth: bool = False) -> bool:
        """Ensure API client is available; optionally require authentication.

        Args:
            require_auth: If True, require authenticated client. If False, allow unauthenticated client.

        Returns:
            True if client is available (and authenticated if required), False otherwise.
        """
        if self.api_client is not None:
            if require_auth and not self.api_client.authenticated:
                messagebox.showwarning(
                    "인증 필요",
                    "이 기능은 관리자 인증이 필요합니다.\n"
                    "MONITOR_ADMIN_USERNAME / MONITOR_ADMIN_PASSWORD 환경 변수를 설정해 주세요.",
                )
                return False
            return True

        try:
            self.api_client = ApiClient(
                API_BASE_URL,
                MONITOR_ADMIN_USERNAME or None,
                MONITOR_ADMIN_PASSWORD or None,
                timeout=API_TIMEOUT,
            )
            if require_auth and not self.api_client.authenticated:
                messagebox.showwarning(
                    "인증 필요",
                    "이 기능은 관리자 인증이 필요합니다.\n"
                    "MONITOR_ADMIN_USERNAME / MONITOR_ADMIN_PASSWORD 환경 변수를 설정해 주세요.",
                )
                return False
        except ApiError as exc:
            self.api_client = None
            if require_auth:
                messagebox.showerror(
                    "API 인증 실패",
                    "관리자 API에 연결하지 못했습니다.\n\n"
                    f"상세: {exc}",
                )
            if hasattr(self, "user_status_label"):
                self.user_status_label.config(text=f"API 인증 실패: {exc}")
            return False
        except Exception as exc:
            self.api_client = None
            if require_auth:
                messagebox.showerror("API 초기화 오류", str(exc))
            if hasattr(self, "user_status_label"):
                self.user_status_label.config(text=f"API 초기화 오류: {exc}")
            return False

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
            text="회원 관리 기능은 관리자 인증이 필요합니다. '새로 고침' 버튼을 클릭하세요.",
            font=("Segoe UI", 10),
            fg=TEXT_SECONDARY,
            bg=BG_PRIMARY
        )
        self.user_status_label.pack(side="bottom", fill="x", padx=20, pady=16)

        # Don't auto-load on startup - wait for user to click refresh
        # This prevents authentication popup on startup
        self._show_auth_required_message()

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
            # Collect target ports from services
            target_ports = set()
            for service in self.services:
                try:
                    parsed = urllib.parse.urlparse(service.check_url)
                    if parsed.port:
                        target_ports.add(parsed.port)
                except Exception as e:
                    # Skip if URL parsing fails
                    continue

            # Add hardcoded ports
            target_ports.update({8000, 8001, 8002, 5173, 5174, 5176})

            if not target_ports:
                messagebox.showwarning("경고", "종료할 대상 포트를 찾을 수 없습니다.")
                return

            # Find processes using target ports
            active_pids = set()
            for conn in psutil.net_connections(kind="inet"):
                try:
                    if conn.laddr and conn.laddr.port in target_ports and conn.pid:
                        active_pids.add(conn.pid)
                except Exception:
                    continue

            if not active_pids:
                message = f"대상 포트({', '.join(str(p) for p in sorted(target_ports))})를 사용하는 프로세스를 찾지 못했습니다.\n\n"
                message += "서비스가 이미 중지되었거나 다른 포트를 사용 중일 수 있습니다."
                messagebox.showinfo("서버 정지", message)
                return

            # Filter allowed processes
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
                    # Add child processes
                    for child in proc.children(recursive=True):
                        if child.pid != os.getpid():
                            candidate_pids.add(child.pid)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue

            if not candidate_pids:
                message = f"대상 포트({', '.join(str(p) for p in sorted(target_ports))})를 사용하는 프로세스를 찾았으나,\n"
                message += "안전을 위해 종료할 수 없는 프로세스입니다."
                messagebox.showwarning("서버 정지", message)
                return

            # Terminate processes
            terminated = []
            failed = []
            for pid in sorted(candidate_pids):
                if pid == os.getpid():
                    continue
                try:
                    result = subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(pid)],
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    if result.returncode == 0:
                        terminated.append(pid)
                    else:
                        failed.append(pid)
                except Exception:
                    failed.append(pid)
                    continue

            # Show result
            if terminated:
                message = f"✅ {len(terminated)}개 프로세스 종료 완료\n\n"
                message += "종료된 PID: " + ", ".join(str(pid) for pid in terminated)
                if failed:
                    message += f"\n\n⚠️ 종료 실패: {', '.join(str(pid) for pid in failed)}"
                message += f"\n\n대상 포트: {', '.join(str(port) for port in sorted(target_ports))}"
                messagebox.showinfo("서버 정지 완료", message)
            else:
                message = f"❌ 모든 프로세스 종료 실패 ({len(failed)}개)\n\n"
                message += "실패한 PID: " + ", ".join(str(pid) for pid in failed)
                message += "\n\n관리자 권한으로 실행하거나 수동으로 종료해주세요."
                messagebox.showerror("서버 정지 실패", message)

        except psutil.AccessDenied:
            messagebox.showerror(
                "권한 오류",
                "프로세스 정보에 접근할 권한이 없습니다.\n\n"
                "모니터를 관리자 권한으로 실행해주세요."
            )
        except Exception as e:
            messagebox.showerror(
                "서비스 중지 실패",
                f"예상치 못한 오류가 발생했습니다:\n\n{type(e).__name__}: {str(e)}\n\n"
                f"디버그 정보:\n- 프로젝트 폴더: {self.selected_folder}"
            )

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

    def _show_auth_required_message(self):
        """Show message that authentication is required for user management"""
        for widget in self.user_list_frame.winfo_children():
            widget.destroy()

        msg_frame = tk.Frame(self.user_list_frame, bg=BG_PRIMARY)
        msg_frame.pack(fill="both", expand=True, pady=50)

        icon_label = tk.Label(
            msg_frame,
            text="🔐",
            font=("Segoe UI", 48),
            fg=TEXT_PRIMARY,
            bg=BG_PRIMARY
        )
        icon_label.pack(pady=10)

        title_label = tk.Label(
            msg_frame,
            text="관리자 인증 필요",
            font=("Segoe UI", 16, "bold"),
            fg=TEXT_PRIMARY,
            bg=BG_PRIMARY
        )
        title_label.pack(pady=5)

        info_label = tk.Label(
            msg_frame,
            text="회원 관리 기능을 사용하려면 관리자 인증이 필요합니다.\n\n"
                 "환경 변수를 설정하고 '새로 고침' 버튼을 클릭하세요:\n"
                 "MONITOR_ADMIN_USERNAME\n"
                 "MONITOR_ADMIN_PASSWORD",
            font=("Segoe UI", 11),
            fg=TEXT_SECONDARY,
            bg=BG_PRIMARY,
            justify="center"
        )
        info_label.pack(pady=10)

        note_label = tk.Label(
            msg_frame,
            text="💡 대시보드 모니터링 기능은 인증 없이 사용 가능합니다",
            font=("Segoe UI", 10),
            fg=ACCENT_INFO,
            bg=BG_PRIMARY
        )
        note_label.pack(pady=15)

    def _load_pending_users(self):
        """Load pending users - requires authentication"""
        self.user_status_label.config(text="회원 목록 로딩 중...")

        for widget in self.user_list_frame.winfo_children():
            widget.destroy()

        if not self._ensure_api_client(require_auth=True):
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
        # Extract username early and validate - prevent KeyError in button callbacks
        username = user.get('username')
        if not username:
            # Skip card creation if username is missing (malformed API response)
            return

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
            text=username,
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
            command=lambda: self._approve_user(username, admin_var.get())
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
            command=lambda: self._reject_user(username)
        )
        reject_btn.pack(side="left", padx=3)

    @staticmethod
    def _csv_value_to_bool(value: Optional[str]) -> bool:
        if value is None:
            return False
        return str(value).strip().lower() in {"1", "true", "yes", "y", "t", "on"}


    def _open_user_browser(self) -> None:
        """Open user browser - requires authentication"""
        if not self._ensure_api_client(require_auth=True):
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
        """Prompt for password reset - requires authentication"""
        if not self._ensure_api_client(require_auth=True):
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
        """Bulk register users from CSV - requires authentication"""
        if not self._ensure_api_client(require_auth=True):
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
        """Approve user - requires authentication"""
        confirm = messagebox.askyesno("회원 승인", f"'{username}' 회원을 승인하시겠습니까?")

        if not confirm:
            return
        if not self._ensure_api_client(require_auth=True):
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
        """Reject user - requires authentication"""
        reason = simpledialog.askstring("회원 거절", f"'{username}' 회원 승인을 거절하시겠습니까?\n\n거절 사유 (선택 입력):")

        if reason is None:
            return
        if not self._ensure_api_client(require_auth=True):
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
