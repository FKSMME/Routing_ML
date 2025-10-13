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
from typing import Dict, Tuple

import tkinter as tk
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

        # Action buttons frame
        action_frame = tk.Frame(self.root, bg="#0d1117")
        action_frame.pack(fill="x", padx=20, pady=(0, 10))

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
        grid = tk.Frame(self.root, bg="#0d1117")
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

        # Footer info
        info = tk.Label(
            self.root,
            text="● Online  ◐ Degraded  ○ Offline  •  Refreshes every 5 seconds",
            font=("Segoe UI", 9),
            fg="#8b949e",
            bg="#0d1117",
            pady=12,
        )
        info.pack(fill="x", side="bottom")

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
