# PRD — Routing ML Training & Prediction QA Review (2025-10-21)

## Executive Summary
- Deliver a comprehensive QA assessment of the routing ML system covering data pipelines, model training, prediction outputs, and visualization pathways.
- Validate integration between embeddings derived from `dbo_BI_ITEM_INFO_VIEW` and downstream comparisons against `dbo_BI_ROUTING_VIEW` and `dbo_BI_WORK_ORDER_RESULTS`.
- Verify database migration status from SQLite to PostgreSQL with emphasis on connection integrity, schema parity, and error handling.

## Problem Statement
Current stakeholders require confirmation that the existing routing ML pipeline (training → inference → visualization) is operating according to specification, especially after recent environment shifts and database migration efforts. A structured QA review with quantitative metrics is missing, leaving uncertainty about model feature usage, weight validation, and visualization accuracy of predicted routings.

## Goals and Objectives
1. Audit model training configuration, feature engineering, and weight validation strategies.
2. Evaluate inference outputs against business requirements, including routing predictions, processing times, and visualization synchronization.
3. Assess reuse options for legacy `models/v1` artefacts.
4. Produce migration-readiness findings for PostgreSQL adoption, including integrity checks across all DB connections.
5. Compile quantified QA report highlighting metrics, gaps, and remediation actions.

## Requirements
- Inventory all features used during training (source tables, transformations, scaling).
- Document weight-checking methodology (validation scripts, monitoring targets, thresholds).
- Confirm embedding generation workflow for `dbo_BI_ITEM_INFO_VIEW` and comparison logic against routing/work-order views.
- Determine how legacy model weights (v1) can be loaded and validated within current pipeline.
- Trace recommendation UI pipeline ensuring predicted routing data surfaces within nodes/wires and recommendation components.
- Verify visualization displays similarity nodes and allows drill-down interactions per predicted routing.
- Assess SQLite → PostgreSQL migration scripts, connection strings, ORM configurations, and automated tests.
- Capture quantitative metrics: dataset sizes, model performance indicators, data validation counts, migration test pass rates.
- Produce actionable recommendations with severity and priority labels.

## Phase Breakdown
### Phase 1 — Documentation & Data Collection (0.5 day)
- Review training, prediction, and visualization codebases.
- Extract current metrics, logs, and configuration parameters.

### Phase 2 — Analysis & Validation (0.5 day)
- Evaluate algorithm alignment with requirements.
- Validate database migration readiness and integrity.

### Phase 3 — Reporting & Recommendations (0.5 day)
- Draft QA report with quantitative findings.
- Propose remediation steps and confirm acceptance criteria.

## Success Criteria
- QA report includes verified feature list, weight validation approach, and inference assessment.
- Documented comparison pipeline aligning embeddings with routing/work-order datasets.
- Clear decision pathway for leveraging legacy v1 models.
- Verified visualization linkage demonstrating predicted routing display correctness.
- Migration integrity checklist completed with quantified pass/fail metrics.
- All action items prioritized and traceable to evidence.

## Timeline Estimates
- Kickoff: 2025-10-21 14:00 KST
- Phase 1 completion: 2025-10-21 18:00 KST
- Phase 2 completion: 2025-10-22 12:00 KST
- Phase 3 completion & report delivery: 2025-10-22 18:00 KST

