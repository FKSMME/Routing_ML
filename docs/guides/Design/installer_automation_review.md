# Installer & Operations Automation Review

## Objectives
- Ensure manifest/registry additions integrate seamlessly into offline Windows installer workflows.
- Validate scheduled automation tasks for training and health verification.

## Installer Updates
| Component | Action | Notes |
| --- | --- | --- |
| Wheelhouse | Include pre-built wheels for `hnswlib`, `polars`, `filelock`. | Stored under `\share\wheels`. |
| Config Migration Wizard | Detect existing `runtime_config.json`, mapping profiles, blueprint JSON; migrate to new schema. | Provide dry-run preview. |
| Registry Bootstrap | Seed `registry.db` with legacy active model entry; copy manifests into `%PROGRAMDATA%\RoutingML\models`. | Create backup ZIP. |
| Silent Install | Support `/VERYSILENT /LOADINF=setup.inf` capturing DSN and ports. | Document in operations handbook. |

## Post-install Automation
- Register inference service via WinSW (`inference-service.xml`) pointing to new registry loader entrypoint.
- Schedule training job using Windows Task Scheduler with quarterly full retrain and monthly incremental refresh.
- Run verification script `scripts/install/post_install_check.ps1` to ping `/health`, verify registry activation, and confirm Access DSN.

## Logging & Rollback
- Installer writes verbose log to `%LOCALAPPDATA%\RoutingML\install.log`.
- Uninstaller retains `logs/` and `models/` directories unless `/PURGE` flag provided.
- Rollback script `scripts/install/rollback.ps1` toggles registry `active_flag` back to pre-install version.

## Risk Mitigation
| Risk | Mitigation |
| --- | --- |
| Access ODBC mismatch | Pre-install check enumerates 32/64-bit drivers; prompts resolution. |
| Port conflicts | Installer scans ports; if busy, requests alternative or reserves via `netsh http add urlacl`. |
| Service start failure | Post-install check retries start; collects Windows Event Log excerpt for support. |

## Follow-up
- Update installer documentation in `deploy/windows/README.md` with new registry parameters.
- Provide training video for operations staff covering silent install usage.
- Align with QA plan to include installer verification in regression cycle.
