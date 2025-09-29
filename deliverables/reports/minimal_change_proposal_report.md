# Minimal-Change Performance Proposal Dossier

## 1. Purpose
- Capture the "Minimal-Change Edition" performance improvement proposal exactly as requested, without altering the existing UI/API contract or file layout.
- Provide an authoritative AS-IS versus TO-BE comparison that highlights where the repository already satisfies the proposal and where gaps remain.
- Maintain an auditable activity log that ties user directives, Codex (assistant) responses, and task execution together on an hourly timeline, including remaining task counts after each milestone.
- Record verification steps and test outcomes.

## 2. Proposal Breakdown (Documented Specification)
The original proposal supplied by the user is decomposed below for traceability. Each numbered clause mirrors the supplied text while reformatting for clarity.

### 0. 목표 (Objectives)
1. Keep the existing UI/API behaviour intact (drag-and-drop interactions, menus, and visual design remain unchanged) while improving internal performance and stability.
2. Split training and prediction into two on-prem Windows services. End users interact only with the prediction service.
3. Reuse existing model artifacts under `models/` without renaming paths or files.
4. Introduce administrator-approved authentication: users register with email + password, then require admin approval before login is allowed.
5. Allow operators to flexibly edit data mappings and processing workflows in the UI (graphical "blueprinter").

### 1. 아키텍처 보강 (Architecture Reinforcement)
- Add a lightweight manifest `models/<version>/manifest.json` describing the artifacts while leaving legacy files untouched.
- Maintain a lightweight SQLite registry that tracks the single active version and rollback history.
- Prediction service loads the manifest declared by the registry during startup to fetch the required joblib/JSON files.
- Include reference manifest snippet showing `encoder`, `index`, `weights`, `meta`, and optional `time` artifact paths.
- Guard against scikit-learn/joblib compatibility issues by storing training-time library versions in `training_metadata.json` and selecting matching runtime environments or providing compatibility loaders.

### 2. 예측 성능 개선 (Serving Optimisations)
1. Tune HNSW/ANN index performance:
   - Memory-map the index if possible and warm caches at boot.
   - Expose `ef_search` as a runtime knob controlled by an operator UI slider to balance latency and recall.
   - Run `uvicorn --workers=<physical cores>` while sharing read-only handles.
2. Feature transformation caching:
   - Load `encoder.joblib` once per process (singleton).
   - Add an input-hash keyed LRU cache (1–50k entries) for transformed vectors.
3. Statistical aggregation optimisation:
   - Replace pandas groupby bottlenecks with Polars (columnar) pipelines.
   - Implement Z-score/Trim-Std/σ profiles using NumPy vectorisation and multi-core aggregation.
4. Reduce I/O:
   - Limit Access queries to required columns only.
   - Cache frequently accessed tables with version tags, refreshing after training/batch updates.

### 3. 학습 분리 (Training Separation)
- Execute training via Windows Scheduler (quarterly/monthly) calling `train_build_index.py --save-dir models/<ver>`.
- Produce artifacts using existing structure plus the new manifest.
- Employ file locking to prevent concurrent training runs.
- Support offline dependency installation via a shared wheelhouse and `pip --no-index`.

### 4. 인증 및 권한 (Authentication and Authorisation)
- `/auth/register` captures pending registrations; `/admin/approve` must activate accounts before login.
- Use Argon2id for password hashing.
- Manage sessions via JWT stored in HttpOnly, SameSite=Lax cookies.
- Support `admin` and `user` roles; confined to intranet so SMTP is unnecessary.

### 5. 데이터 유연성 (Data Flexibility)
1. Column/feature mapping UI:
   - Maintain multiple saved profiles mapping Access columns to internal feature names, one active at a time.
   - Provide output mapping profiles with preview and validation for null/type/range checks prior to saving.
2. Graphic blueprinter:
   - Use ReactFlow nodes/edges to represent loader → encoder → weights → embedding → index/storage chains.
   - Persisted JSON updates server configuration; code stubs/wrappers refresh automatically so operators adjust options via UI only.

### 6. 운영 및 배포 (Operations and Deployment)
- Run prediction service via `uvicorn app:app --workers=N`, registered as a Windows service (NSSM/WinSW).
- Trigger training via scheduled Python scripts.
- Serve static frontend via IIS or Caddy with `/api/*` reverse proxy.
- Implement structured JSON logging with rotation, recording `request_id` and model version per request.
- Expose `/health` endpoint verifying model load, index handle, and DB connectivity.
- Enforce pre-commit quality hooks (ruff, black, pytest, compileall).
- Support zero-downtime rollback by flipping the active registry version and hot-reloading the prediction service.

### 7. 예상 이슈 및 대응 (Risk Register)
- Joblib incompatibility: detect via `training_metadata.json` and align runtime versions.
- Access/ODBC bitness/driver failures: provide diagnostic scripts and DSN-less connections with detailed logs.
- Large aggregation bottlenecks: apply Polars/NumPy, multi-workers, and caching.
- Concurrent training collisions: enforce single instance via file locks.
- Configuration drift: force runtime reload after `/workflow` PATCH and cover with integration tests.
- Credential leakage: rely on `.env`, Argon2id, and JWT cookies.

### 8. 점검 스크립트 (Checklist Script)
- Provide PowerShell script enumerating each version directory in `models/`, ensuring required artifacts exist, and emitting a manifest JSON per version without renaming original files.

### 9. 측정 기준 (KPIs)
- ANN Top-K (≤50) with group expansion (≤10): p95 latency < 2 s.
- Standard time summaries: p95 < 1 s (200 ms on cache hits).
- API cold start (first request after boot): < 3 s (single model load).
- Operations dashboard displays model version, latency, cache hit rate, and error rate.

### 10. 실행 순서 (Deployment Playbook)
1. Generate manifests with the provided script while keeping existing artifacts untouched.
2. Add SQLite registry with a single active version flag.
3. Modify prediction service to load via registry → manifest indirection.
4. Optionally enable Polars/NumPy, multi-worker tuning, and caches; measure p95 targets.
5. Connect authentication, mapping UI, and blueprinter.
6. Separate training service (scheduled execution) with file locking.
7. Document rollback, training/deployment handbook, and troubleshooting guides.

## 3. AS-IS vs TO-BE Comparison
The table summarises current repository status (AS-IS), desired end state (TO-BE per proposal), and notes gaps.

| Area | AS-IS Implementation | TO-BE Requirement | Gap Assessment |
| --- | --- | --- | --- |
| Model manifests & registry | `models/manifest.py` defines manifest schema including optional `time_profiles.json`, while `backend/maintenance/model_registry.py` and `scripts/train_build_index.py` manage activation, matching the proposal’s manifest/registry requirement.【F:models/manifest.py†L1-L118】【F:backend/maintenance/model_registry.py†L1-L139】【F:scripts/train_build_index.py†L1-L199】 | Maintain manifest per version, registry-controlled activation, zero-downtime rollbacks. | **Satisfied** – implementation aligns with specification. |
| Prediction caching | `backend/predictor_ml.py` loads models once, memoises encoder outputs via `LRUCache`, and exposes cache tuning hooks, fulfilling singleton and input caching goals.【F:backend/predictor_ml.py†L1-L210】【F:backend/predictor_ml.py†L646-L700】 | Singleton encoder loading and hashed input LRU cache. | **Satisfied**. |
| Training metadata compatibility | Prediction service compares runtime vs recorded versions before loading artifacts, enforcing joblib compatibility checks.【F:backend/api/services/prediction_service.py†L320-L520】 | Store training-time library versions and prefer matching runtimes. | **Satisfied**. |
| Authentication workflow | Auth router implements register/login/logout plus admin approve/reject, issuing HttpOnly SameSite=Lax JWT cookies; Argon2id hashing enforced in `auth_service` with approval gate.【F:backend/api/routes/auth.py†L1-L134】【F:backend/api/services/auth_service.py†L1-L200】 | Admin-approved registration, Argon2id, JWT cookies, roles. | **Satisfied**. |
| Data access minimisation | Database layer selects explicit columns and caches frequently used datasets with version tags.【F:backend/database.py†L24-L120】【F:backend/database.py†L300-L720】 | Limit queries to necessary columns and cache with version tags. | **Satisfied**. |
| HNSW runtime tuning | Runtime config lacks `ef_search`; `index_hnsw.py` sets efSearch once at load with no API/UI control.【F:common/config_store.py†L39-L82】【F:backend/index_hnsw.py†L17-L61】 | Operator-adjustable `ef_search` slider controlling runtime searches. | **Gap** – needs config, API, and UI wiring. |
| Time aggregation engine | Prediction service instantiates a legacy per-row `TimeAggregator`, bypassing the Polars/NumPy implementation in `time_aggregator.py`.【F:backend/api/services/prediction_service.py†L160-L335】【F:backend/api/services/time_aggregator.py†L1-L86】 | Replace pandas loops with Polars/NumPy vectorised aggregator. | **Gap** – needs integration. |
| Workflow/UI blueprinter | ReactFlow-based workflow editor persists blueprint definitions and syncs with backend stubs.【F:frontend/src/views/WorkflowBlueprintPage.vue†L1-L220】【F:backend/api/routes/workflow.py†L24-L187】 | Graphic blueprint editing controlling runtime templates. | **Satisfied**. |
| Operations & logging | Uvicorn deployment guidance, JSON logging, health checks, and registry-driven hot reloads already scripted in docs/scripts.【F:deploy/windows/uvicorn_service.md†L1-L120】【F:backend/api/routes/health.py†L1-L60】 | Windows services, logging, health-check, zero-downtime rollbacks. | **Satisfied**. |

## 4. Execution Log (UTC)
Timestamps are recorded in Coordinated Universal Time. Historical entries are reconstructed from repository history and conversation order; current-session events use real timestamps.

| Timestamp (UTC) | Event | Remaining Tasks |
| --- | --- | --- |
| 2025-09-29T02:15:00Z | User delivered the "Minimal-Change Edition" performance proposal and requested evaluation. Assistant acknowledged and produced a high-level audit summary. | 4 |
| 2025-09-29T02:20:00Z | User reiterated the proposal; assistant analysed repository gaps (authentication, caching, ef_search, etc.) in a QA response. | 4 |
| 2025-09-29T02:22:00Z | Assistant committed `deliverables/minimal_change_audit.md`, documenting compliance and gaps. | 4 |
| 2025-09-29T02:28:00Z | New directive received: document proposal, create AS-IS/TO-BE report, maintain logs, and perform testing. | 4 |
| 2025-09-29T02:34:00Z | Task 1 completed – proposal documented in Section 2. | 3 |
| 2025-09-29T02:38:00Z | Task 2 completed – AS-IS vs TO-BE table populated with citations. | 2 |
| 2025-09-29T02:42:00Z | Task 3 completed – execution log table finalised (this section). | 1 |
| 2025-09-29T02:45:00Z | Task 4 completed – ran `pytest`; recorded dependency-related import errors. | 0 |

## 5. Testing Summary
- Command: `pytest`
- Outcome: Fails during collection because `argon2`, `cachetools`, and `numexpr` are not installed in the test environment (see `ModuleNotFoundError` traces).【55e69d†L1-L53】
- Action: Documented failure in this report and will surface in final response; no code changes made to address dependencies in this iteration.

## 6. Outstanding Gaps
1. Wire `ef_search` runtime control across configuration, API, backend, and UI layers.
2. Replace the legacy per-row time aggregation within `prediction_service.py` with the vectorised Polars/NumPy implementation.
3. Install missing optional dependencies (`argon2-cffi`, `cachetools`, `numexpr`) before rerunning the full test suite.

