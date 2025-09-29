"""Synthetic demo dataset used when ``ROUTING_ML_DEMO_MODE`` is enabled."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict, Iterable, List

import pandas as pd

from backend.constants import TRAIN_FEATURES, NUMERIC_FEATURES


@dataclass(frozen=True)
class DemoRouting:
    """Simple structure describing a routing template for a demo item."""

    item_cd: str
    rout_no: str
    operations: List[Dict[str, object]]


_DEMO_BASE_ITEM: Dict[str, object] = {
    "PART_TYPE": "SHAFT",
    "PartNm": "Demo Part",
    "ITEM_SUFFIX": "A",
    "ITEM_SPEC": "SPEC-001",
    "ITEM_NM": "Demo Assembly",
    "ADDITIONAL_SPEC": "",
    "ITEM_MATERIAL": "SS400",
    "MATERIAL_DESC": "Steel",
    "ITEM_ACCT": "FG",
    "ITEM_TYPE": "FINISHED",
    "ITEM_UNIT": "EA",
    "ITEM_GRP1": "GRP-A",
    "ITEM_GRP1NM": "Group A",
    "STANDARD_YN": "Y",
    "GROUP1": "G1",
    "GROUP2": "G2",
    "GROUP3": "G3",
    "DRAW_NO": "DW-000",
    "DRAW_REV": "R0",
    "DRAW_SHEET_NO": "1",
    "DRAW_USE": "Y",
    "ITEM_NM_ENG": "Demo Assembly",
    "OUTDIAMETER": 120.0,
    "INDIAMETER": 60.0,
    "OUTTHICKNESS": 8.0,
    "OUTDIAMETER_UNIT": "MM",
    "ROTATE_CLOCKWISE": 1,
    "ROTATE_CTRCLOCKWISE": 0,
    "SealTypeGrup": "ST",
    "IN_SEALTYPE_CD": "IN-S",
    "IN_SEALSIZE": 35.0,
    "IN_SEALSIZE_UOM": "MM",
    "MID_SEALTYPE_CD": "MID-S",
    "MID_SEALSIZE": 40.0,
    "MID_SEALSIZE_UOM": "MM",
    "OUT_SEALTYPE_CD": "OUT-S",
    "OUT_SEALSIZE": 45.0,
    "OUT_SEALSIZE_UOM": "MM",
    "RAW_MATL_KIND": "STEEL",
    "RAW_MATL_KINDNM": "Carbon Steel",
}

_DEMO_ITEMS: List[Dict[str, object]] = []
for idx in range(1, 6):
    row = dict(_DEMO_BASE_ITEM)
    row["ITEM_CD"] = f"DEMO_ITEM_{idx:03d}"
    row["PART_TYPE"] = "SHAFT" if idx % 2 else "VALVE"
    row["ITEM_SPEC"] = f"SPEC-{idx:03d}"
    row["ITEM_NM"] = f"Demo Assembly {idx:03d}"
    row["ITEM_GRP1"] = "GRP-A" if idx <= 3 else "GRP-B"
    row["ITEM_GRP1NM"] = "Group A" if idx <= 3 else "Group B"
    row["OUTDIAMETER"] = 100.0 + idx * 5.0
    row["INDIAMETER"] = 50.0 + idx * 3.0
    row["OUTTHICKNESS"] = 6.0 + idx * 0.5
    row["IN_SEALSIZE"] = 30.0 + idx
    row["MID_SEALSIZE"] = 32.0 + idx
    row["OUT_SEALSIZE"] = 34.0 + idx
    _DEMO_ITEMS.append(row)

_DEMO_ITEM_MASTER = pd.DataFrame(_DEMO_ITEMS, columns=TRAIN_FEATURES)

_DEMO_ROUTINGS: Dict[str, DemoRouting] = {
    "DEMO_ITEM_001": DemoRouting(
        item_cd="DEMO_ITEM_001",
        rout_no="R1",
        operations=[
            {
                "PROC_SEQ": 10,
                "JOB_NM": "Turning",
                "RES_DIS": "CNC-01",
                "TIME_UNIT": "MIN",
                "SETUP_TIME": 12.0,
                "RUN_TIME": 45.0,
                "WAIT_TIME": 5.0,
                "MOVE_TIME": 3.0,
                "RUN_TIME_QTY": 1.0,
                "MFG_LT": 60.0,
            },
            {
                "PROC_SEQ": 20,
                "JOB_NM": "Polishing",
                "RES_DIS": "POL-02",
                "TIME_UNIT": "MIN",
                "SETUP_TIME": 6.0,
                "RUN_TIME": 25.0,
                "WAIT_TIME": 2.0,
                "MOVE_TIME": 1.5,
                "RUN_TIME_QTY": 1.0,
                "MFG_LT": 35.0,
            },
        ],
    ),
    "DEMO_ITEM_002": DemoRouting(
        item_cd="DEMO_ITEM_002",
        rout_no="R1",
        operations=[
            {
                "PROC_SEQ": 10,
                "JOB_NM": "Casting",
                "RES_DIS": "CAST-01",
                "TIME_UNIT": "MIN",
                "SETUP_TIME": 20.0,
                "RUN_TIME": 55.0,
                "WAIT_TIME": 4.0,
                "MOVE_TIME": 2.0,
                "RUN_TIME_QTY": 1.0,
                "MFG_LT": 80.0,
            }
        ],
    ),
}


def _numeric_defaults() -> Dict[str, float]:
    return {
        "SETUP_TIME": 0.0,
        "RUN_TIME": 0.0,
        "WAIT_TIME": 0.0,
        "MOVE_TIME": 0.0,
        "RUN_TIME_QTY": 0.0,
        "MFG_LT": 0.0,
        "QUEUE_TIME": 0.0,
        "ACT_SETUP_TIME": 0.0,
        "ACT_RUN_TIME": 0.0,
        "MACH_WORKED_HOURS": 0.0,
    }


def demo_item_master() -> pd.DataFrame:
    """Return a copy of the demo item master dataset."""
    return _DEMO_ITEM_MASTER.copy()


def get_demo_item(item_cd: str) -> pd.DataFrame:
    """Return a single demo item row matching ``item_cd``."""
    df = _DEMO_ITEM_MASTER[_DEMO_ITEM_MASTER["ITEM_CD"].str.upper() == item_cd.upper()]
    return df.copy()


def get_demo_routing(item_cd: str) -> pd.DataFrame:
    """Return demo routing rows for ``item_cd`` if available."""
    routing = _DEMO_ROUTINGS.get(item_cd.upper())
    if routing is None:
        return pd.DataFrame()

    rows: List[Dict[str, object]] = []
    for op in routing.operations:
        record = {
            "ITEM_CD": routing.item_cd,
            "ROUT_NO": routing.rout_no,
            "INSIDE_FLAG": "Y",
            "JOB_CD": op.get("JOB_NM", "PROC"),
            "JOB_NM": op.get("JOB_NM"),
            "RES_CD": op.get("RES_DIS"),
            "RES_DIS": op.get("RES_DIS"),
            "TIME_UNIT": op.get("TIME_UNIT", "MIN"),
        }
        record.update(_numeric_defaults())
        record.update(op)
        rows.append(record)

    df = pd.DataFrame(rows)
    numeric_cols = [col for col in df.columns if col in _numeric_defaults()]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    if "PROC_SEQ" in df.columns:
        df["PROC_SEQ"] = pd.to_numeric(df["PROC_SEQ"], errors="coerce").fillna(0).astype(int)
    return df


def list_demo_items() -> Iterable[str]:
    return _DEMO_ITEM_MASTER["ITEM_CD"].tolist()


def has_demo_routing(item_cd: str) -> bool:
    return item_cd.upper() in _DEMO_ROUTINGS


def demo_mode_enabled() -> bool:
    return os.getenv("ROUTING_ML_DEMO_MODE", "").strip().lower() in {"1", "true", "yes"}


__all__ = [
    "demo_item_master",
    "get_demo_item",
    "get_demo_routing",
    "list_demo_items",
    "has_demo_routing",
    "demo_mode_enabled",
    "NUMERIC_FEATURES",
    "TRAIN_FEATURES",
]
