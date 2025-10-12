# RSL API CRUD & Release Test Plan

## Scope
- Validate RSL API CRUD operations and release workflows prior to production rollout.
- Ensure optimistic locking, import/export reliability, and failure recovery steps are documented.

## Test Matrix
| ID | Scenario | Steps | Expected Outcome |
| --- | --- | --- | --- |
| T1 | Create route with nested steps | POST `/api/rsl/routes` with template payload; follow-up GET | Route persisted, `rsl_steps` entries created with sequential order, audit entry recorded. |
| T2 | Update step with optimistic lock | PATCH `/api/rsl/steps/<id>` with `If-Match` header | Update succeeds when version matches; 412 returned if stale. |
| T3 | Delete route with cascade | DELETE `/api/rsl/routes/<id>` | Associated steps/rules deleted; audit log records soft delete event. |
| T4 | Import route package | POST `/api/rsl/import` with ZIP | Routes/steps/rules inserted transactionally; rollback on validation error. |
| T5 | Export active route | GET `/api/rsl/routes/<id>/export` | Returns signed ZIP containing manifest-aligned schema. |
| T6 | Release candidate promotion | POST `/api/rsl/routes/<id>/release` | Route version flagged as `released`; release log updated. |
| T7 | Failure recovery on DB outage | Simulate DB disconnect during PATCH | API returns 503; retry queue replays change; audit entry records failure. |

## Tooling
- `pytest` suite using SQLite in-memory and PostgreSQL container.
- Postman/Newman collection for manual validation.
- CLI smoke tool: `python -m scripts.rsl.smoke --scenario <T#>` for offline execution.

## Metrics & Logging
- Capture latency percentiles for CRUD endpoints (p50, p95).
- Record error rate per scenario and correlate with structured logs (`request_id`, `actor`, `route_id`).
- Emit release promotion metrics to observability dashboard.

## Exit Criteria
- 100% pass rate across scenarios T1–T7.
- No P1/P2 defects outstanding; P3 tracked with mitigation.
- Release rollback verified via Task T6 executed twice (promote, rollback).

## Follow-up
- Integrate test plan into CI via GitHub Actions offline runners.
- Provide PDF summary to QA leadership for sign-off.
- Automate report ingestion into hourly log pipeline.
