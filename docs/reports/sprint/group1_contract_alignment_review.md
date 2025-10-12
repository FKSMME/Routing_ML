# Group 1 – Contract Alignment Review (Tasklist 1)

## Scope Review Summary
- **Directive Sources Reviewed**: `PRD.md` (v2025-09-28.1) absolute instructions, `Tasklist.md` Step 1 follow-up, and `docs/Design/onprem_two_tier_architecture.md` refactor blueprint.
- **Objective**: Confirm manifest/registry additions preserve the existing `models/<version>` artifact layout while adding the minimum viable contracts (`manifest.json`, `registry.db`).
- **Training → Inference Hand-off**: Training jobs must emit `manifest.json` (hashes, runtime versions) alongside legacy `.joblib/.json` artifacts; registry entry inserted as *pending* until operator flips `active_flag` via API/CLI.
- **Inference Expectations**: On startup, service loads the single `active_flag = 1` record from `registry.db`, validates artifacts via manifest checksum, enforces runtime compatibility using `training_metadata.json`, and surfaces observability fields (`request_id`, `active_version`, `latency_ms`).

## Contract Surface Matrix
| Contract | Required Fields / Behaviour | Source Directive | Alignment Notes |
| --- | --- | --- | --- |
| `manifest.json` | Artifact list with hashes, runtime metadata, pointers to mapping profiles. | PRD §C.4, On-Prem Architecture §Training Workflow | Matches existing packaging plan; no file relocation required. |
| `registry.db` (`model_registry` table) | Columns: `version`, `active_flag`, `created_at`, `notes`; exactly one active version. | User directive §2.1, Architecture §Contract Stabilisation | SQLite already acceptable; confirm CLI/API toggles only mutate `active_flag`. |
| Mapping Profiles | Input/Output schema mappings with whitelist validation, preview, active profile pointer. | User directive §3.3, PRD §C.3 | Stored as mutable config; manifest references active profile ID only. |
| Blueprint Graph JSON | ReactFlow graph persisting trainer/inference node wiring, triggers template regeneration. | User directive §3.4, Architecture §Go/No-Go | No schema change required; ensure manifest/registry hooks do not alter existing SAVE flow. |

## Discrepancy Check
- **Artifact Footprint**: Existing `models/*.joblib/*.json` remain untouched; manifest/registry additions append metadata without altering filenames – **no discrepancy**.
- **Activation Process**: Registry `active_flag` toggles already planned for rollback; ensure UI/API exposes approval workflow before enabling automated flips – **requires follow-up evidence in Tasklist (2)**.
- **Config Mutability**: Runtime configs stay in `runtime_config.json`/`trainer_config.yaml`; manifest remains immutable per version – **aligned**.
- **Logging Mandate**: Structured JSON logs include `active_version`, satisfying observability directive – **aligned**.

## Next Steps
1. Capture approval artifacts for manifest/registry rollout (Tasklist (2)).
2. Draft registry schema + migration scenarios (Tasklist (3)).
3. Update hourly and sprint logs per absolute directive.
