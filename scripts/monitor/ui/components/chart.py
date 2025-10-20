"""
Performance chart UI component
"""

import tkinter as tk
from collections import deque
from monitor.config import BG_TERTIARY, BORDER_DEFAULT, PERFORMANCE_HISTORY_SIZE


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
