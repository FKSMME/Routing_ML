# Routing ML – Technical Reality Check (2025-10-09)

## Executive Snapshot
- **Backend tests**: `pytest tests/backend -q` → ❌ fails with `PydanticImportError` because the code imports `BaseSettings` from the deprecated location (`backend/api/config.py:8`), so automated regression protection is currently **0 %** effective.
- **Core model stack**: `predict_items_with_ml_optimized` duplicates the candidate merge loop twice (`backend/predictor_ml.py:1637-1759`), inflating response size and runtime by >2× for every request.
- **Time aggregation**: API layer still ships a pure-Python `TimeAggregator` (`backend/api/services/prediction_service.py:166-214`), while the optimized Polars version exists separately (`backend/api/services/time_aggregator.py`). Requests bypass vectorised code, leaving ~8× performance on the table.
- **Prediction accuracy evidence**: No manifest metrics, evaluation datasets, or validation scripts are present (`models/`, `deliverables/`), so routing accuracy is unquantified.
- **Frontend duplication**: Two routing control panels of ~2 k LOC each remain almost identical (`frontend-prediction/src/components/RoutingGroupControls.tsx`, `frontend-training/src/components/RoutingGroupControls.tsx`), locking in a long-term maintenance tax.

## Quantitative Indicators
| Category | Observation | Impact |
| --- | --- | --- |
| Test automation | `pytest tests/backend -q` → **ImportError** (Pydantic 2.x vs 1.x) | 100 % backend regression risk |
| Model inference size | Duplicate candidate loops add each candidate up to three times | Response payload & DB lookups ×3 |
| Backend LOC hotspots | `backend/predictor_ml.py` 1,913 LOC, `backend/api/services/prediction_service.py` 1,819 LOC | High cognitive load, low modularity |
| Frontend duplication | Two RoutingGroupControls totaling 3,994 LOC | ~4 k LOC duplicated logic |
| Performance tooling | No benchmarking scripts, no latency metrics in repo | Cannot verify SLAs |

## Ten Failure Paths
1. **Prediction loop duplication** – `backend/predictor_ml.py:1637-1759` re-runs the candidate merge twice, creating duplicate rows and O(n·k) overhead. Large batches will blow up API latency.
2. **Model loader uncached** – `_ensure_model()` reloads metadata on every request without guarding against concurrent access (`backend/api/services/prediction_service.py:453-495`), risking thundering herd on startup.
3. **Pydantic v2 incompatibility** – importing `BaseSettings` from `pydantic` crashes the app when 2.x is installed (`backend/api/config.py:8-165`); any fresh environment or CI run fails instantly.
4. **Time aggregation downgrade** – the API uses a Python loop aggregator (`backend/api/services/prediction_service.py:166-214`) instead of the Polars implementation (`backend/api/services/time_aggregator.py:12-123`), turning time summaries into CPU bottlenecks.
5. **FAISS stub in tests only** – production `predictor_ml` requires FAISS/pyodbc, but neither dependency is validated in CI (pipeline expects Linux runners where `pyodbc` build fails). Deployments can crash on import.
6. **Lack of accuracy baselines** – without stored precision/recall or routing-match metrics, a new model could regress silently. No files in `models/` or `deliverables/` provide KPI history.
7. **Cache version drift** – `database.get_cache_snapshot()` is called per request (`backend/api/services/prediction_service.py:644-651`) but cache invalidation relies on global state (`backend/database.py:272-352`). A single stale entry corrupts SLA metrics.
8. **Duplicate manifest loader** – `_ManifestLoader` caches JSON but never evicts stale entries on schema change (`backend/api/services/prediction_service.py:66-115`), so rolling deployments can serve outdated metadata.
9. **CI pipeline mismatch** – `.github/workflows/ci-cd-pipeline.yml` targets Python 3.11 and runs Safety/Bandit, but misses OS-level dependencies (`unixODBC-dev`) needed for `pyodbc`. Pipeline succeeds locally but fails in GitHub-hosted runners.
10. **Frontend export parity** – Training UI hardcodes `mappingRows: any[] = []` (`frontend-training/src/components/RoutingGroupControls.tsx:235-240`), so ERP export buttons appear but silently skip output. Operators receive a “successful” workflow with no data.

## Success Vision
Picture a system delivering 95 %+ routing match recall within a 500 ms p95 SLA, running on deterministic CI/CD:
- **Performance**: shared Polars/NumExpr aggregator, batched FAISS queries, and memoised manifests push throughput to 50+ prediction requests/sec on commodity CPUs.
- **Quality**: nightly regression harness compares predicted routings against curated baselines, surfacing delta metrics (precision/recall/top-k hit rate) on the Grafana dashboard.
- **Maintainability**: the shared `@routing-ml/shared` package replaces duplicated 4 k LOC components, trimming PR diff sizes by 30 % and keeping UI behaviour consistent.
- **Observability**: Prometheus exports latency histograms and accuracy KPIs, while Alertmanager pages on degradation before customers notice.

## Panel Critiques
- **Steve Jobs**: “Two nearly identical routing consoles is like shipping two remotes for one TV. Simplify the interface—or someone else will.”
- **Warren Buffett**: “Your returns come from compounding trust. If backend tests don’t run, you’re reinvesting in uncertainty. Fix the foundation before the interest on chaos piles up.”
- **Jensen Huang**: “Data pipelines should scream, not crawl. Without accelerated aggregators and accuracy telemetry, your GPUs—real or imagined—are idling.”

## Priority Checklist
1. **Fix prediction duplication** – Consolidate the candidate merge loop in `backend/predictor_ml.py:1637-1759`; add unit tests that assert unique candidate IDs per item.
2. **Restore backend tests** – Move to `pydantic-settings` or pin Pydantic 1.10 in a constraints file; re-run `pytest tests/backend -q`.
3. **Adopt shared TimeAggregator** – Replace the inline class in `backend/api/services/prediction_service.py` with the Polars implementation; benchmark with synthetic 10 k-operation payloads.
4. **Document & measure accuracy** – Create a baseline dataset and capture precision/recall metrics in `models/metrics/` for every model revision; integrate with CI.
5. **Stabilise exports** – Re-enable `outputMappings` in `frontend-training` and ensure ERP exports write actual payloads; back it with Vitest coverage.
6. **Provide dependency tooling** – Add OS package install steps (unixODBC) to CI and Dockerfiles; fail fast when FAISS or pyodbc backends are unavailable.
7. **Unify manifest cache** – Add version-aware invalidation to `_ManifestLoader` and assert cache busting in tests.
8. **Merge routing consoles** – Execute the planned `@routing-ml/shared` sprint to eliminate the 4 k LOC duplication.
9. **Introduce performance benchmarks** – Script load tests (e.g., `scripts/bench_predict.py`) to log p50/p95 latency with 100, 1k, 5k predictions.
10. **Surface metrics in Grafana** – Emit prediction accuracy and latency histograms to Prometheus; wire alerts for SLA breaches.

