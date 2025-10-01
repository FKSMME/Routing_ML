import asyncio
import json
import os
import sys
from pathlib import Path
from typing import List

import pandas as pd
import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

os.environ.setdefault(
    "ROUTING_ML_MODEL_DIRECTORY_OVERRIDE",
    str((Path(__file__).resolve().parents[1] / "models").resolve()),
)
os.environ.setdefault(
    "MODEL_DIRECTORY_OVERRIDE",
    str((Path(__file__).resolve().parents[1] / "models").resolve()),
)

from backend.api.config import get_settings

get_settings.cache_clear()

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()

if "faiss" not in sys.modules:
    class _DummyIndex:
        def __init__(self, d: int, m: int) -> None:
            self.hnsw = type("HNSW", (), {"efConstruction": 0, "efSearch": 0})()

        def add(self, vectors):  # pragma: no cover - stub
            return None

        def search(self, q, top_k):  # pragma: no cover - stub
            return None, None

    sys.modules["faiss"] = type(
        "faiss",
        (),
        {
            "IndexHNSWFlat": _DummyIndex,
            "normalize_L2": lambda arr: None,
        },
    )

from backend.api.schemas import (
    AuthenticatedUser,
    CandidateRouting,
    OperationStep,
    PredictionRequest,
    RoutingSummary,
    RuleValidationRequest,
    SimilarItem,
    SimilaritySearchRequest,
    SimilaritySearchResponse,
    SimilaritySearchResult,
    TimeBreakdown,
    TimeSummaryRequest,
    TimeSummaryResponse,
)
from backend.api.services.prediction_service import PredictionService, prediction_service
from models.manifest import write_manifest
from backend.api.routes import prediction as prediction_routes
from common.config_store import WorkflowConfigStore


@pytest.fixture()
def prediction_service_with_manifest(tmp_path, monkeypatch) -> PredictionService:
    service = PredictionService()
    model_dir = tmp_path / "model"
    model_dir.mkdir()
    service.settings.model_directory = model_dir
    manifest_payload = {
        "revision": "2024.03",
        "items": [
            {
                "item_code": "ITEM1",
                "groups": [{"id": "G1", "score": 0.91}],
                "similar_items": [
                    {"item_code": "SIMX", "score": 0.88, "metadata": {"family": "B"}},
                ],
            },
            {"item_code": "SIM1", "metadata": {"family": "A"}},
            {"item_code": "SIMX", "metadata": {"family": "B"}},
        ],
        "rules": [
            {
                "id": "setup-nonnegative",
                "type": "threshold",
                "field": "SETUP_TIME",
                "operator": ">=",
                "value": 0,
                "scope": "per_operation",
            },
            {
                "id": "max-ops",
                "type": "max_operations",
                "value": 1,
                "severity": "warning",
            },
        ],
    }
    (model_dir / "manifest.json").write_text(
        json.dumps(manifest_payload, ensure_ascii=False),
        encoding="utf-8",
    )

    def fake_predict(items, model_dir, top_k, miss_thr, mode):  # pragma: no cover - helper stub
        routing_df = pd.DataFrame(
            [
                {
                    "ITEM_CD": "ITEM1",
                    "CANDIDATE_ID": "ITEM1_C1",
                    "PROC_SEQ": 1,
                    "SIMILARITY_SCORE": 0.9,
                }
            ]
        )
        candidates_df = pd.DataFrame(
            [
                {"ITEM_CD": "ITEM1", "CANDIDATE_ITEM_CD": "SIM1", "SIMILARITY_SCORE": 0.95},
                {"ITEM_CD": "ITEM1", "CANDIDATE_ITEM_CD": "SIM2", "SIMILARITY_SCORE": 0.2},
            ]
        )
        return routing_df, candidates_df

    monkeypatch.setattr(
        "backend.api.services.prediction_service.predict_items_with_ml_optimized",
        fake_predict,
    )
    service._ensure_model = lambda: None  # type: ignore[assignment]
    return service


def test_similarity_search_uses_manifest_metadata(prediction_service_with_manifest):
    request = SimilaritySearchRequest(
        item_codes=["ITEM1"],
        top_k=3,
        min_similarity=0.3,
        include_manifest_metadata=True,
    )
    response = prediction_service_with_manifest.search_similar_items(request)

    assert response.metrics["total_matches"] >= 1
    assert response.results[0].manifest_revision == "2024.03"

    families = {
        match.item_code: match.metadata.get("family")
        for match in response.results[0].matches
        if match.metadata
    }
    assert families.get("SIM1") == "A"
    assert any(match.source == "manifest" for match in response.results[0].matches)


def test_time_summary_aggregates_durations():
    service = PredictionService()
    request = TimeSummaryRequest(
        item_code="ITEM1",
        operations=[
            {"PROC_SEQ": 1, "SETUP_TIME": "1.5", "MACH_WORKED_HOURS": 2.0, "QUEUE_TIME": 0.5},
            {"PROC_SEQ": 2, "SETUP_TIME": 0.5, "ACT_RUN_TIME": 1.0, "WAIT_TIME": 0.25, "MOVE_TIME": 0.1},
        ],
        include_breakdown=True,
    )

    response = service.summarize_process_times(request)

    assert response.totals["setup_time"] == pytest.approx(2.0)
    assert response.totals["run_time"] == pytest.approx(3.0)
    assert response.totals["lead_time"] == pytest.approx(
        response.totals["setup_time"]
        + response.totals["run_time"]
        + response.totals["queue_time"]
        + response.totals["wait_time"]
        + response.totals["move_time"]
    )
    assert response.breakdown is not None
    assert len(response.breakdown) == 2
    assert isinstance(response.breakdown[0], TimeBreakdown)


def test_rule_validation_detects_threshold_violation(prediction_service_with_manifest):
    request = RuleValidationRequest(
        item_code="ITEM1",
        operations=[
            {"PROC_SEQ": 1, "SETUP_TIME": -0.5},
            {"PROC_SEQ": 2, "SETUP_TIME": 0.2},
        ],
    )
    response = prediction_service_with_manifest.validate_rules(request)

    assert not response.passed
    violation_ids = {violation.rule_id for violation in response.violations}
    assert "setup-nonnegative" in violation_ids
    assert any(violation.severity == "warning" for violation in response.violations)


def test_export_predictions_reports_partial_failures(tmp_path, monkeypatch):
    service = PredictionService()
    store = WorkflowConfigStore(path=tmp_path / "workflow.json")
    export_cfg = store.get_export_config()
    export_cfg.export_directory = str(tmp_path / "exports")
    export_cfg.compress_on_save = False
    store.update_export_config(export_cfg)

    monkeypatch.setattr(
        "backend.api.services.prediction_service.workflow_config_store", store
    )
    monkeypatch.setattr("common.config_store.workflow_config_store", store)

    routings = [
        RoutingSummary(
            item_code="ITEM-001",
            candidate_id="CAND-1",
            operations=[OperationStep(proc_seq=1, job_cd="CUT", setup_time=1.0)],
        )
    ]
    candidates = [
        CandidateRouting(
            candidate_item_code="SIM-1",
            similarity_score=0.92,
            source_item_code="ITEM-001",
        )
    ]

    original_to_csv = pd.DataFrame.to_csv

    def flaky_to_csv(self, path, *args, **kwargs):
        if kwargs.get("sep") == "\t":
            raise IOError("disk full")
        return original_to_csv(self, path, *args, **kwargs)

    monkeypatch.setattr(pd.DataFrame, "to_csv", flaky_to_csv)

    exported, errors = service.export_predictions(routings, candidates, ["csv", "txt"])

    assert any(path.endswith(".csv") for path in exported)
    assert errors, "Expected JSON export failure to be reported"
    assert errors[0]["path"].endswith(".txt")
    assert "disk full" in errors[0]["error"]


@pytest.fixture()
def dummy_user():
    return AuthenticatedUser(
        username="tester",
        display_name="Tester",
        status="approved",
        is_admin=False,
        issued_at=pd.Timestamp.utcnow().to_pydatetime(),
        expires_at=pd.Timestamp.utcnow().to_pydatetime(),
        session_id="session",
        client_host="127.0.0.1",
    )


def test_similarity_endpoint_integration(dummy_user, monkeypatch):
    fake_response = SimilaritySearchResponse(
        results=[
            SimilaritySearchResult(
                item_code="ITEM1",
                matches=[
                    SimilarItem(
                        item_code="SIM1",
                        similarity_score=0.9,
                        source="prediction",
                        metadata={"family": "A"},
                    )
                ],
                manifest_revision="rev1",
            )
        ],
        metrics={"total_matches": 1},
    )
    monkeypatch.setattr(
        prediction_service,
        "search_similar_items",
        lambda request: fake_response,
    )

    request = SimilaritySearchRequest(item_codes=["ITEM1"])
    response = asyncio.run(
        prediction_routes.similarity_search(request, current_user=dummy_user)
    )

    assert response.metrics["total_matches"] == 1
    assert response.results[0].item_code == "ITEM1"


def test_predict_endpoint_includes_export_error_feedback(dummy_user, monkeypatch):
    items: List[RoutingSummary] = []
    candidates: List[CandidateRouting] = []
    metrics = {"threshold": 0.85}

    monkeypatch.setattr(
        prediction_service,
        "predict",
        lambda *args, **kwargs: (items, candidates, dict(metrics)),
    )
    monkeypatch.setattr(
        prediction_service,
        "export_predictions",
        lambda routings, preds, formats: (
            ["/tmp/routing_operations_20240101.csv"],
            [
                {
                    "path": "/tmp/routing_bundle_20240101.json",
                    "error": "IOError: disk full",
                }
            ],
        ),
    )

    request = PredictionRequest(item_codes=["ITEM1"], export_formats=["csv", "json"])
    response = asyncio.run(
        prediction_routes.predict(request, current_user=dummy_user)
    )

    assert response.metrics["exported_files"] == [
        "/tmp/routing_operations_20240101.csv"
    ]
    assert response.metrics["export_errors"][0]["path"].endswith(".json")


def test_time_summary_endpoint_integration(dummy_user, monkeypatch):
    fake_response = TimeSummaryResponse(
        item_code="ITEM1",
        totals={"lead_time": 3.2},
        process_count=2,
        breakdown=[],
    )
    monkeypatch.setattr(
        prediction_service,
        "summarize_process_times",
        lambda request: fake_response,
    )

    request = TimeSummaryRequest(item_code="ITEM1", operations=[])
    response = asyncio.run(
        prediction_routes.time_summary(request, current_user=dummy_user)
    )

    assert response.process_count == 2
    assert response.totals["lead_time"] == 3.2


def test_prediction_service_loads_time_profiles(tmp_path):
    service = PredictionService()
    model_dir = tmp_path / "model"
    model_dir.mkdir()
    service.settings.model_directory = model_dir
    service._model_reference = model_dir
    service._model_manifest = None

    for filename in (
        "similarity_engine.joblib",
        "encoder.joblib",
        "scaler.joblib",
        "feature_columns.joblib",
    ):
        (model_dir / filename).write_text("stub", encoding="utf-8")

    time_profiles_path = model_dir / "time_profiles.json"
    initial_profiles = {
        "generated_at": "2024-01-01T00:00:00Z",
        "strategy": "sigma_profile",
        "time_columns": ["SETUP_TIME"],
        "columns": {
            "SETUP_TIME": {"samples": 5, "profile": {"standard": 1.0}},
        },
        "profiles": {
            "OPT": {"SETUP_TIME": 1.2},
            "STD": {"SETUP_TIME": 1.0},
            "SAFE": {"SETUP_TIME": 1.8},
        },
        "parameters": {},
    }
    time_profiles_path.write_text(
        json.dumps(initial_profiles, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    write_manifest(model_dir, strict=False)
    service._refresh_manifest(strict=False)

    first = service.get_time_profiles()
    assert first is not None
    assert first["profiles"]["STD"]["SETUP_TIME"] == pytest.approx(1.0)

    second = service.get_time_profiles()
    assert second is not None
    assert second["profiles"]["STD"]["SETUP_TIME"] == pytest.approx(1.0)
    assert second is not first

    updated_profiles = dict(initial_profiles)
    updated_profiles["profiles"] = dict(initial_profiles["profiles"])
    updated_profiles["profiles"]["STD"] = {"SETUP_TIME": 2.5}
    time_profiles_path.write_text(
        json.dumps(updated_profiles, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.utime(time_profiles_path, None)

    third = service.get_time_profiles()
    assert third is not None
    assert third["profiles"]["STD"]["SETUP_TIME"] == pytest.approx(2.5)
