# Product Requirements Document  
**Project:** Training Status & TensorBoard Remediation  
**Date:** 2025-10-23  
**Author:** Codex (automation agent)  

---

## Executive Summary
Operators of the Training Frontend currently face usability and reliability issues across the training-status dashboard, TensorBoard embedding viewer, training controls, and legacy prediction-quality pages. The TensorBoard T-SNE view additionally crashes with a “Maximum update depth exceeded” loop. This project streamlines the experience by reducing the training dashboard to two focused 3D visualisations (feature weights and feature statistics), restoring TensorBoard data availability (including the T-SNE progress view), enforcing administrator-only training controls, and removing unused monitoring pages.

## Problem Statement
- The training-status screen displays multiple oversized cards, forcing excessive vertical scrolling and diluting insight.  
- Feature statistics heatmap endpoints fail, showing “Heatmap data unavailable.”  
- TensorBoard Embedding Viewer cannot load projector data, produces repeated 404/empty responses, and its T-SNE progress view triggers a recursive update loop.  
- Training start/monitor/settings controls are exposed to non-admin users, creating operational risk.  
- The prediction quality monitoring page is obsolete but still present, confusing users.  

## Goals and Objectives
1. Limit the training-status workspace to two modules: feature weights and feature statistics, each rendered with 3D interactive visualisations (e.g., point cloud or bar/mesh).  
2. Restore feature statistics data delivery so the new 3D heatmap view renders meaningful values or a clear fallback message.  
3. Fix TensorBoard projector/config endpoints so projector lists, metadata, embeddings, and T-SNE progress render without 404 errors or update loops.  
4. Gate training-start buttons, training monitor, and training settings behind the `isAdmin` flag.  
5. Remove the prediction quality monitoring navigation, route, components, and API usage.  

## Requirements
- **UI:**  
  - Feature weights card shows top 5 weights by default with internal scroll and an interactive 3D view (e.g., Three.js).  
  - Feature statistics tab replaces the legacy 2D heatmap with a 3D correlation bar grid (Three.js) that highlights pairwise axis strength, offers hover guidance, and exposes a clear empty-state message.  
  - TensorBoard embedding viewer exposes axis controls (X/Y/Z) so analysts can remap any numeric feature or derived dimension onto the 3D scatter plot, with quick presets for “learned embedding” vs. “feature-based comparison.”  
  - Cluster legend and color/shape cues surface top-N similar item groups so users can quickly differentiate proximity-based cohorts.  
  - All other cards (metrics summary, TensorBoard iframe, run history, etc.) are removed from the training-status page.  
- **Data:**  
  - Feature statistics endpoint returns structured data (or a clearly indicated empty state) suitable for 3D rendering.  
  - TensorBoard endpoints return existing projector data and stabilise the T-SNE progress view; 404s only occur for genuinely missing assets.  
  - Projector outputs omit NaN/undefined coordinates and document sampling defaults so that the client-side correlation grid renders reliably without runaway memory usage.  
  - Embedding payloads are expanded with (a) numeric feature vectors suitable for axis remapping and (b) optional clustering metadata (e.g., cluster_id, similarity score) so the frontend can highlight user-selected cohorts without recomputing on the client.  
- **Security:**  
  - Non-admin users do not see or cannot interact with training start/monitor/settings actions.  
- **Cleanup:**  
  - Prediction quality monitoring navigation and supporting code are fully removed.  
- **Validation:**  
  - All existing lint/test/build pipelines succeed.  
  - Manual validation scenarios are documented (3D interactions, admin vs. non-admin visibility, TensorBoard load).  

## Phase Breakdown
1. **Phase 1 – Analysis & Reproduction**  
   - Reproduce UI/data failures, capture API logs, confirm data availability in model artifacts.  
2. **Phase 2 – Backend Remediation**  
   - Restore feature statistics/heatmap data service and TensorBoard projector loaders; add regression tests.  
3. **Phase 3 – Frontend Updates**  
   - Build 3D visualisations, prune obsolete cards, enforce admin-only training controls, remove prediction quality pages.  
4. **Phase 4 – Integration & Reporting**  
   - Run lint/test/build, perform manual smoke tests, update documentation and checklist.  

## Success Criteria
- Training-status page contains only the two 3D cards with functional internal scrolling and interactions.  
- Feature statistics endpoint supplies data or a deliberate “no data” state without console errors.  
- TensorBoard embedding viewer lists projectors, loads points/metadata/T-SNE progress without recursion errors, and displays meaningful status.  
- Non-admin logins cannot initiate or configure training.  
- Prediction quality monitoring is fully removed from navigation and codepath.  
- Tests/build succeed and the checklist is 100% complete.  

## Timeline Estimates
- Phase 1: 0.5 day  
- Phase 2: 1.0 day  
- Phase 3: 1.0 day  
- Phase 4: 0.5 day  
*Total: 3.0 days*  

---
