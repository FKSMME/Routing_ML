import json
import sys
import types

import numpy as np

if "faiss" not in sys.modules:
    class _DummyIndex:
        def __init__(self, d: int, m: int) -> None:
            self.hnsw = types.SimpleNamespace(efConstruction=0, efSearch=0)

        def add(self, vectors: np.ndarray) -> None:  # pragma: no cover - 단위 테스트에서 호출하지 않음
            pass

        def search(self, q: np.ndarray, top_k: int):  # pragma: no cover
            return np.zeros((1, top_k), dtype=np.float32), np.zeros((1, top_k), dtype=np.int64)

    faiss_stub = types.SimpleNamespace(
        IndexHNSWFlat=_DummyIndex,
        normalize_L2=lambda arr: None,
    )
    sys.modules["faiss"] = faiss_stub

from backend.api.services.prediction_service import PredictionService


def test_save_candidate_produces_sql_preview(tmp_path):
    service = PredictionService()
    service.settings.candidate_store_dir = tmp_path
    service.settings.sql_table_candidates = "dbo.routing_candidates"
    service.settings.sql_table_operations = "dbo.routing_candidate_operations"
    service.settings.sql_preview_row_limit = 1

    payload = {
        "summary": {
            "ROUTING_SIGNATURE": "CUT+DRILL",
            "SIMILARITY_SCORE": 0.92,
            "PRIORITY": "primary",
            "SIMILARITY_TIER": "HIGH",
            "REFERENCE_ITEM_CD": "REF01",
        },
        "operations": [
            {
                "ITEM_CD": "ITEM1",
                "CANDIDATE_ID": "ITEM1_C01",
                "PROC_SEQ": 1,
                "JOB_NM": "CUT",
                "SIMILARITY_SCORE": 0.92,
            },
            {
                "ITEM_CD": "ITEM1",
                "CANDIDATE_ID": "ITEM1_C01",
                "PROC_SEQ": 2,
                "JOB_NM": "DRILL",
                "SIMILARITY_SCORE": 0.91,
                "EXTRA_FIELD": "ignored",
            },
        ],
    }

    response = service.save_candidate("ITEM1", "ITEM1_C01", payload)

    assert len(response.sql_preview) == 2
    assert response.sql_preview[0].startswith("INSERT INTO dbo.routing_candidates")
    assert "dbo.routing_candidate_operations" in response.sql_preview[1]
    assert response.warnings
    assert any("SQL 미리보기" in warning for warning in response.warnings)

    saved_files = list(tmp_path.iterdir())
    assert saved_files
    saved_data = json.loads(saved_files[0].read_text(encoding="utf-8"))
    assert saved_data["sql_preview"] == response.sql_preview
    assert saved_data["warnings"] == response.warnings
