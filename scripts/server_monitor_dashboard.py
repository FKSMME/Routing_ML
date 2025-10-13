"""Tkinter dashboard that visualizes Routing ML service status."""
from __future__ import annotations

import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from queue import Empty, Queue
from typing import Dict, Tuple, List, Optional
import json

import tkinter as tk
from tkinter import ttk
import webbrowser
from functools import partial

POLL_INTERVAL_SECONDS = 5.0


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
        check_url="http://localhost:8000/api/health",
        links=(
            ("Local", "http://localhost:8000/docs"),
            ("LAN", "http://10.204.2.28:8000/docs"),
        ),
    ),
    Service(
        key="home",
        name="Home Dashboard",
        check_url="http://localhost:3000/",
        links=(
            ("Local", "http://localhost:3000"),
            ("LAN", "http://10.204.2.28:3000"),
        ),
    ),
    Service(
        key="prediction",
        name="Routing Creation UI",
        check_url="http://localhost:5173/",
        links=(
            ("Local", "http://localhost:5173"),
            ("LAN", "http://10.204.2.28:5173"),
        ),
    ),
    Service(
        key="training",
        name="Model Training UI",
        check_url="http://localhost:5174/",
        links=(
            ("Local", "http://localhost:5174"),
            ("LAN", "http://10.204.2.28:5174"),
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

    try:
        with urllib.request.urlopen(request, timeout=service.timeout) as response:
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
    """Visual card that displays status for a single service."""

    COLORS: Dict[str, str] = {
        "online": "#4caf50",
        "warning": "#ff9800",
        "offline": "#f44336",
        "checking": "#2196f3",
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
            borderwidth=0,
            relief="flat",
            padx=16,
            pady=12,
            bg="#1a1d23",
            highlightbackground="#2d3139",
            highlightthickness=1,
        )
        self.service = service

        # Title with icon
        title_frame = tk.Frame(self, bg="#1a1d23")
        title_frame.pack(anchor="w", fill="x")

        self.status_icon = tk.Label(
            title_frame,
            text="◌",
            font=("Segoe UI", 16),
            fg="#2196f3",
            bg="#1a1d23",
        )
        self.status_icon.pack(side="left", padx=(0, 8))

        self.title_label = tk.Label(
            title_frame,
            text=service.name,
            font=("Segoe UI", 12, "bold"),
            fg="#ffffff",
            bg="#1a1d23",
        )
        self.title_label.pack(side="left")

        # Status message (compact)
        self.status_label = tk.Label(
            self,
            text="Checking...",
            font=("Segoe UI", 9),
            fg="#90a4ae",
            bg="#1a1d23",
            anchor="w",
        )
        self.status_label.pack(anchor="w", pady=(6, 8))

        # Links (more compact)
        self.links_frame = tk.Frame(self, bg="#1a1d23")
        self.links_frame.pack(anchor="w", fill="x")

        for label, url in service.links:
            btn = tk.Button(
                self.links_frame,
                text=f"{label}",
                font=("Segoe UI", 9),
                fg="#90caf9",
                bg="#263238",
                activebackground="#37474f",
                activeforeground="#ffffff",
                relief="flat",
                bd=0,
                cursor="hand2",
                padx=10,
                pady=4,
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
        self.root.title("Routing ML v4 - Service Monitor")
        self.root.configure(bg="#0d1117")
        self.root.geometry("1000x650")
        self.root.resizable(False, False)

        # Header with gradient effect
        header_frame = tk.Frame(self.root, bg="#0d1117", height=60)
        header_frame.pack(fill="x", pady=(0, 10))

        header = tk.Label(
            header_frame,
            text="🚀 Routing ML Service Monitor",
            font=("Segoe UI", 18, "bold"),
            fg="#58a6ff",
            bg="#0d1117",
        )
        header.pack(pady=15)

        # Tab control
        tab_control = ttk.Notebook(self.root)

        # Service Monitor Tab
        service_tab = tk.Frame(tab_control, bg="#0d1117")
        tab_control.add(service_tab, text="서비스 모니터")

        # User Management Tab
        user_tab = tk.Frame(tab_control, bg="#0d1117")
        tab_control.add(user_tab, text="회원 관리")

        tab_control.pack(expand=1, fill="both", padx=10, pady=(0, 10))

        # Service Tab Content
        # Action buttons frame
        action_frame = tk.Frame(service_tab, bg="#0d1117")
        action_frame.pack(fill="x", padx=20, pady=(10, 10))

        # Select folder button
        folder_btn = tk.Button(
            action_frame,
            text="📁 Select Project Folder",
            font=("Segoe UI", 10),
            fg="#c9d1d9",
            bg="#21262d",
            activebackground="#30363d",
            activeforeground="#ffffff",
            relief="flat",
            bd=0,
            cursor="hand2",
            padx=20,
            pady=8,
            command=self._select_folder,
        )
        folder_btn.pack(side="left", padx=(0, 10))

        # START_ALL button
        start_btn = tk.Button(
            action_frame,
            text="▶ Start All Services",
            font=("Segoe UI", 10, "bold"),
            fg="#ffffff",
            bg="#238636",
            activebackground="#2ea043",
            activeforeground="#ffffff",
            relief="flat",
            bd=0,
            cursor="hand2",
            padx=20,
            pady=8,
            command=self._start_services,
        )
        start_btn.pack(side="left", padx=(0, 10))

        # STOP_ALL button
        stop_btn = tk.Button(
            action_frame,
            text="■ Stop All Services",
            font=("Segoe UI", 10, "bold"),
            fg="#ffffff",
            bg="#da3633",
            activebackground="#f85149",
            activeforeground="#ffffff",
            relief="flat",
            bd=0,
            cursor="hand2",
            padx=20,
            pady=8,
            command=self._stop_services,
        )
        stop_btn.pack(side="left", padx=(0, 10))

        # Clear cache button
        cache_btn = tk.Button(
            action_frame,
            text="🗑️ Clear Vite Cache",
            font=("Segoe UI", 10),
            fg="#c9d1d9",
            bg="#21262d",
            activebackground="#30363d",
            activeforeground="#ffffff",
            relief="flat",
            bd=0,
            cursor="hand2",
            padx=20,
            pady=8,
            command=self._clear_cache,
        )
        cache_btn.pack(side="left")

        # Service cards grid
        grid = tk.Frame(service_tab, bg="#0d1117")
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

        # Footer info for service tab
        service_info = tk.Label(
            service_tab,
            text="● Online  ◐ Degraded  ○ Offline  •  Refreshes every 5 seconds",
            font=("Segoe UI", 9),
            fg="#8b949e",
            bg="#0d1117",
            pady=12,
        )
        service_info.pack(fill="x", side="bottom")

        # ==================================================================
        # User Management Tab Content
        # ==================================================================
        self._init_user_management_tab(user_tab)

        self.root.after(200, self._drain_queue)
        self.worker = threading.Thread(target=self._poll_loop, daemon=True)
        self.worker.start()

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
        """선택된 폴더에서 START_ALL_WINDOWS.bat을 실행합니다."""
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
            subprocess.Popen(
                ["cmd", "/c", "start", "cmd", "/k", "START_ALL_WINDOWS.bat"],
                cwd=self.selected_folder,
                shell=True
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
        """회원 관리 탭 초기화"""
        # Top controls
        control_frame = tk.Frame(parent, bg="#0d1117")
        control_frame.pack(fill="x", padx=20, pady=15)

        # Refresh button
        refresh_btn = tk.Button(
            control_frame,
            text="🔄 새로고침",
            font=("Segoe UI", 10),
            fg="#c9d1d9",
            bg="#238636",
            activebackground="#2ea043",
            activeforeground="#ffffff",
            relief="flat",
            bd=0,
            cursor="hand2",
            padx=20,
            pady=8,
            command=self._load_pending_users,
        )
        refresh_btn.pack(side="left")

        # Status label
        self.user_status_label = tk.Label(
            control_frame,
            text="대기 중인 회원을 불러오는 중...",
            font=("Segoe UI", 9),
            fg="#8b949e",
            bg="#0d1117",
        )
        self.user_status_label.pack(side="left", padx=15)

        # User list frame with scrollbar
        list_frame = tk.Frame(parent, bg="#0d1117")
        list_frame.pack(fill="both", expand=True, padx=20, pady=(0, 20))

        # Scrollbar
        scrollbar = tk.Scrollbar(list_frame, orient="vertical")
        scrollbar.pack(side="right", fill="y")

        # Canvas for scrolling
        self.user_canvas = tk.Canvas(
            list_frame,
            bg="#0d1117",
            highlightthickness=0,
            yscrollcommand=scrollbar.set,
        )
        self.user_canvas.pack(side="left", fill="both", expand=True)
        scrollbar.config(command=self.user_canvas.yview)

        # Inner frame for user cards
        self.user_list_frame = tk.Frame(self.user_canvas, bg="#0d1117")
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

            request = urllib.request.Request(
                "http://localhost:8000/api/auth/admin/pending-users",
                headers={"User-Agent": "RoutingML-Monitor/1.0"},
            )
            with urllib.request.urlopen(request, timeout=5) as response:
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
        """개별 회원 카드 생성"""
        card = tk.Frame(
            self.user_list_frame,
            bg="#1a1d23",
            highlightbackground="#2d3139",
            highlightthickness=1,
        )
        card.pack(fill="x", padx=10, pady=8)

        # User info frame
        info_frame = tk.Frame(card, bg="#1a1d23")
        info_frame.pack(side="left", fill="both", expand=True, padx=20, pady=15)

        # Username (large)
        username_label = tk.Label(
            info_frame,
            text=f"👤 {user.get('username', 'N/A')}",
            font=("Segoe UI", 14, "bold"),
            fg="#ffffff",
            bg="#1a1d23",
            anchor="w",
        )
        username_label.pack(anchor="w")

        # Full name
        if user.get('full_name'):
            fullname_label = tk.Label(
                info_frame,
                text=f"이름: {user['full_name']}",
                font=("Segoe UI", 10),
                fg="#c9d1d9",
                bg="#1a1d23",
                anchor="w",
            )
            fullname_label.pack(anchor="w", pady=(5, 0))

        # Email
        if user.get('email'):
            email_label = tk.Label(
                info_frame,
                text=f"이메일: {user['email']}",
                font=("Segoe UI", 10),
                fg="#c9d1d9",
                bg="#1a1d23",
                anchor="w",
            )
            email_label.pack(anchor="w", pady=(2, 0))

        # Created at
        if user.get('created_at'):
            created_label = tk.Label(
                info_frame,
                text=f"신청일: {user['created_at'][:19].replace('T', ' ')}",
                font=("Segoe UI", 9),
                fg="#8b949e",
                bg="#1a1d23",
                anchor="w",
            )
            created_label.pack(anchor="w", pady=(2, 0))

        # Action buttons frame
        action_frame = tk.Frame(card, bg="#1a1d23")
        action_frame.pack(side="right", padx=20, pady=15)

        # Approve button
        approve_btn = tk.Button(
            action_frame,
            text="✓ 승인",
            font=("Segoe UI", 10, "bold"),
            fg="#ffffff",
            bg="#238636",
            activebackground="#2ea043",
            activeforeground="#ffffff",
            relief="flat",
            bd=0,
            cursor="hand2",
            padx=25,
            pady=10,
            command=lambda u=user: self._approve_user(u['username']),
        )
        approve_btn.pack(side="left", padx=5)

        # Make admin checkbox
        admin_var = tk.BooleanVar()
        admin_check = tk.Checkbutton(
            action_frame,
            text="관리자",
            variable=admin_var,
            font=("Segoe UI", 9),
            fg="#c9d1d9",
            bg="#1a1d23",
            selectcolor="#21262d",
            activebackground="#1a1d23",
            activeforeground="#ffffff",
        )
        admin_check.pack(side="left", padx=10)

        # Store admin_var in button for later access
        approve_btn.admin_var = admin_var

        # Reject button
        reject_btn = tk.Button(
            action_frame,
            text="✗ 거절",
            font=("Segoe UI", 10, "bold"),
            fg="#ffffff",
            bg="#da3633",
            activebackground="#f85149",
            activeforeground="#ffffff",
            relief="flat",
            bd=0,
            cursor="hand2",
            padx=25,
            pady=10,
            command=lambda u=user: self._reject_user(u['username']),
        )
        reject_btn.pack(side="left", padx=5)

    def _approve_user(self, username: str) -> None:
        """회원 승인"""
        from tkinter import messagebox
        import urllib.request
        import json

        # Find the approve button to get make_admin checkbox value
        make_admin = False
        for widget in self.user_list_frame.winfo_children():
            for child in widget.winfo_children():
                if isinstance(child, tk.Frame):
                    for btn in child.winfo_children():
                        if isinstance(btn, tk.Button) and hasattr(btn, 'admin_var'):
                            make_admin = btn.admin_var.get()
                            break

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
                "http://localhost:8000/api/auth/admin/approve",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "RoutingML-Monitor/1.0",
                },
                method="POST",
            )

            with urllib.request.urlopen(request, timeout=5) as response:
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
        """회원 거절"""
        from tkinter import messagebox, simpledialog

        reason = simpledialog.askstring(
            "회원 거절",
            f"'{username}' 회원 가입을 거절하시겠습니까?\n\n거절 사유를 입력하세요 (선택사항):",
        )
        if reason is None:  # User clicked cancel
            return

        try:
            import urllib.request
            import json

            payload = json.dumps({
                "username": username,
                "reason": reason if reason else "사유 없음"
            }).encode("utf-8")

            request = urllib.request.Request(
                "http://localhost:8000/api/auth/admin/reject",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "RoutingML-Monitor/1.0",
                },
                method="POST",
            )

            with urllib.request.urlopen(request, timeout=5) as response:
                result = json.loads(response.read().decode("utf-8"))
                messagebox.showinfo(
                    "거절 완료",
                    f"'{username}' 회원 가입이 거절되었습니다.\n\n{result.get('message', '')}"
                )
                self._load_pending_users()

        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            try:
                error_data = json.loads(error_body)
                error_msg = error_data.get("detail", str(e))
            except:
                error_msg = str(e)
            messagebox.showerror("거절 실패", f"회원 거절 중 오류가 발생했습니다:\n\n{error_msg}")
        except Exception as e:
            messagebox.showerror("오류", f"회원 거절 중 오류가 발생했습니다:\n\n{str(e)}")

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
