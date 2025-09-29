# Frontend State Store Transition Plan

## Objectives
- Transition routing workspace state management to a maintainable store that supports audit logging and offline readiness.
- Preserve existing UX flows while enabling drag-and-drop validations and manifest-aware previews.

## Current Pain Points
- Local component state duplicates data across timeline and detail panes.
- Audit logging relies on ad-hoc REST calls without consistent metadata.
- React Query caches and custom hooks diverge, causing stale route snapshots.

## Target Architecture
| Layer | Responsibility | Notes |
| --- | --- | --- |
| Zustand Store (or Redux Toolkit) | Single source of truth for routes, steps, rules, manifest context. | Use Immer for immutable updates; persist to IndexedDB for offline. |
| React Query | Server synchronization layer for registry, RSL CRUD endpoints. | Configure query invalidation on manifest activation events. |
| Event Bus | Broadcast rule violations and UI notifications. | Implement with `mitt` or RxJS depending on existing stack. |

## Data Flow
1. Load active manifest metadata via `/api/registry/models/active` on boot; hydrate store with version, constraints.
2. Fetch route graph via `/api/rsl/routes/<id>` and normalize into nodes/edges for ReactFlow.
3. Persist local edits in store; mark dirty state and track change vector for audit trail.
4. On save, dispatch batch mutation through API, then reconcile store from server response.

## Audit Logging Integration
- Attach `request_id`, `user_id`, and `active_version` to every mutation action.
- Store-level middleware writes audit snapshots to `auditQueue` persisted in IndexedDB when offline.
- Background sync worker flushes queue via `/api/rsl/audit/import` once connectivity returns.

## Testing Strategy
- Unit tests for reducers/selectors ensuring deterministic state transitions.
- Cypress component tests for drag-and-drop flows verifying store updates and UI badges.
- Performance benchmark capturing ReactFlow render time pre/post refactor.

## Migration Steps
1. Introduce store scaffolding parallel to existing context providers.
2. Migrate read paths (selectors) before write paths to reduce regression risk.
3. Enable audit middleware behind feature flag; monitor telemetry for noise.
4. Remove legacy context/hook duplication after two release cycles.

## Follow-up
- Document store contract in `/docs/frontend/state_store_contract.md`.
- Provide onboarding guide for developers covering state inspection tools.
- Coordinate with QA for regression suite updates.
