# PRD — TensorBoard Export Dummy Model RCA

## Executive Summary
The TensorBoard export workflow inside the training dashboard currently returns placeholder projector assets instead of the latest trained embeddings. The objective is to identify the root cause for the dummy artifacts and close the functional gap so that operators receive production-ready vectors at export time.

## Problem Statement
When a user presses **Export from model** in the TensorBoard page (observed on 2025-10-22), the resulting projector selection still defaults to the legacy "root" projector containing dummy embeddings. The workflow must analyze both backend export pipelines and frontend selector logic to determine why production artifacts are not surfaced.

## Goals and Objectives
- Restore TensorBoard exports so that the freshest trained embeddings are surfaced without manual file copies.
- Quantify the impact on users (e.g., number of vectors exposed, selection latency) and define measurable performance baselines.
- Document root causes and preventive actions aligned with routing ML deployment standards.

## Requirements
1. Audit backend export path resolution (FastAPI `/projectors/export`) and confirm which model directory and script parameters are used.
2. Trace frontend projector selection defaults to verify whether fallback projectors override actual trained exports.
3. Produce reproducible evidence (logs, timestamps, counts) that explains why dummy vectors are loaded post-export.
4. Recommend mitigations with quantitative targets (e.g., 100% exports using active model directory, <5s projector reload latency).

## Phase Breakdown
- **Phase 1 – Discovery & Data Capture**: Inspect backend code, environment configuration, and existing projector artifacts. Capture metrics (file timestamps, vector counts) for dummy vs real exports.
- **Phase 2 – Root Cause Analysis**: Map execution flow for the export endpoint and frontend selector, validate failing assumptions, and isolate configuration/control bugs.
- **Phase 3 – Mitigation Planning**: Define code or configuration changes, regression tests, and monitoring hooks to guarantee correct model selection.

## Success Criteria
- Root cause documented with code references, supporting metrics, and timeline of failure path.
- Mitigation plan provides concrete actions with owners and verifiable KPIs.
- All findings delivered in final report summarized for stakeholders (English/Korean friendly wording).

## Timeline Estimates
- Phase 1: 2.0 hours (artifact inspection, metrics capture).
- Phase 2: 2.5 hours (flow validation, hypothesis testing).
- Phase 3: 1.5 hours (countermeasure design and documentation).
- Total: 6.0 hours (same-day turnaround, 2025-10-22).
