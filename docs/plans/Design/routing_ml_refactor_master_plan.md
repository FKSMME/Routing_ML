# Routing ML Refactor Master Plan

## 0. Directive Acceptance & Scope Guardrails
- We formally accept the stakeholder directives dated 2025-09-29 and will execute the refactor without disrupting the existing `models/<version>` artifact layout (`*.joblib`, `*.json`).
- Training and inference remain decoupled services. Enhancements will be implemented as additive layers (manifest, registry, runtime configs) to preserve backward compatibility and avoid sweeping rewrites.
- All activities adhere to the absolute directives from `PRD.md` and `Tasklist.md`, including staged approvals, background execution, and comprehensive logging for every step.

## 1. Architecture Summary (On-Prem / Windows / Offline)
- **Two-tier topology**: batch-oriented Training Service and multi-worker Inference Service communicate only through artifacts and the lightweight registry database to respect offline/on-prem constraints.
- **Training pipeline**: Access extraction → preprocessing → embedding generation → HNSW index build → artifact packaging under `models/<version>` → `manifest.json` emission → registry registration (inactive by default). Training metadata captures runtime dependencies for reproducibility.
- **Inference runtime**: loads the single active manifest recorded in `registry.db`, exposes prediction APIs, and supports hot-reload by switching the `active_flag` without redeploying binaries.
- **Contract surfaces**: `manifest.json` (loading contract), `registry.db` (activation contract), mapping profiles for I/O schema contracts, Blueprint graph JSON for pipeline wiring. Legacy joblib/json payloads remain untouched.

## 2. Operability & Maintainability Enhancements
### 2.1 Versioning, Deployment, Rollback
- Implement a SQLite-backed `model_registry` table with `(version TEXT, active_flag INTEGER, created_at DATETIME, notes TEXT, manifest_path TEXT)` to drive activation toggles.
- Use semantic versioning `YYYY.MM.DD_build` and persist change scopes (preprocessing, embedding params) in registry notes for quick audit.
- Record Python, scikit-learn, and joblib versions in `training_metadata.json`. Inference selects compatible loaders or warns operators when drift is detected.

### 2.2 Configuration Management
- Enforce immutable artifacts and mutable configs: models stay fixed while thresholds (`ef_search`, confidence gates, mapping overrides) live in `runtime_config.json` (inference) and `trainer_config.yaml` (training).
- Add GET/PATCH endpoints so operators adjust configs through the UI with server-side validation and audit logging of who/when/what changed.

### 2.3 Observability
- Emit structured JSON logs capturing `ts`, `request_id`, `user_id`, `active_version`, `latency_ms`, `cache_hit`, `ef_search`.
- Provide `/health` diagnostics covering model/index handles, registry connectivity, Access source status, and cache saturation.
- Ship a lightweight HTML/JS dashboard (bundled assets, no external CDN) displaying request volume, p95 latency, error rate, cache hit rate, and current active version.

## 3. User-Facing Enhancements (Incremental)
### 3.1 Authentication & Authorization
- Provide a simple admin approval workflow: signup (email/password) → pending → admin activation → login (JWT stored in HttpOnly cookie). Use Argon2id hashes and optionally restrict concurrent sessions.

### 3.2 Routing Editor with Validation
- Retain existing timeline/group UX while layering drag-and-drop editing and JSON-DSL rule checks. Violations surface via badges/toasts naming the rule ID, condition, and limits.

### 3.3 Mapping Profiles
- Allow multiple input and output mapping profiles (`Access column ↔ internal feature`, `internal output ↔ ERP column`) with exactly one active profile each.
- UI offers preview tables with NULL/type/range checks before saving. Backend enforces whitelist and mandatory-column validation.

### 3.4 Blueprint Graph Integration
- Persist ReactFlow graphs describing Predictor and Trainer pipelines (nodes for loader, encoding, embedding, HNSW, rule validation).
- Saving a graph writes JSON, regenerates code/config via templates, and triggers hot reload or controlled restart of services.

## 4. Data & Training Visualization (Offline-Friendly)
- Provide UMAP/t-SNE 2D projections (sampled) with group/tag filters and optional Top-K linkage overlays.
- Render per-process histograms/box plots showing pre/post z-score or trim transformations.
- Display feature importance (permutation/tree) alongside current editable weights.
- Surface quality metrics: adoption rate, Levenshtein distance distribution, time prediction MAPE/MAE.
- Bundle Plotly or ECharts locally for offline rendering.

## 5. Performance Optimization (Minimal Change)
### 5.1 HNSW Runtime Tuning
- Expose an `ef_search` slider with conservative/standard/aggressive presets, enabling operators to balance latency and accuracy.
- Warm the index on startup, using memory-mapped files when supported, and align Uvicorn workers to physical cores while sharing the index handle per process.

### 5.2 Preprocessing & Aggregation
- Target pandas hotspots for replacement with Polars in group-by and aggregation flows.
- Vectorize statistical profiles using NumPy/numexpr and cache `(input → embedding)` as well as time summaries (LRU 10–50k entries).

### 5.3 Access I/O
- Restrict ODBC queries to required columns, caching high-frequency lookups with version tagging.
- Bundle mandatory ODBC 32/64-bit checks in the installer, validating installation paths and permissions.
- Track SLOs: Top-K search p95 < 2s (≤50 neighbors + ≤10 group expansions), time summary p95 < 1s (200ms cache hits), cold start < 3s.

## 6. Installation & Deployment Automation
- Package Python wheels in an internal share and install via `pip --no-index --find-links`.
- Include pre-built wheels for native modules such as `hnswlib`.
- Build frontend assets offline via `npm ci --offline` and embed bundles in installer payloads.
- Use Inno Setup or WiX to install Windows services (via NSSM/WinSW), checking prerequisites (ODBC, VC++ runtime, port availability).
- Provide migration wizard relocating existing configs (`runtime_config.json`, mappings, blueprint graphs). Support silent install/uninstall while preserving logs.
- After installation, automatically ping `/health` and verify registry/manifests are readable.

## 7. Developer Experience
- Standardize API schemas with Pydantic v2 so validation, documentation, and typing remain in sync.
- Drive code generation from Blueprint saves using Jinja2 templates while safeguarding hand-written hooks.
- Enforce `.pre-commit` hooks (ruff, black, isort, pytest, compileall).
- Maintain multi-level tests: unit (preprocess, embedding, aggregation, rule validation), contract (manifest/registry/mapping profile schema), and offline E2E (sample input → prediction → persistence → DB preview).
- Publish OpenAPI docs and an operations runbook covering installation, rollback, and incident response.

## 8. Risk Register & Mitigations
| Risk | Cause | Mitigation |
| --- | --- | --- |
| Joblib incompatibility | Runtime/storage version drift | Embed version metadata, branch loaders per version, align training/inference runtimes |
| Access connection failures | Driver bitness/path issues | Installer pre-check scripts, DSN-less configs, surfaced failure logs |
| Performance regressions | Data noise or config changes | Monitor p95 metrics, use caches, permit ef_search profile switching |
| Concurrent training conflicts | Missing file locks | Apply file locks with retry + operator alerts |
| Misconfigured settings | Unvalidated edits | Server-side schema validation and rollback snapshots |
| Security vulnerabilities | Weak hashes/exposed tokens | Argon2id hashing, HttpOnly/SameSite cookies, secure env handling |

## 9. Go/No-Go Checklist
- `models/<version>` contains encoder, HNSW, weights, metadata, and matching `manifest.json`.
- `registry.db` has exactly one active version; inference loads the manifest on boot.
- Auth workflow: signup → approval → login with role-based screens.
- Routing drag-and-drop editor enforces rule badges/toasts and persists successfully.
- Mapping profile CRUD (input/output) with preview validation and server-side enforcement.
- Blueprint SAVE regenerates code/config and triggers reload without service drift.
- Performance SLOs achieved; dashboard reflects live metrics and active version.
- Installer completes unattended deployment, registers services, and `/health` passes post-install.
- Pre-commit hooks and pytest succeed; ops handbook updated with rollback playbook.

## 10. Execution Wave & Timeline
| Wave | Focus | Key Deliverables | Dependencies |
| --- | --- | --- | --- |
| Wave 0 | Registry & manifest bootstrap | Manifest generator, loader abstraction, registry schema & service | Existing models dir structure |
| Wave 1 | Config & observability upgrades | Runtime config APIs, structured logging, health check, dashboard MVP | Wave 0 manifest availability |
| Wave 2 | UI enhancements | Auth workflow, routing DnD validation, mapping profiles | Wave 1 APIs/logging |
| Wave 3 | Blueprint automation & visualizations | ReactFlow integration, codegen hooks, Plotly bundles | Wave 2 UI groundwork |
| Wave 4 | Performance & Access tuning | Polars migration, caching, ef_search presets | Wave 0 registry (for config toggles) |
| Wave 5 | Installer & DevEx | Offline installer scripts, pre-commit enforcement, E2E harness | Prior waves for packaging content |

- Each wave ends with approvals recorded in the sprint logbook and Tasklist updates enumerating remaining backlog.

## 11. Reporting & Logging Commitment
- After every discrete task, append hour-level entries to `logs/task_execution_YYYYMMDD.log` capturing directives, responses, evidence, and remaining task counts.
- Maintain quantitative tracking of outstanding work items, updating Tasklist summaries and daily sprint logbook entries per `docs/sprint/logbook_spec.md`.
