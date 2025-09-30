"""Utilities for translating workflow graph nodes into code artifacts."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List

from common.config_store import WorkflowGraphConfig


@dataclass(slots=True)
class WorkflowCodeArtifact:
    """Representation of a generated workflow module."""

    node_id: str
    label: str
    path: Path

    def as_dict(self) -> dict[str, str]:
        return {
            "node_id": self.node_id,
            "label": self.label,
            "path": str(self.path),
        }


def _sanitize_filename(candidate: str) -> str:
    """Return a filesystem friendly slug derived from the given string."""

    slug = re.sub(r"[^0-9a-zA-Z]+", "_", candidate).strip("_").lower()
    return slug or "node"


def _render_module_source(node: dict, node_id: str, label: str) -> str:
    """Generate Python source code for a workflow node."""

    category = node.get("category")
    status = node.get("status")
    description = None
    settings = node.get("settings") or {}
    if isinstance(settings, dict):
        description = settings.get("description")

    doc_refs = node.get("doc_refs") or []
    metrics = node.get("metrics") or {}

    doc_refs_literal = json.dumps(doc_refs, ensure_ascii=False)
    metrics_literal = json.dumps(metrics, ensure_ascii=False)

    lines = [
        "# Auto-generated workflow node module",
        f"NODE_ID = {json.dumps(node_id, ensure_ascii=False)}",
        f"NODE_LABEL = {json.dumps(label, ensure_ascii=False)}",
        f"NODE_CATEGORY = {json.dumps(category, ensure_ascii=False)}",
        f"NODE_STATUS = {json.dumps(status, ensure_ascii=False)}",
        f"NODE_DOC_REFS = {doc_refs_literal}",
        f"NODE_METRICS = {metrics_literal}",
        f"NODE_DESCRIPTION = {json.dumps(description, ensure_ascii=False)}",
        "",
        "def describe() -> str:",
        "    \"\"\"Return a short human readable summary for the node.\"\"\"",
        "    return NODE_LABEL",
        "",
    ]
    return "\n".join(lines)


def _existing_module_paths(directory: Path) -> dict[str, Path]:
    """Return a mapping of module stem -> file path for previously generated modules."""

    return {
        path.stem: path
        for path in directory.glob("*.py")
        if path.name != "__init__.py"
    }


def _ensure_unique_filename(stem: str, used: set[str]) -> str:
    """Ensure the module filename is unique within the generation run."""

    candidate = stem
    index = 2
    while candidate in used:
        candidate = f"{stem}_{index}"
        index += 1
    used.add(candidate)
    return candidate


def generate_workflow_modules(
    graph: WorkflowGraphConfig,
    output_dir: Path,
) -> List[WorkflowCodeArtifact]:
    """Generate Python modules for each workflow node in the graph."""

    output_dir.mkdir(parents=True, exist_ok=True)
    init_file = output_dir / "__init__.py"
    init_file.touch(exist_ok=True)

    previous_modules = _existing_module_paths(output_dir)
    used_stems: set[str] = set()
    artifacts: list[WorkflowCodeArtifact] = []

    for raw_node in graph.nodes:
        node: dict[str, object]
        if isinstance(raw_node, dict):
            node = dict(raw_node)
        elif hasattr(raw_node, "dict"):
            node = dict(raw_node.dict())  # type: ignore[call-arg]
        elif hasattr(raw_node, "__dict__"):
            node = dict(raw_node.__dict__)
        else:
            continue

        node_id = str(node.get("id") or "node")
        label = str(node.get("label") or node_id)

        preferred_stem = _sanitize_filename(node_id or label)
        unique_stem = _ensure_unique_filename(preferred_stem, used_stems)
        module_path = output_dir / f"{unique_stem}.py"

        source = _render_module_source(node, node_id, label)
        module_path.write_text(source + "\n", encoding="utf-8")

        artifacts.append(WorkflowCodeArtifact(node_id=node_id, label=label, path=module_path))

        # Remove from previous modules tracking so we can clean up stale files later.
        previous_modules.pop(unique_stem, None)

    # Remove modules that are no longer associated with an active node.
    for stale_path in previous_modules.values():
        try:
            stale_path.unlink()
        except FileNotFoundError:
            pass

    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps([artifact.as_dict() for artifact in artifacts], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    return artifacts


__all__ = ["WorkflowCodeArtifact", "generate_workflow_modules"]
