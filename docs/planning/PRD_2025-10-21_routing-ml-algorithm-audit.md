## Executive Summary

This effort delivers a full-stack QA audit of the Routing ML pipeline covering feature ingestion, training artifacts, prediction services, and visualization outputs. We will document current behavior, validate alignment with the stated product objectives, and recommend remediation steps backed by quantitative metrics.

## Problem Statement

The existing routing recommendation workflow relies on a combination of pre-trained and incremental models, database views (`dbo_BI_ITEM_INFO_VIEW`, `dbo_BI_ROUTING_VIEW`, `dbo_BI_WORK_ORDER_RESULTS`), and visualization layers. Stakeholders have requested a comprehensive verification that:

- Training features and weight verification procedures are correct and reproducible.
- Embedding joins between ITEM INFO and routing/work order views yield accurate routing path and cycle-time predictions for each ITEM CODE.
- Legacy `models/v1` artifacts remain compatible or have a clear migration plan.
- Feature weighting recommendations integrate with user-selected weights to trigger downstream routing visualization updates, including nodes/wires and recommendation prompts.
- The visualization surface presents predicted routing, similar-item lineage, and interactive exploration as designed.

## Goals and Objectives

- Produce a quantitative QA report that traces data flow from feature extraction through prediction output, highlighting metrics (accuracy, latency, coverage) collected during the review.
- Validate whether the current implementation matches the intended objective for ITEM CODE routing/time prediction from embedded database joins.
- Assess reuse process for legacy `models/v1` checkpoints and detail required steps or blockers.
- Recommend feature weight configurations based on current training data statistics and confirm UI trigger behavior.
- Confirm visualization rendering requirements for predicted routing and similar-item nodes.

## Requirements

1. Inventory feature sets used during training, including source tables, transformations, and validation checks for weights.
2. Inspect embedding and join pipeline logic comparing ITEM INFO to routing/work order views; validate prediction outputs for both routing path and cycle time metrics.
3. Document compatibility of existing `models/v1` assets with the current pipeline (data schema, serialization format, dependencies).
4. Detail recommended feature weights derived from current datasets and outline how user selections trigger routing generation and visualization updates.
5. Verify visualization requirements: similar item node list, node-click behavior, node/wire rendering of predicted routing, and recommendation node display.
6. Capture quantitative indicators (e.g., dataset counts, model accuracy scores, inference latency) where available; propose instrumentation for gaps.
7. Compile findings into a comprehensive QA report referenced from `docs/reports/`.

## Phase Breakdown

**Phase 1 – Discovery & Data Flow Mapping**
- Locate and review training/prediction code, configuration, and data pipelines.
- Extract documented features, weights, and validation utilities.
- Analyze embedding and join logic for ITEM INFO and routing/work order views.

**Phase 2 – Model Artifact Assessment**
- Evaluate `models/v1` assets, metadata, and compatibility requirements.
- Identify current training outputs, metrics, and reproduction steps.
- Draft recommendations for feature weighting and reuse pathways.

**Phase 3 – Visualization & UX Verification**
- Inspect routing visualization components for predicted routing and recommendation nodes.
- Validate similar-item list interactions and trigger mechanics.
- Assemble quantitative QA report with findings, metrics, and remediation plan.

## Success Criteria

- Completed QA report in `docs/reports/` that addresses all stakeholder questions with quantitative/qualitative evidence.
- Verified documentation of feature usage, weight validation, and embedding comparisons.
- Clear guidance on reusing legacy `models/v1` checkpoints or necessary adjustments.
- Confirmed visualization behaviors aligned with routing prediction outputs.
- Identified risks and proposed mitigations for any discrepancies discovered.

## Timeline Estimates

- Phase 1: 0.5 day
- Phase 2: 0.5 day
- Phase 3: 0.5 day

Total estimated effort: 1.5 days (spread across Oct 21–22, 2025).
