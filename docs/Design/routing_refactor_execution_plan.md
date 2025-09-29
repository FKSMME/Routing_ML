# Routing ML Refactoring Execution Plan

## 1. Scope Review & Constraints
- **Absolute directives** (PRD.md §절대 지령, Tasklist.md §절대 지령) stay in force. Every implementation stage requires prior approval, background execution, and regression review before hand-off.
- **Artifact reuse mandate** (user directive, PRD.md §C.4, Tasklist Step 1 backlog): retain existing contents of `models/<version>` (`*.joblib`, `*.json`) and introduce only lightweight manifest/registry layers to avoid duplicating or renaming assets.
- **RSL persistence goal** (PRD.md §C.1~C.3): CRUD-ready workflow with drag/drop UI must operate on a database that supports pagination, search, tagging, releases, and import/export while keeping DB as the source of truth.

## 2. Targeted Task Alignment
| Source Checklist | Gap | Plan Alignment |
| --- | --- | --- |
| Tasklist Step 1 – `docs/design/routing_enhancement_plan.md` review | Need concrete implementation path for manifest, registry, and API extensions | Sections 3 & 4 map each enhancement theme to code modules and migration tasks |
| Tasklist Step 1 – `docs/backend_api_routing_groups_spec.md` review | Missing execution plan for RSL DB/API | Section 5 details schema, migration bootstrap, and API rollout |
| Tasklist Step 1 – `docs/design/routing_state_store_plan.md` review | Frontend refactor (20/60/20 layout, IndexedDB persistence) lacks actionable breakdown | Section 6 enumerates store changes, component rewrites, and QA hooks |
| PRD deployment notes (training/prediction separation, installer packaging) | Ensure manifest/registry don’t break packaging flow | Section 7 covers ops updates and installer touchpoints |

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
1. **State store upgrade** – Rework `frontend/src/store/routingWorkspaceStore.ts` (and related slices) per `routing_state_store_plan.md`: maintain history stacks, audit buffer, runtime config bindings, and IndexedDB persistence using existing utilities.
2. **Layout implementation** – Recompose workspace components under `frontend/src/components/workspaces/routing/` into the documented 20/60/20 layout. Integrate ReactFlow (or existing flow lib) for horizontal timeline with drag-and-drop support and candidate cards column.
3. **RSL integration** – Connect UI to new RSL APIs for list/pagination, detail editing, tagging, release status. Implement import/export modals that call backend endpoints and handle CSV/JSON downloads/uploads.
4. **Time profiles & options panel** – Surface z-score/trimmed-STD/sigma options tied to backend aggregator settings. Sync with runtime config updates and ensure SAVE propagates via `/api/workflow/graph`.
5. **QA hooks** – Add automated Jest/Vitest component tests for store mutations and Cypress (if available) smoke flows for drag/drop and save interactions, recording logs per absolute directive 8.

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
