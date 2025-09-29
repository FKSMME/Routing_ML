# On-Premises Two-Tier Routing ML Architecture

## Overview
This document summarizes the refactored on-premises deployment that preserves the existing
artifact layout while adding manifest and registry control surfaces for safer operations.
The architecture follows the operator directives captured in PRD.md and the September 2025
Tasklist.

## Execution Environment
- **Topology**: Windows-only, offline factory network with no external CDN access.
- **Services**:
  - **Training Service** (batch / scheduled) orchestrates Access extraction → preprocessing →
    embedding build → HNSW index → artifact packaging under `models/<version>`.
  - **Inference Service** (always-on / multi-worker) exposes prediction APIs and keeps zero
    downtime by hot reloading the active manifest.
- **Runtime Isolation**: Each service runs as a Windows service (WinSW/NSSM) configured by the
  installer; the scheduler triggers training jobs via `scripts/train_build_index.py` with local
  wheelhouse dependencies.

## Contract Stabilisation
| Surface | Contract | Notes |
| --- | --- | --- |
| `manifest.json` | Loader contract enumerating joblib/json assets and hashes. | Generated per training run; required before registry registration. |
| `registry.db` | Activation contract storing version metadata and active flag. | SQLite schema managed by `backend/maintenance/model_registry.py`. |
| Mapping profiles | Schema contract for Access inputs & ERP outputs. | Configured via workflow PATCH API and stored under `config/workflow.json`. |
| Blueprint graph JSON | Pipeline contract describing Trainer/Inference nodes. | Saved by UI (ReactFlow) and replayed by workflow loader at runtime. |

## Training Workflow
1. Training job reads the active workflow configuration (`workflow_config_store`).
2. Artifacts (`*.joblib`, `*.json`) are stored under `models/<version>` with no renames.
3. `models/manifest.py` emits `manifest.json` with hashes, metadata, and runtime versions.
4. The registry entry is inserted via `backend.maintenance.model_registry.register_version` with
   lifecycle state = pending.
5. Operators approve promotion by flipping the active flag through the registry service or CLI.

## Inference Workflow
1. On boot, the prediction service loads `registry.db` to find the single active version.
2. `models/manifest.read_model_manifest` validates checksums and resolves artifact paths.
3. Runtime compatibility is checked against `training_metadata.json` (python/sklearn/joblib).
4. Feature weights, mapping profiles, and runtime thresholds are fetched via the workflow config
   layer for hot updates without mutating artifacts.
5. Structured JSON logs are written with request id, latency, cache hits, and active version for
   the on-prem observability dashboard.

## Observability & Diagnostics
- `/api/health` confirms manifest availability, registry connectivity, and cache status.
- Rotating JSON logs under `logs/` capture `request_id`, `active_version`, `latency_ms`, and
  cache details suitable for the local HTML dashboard.
- Dashboards are delivered as static bundles (Plotly/ECharts) with no external dependencies.

## Installation Automation
- Installer bundles: Python wheelhouse (`pip --no-index`), prebuilt native wheels (`hnswlib`),
  offline `npm ci --offline` assets, registry migration scripts.
- Pre-flight validation: Access ODBC bitness, VC++ runtime, folder permissions, port conflicts.
- Post-install smoke test automatically calls `/api/health` and confirms manifest checksum.

## Developer Experience Enhancements
- Pydantic v2 models unify API schemas, documentation, and validation.
- Workflow SAVE emits JSON consumed by Jinja2 templates for trainer/predictor hooks.
- `.pre-commit-config.yaml` runs Ruff, Black, isort, pytest, and `python -m compileall`.
- `scripts/update_logbook.py` (added in this refactor) records task-level progress with remaining
  Tasklist counts to satisfy the absolute logging directive.

## Risk Controls
- Registry fallback ensures exactly one active version; missing entries trigger default model
  load with operator alerting.
- Joblib compatibility guard raises actionable errors when runtime major versions diverge.
- File locks prevent concurrent training runs from clobbering artifacts.
- Configuration PATCH APIs enforce whitelist validation for Access/ERP schema mappings.

## Go / No-Go Checklist
- `models/<version>` contains encoder, scaler, feature columns, similarity index, manifest.
- `registry.db` has one active version; inference boot logs confirm manifest checksum.
- Authentication flow: signup → admin approval → login (JWT HttpOnly cookies).
- Drag & drop routing editor enforces rule validation with detailed badges/toasts.
- Mapping profile CRUD and preview pass server-side validation (HTTP 400 on violations).
- Blueprint SAVE refreshes trainer/predictor configurations without process restarts.
- p95 latency targets met (Top-K ≤ 2 s, time summary ≤ 1 s, cold start ≤ 3 s).
- Windows installer supports silent mode and retains logs on uninstall.
- Pre-commit + pytest succeed; ops handbook updated with rollback & incident playbooks.

