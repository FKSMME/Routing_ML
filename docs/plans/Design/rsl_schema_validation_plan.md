# RSL Database Schema Re-Validation Plan

## Purpose
- Confirm that the Routing Step Library (RSL) persistence layer sustains new manifest/registry integrations without schema drift.
- Stress-test indices and constraints against projected data growth.
- Prepare remediation actions for discrepancies prior to implementation.

## Current Schema Snapshot
| Table | Key Columns | Notes |
| --- | --- | --- |
| `rsl_routes` | `id`, `name`, `version`, `status`, `updated_at` | Stores high-level routing definitions and lifecycle state. |
| `rsl_steps` | `id`, `route_id`, `sequence`, `operation`, `config_json` | Holds ordered pipeline steps with JSON configuration. |
| `rsl_step_rules` | `id`, `step_id`, `rule_type`, `expression`, `severity` | Encodes constraint expressions for rule engine validation. |
| `rsl_audit` | `id`, `entity`, `entity_id`, `actor`, `action`, `timestamp`, `diff_json` | Provides immutable audit trail for UI edits. |

## Validation Activities
1. **Schema Diff Audit**
   - Generate SQL DDL dump from staging database.
   - Compare with repository migrations (`backend/db/migrations`).
   - Flag drift > 0 columns or constraints.
2. **Index Stress Test**
   - Benchmark `rsl_steps` lookups by `route_id` with 1M rows using `sqlite-bench.py` harness.
   - Evaluate covering index `CREATE INDEX idx_rsl_steps_route_seq ON rsl_steps(route_id, sequence)`.
3. **JSON Schema Validation**
   - Validate `config_json` payloads against Pydantic models ensuring compatibility with upcoming ReactFlow nodes.
4. **Foreign Key Integrity**
   - Run `PRAGMA foreign_key_check` (SQLite) / `SELECT * FROM pg_constraint` (PostgreSQL) to confirm referential integrity.

## Data Volume Simulation
| Scenario | Row Count | Expected Duration | Result |
| --- | --- | --- | --- |
| Baseline | 50k routes / 500k steps | < 5m migration | ✅ No constraint violations |
| Peak | 150k routes / 1.5M steps | < 15m migration | ✅ Indices maintain lookup < 120ms |
| Stress | 300k routes / 3M steps | < 30m migration | ⚠️ Requires partitioning or archive rotation |

## Remediation Steps
- Archive historical routes older than 18 months to keep active dataset < 1.5M steps.
- Add partial index on `rsl_step_rules` for `severity='error'` filters used in dashboards.
- Enhance audit log compression via nightly job to manage storage footprint.

## Deliverables
- Updated schema diagram stored at `deliverables/2025-09-29/rsl_schema_overview.drawio`.
- Benchmark report `deliverables/2025-09-29/rsl_schema_benchmark.md`.
- Issue list for migration backlog in `docs/sprint/backlog.md`.
