"""
Service card UI component
"""

import tkinter as tk
import webbrowser
from functools import partial

from monitor.models import Service
from monitor.config import (
    BG_TERTIARY, BG_ELEVATED,
    TEXT_PRIMARY, TEXT_SECONDARY,
    BORDER_DEFAULT,
    ACCENT_SUCCESS,
    STATUS_ONLINE, STATUS_WARNING, STATUS_OFFLINE
)
from monitor.utils import blend_color


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
