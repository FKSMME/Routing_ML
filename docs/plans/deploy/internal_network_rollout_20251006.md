# Internal Network Rollout Plan — 2025-10-06

- **Scope**: Deploy Routing ML frontend/backend build from commit `main@6d1f3fa` + database schema revision `20250925_stage5_create_routing_tables` to internal Lab network.
- **Prerequisites**:
  1. Stage 4/5 QA evidence archived (`deliverables/onboarding_evidence/lab3_manual_session_20251004.md`).
  2. Database snapshot `qa-routing-20251003` validated against production (no pending migrations).
  3. ERP feature flag config file updated with default `erp_required=false` for legacy groups.

## Timeline (UTC)
| Time | Owner | Task |
| --- | --- | --- |
| 2025-10-05 23:30 | DBA (Han) | Take staging snapshot, compare schema & row counts with prod (`scripts/db_compare.py --snapshot qa-routing-20251003`). |
| 2025-10-06 00:15 | DevOps (Min) | Publish Docker images to internal registry `registry.lab3.internal/routing-ml:{frontend,backend}-20251004`. |
| 2025-10-06 00:45 | QA (Kim) | Smoke test staging instance using manual evidence checklist (ERP toggle, dirty reset). |
| 2025-10-06 01:15 | DevOps (Min) | Switch production to read-only, back up `routing_candidates`, `routing_candidate_operations`. |
| 2025-10-06 01:30 | DBA (Han) | Apply Alembic migration `20250925_stage5_create_routing_tables` if pending; verify checksum. |
| 2025-10-06 01:45 | QA (Kim) | Enable ERP toggle feature flag via `/api/admin/config` (feature `erp_required_enabled=true`). |
| 2025-10-06 02:00 | DevOps (Min) | Deploy frontend build to Nginx, restart backend pods, flush CDN cache. |
| 2025-10-06 02:15 | QA (Kim) | Run post-deploy validation script `scripts/post_deploy_checks.sh --suite routing-ml`. |
| 2025-10-06 02:45 | Product (Lee) | Sign-off via release governance checklist (`docs/release_governance_execution_20250927.md`). |
| 2025-10-06 03:30 | DevOps (Min) | Remove read-only mode, monitor metrics dashboard for 30 minutes. |

## Rollback Strategy
1. Revert feature flag `erp_required_enabled` to `false` via admin API.
2. Restore Docker images `routing-ml-frontend:20250922` and `routing-ml-backend:20250922` from registry cache.
3. If Alembic migration introduced schema changes, run `alembic downgrade -1` and restore `routing_candidates*` tables from snapshot `qa-routing-20251003`.
4. Post-rollback validation: execute `tests/post_deploy/smoke_routing_ml.py` to confirm API health.

## Communication Plan
- **Channels**: Teams `#routing-ml-release`, Email alias `routing-ml-dev@corp`.
- **Check-ins**: 15 minutes before deployment window, immediately after go-live, and after 30-minute monitoring period.
- **Incident Protocol**: Any Sev-1/Sev-2 issue triggers on-call escalation (Ops PagerDuty schedule `routing-ml-ops`).

## Sign-off Checklist
- [ ] DBA snapshot verified
- [ ] Docker images published
- [ ] ERP toggle feature flag enabled
- [ ] Post-deploy validation passed
- [ ] Release governance document updated
