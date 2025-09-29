"""Sprint logbook update helper.

This utility satisfies the absolute directive that demands hour-level task
tracking by:

* Appending a markdown row to ``docs/sprint/logbook.md``.
* Writing a JSON line into ``logs/task_execution_<date>.log``.
* Reporting remaining checklist counts from ``Tasklist.md``.

The script is dependency-free to preserve the offline Windows installer
workflow.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional

RE_CHECKBOX = re.compile(r"^- \[(?P<state>[ xX])\] ")


@dataclass
class LogbookEntry:
    date: str
    stage: str
    task_id: str
    description: str
    metrics: str
    evidence: str
    approval: str
    follow_up: str
    author: Optional[str] = None
    timestamp: Optional[str] = None
    tasks_remaining: Optional[int] = None

    def to_markdown_row(self) -> str:
        return (
            f"| {self.date} | {self.stage} | {self.task_id} | {self.description} | "
            f"{self.metrics} | {self.evidence} | {self.approval} | {self.follow_up} |\n"
        )

    def to_json(self) -> Dict[str, object]:
        payload = asdict(self)
        return {key: value for key, value in payload.items() if value is not None}


def parse_metrics(pairs: List[str]) -> str:
    if not pairs:
        return ""
    normalized: List[str] = []
    for token in pairs:
        if not token:
            continue
        if "=" not in token:
            normalized.append(token.strip())
            continue
        key, value = token.split("=", 1)
        normalized.append(f"{key.strip()}={value.strip()}")
    return ", ".join(normalized)


def ensure_logbook(path: Path) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    header = "| Date | Stage / Menu | Task ID | Description | Metrics | Evidence | Approval | Follow-up |\n"
    separator = "| --- | --- | --- | --- | --- | --- | --- | --- |\n"
    path.write_text(header + separator, encoding="utf-8")


def append_logbook(entry: LogbookEntry, path: Path) -> None:
    ensure_logbook(path)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(entry.to_markdown_row())


def append_daily_log(entry: LogbookEntry, log_dir: Path) -> Path:
    log_dir.mkdir(parents=True, exist_ok=True)
    date_part = entry.date.replace("-", "")
    log_path = log_dir / f"task_execution_{date_part}.log"
    record = entry.to_json()
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    return log_path


def summarize_tasklist(tasklist_path: Path) -> Dict[str, int]:
    if not tasklist_path.exists():
        return {"pending": 0, "completed": 0}
    pending = 0
    completed = 0
    for line in tasklist_path.read_text(encoding="utf-8").splitlines():
        match = RE_CHECKBOX.match(line.strip())
        if not match:
            continue
        state = match.group("state").lower()
        if state == "x":
            completed += 1
        else:
            pending += 1
    return {"pending": pending, "completed": completed}


def build_entry(args: argparse.Namespace, counts: Dict[str, int]) -> LogbookEntry:
    today = dt.datetime.now().astimezone()
    entry_date = args.date or today.strftime("%Y-%m-%d")
    timestamp = today.strftime("%Y-%m-%dT%H:%M:%S%z")
    metrics = parse_metrics(args.metric)
    if counts:
        metrics = ", ".join(
            [token for token in [metrics, f"tasks_remaining={counts.get('pending', 0)}"] if token]
        )
    approval = args.approval or "pending"
    follow_up = args.follow_up or ""

    return LogbookEntry(
        date=entry_date,
        stage=args.stage,
        task_id=args.task_id,
        description=args.description,
        metrics=metrics,
        evidence=args.evidence or "",
        approval=approval,
        follow_up=follow_up,
        author=args.author,
        timestamp=timestamp,
        tasks_remaining=counts.get("pending") if counts else None,
    )


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Update sprint logbook and task execution logs")
    parser.add_argument("--stage", required=True, help="Stage/Menu reference from Tasklist")
    parser.add_argument("--task-id", required=True, help="Task identifier or anchor path")
    parser.add_argument("--description", required=True, help="Action summary")
    parser.add_argument("--metric", action="append", default=[], help="Metric key=value pairs")
    parser.add_argument("--evidence", help="Path to supporting artifact")
    parser.add_argument("--approval", help="Approval status")
    parser.add_argument("--follow-up", help="Next steps or blockers")
    parser.add_argument("--date", help="Override entry date (YYYY-MM-DD)")
    parser.add_argument("--author", help="Person responsible for the entry")
    parser.add_argument(
        "--logbook",
        type=Path,
        default=Path("docs/sprint/logbook.md"),
        help="Markdown logbook path",
    )
    parser.add_argument(
        "--tasklist",
        type=Path,
        default=Path("Tasklist.md"),
        help="Tasklist markdown path for counting remaining items",
    )
    parser.add_argument(
        "--log-dir",
        type=Path,
        default=Path("logs"),
        help="Directory where daily JSONL logs are written",
    )
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = create_parser()
    args = parser.parse_args(argv)

    counts = summarize_tasklist(args.tasklist)
    entry = build_entry(args, counts)

    append_logbook(entry, args.logbook)
    log_path = append_daily_log(entry, args.log_dir)

    summary = {
        "logbook": str(args.logbook),
        "daily_log": str(log_path),
        "tasks_pending": counts.get("pending", 0),
        "tasks_completed": counts.get("completed", 0),
        "timestamp": entry.timestamp,
    }
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
