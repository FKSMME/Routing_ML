import os
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.append(str(REPO_ROOT))

from backend.api.services.time_aggregator import TimeAggregator


def test_time_aggregator_totals_and_breakdown():
    aggregator = TimeAggregator()
    operations = [
        {
            "setup_time": "1.5",
            "RUN_TIME": "3",
            "queue_time": 0.4,
            "WAIT_TIME": 0,
            "MOVE_TIME": None,
            "PROC_SEQ": "1",
        },
        {
            "ACT_SETUP_TIME": 0.5,
            "ACT_RUN_TIME": "1.0",
            "QUEUE_TIME": " ",
            "IDLE_TIME": "0.2",
            "MOVE_TIME": "0.1",
            "SEQ": 2,
        },
    ]

    summary = aggregator.summarize(operations, include_breakdown=True)

    assert summary["process_count"] == 2

    totals = summary["totals"]
    assert totals["setup_time"] == pytest.approx(2.0)
    assert totals["run_time"] == pytest.approx(4.0)
    assert totals["queue_time"] == pytest.approx(0.4)
    assert totals["wait_time"] == pytest.approx(0.2)
    assert totals["move_time"] == pytest.approx(0.1)
    assert totals["lead_time"] == pytest.approx(6.7)

    breakdown = summary["breakdown"]
    assert len(breakdown) == 2

    first = breakdown[0]
    assert first["proc_seq"] == 1
    assert first["setup_time"] == pytest.approx(1.5)
    assert first["run_time"] == pytest.approx(3.0)
    assert first["queue_time"] == pytest.approx(0.4)
    assert first["wait_time"] == pytest.approx(0.0)
    assert first["move_time"] == pytest.approx(0.0)
    assert first["total_time"] == pytest.approx(4.9)

    second = breakdown[1]
    assert second["proc_seq"] == 2
    assert second["setup_time"] == pytest.approx(0.5)
    assert second["run_time"] == pytest.approx(1.0)
    assert second["queue_time"] == pytest.approx(0.0)
    assert second["wait_time"] == pytest.approx(0.2)
    assert second["move_time"] == pytest.approx(0.1)
    assert second["total_time"] == pytest.approx(1.8)


def test_time_aggregator_handles_missing_values():
    aggregator = TimeAggregator()
    operations = [
        {"RUN_TIME_QTY": "2.5", "STEP": "3", "MOVE_TIME": ""},
        {"MACH_WORKED_HOURS": None, "ORDER": 4, "WAIT_TIME": "1.5"},
    ]

    summary = aggregator.summarize(operations, include_breakdown=True)

    totals = summary["totals"]
    assert totals["setup_time"] == pytest.approx(0.0)
    assert totals["run_time"] == pytest.approx(2.5)
    assert totals["queue_time"] == pytest.approx(0.0)
    assert totals["wait_time"] == pytest.approx(1.5)
    assert totals["move_time"] == pytest.approx(0.0)
    assert totals["lead_time"] == pytest.approx(4.0)

    breakdown = summary["breakdown"]
    assert [entry["proc_seq"] for entry in breakdown] == [3, 4]
    assert breakdown[0]["run_time"] == pytest.approx(2.5)
    assert breakdown[1]["wait_time"] == pytest.approx(1.5)


def test_time_aggregator_empty_operations():
    aggregator = TimeAggregator()

    summary = aggregator.summarize([], include_breakdown=True)

    assert summary == {
        "totals": {
            "setup_time": 0.0,
            "run_time": 0.0,
            "queue_time": 0.0,
            "wait_time": 0.0,
            "move_time": 0.0,
            "lead_time": 0.0,
        },
        "process_count": 0,
        "breakdown": [],
    }
