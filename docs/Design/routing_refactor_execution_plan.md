# Routing ML Refactoring Execution Plan

## 1. Scope Review & Constraints
- **Absolute directives** (PRD.md §절대 지령, Tasklist.md §절대 지령) stay in force. Every implementation stage requires prior approval, background execution, and regression review before hand-off.
- **Artifact reuse mandate** (user directive, PRD.md §C.4, Tasklist Step 1 backlog) requires us to retain existing contents of `models/<version>` (`*.joblib`, `*.json`) and introduce only lightweight manifest/registry layers to avoid duplicating or renaming assets.
- **RSL persistence goal** (PRD.md §C.1~C.3; docs/sprint/routing_enhancement_tasklist.md §Phase 2~4) reiterates that CRUD-ready workflow with drag/drop UI must operate on a database supporting pagination, search, tagging, releases, and import/export while keeping the DB as the source of truth.
- **Deployment/installer guardrails** (PRD.md §C.4, §C.5) mandate Windows packaging, trainer/predictor separation, and configuration hot-loading via `/api/workflow/graph`.

## 2. Tasklist & PRD Crosswalk
| Checklist Source | Requirement | Gap Observed During Review | Plan Alignment |
| --- | --- | --- | --- |
| Tasklist.md Step 1 | Manifest/registry refactor must reuse existing artifacts and document migration | No consolidated rollout plan covering training, prediction, and ops | Sections 3 & 4 outline manifest generation, loader adoption, registry API, and documentation |
| Tasklist.md Step 1 | RSL persistence/API spec requires implementation path | Missing DB schema ownership and CRUD sequencing | Section 5 defines schema, migrations, service layer, and endpoint sequencing |
| Tasklist.md Step 1 | State store plan demands actionable frontend breakdown | Lack of explicit component/store milestones and QA hooks | Section 6 enumerates state slices, layout rebuild, API wiring, and tests |
| docs/sprint/routing_enhancement_tasklist.md Phase 1 | Capture reusable UI tokens/components & finalize navigation labels | No tie-in between design audit and refactor backlog | Section 6.2 commits to reapplying tokens during layout rebuild and aligning nav labels |
| docs/sprint/routing_enhancement_tasklist.md Phase 2 | Implement 20/60/20 layout, ReactFlow timeline, Save panel integration | Timeline dependencies and IndexedDB sync unspecified | Section 6 details panel structure, ReactFlow integration, and persistence |
| docs/sprint/routing_enhancement_tasklist.md Phase 3 | Reference Data, Algorithm Visualization, Data Output, Learning Status, System Options updates | Backend dependencies for these menus not enumerated | Sections 5 & 7 call out API touchpoints, logging, and deployment notes for each menu |
| docs/sprint/routing_enhancement_tasklist.md Phase 4 | IndexedDB + server persistence, audit logging, ERP trigger, Docker/internal deployment doc | Need consistent backend/front linkage and release notes | Sections 5–7 integrate audit logging, ERP hooks, and documentation tasks |
| docs/sprint/routing_enhancement_tasklist.md Phase 5 | QA checklist execution, `/api/routing/groups` test, OpenAPI updates, release notes | QA gating criteria absent from refactor flow | Section 8 adds validation checklist and approval workflow |
| PRD.md §C | Predictor APIs (`/api/similar/search`, `/api/recommend/group`, `/api/time/summary`, `/api/rules/validate`) with ML + rule validation, time aggregation, ERP toggles | Current code only provides `/api/predict` and lacks manifest-aware routing | Section 4 extends PredictionService, schemas, and auditing |
| PRD.md §C.4–C.5 | Trainer/predictor separation, workflow settings hot-reload, installer packaging | Risk of manifest/registry changes breaking packaging | Section 7 ensures CLI, container, and installer updates remain compatible |

## 3. Manifest-Driven Model Loading
1. **Manifest generation hook** – Extend `backend/trainer_ml.py` and `backend/api/services/training_service.py` to emit `manifest.json` after saving the existing artifacts. Capture relative paths, SHA256 hashes, schema version flags, and optional `time_profiles.json` presence.
2. **Loader abstraction** – Introduce `common/models/manifest_loader.py` that resolves file handles based on `manifest.json`. Update `backend/api/services/prediction_service.py` and any CLI utilities to consume the manifest before touching `joblib/json` files. Preserve legacy fallback by generating a manifest for the current active directory during migration.
3. **Validation & telemetry** – Log hash mismatches via the existing audit logger and surface manifest schema version in `/api/health` so operators can detect drift before deployment.

## 4. Model Registry (SQLite → optional PostgreSQL)
1. **Schema bootstrap** – Create `backend/database/model_registry.py` with SQLAlchemy models `ModelRegistry` (version, status, created_at, notes, manifest_path, active_flag).
2. **Service utilities** – Add `backend/api/services/model_registry_service.py` to register training outputs, toggle active versions, and fetch the latest active manifest. Ensure rollbacks simply flip `active_flag`.
3. **API exposure** – Extend `backend/api/routes/training.py` (or dedicated `/api/models/registry`) to list versions, publish, and rollback. Reuse API key auth and audit logging. Update prediction service startup to resolve the active manifest via the registry.

## 5. Routing Signature Library (RSL) Persistence & APIs
1. **DB schema** – Implement SQLAlchemy models for `rsl_group`, `rsl_step`, `rsl_rule_ref` with indexes on `signature`, `tags`, `created_at`, `is_released`. Provide migrations or startup DDL for SQLite with future PostgreSQL compatibility (use Alembic migration scripts).
2. **Service layer** – New module `backend/api/services/rsl_service.py` handling CRUD, pagination, tagging, release workflow, validation (duplicate signatures, empty steps, prohibited transitions).
3. **Routes & Import/Export** – Add `backend/api/routes/rsl.py` endpoints: list/search (paginated), detail fetch, create/update with optimistic locking, release/deprecate toggles, and CSV/JSON import/export endpoints that operate through the service layer. Ensure audit logs track signature changes and release actions.

## 6. Frontend Workspace & State Store Refactor
### 6.1 State store upgrade
Rework `frontend/src/store/routingWorkspaceStore.ts` (and related slices) per `routing_state_store_plan.md`: maintain history stacks, audit buffer, runtime config bindings, and IndexedDB persistence using existing utilities.

### 6.2 Layout implementation
Recompose workspace components under `frontend/src/components/workspaces/routing/` into the documented 20/60/20 layout. Integrate ReactFlow (or existing flow lib) for horizontal timeline with drag-and-drop support and candidate cards column while reapplying shared UI tokens and finalized navigation labels.

### 6.3 RSL integration
Connect UI to new RSL APIs for list/pagination, detail editing, tagging, release status. Implement import/export modals that call backend endpoints and handle CSV/JSON downloads/uploads with optimistic updates and audit logging.

### 6.4 Time profiles & options panel
Surface z-score/trimmed-STD/sigma options tied to backend aggregator settings. Sync with runtime config updates and ensure SAVE propagates via `/api/workflow/graph` with ERP toggles intact.

### 6.5 QA hooks
Add automated Jest/Vitest component tests for store mutations and Cypress (if available) smoke flows for drag/drop and save interactions, recording logs per absolute directive 8 and feeding QA checklist artifacts.

## 7. Training/Prediction Ops & Installer Touchpoints
1. **Batch pipeline** – Update training CLI scripts under `scripts/` to generate manifests, register versions, and optionally compute `time_profiles.json` using shared aggregator utilities.
2. **Inference container** – Modify predictor startup scripts/config to fetch active manifest via registry API or direct DB connection, enabling hot-swap without redeploying binaries.
3. **Installer updates** – Refresh `deploy/installer/build_windows_installer.py` to bundle manifest files and registry migration scripts. Document new environment variable or config keys in the installer templates.
4. **Documentation** – Add migration notes to `docs/Deploy/` (follow-up task) explaining manifest creation, registry initialization, and RSL DB bootstrap for operators.

## 8. Risk & Validation Checklist
- **Backward compatibility** – Ensure legacy deployments (single active folder) receive auto-generated manifest/registry entry during first boot.
- **Performance** – Benchmark RSL queries on 20k groups within SQLite (index hints, pagination) before approving release. Plan PostgreSQL migration script if limits exceeded.
- **Audit & logging** – Confirm every new endpoint logs request metadata and changes to satisfy PRD logging requirements.
- **Approval workflow** – Each major module (manifest, registry, RSL, frontend) should produce a demo checklist and await approval before merging, honoring the absolute directives.

## 9. Next Steps
1. Circulate this plan for stakeholder approval (aligns with Tasklist Step 1 pending reviews).
2. Once approved, execute refactors in iterative branches: start with manifest/registry backend, then RSL backend, followed by frontend store/layout, and finally ops/installer updates.
3. Maintain detailed PoC/test evidence per directive 8 after each phase.
