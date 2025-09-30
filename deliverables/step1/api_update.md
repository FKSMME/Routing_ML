# Step 1 API Update Summary

> Source: `docs/backend_api_routing_groups_spec.md` (approved 2025-09-29)

## Endpoint Coverage
- CRUD endpoints for `/api/routing/groups` with authentication and dedicated audit actions (`routing.group.save|list|load|update|delete`).【F:docs/backend_api_routing_groups_spec.md†L1-L27】【F:docs/backend_api_routing_groups_spec.md†L68-L86】
- Requests capture `group_name`, `item_codes`, ordered `steps`, ERP toggle, metadata, and optimistic `version`; responses return ownership metadata and timestamps.【F:docs/backend_api_routing_groups_spec.md†L29-L66】
- Error handling includes validation (400), conflict (409) with diff payload, dirty merge lock (423), and logging of failures with `result=error`.【F:docs/backend_api_routing_groups_spec.md†L49-L66】【F:docs/backend_api_routing_groups_spec.md†L87-L108】

## Business Rules and Integrations
- Enforces unique `(owner, group_name)`, `seq` ordering, ERP-required process checks, sharing policy validation, and optimistic locking via headers/body version fields.【F:docs/backend_api_routing_groups_spec.md†L110-L137】
- Integrates with database schema additions (`routing_groups` table), Pydantic schema updates, auth middleware, and audit logger channel `routing.audit` with correlation IDs.【F:docs/backend_api_routing_groups_spec.md†L139-L170】【F:docs/backend_api_routing_groups_spec.md†L172-L190】
- Database schema defines JSON fields for items/steps, ERP flag, versioning, timestamps, soft delete, and supporting indexes for recency queries.【F:docs/backend_api_routing_groups_spec.md†L192-L226】

## Migration and Rollback Notes
- Bootstrap tasks include SQLAlchemy migrations, default dataset seeding, API integration tests, and rollback procedure that retains history for soft-deleted groups.【F:docs/backend_api_routing_groups_spec.md†L228-L248】
