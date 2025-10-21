# PRD: Critical Routing Prediction and Training Fixes

**Date**: 2025-10-21
**Status**: In Progress
**Priority**: CRITICAL
**Assignee**: Claude Code

---

## Executive Summary

Three critical issues are blocking core functionality:
1. Routing prediction only loads ITEM-01 instead of user-specified items
2. Model training fails with errors
3. Canvas wire connections between nodes not implemented

These are the most important features of the system and must be fixed immediately.

---

## Problem Statement

### Issue 1: Routing Prediction Only Loads ITEM-01
**Severity**: CRITICAL
**Impact**: Users cannot predict routing for their actual items
**Current Behavior**: When clicking "추천 실행" button in routing generation, only ITEM-01 loads regardless of which item codes are entered
**Expected Behavior**: System should predict routing for all entered item codes using trained ML model

### Issue 2: Model Training Failure
**Severity**: CRITICAL
**Impact**: Cannot train new models, system relies on outdated models
**Current Behavior**: Clicking "모델 학습" button causes training errors
**Expected Behavior**: Model training completes successfully and saves new model weights

### Issue 3: Canvas Wire Connections Missing
**Severity**: CRITICAL
**Impact**: Cannot visualize routing flow between operations
**Current Behavior**: No wire connections visible between canvas nodes
**Expected Behavior**: Visual lines connecting sequential routing operations

---

## Goals and Objectives

### Primary Goals
1. **Fix routing prediction** to work with any item code(s)
2. **Fix model training** to complete without errors
3. **Implement canvas wire connections** for routing visualization

### Success Criteria
- ✅ Multiple item codes can be predicted simultaneously
- ✅ Prediction uses trained ML model, not hardcoded ITEM-01
- ✅ Model training completes and saves weights
- ✅ Canvas shows wire connections between all sequential nodes
- ✅ All fixes committed with proper git workflow

---

## Requirements

### Functional Requirements

#### FR1: Multi-Item Routing Prediction
- FR1.1: Accept multiple item codes (comma/newline/semicolon separated)
- FR1.2: Query database for each item's master data
- FR1.3: Run ML prediction for each item
- FR1.4: Display all predicted routings in timeline
- FR1.5: Create separate tabs for each predicted item

#### FR2: Model Training
- FR2.1: Load training data from database
- FR2.2: Preprocess features according to model architecture
- FR2.3: Train model with proper hyperparameters
- FR2.4: Save model weights to disk
- FR2.5: Log training metrics (loss, accuracy, epoch progress)

#### FR3: Canvas Wire Connections
- FR3.1: Detect sequential routing steps
- FR3.2: Create edge data structure for ReactFlow
- FR3.3: Render edges with proper styling
- FR3.4: Support wire selection/highlighting
- FR3.5: Handle multiple routing paths (matrix routing)

### Non-Functional Requirements
- NFR1: Prediction response time < 3 seconds for single item
- NFR2: Training completes within reasonable time (< 30 min for full dataset)
- NFR3: Wire rendering performs smoothly (60fps)

---

## Phase Breakdown

### Phase 0: Error Analysis and Root Cause Investigation
**Duration**: 1.5 hours
**Tasks**:
1. Check backend logs for prediction API errors
2. Analyze training API error messages
3. Inspect canvas edge rendering code
4. Identify exact failure points

**Deliverables**:
- Root cause analysis document
- Error logs captured
- Code locations identified

### Phase 1: Fix Routing Prediction for Multi-Item
**Duration**: 3 hours
**Tasks**:
1. Review PredictionControls item code parsing
2. Check apiClient.ts predictRoutings implementation
3. Verify backend predict_items_with_ml_optimized
4. Test database queries for non-ITEM-01 items
5. Fix any hardcoded ITEM-01 references
6. Validate ML model input preprocessing

**Deliverables**:
- Prediction works for any item code
- Multiple items predicted simultaneously
- Timeline shows all predicted items

### Phase 2: Fix Model Training
**Duration**: 3 hours
**Tasks**:
1. Capture full training error traceback
2. Verify training data loading
3. Check feature preprocessing pipeline
4. Validate model architecture compatibility
5. Fix tensor shape mismatches
6. Test training with small batch

**Deliverables**:
- Training completes successfully
- Model weights saved
- Training metrics logged

### Phase 3: Implement Canvas Wire Connections
**Duration**: 2 hours
**Tasks**:
1. Review RoutingCanvas edge configuration
2. Generate edge data from timeline
3. Add edge rendering to ReactFlow
4. Style edges for visibility
5. Test with multiple routing paths

**Deliverables**:
- Wires visible between all nodes
- Sequential operations connected
- Edges styled appropriately

### Phase 4: Integration Testing
**Duration**: 1.5 hours
**Tasks**:
1. End-to-end test: train model → predict item → view canvas
2. Test with multiple item codes
3. Verify wire connections for complex routings
4. Performance testing

**Deliverables**:
- All three issues resolved
- System working end-to-end
- QA checklist completed

---

## Technical Architecture

### Components Involved

**Frontend**:
- PredictionControls.tsx - Item code input
- usePredictRoutings.ts - Prediction hook
- RoutingCanvas.tsx - Wire rendering
- TimelinePanel.tsx - Result display

**Backend**:
- backend/api/routes/prediction.py - Prediction endpoint
- backend/api/routes/training.py - Training endpoint
- backend/ml/model.py - Model architecture
- backend/database.py - Data queries

**Data Flow**:
```
User Input (Item Codes)
  ↓
PredictionControls parsing
  ↓
API POST /api/predict/items
  ↓
predict_items_with_ml_optimized
  ↓
Database query (fetch_item_master, fetch_routing_for_item)
  ↓
ML model inference
  ↓
Timeline generation
  ↓
Canvas rendering with wires
```

---

## Success Criteria

### Issue 1: Routing Prediction
- [ ] Can predict routing for any valid item code
- [ ] Multiple items predicted in single request
- [ ] Timeline shows all predicted items
- [ ] No hardcoded ITEM-01 references

### Issue 2: Model Training
- [ ] Training completes without errors
- [ ] Model weights saved to disk
- [ ] Training logs show progress
- [ ] Can load and use trained model for prediction

### Issue 3: Canvas Wires
- [ ] Wire connections visible between nodes
- [ ] Wires follow sequential operation order
- [ ] Edges styled with appropriate color/width
- [ ] Multiple routing paths handled correctly

### Overall
- [ ] All three critical issues resolved
- [ ] No regression in existing features
- [ ] Git workflow followed (PRD → Checklist → Phase commits)

---

## Timeline Estimates

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0: Error Analysis | 1.5h | None |
| Phase 1: Fix Prediction | 3h | Phase 0 |
| Phase 2: Fix Training | 3h | Phase 0 |
| Phase 3: Canvas Wires | 2h | Phase 1 |
| Phase 4: Integration Testing | 1.5h | All previous |
| **Total** | **11h** | Sequential |

---

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Database missing item data | Medium | High | Add fallback dummy data generation |
| Model architecture incompatible | Low | High | Verify tensor shapes match training data |
| Edge rendering performance | Low | Medium | Optimize edge count, use virtualization |
| Multiple root causes | High | High | Systematic debugging per phase |

---

## References

- Previous work: CHECKLIST_2025-10-20_routing-workflow-improvements.md
- Database schema: backend/database.py (BI_ROUTING_VIEW fix)
- Canvas implementation: frontend-prediction/src/components/routing/RoutingCanvas.tsx
- ML model: backend/ml/model.py

---

**Last Updated**: 2025-10-21
**Next Review**: After Phase 0 completion
