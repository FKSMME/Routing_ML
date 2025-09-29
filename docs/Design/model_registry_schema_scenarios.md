# Model Registry Schema & Migration Scenarios

## Goals
- Provide a migration-safe registry schema that supports SQLite (on-prem default) and PostgreSQL (optional scale-out).
- Detail version activation, rollback, and auditing semantics aligned with manifest contracts.
- Outline deployment and testing sequences that preserve zero-downtime objectives.

## Core Schema
```sql
CREATE TABLE model_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL UNIQUE,
    manifest_path TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP NULL,
    active_flag INTEGER NOT NULL DEFAULT 0,
    notes TEXT NULL,
    trainer_build TEXT NOT NULL,
    runtime_constraints JSON NOT NULL
);
```

### Columns
- `version`: Semantic version `YYYY.MM.DD_build` as defined in PRD.
- `manifest_path`: Relative path to the manifest inside `models/<version>/manifest.json`.
- `created_at` / `activated_at`: Track promotion timeline for auditing.
- `active_flag`: Enforces single-active invariant (use partial index in PostgreSQL).
- `trainer_build`: Captures Python/sklearn/joblib versions from `training_metadata.json`.
- `runtime_constraints`: Serialized JSON capturing ef_search presets, cache sizing hints, and required runtime extensions.

## SQLite vs. PostgreSQL Adjustments
| Concern | SQLite Strategy | PostgreSQL Strategy |
| --- | --- | --- |
| Auto increment | `INTEGER PRIMARY KEY AUTOINCREMENT` | `GENERATED ALWAYS AS IDENTITY` |
| Boolean flag | `INTEGER` with trigger enforcement | `BOOLEAN` with partial unique index on `active_flag=true` |
| JSON storage | Canonicalized text (validated by app layer) | Native `JSONB` with schema validation via CHECK constraint |
| Concurrency | File locks with `portalocker`/`filelock` wrappers | Transactional locking using `SELECT ... FOR UPDATE` |

## Migration Phases
1. **Preparation**: Create table in maintenance window, populate with historic models via manifest scan.
2. **Validation**: Run dry-run activation toggles to assert single-active constraint.
3. **Cutover**: Update inference service to read from registry, keep fallback to legacy joblib path until verification.
4. **Verification**: Execute smoke tests (`/health`, prediction, warm cache) against active version.
5. **Cleanup**: Remove legacy config once monitoring confirms stability for 48 hours.

## Rollback Plan
- Maintain previous manifest entries in `model_registry` with `active_flag=0`.
- Toggling rollback: set desired version `active_flag=1`, disable current version, trigger inference hot-reload endpoint.
- Persist change log by appending to `logs/registry_activation_history.log` for audit.

## Testing Matrix
| Scenario | SQLite | PostgreSQL |
| --- | --- | --- |
| Initial migration | `pytest tests/registry/test_migration_sqlite.py` | `pytest tests/registry/test_migration_postgres.py` |
| Activation toggle | `python -m scripts.registry.toggle --version <ver>` | Same command with DSN override |
| Manifest mismatch | Simulated by altering manifest checksum; expect alert + blocked activation | Validate constraint violation via `CHECK (manifest_path <> '')` |

## Dependencies
- `filelock` for SQLite concurrency control.
- Database DSN configuration via `runtime_config.json`.
- Telemetry hook to send activation events to observability dashboard.

## Follow-up
- Generate Alembic migration stub for PostgreSQL installations.
- Document manual rollback CLI in operations handbook.
- Align inference service config loader with registry schema fields.
