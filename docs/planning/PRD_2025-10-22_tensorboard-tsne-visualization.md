## Executive Summary
Add an interactive T-SNE visualization to the existing TensorBoard workspace so that training stakeholders can inspect embedding evolution over time directly inside the web console without leaving the Routing ML suite.

## Problem Statement
- Current TensorBoard integration only exposes static projector exports and aggregate scalar charts.
- Model engineers must launch external TensorBoard instances to inspect training progression layouts, creating workflow friction and fragmented context.
- Without timeline-aware visualization, stakeholders cannot easily understand convergence behaviour or metadata slices during evaluation.

## Goals and Objectives
- Provide a first-class T-SNE style 2D layout derived from existing projector artifacts.
- Surface per-point metadata, training progress, and sampling controls inside the frontend.
- Ensure the backend exposes an authenticated API for computing/retrieving the layout on demand.
- Maintain performance by sampling embeddings and caching projector data.

## Requirements
- **Backend**
  - Reuse exported embeddings to compute a configurable T-SNE layout.
  - Support filtering, sampling, stride, perplexity, and iteration parameters.
  - Return per-point metadata, step, and normalized progress.
- **Frontend**
  - Extend the tensorboard store with T-SNE state, settings, and async fetching.
  - Add UI controls (perplexity slider, sample limits, step highlights) and render a scatter chart with ECharts.
  - Display summary stats, loading states, and fallback messaging.
- **Operational**
  - Respect existing auth, error handling, and caching conventions.
  - Document progress via checklist updates aligned with workflow directives.

## Phase Breakdown
- **Phase 1 – Planning & API design**
  - Confirm data sources, sampling strategy, and interface schema.
- **Phase 2 – Backend implementation**
  - Extend FastAPI route, introduce helper utilities, and expose `/projectors/{id}/tsne`.
- **Phase 3 – Frontend implementation**
  - Update types, API client, store, and UI components to consume the new endpoint.
- **Phase 4 – Validation & Documentation**
  - Run build/test commands, capture failures, and update checklist/progress tracking.

## Success Criteria
- Backend endpoint returns valid T-SNE payloads with metadata and sensible defaults.
- Frontend renders the new visualization mode with interactive controls and summaries.
- Sampling/perplexity adjustments trigger backend requests and update the chart.
- Existing projector features remain unaffected (no regression in 3D view or heatmap).
- All workflow directives (PRD, checklist, progress tracking) are satisfied.

## Timeline Estimates
- Phase 1: 0.5 day
- Phase 2: 1.0 day
- Phase 3: 1.5 days
- Phase 4: 0.5 day
Total estimate: 3.5 days (spread across the current sprint).
