# Step 1 Follow-up Execution Checklist

> This checklist splits the next-stage routing refactor follow-up into ten sequential checkbox items grouped by workflow theme. Each Tasklist checkbox references the anchors below.

## Group 1 – Contract Alignment

- **Tasklist (1)** – Re-review manifest/registry directives from PRD.md, Tasklist absolute directives, and `docs/Design/onprem_two_tier_architecture.md` to confirm scope boundaries. Capture discrepancies for approval.
- **Tasklist (2)** – Gather sign-offs and evidence (meeting notes, diffs) confirming manifest/registry compliance before backend edits begin.

## Group 2 – Backend Readiness

- **Tasklist (3)** – Draft the model registry schema and migration scenarios, noting SQLite vs. PostgreSQL toggles and rollback paths.
- **Tasklist (4)** – Finalize manifest loader and registry API outline including endpoints, telemetry, and rollback hooks ready for implementation.

## Group 3 – RSL Persistence

- **Tasklist (5)** – Re-validate RSL database schema, indices, and migration scripts with data-volume test matrix.
- **Tasklist (6)** – Confirm CRUD/release test plan covering optimistic locking, import/export, and failure recovery for RSL APIs.

## Group 4 – Frontend Integration

- **Tasklist (7)** – Break down routing workspace state store transitions, persistence strategy, and audit logging requirements.
- **Tasklist (8)** – Produce the 20/60/20 layout & ReactFlow execution checklist including drag/drop flows, preview panes, and options sidebars.

## Group 5 – QA and Observability

- **Tasklist (9)** – Define QA, logging, and metrics coverage, mapping to automated tests, dashboards, and `/health` probes.
- **Tasklist (10)** – Review installer, scheduler, and automation implications ensuring manifest/registry changes integrate with install/upgrade scripts.

## Reporting

- Update `docs/sprint/hourly_history_20250929.md` after completing each checkbox to satisfy hourly log requirements.
- Run `python scripts/update_logbook.py` with metrics after each group is completed to sync markdown and JSON logs.
