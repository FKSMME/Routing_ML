"""Workflow SAVE validation by exercising the configuration store directly."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, Type

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

if TYPE_CHECKING:  # pragma: no cover - 타입 검사 전용
    from common.config_store import WorkflowGraphConfig


def _load_workflow_store():
    from common.config_store import workflow_config_store

    return workflow_config_store


def _load_workflow_config() -> Type["WorkflowGraphConfig"]:
    from common.config_store import WorkflowGraphConfig

    return WorkflowGraphConfig

LOG_DIR = Path("logs/workflow")


def run_validation() -> Dict[str, Any]:
    store = _load_workflow_store()
    config_cls = _load_workflow_config()
    before = store.load()
    graph = config_cls(
        nodes=[
            {"id": "source", "label": "Data Source", "type": "start"},
            {"id": "trainer", "label": "Train Model", "type": "process"},
        ],
        edges=[{"id": "e1", "source": "source", "target": "trainer"}],
        design_refs=["main/1.jpg"],
    )
    updated = store.update_graph(graph)
    after = store.load()

    last_saved = updated["graph"].get("last_saved")
    assert last_saved, "Graph did not record last_saved timestamp"
    assert len(updated["graph"]["nodes"]) == 2

    return {
        "before_snapshot": before,
        "after_snapshot": after,
        "updated": updated,
    }


def main() -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    result = run_validation()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_path = LOG_DIR / f"workflow_save-{timestamp}.json"
    report_path.write_text(json.dumps({"generated_at": timestamp, **result}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(report_path)
    return report_path


if __name__ == "__main__":
    main()
