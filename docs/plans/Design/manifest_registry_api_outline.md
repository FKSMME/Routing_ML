# Manifest Loader & Registry API Outline

## Objectives
- Deliver inference-ready APIs for activating and inspecting model manifests without disrupting existing joblib loaders.
- Provide training-side hooks to publish manifests and toggle activation safely.
- Ensure telemetry and auditing integration for every write path.

## API Surface
| Endpoint | Method | Scope | Description | Auth |
| --- | --- | --- | --- | --- |
| `/api/registry/models` | GET | Inference | List manifest entries with pagination, filter by `active_flag`. | admin, user |
| `/api/registry/models/active` | GET | Inference | Fetch currently active manifest payload (cached). | admin, user |
| `/api/registry/models/<version>` | GET | Inference | Retrieve manifest metadata and runtime constraints. | admin, user |
| `/api/registry/models` | POST | Training | Publish new manifest + metadata bundle; requires checksum validation. | admin |
| `/api/registry/models/<version>/activate` | POST | Training/Operations | Toggle active version; enforces single-active invariant with transaction + audit trail. | admin |
| `/api/registry/models/<version>/notes` | PATCH | Operations | Update operational notes without modifying manifest content. | admin |

## Manifest Loader Flow
1. Inference service bootstraps by calling `/api/registry/models/active`.
2. Loader verifies `training_metadata.json` compatibility (Python/sklearn/joblib) before hydrating components.
3. On activation change, inference service receives WebSocket or SSE event to hot-reload.
4. Loader caches manifest + derived resources (encoder, HNSW index) with TTL invalidation when `active_version` changes.

## Telemetry & Logging
- Structured log fields: `event_type`, `version`, `request_id`, `actor`, `result`, `latency_ms`.
- Metrics: activation count, manifest publish duration, rollback frequency, cache hit rate for manifest fetches.
- Audit: Append activation events to `logs/registry_activation_history.log` with before/after snapshot.

## Error Handling
| Condition | Response | Recovery |
| --- | --- | --- |
| Checksum mismatch on manifest upload | `400 Bad Request` | Inform training pipeline to regenerate manifest. |
| Activation conflict (`active_flag` already true) | `409 Conflict` | Return active version; operator retries with explicit rollback. |
| Runtime compatibility failure | `422 Unprocessable Entity` | Provide expected vs. actual runtime versions, block activation. |

## Security
- JWT HttpOnly cookies with role-based checks (admin vs. user) enforced via FastAPI dependency.
- Rate limiting on activation endpoint (burst 3/min) to prevent thrashing.
- Request signing optional for offline installers using pre-shared keys.

## Deployment Considerations
- Maintain feature flag to fall back to legacy configuration path until full validation.
- Provide CLI wrappers: `python -m scripts.registry.publish` and `python -m scripts.registry.activate` for offline usage.
- Document inference service environment variables: `REGISTRY_DSN`, `MANIFEST_CACHE_DIR`, `HOT_RELOAD_ENDPOINT`.

## Follow-up
- Generate OpenAPI schemas using Pydantic v2 models aligned with manifest contract.
- Implement integration tests covering activation hot-reload and telemetry emission.
- Coordinate with installer team to expose registry DSN configuration during setup.
