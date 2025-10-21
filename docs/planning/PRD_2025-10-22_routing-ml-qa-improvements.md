# PRD — Routing ML QA Improvements (2025-10-22)

## Executive Summary
- Implement critical fixes to the ML routing prediction pipeline based on comprehensive QA findings from 2025-10-21
- Enable multi-candidate routing aggregation instead of single-item limitation
- Complete visualization layer with similar-item nodes, drill-down interactions, and hover tooltips
- Resolve feature weight validation and UTF-8 encoding issues
- Deliver updated QA report documenting all improvements and validation results

## Problem Statement
The current routing ML system has several critical gaps identified in the 2025-10-21 QA review:

1. **Single-candidate limitation**: `predict_routing_from_similar_items` stops at the first match (line 1233, 1262 breaks), preventing weighted multi-candidate aggregation
2. **Missing visualization features**: Similar item nodes are not exposed to UI, drill-down by clicking candidate nodes is not implemented, and hover tooltips for setup/standard/safe times are missing
3. **Feature weight validation broken**: Inspection script fails due to JSON schema mismatch (float vs dict structure)
4. **Encoding issues**: `feature_recommendations.json` contains mojibake (모지바케) preventing Korean UI hints

These issues prevent the system from meeting its core objectives of multi-source prediction accuracy and comprehensive visualization.

## Goals and Objectives
1. **Enable multi-candidate routing aggregation** - Remove break statements, collect ALL similar item routings, implement weighted averaging by similarity scores
2. **Complete visualization layer** - Display similar item nodes at top of canvas, enable click-to-view drill-down, add hover tooltips showing setup/standard/safe times
3. **Fix feature weight governance** - Repair inspection script to handle current JSON schema, regenerate feature_recommendations.json with proper UTF-8 encoding
4. **Validate end-to-end pipeline** - Ensure ITEM_INFO embedding → ROUTING_VIEW + WORK_ORDER comparison → prediction → visualization flow works correctly
5. **Update QA documentation** - Create comprehensive report documenting all findings, fixes, and validation results

## Requirements

### Functional Requirements
1. **Multi-Candidate Aggregation (FR-1)**
   - Remove break statements at [predictor_ml.py:1233](backend/predictor_ml.py#L1233) and [predictor_ml.py:1262](backend/predictor_ml.py#L1262)
   - Collect routing data from ALL top_k similar items (not just first match)
   - Implement weighted averaging based on similarity scores
   - Store candidate metadata (source item, similarity, routing) for UI exposure
   - Log multi-candidate merge operations for audit trail

2. **Visualization - Similar Item Nodes (FR-2)**
   - Display candidate nodes as tabs at top of RoutingCanvas
   - Show item code, similarity score, and "View Routing" action per node
   - On click, load that candidate's routing into the visualization canvas
   - Maintain separate timeline for each candidate (not just target item)

3. **Visualization - Hover Tooltips (FR-3)**
   - Add tooltip component to RoutingCanvas nodes showing:
     - Setup time (SETUP_TIME)
     - Standard time (STANDARD_TIME / OPTIMAL_TIME)
     - Safe time (SAFE_TIME)
   - Add tooltip to recommendation bucket cards with same time breakdowns
   - Implement proper mouse enter/leave events (fix always-visible tooltip bug)

4. **Feature Weight Validation (FR-4)**
   - Fix `scripts/inspect_training_features.py` to handle `feature_weights.json` structure where enabled is a boolean field
   - Add proper type checking and graceful error handling
   - Regenerate `models/default/feature_recommendations.json` with UTF-8 encoding
   - Validate that Korean characters render correctly in UI

5. **Data Flow Validation (FR-5)**
   - Confirm ITEM_INFO embedding generates 128-dim vectors
   - Verify comparison logic uses ROUTING_VIEW for routing structure
   - Verify WORK_ORDER_RESULTS integration for time predictions
   - Validate that predicted operations flow through to PredictionResponse → routingStore → RoutingCanvas

### Non-Functional Requirements
- **Performance (NFR-1)**: Multi-candidate aggregation should not increase prediction latency beyond 2x current time
- **Compatibility (NFR-2)**: Must work with existing v1 model artifacts (if present)
- **Maintainability (NFR-3)**: All changes must include inline comments and update existing documentation
- **Observability (NFR-4)**: Log key decision points (number of candidates, merge strategy, UI state transitions)

## Phase Breakdown

### Phase 1 — Multi-Candidate Routing Aggregation (Est. 3h)
**Objective**: Remove single-candidate limitation and enable weighted multi-source predictions

**Tasks**:
1. Remove break statement at [predictor_ml.py:1233](backend/predictor_ml.py#L1233)
2. Remove break statement at [predictor_ml.py:1262](backend/predictor_ml.py#L1262)
3. Update aggregation logic to collect ALL similar item routings into `raw_candidate_frames` list
4. Implement weighted averaging by similarity score in detailed mode
5. Store candidate metadata (item_code, similarity, operations) in response
6. Add logging for multi-candidate merge operations
7. Update unit tests to validate multi-candidate behavior

**Acceptance Criteria**:
- Prediction uses ALL top_k similar items (not just first match)
- Response includes `candidates` array with item code, similarity, operation count
- Logs show "Merged N candidates with avg similarity X"
- Existing single-candidate tests still pass

### Phase 2 — Similar Item Nodes in Visualization (Est. 4h)
**Objective**: Display similar items as clickable nodes with drill-down capability

**Tasks**:
1. Update `routingStore.loadRecommendations` to preserve `PredictionResponse.candidates` array
2. Create `CandidateNodeTabs` component displaying item code + similarity score
3. Add click handler to switch active candidate and reload timeline
4. Update `RoutingCanvas` to render candidate tabs at top
5. Ensure timeline data switches when user clicks different candidate node
6. Add visual indicator for currently selected candidate
7. Test drill-down behavior with multi-candidate response

**Acceptance Criteria**:
- Top of canvas shows tabs for each similar item candidate
- Clicking a tab loads that item's routing into the visualization
- Active tab is visually highlighted
- Timeline correctly reflects selected candidate's operations

### Phase 3 — Hover Tooltips for Times (Est. 2h)
**Objective**: Add tooltips showing setup/standard/safe times on hover

**Tasks**:
1. Fix RoutingCanvas tooltip state (change initial value from `true` to `false`)
2. Add `onMouseEnter`/`onMouseLeave` handlers to canvas nodes
3. Create tooltip component displaying:
   - Setup Time: {SETUP_TIME}
   - Standard Time: {STANDARD_TIME}
   - Safe Time: {SAFE_TIME}
4. Map backend fields (`OPTIMAL_TIME`, `SAFE_TIME`, etc.) to UI properties
5. Add similar tooltip to recommendation bucket cards in `CandidatePanel`
6. Test hover behavior (tooltip appears on hover, disappears on mouse leave)

**Acceptance Criteria**:
- Tooltip appears only when mouse hovers over node/card
- Tooltip disappears when mouse leaves
- All three time values display correctly
- No "always visible" tooltip bug

### Phase 4 — Feature Weight & Encoding Fixes (Est. 2h)
**Objective**: Fix validation script and UTF-8 encoding issues

**Tasks**:
1. Update `scripts/inspect_training_features.py` lines 122-137 to handle boolean `enabled` field
2. Add type checking for dict vs float in weight access
3. Add error handling for malformed weight entries
4. Regenerate `models/default/feature_recommendations.json` with proper UTF-8 encoding
5. Verify Korean characters display correctly (no 모지바케)
6. Run inspection script and verify clean execution
7. Update documentation with new validation procedure

**Acceptance Criteria**:
- `inspect_training_features.py` runs without errors
- `feature_recommendations.json` displays Korean text correctly
- Weight validation report shows all 33 active features
- No encoding warnings in logs

### Phase 5 — QA Report & Documentation (Est. 2h)
**Objective**: Document all findings, fixes, and validation results

**Tasks**:
1. Update existing QA report with "Improvements Implemented" section
2. Document each fix with before/after evidence
3. Add validation results (screenshots, logs, metrics)
4. Create comparison table showing old vs new behavior
5. Document remaining recommendations (if any)
6. Add next steps and timeline
7. Review and finalize report

**Acceptance Criteria**:
- QA report includes all improvements from Phases 1-4
- Each fix has evidence (code references, logs, screenshots)
- Report follows existing format from 2025-10-21 QA review
- Stakeholder acceptance criteria documented

## Success Criteria
- ✅ Multi-candidate aggregation enabled (no break statements, weighted averaging works)
- ✅ Visualization displays similar item nodes with drill-down capability
- ✅ Hover tooltips show setup/standard/safe times correctly
- ✅ Feature weight inspection script runs cleanly
- ✅ Korean text displays correctly without encoding issues
- ✅ Updated QA report delivered with comprehensive findings
- ✅ All unit tests pass
- ✅ No regression in existing functionality

## Timeline Estimates
- **Phase 1**: 3 hours (Multi-candidate routing)
- **Phase 2**: 4 hours (Visualization nodes)
- **Phase 3**: 2 hours (Hover tooltips)
- **Phase 4**: 2 hours (Feature weight fixes)
- **Phase 5**: 2 hours (QA report)

**Total**: 13 hours (~2 working days)

- **Kickoff**: 2025-10-22 09:00 KST
- **Phase 1 complete**: 2025-10-22 12:00 KST
- **Phase 2 complete**: 2025-10-22 17:00 KST
- **Phase 3 complete**: 2025-10-22 19:00 KST (next day)
- **Phase 4 complete**: 2025-10-23 11:00 KST
- **Phase 5 complete & delivery**: 2025-10-23 13:00 KST

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Multi-candidate aggregation breaks existing predictions | High | Maintain backward compatibility flag, extensive testing |
| Visualization changes conflict with existing UI state | Medium | Incremental rollout, feature flag for candidate tabs |
| Performance degradation from processing all candidates | Medium | Profile code, add caching, set reasonable top_k limit |
| UTF-8 encoding issues persist | Low | Use explicit encoding in file operations, validate output |

## Dependencies
- Existing training artifacts in `models/default/`
- Database views: `dbo_BI_ITEM_INFO_VIEW`, `dbo_BI_ROUTING_VIEW`, `dbo_BI_WORK_ORDER_RESULTS`
- Frontend store architecture (Zustand)
- Backend API contract (`PredictionResponse` schema)

## Stakeholders
- **Product Owner**: Requires visualization improvements for user presentation
- **Data Science Team**: Needs multi-candidate aggregation for better predictions
- **Frontend Team**: Implements visualization enhancements
- **QA Team**: Validates all improvements and regression testing

## Related Documents
- [QA Report 2025-10-21](../../deliverables/QA_REPORT_2025-10-21_routing-ml-training-prediction-review.md)
- [Checklist 2025-10-21](CHECKLIST_2025-10-21_routing-ml-training-prediction-review.md)
- [Workflow Directives](../../.claude/WORKFLOW_DIRECTIVES.md)
