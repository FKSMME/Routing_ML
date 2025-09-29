# Minimal-Change Performance Upgrade Audit

## Summary
- The repository already includes the manifest/registry pattern, administrator approval workflow, cached model loading, and Access query narrowing requested in the specification.
- Training is runnable as a stand-alone CLI with manifest emission and registry updates, supporting the Windows Scheduler deployment story.
- Two notable follow-ups remain: exposing HNSW `ef_search` as a runtime knob and ensuring the Polars/NumPy time aggregator replaces the legacy in-module implementation.

## Detailed Findings

### 1. Model artifact lifecycle
- `models/manifest.py` defines an extended manifest schema (including the optional `time_profiles.json`) and checksum verification, satisfying the “manifest only” augmentation requirement while leaving legacy artifact names untouched.【F:models/manifest.py†L1-L118】
- The lightweight SQLite registry records version states, active flags, and activation timestamps, matching the active-version/rollback design.【F:backend/maintenance/model_registry.py†L1-L139】
- `scripts/train_build_index.py` trains offline, writes the manifest, registers the version, and maintains a status file under a file lock, aligning with the “separate Windows service” flow.【F:scripts/train_build_index.py†L1-L199】

### 2. Serving path optimizations
- `backend/predictor_ml.py` keeps loaded models in a process-wide cache and uses an `LRUCache` keyed by normalized request payloads to memoize encoder outputs, meeting the singleton loader and input caching objectives.【F:backend/predictor_ml.py†L63-L156】【F:backend/predictor_ml.py†L646-L700】
- The prediction service validates training metadata, compares runtime library versions, and selects the appropriate loader strategy before admitting a model, covering the joblib compatibility safeguard.【F:backend/api/services/prediction_service.py†L320-L520】

### 3. Data acquisition controls
- Access queries rely on curated column lists rather than `SELECT *`, and fetch helpers route through caching layers with version tags and hit/miss telemetry, in line with the I/O reduction guidance.【F:backend/database.py†L24-L120】【F:backend/database.py†L300-L720】

### 4. Authentication and approval
- The FastAPI auth router exposes registration, login, logout, and admin approval endpoints and sets HttpOnly SameSite=Lax JWT cookies on login.【F:backend/api/routes/auth.py†L1-L134】
- `AuthService` stores Argon2id hashes, enforces the approval gate, and issues JWTs via the dedicated session manager; `session_manager.py` creates/verifies signed tokens with TTL controls, fulfilling the security requirements.【F:backend/api/services/auth_service.py†L1-L200】【F:backend/api/session_manager.py†L1-L80】

### 5. Training metadata completeness
- The trainer writes `training_metadata.json` with runtime package versions and workflow settings, preserving the information needed for rollback compatibility decisions.【F:backend/trainer_ml.py†L66-L120】【F:backend/trainer_ml.py†L669-L714】

## Gaps and Follow-Up Actions
- **Expose `ef_search` at runtime:** `PredictorRuntimeConfig` lacks an `ef_search` parameter, and there is no API/UI plumbing to push new values into `HNSWSearch`, leaving the operator slider requirement unmet.【F:common/config_store.py†L39-L82】【F:backend/index_hnsw.py†L17-L61】
- **Polars time aggregation not in use:** Although a Polars/NumPy implementation exists in `backend/api/services/time_aggregator.py`, `prediction_service.py` re-defines and instantiates a legacy per-row aggregator class, so the vectorized path never executes.【F:backend/api/services/time_aggregator.py†L1-L86】【F:backend/api/services/prediction_service.py†L164-L212】【F:backend/api/services/prediction_service.py†L260-L335】
- **Runtime slider wiring:** Once `ef_search` is added to the runtime config, ensure the workflow route and UI propagate the setting before model load so operators can balance recall/latency without redeploys.【F:common/config_store.py†L39-L82】【F:backend/api/routes/workflow.py†L24-L187】

