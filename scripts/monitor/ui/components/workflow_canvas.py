"""
Workflow canvas UI component
"""

import tkinter as tk
from monitor.config import (
    BG_PRIMARY, TEXT_PRIMARY, TEXT_TERTIARY, BORDER_DEFAULT, BORDER_EMPHASIS,
    NODE_DEFAULT, NODE_ACTIVE, NODE_ENABLED, NODE_DISABLED
)


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
                        cursor = "hand2" if enabled else "arrow"
                        self.itemconfig(node["rect"], cursor=cursor)
                        self.itemconfig(node["text"], cursor=cursor)
                        break
                break
