"""Run an end-to-end SQL preview validation using the prediction service."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Dict, List

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

if "faiss" not in sys.modules:  # pragma: no cover - optional dependency
    import types
    import numpy as np

    class _DummyIndex:
        def __init__(self, d: int, m: int) -> None:
            self.hnsw = types.SimpleNamespace(efConstruction=0, efSearch=0)

        def add(self, vectors: np.ndarray) -> None:
            pass

        def search(self, q: np.ndarray, top_k: int):
            return np.zeros((1, top_k), dtype=np.float32), np.zeros((1, top_k), dtype=np.int64)

    faiss_stub = types.SimpleNamespace(
        IndexHNSWFlat=_DummyIndex,
        normalize_L2=lambda arr: None,
    )
    sys.modules["faiss"] = faiss_stub

if TYPE_CHECKING:  # pragma: no cover - 타입 검사 전용
    from backend.api.services.prediction_service import PredictionService


def _load_prediction_service():
    from backend.api.services.prediction_service import PredictionService

    return PredictionService()


def _load_sql_columns() -> List[str]:
    from common.sql_schema import DEFAULT_SQL_OUTPUT_COLUMNS

    return list(DEFAULT_SQL_OUTPUT_COLUMNS)

LOG_DIR = Path("logs/sql")


def build_sample_payload() -> Dict[str, object]:
    operations: List[Dict[str, object]] = []
    for seq in range(1, 4):
        operations.append(
            {
                "ITEM_CD": "ITEM_TEST",
                "CANDIDATE_ID": "ITEM_TEST_C01",
                "PROC_SEQ": seq,
                "JOB_NM": ["CUT", "DRILL", "POLISH"][seq - 1],
                "SIMILARITY_SCORE": 0.9 - (seq - 1) * 0.01,
                "MFG_LT": 12.5,
            }
        )
    summary = {
        "ROUTING_SIGNATURE": "CUT+DRILL+POLISH",
        "SIMILARITY_SCORE": 0.91,
        "PRIORITY": "primary",
        "SIMILARITY_TIER": "HIGH",
        "REFERENCE_ITEM_CD": "REF100",
    }
    return {"summary": summary, "operations": operations}


def validate_sql_payload(service: "PredictionService") -> Dict[str, object]:
    payload = build_sample_payload()
    response = service.save_candidate("ITEM_TEST", "ITEM_TEST_C01", payload)

    schema = set(_load_sql_columns())
    invalid_columns: List[str] = []
    for row in payload["operations"]:
        invalid_columns.extend(col for col in row.keys() if col not in schema)

    result = {
        "sql_preview": response.sql_preview,
        "warnings": response.warnings,
        "invalid_columns": sorted(set(invalid_columns)),
        "candidate_store_dir": str(service.settings.candidate_store_dir),
    }
    return result


def main() -> Path:
    service = _load_prediction_service()
    result = validate_sql_payload(service)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_path = LOG_DIR / f"sql_end_to_end-{timestamp}.json"
    report_path.write_text(json.dumps({"generated_at": timestamp, **result}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(report_path)
    return report_path


if __name__ == "__main__":
    main()
