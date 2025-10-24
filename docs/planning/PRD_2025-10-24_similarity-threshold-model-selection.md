# PRD: Similarity Search Threshold & Model Selection Integration

**Date**: 2025-10-24
**Status**: In Planning
**Priority**: High
**Related Issues**: Bug Report #5, #6 from 2025-10-24

---

## Executive Summary

This PRD addresses two critical bugs in the routing prediction system:
1. **Similarity search threshold issue**: 10% threshold not returning results
2. **Model selection not connected**: Selected model version not applied to prediction API

Both issues impact prediction accuracy and user experience. The similarity threshold issue prevents users from finding low-similarity matches that may still be relevant. The model selection issue means users cannot leverage different trained model versions.

**Expected Outcome**:
- Similarity search returns results at 10% threshold
- Model version dropdown actively controls which model is used for predictions

---

## Problem Statement

### Issue #5: Similarity Search Threshold

**Current Behavior**:
- User sets similarity threshold to 10%
- Search returns no results despite potential matches existing

**Expected Behavior**:
- Search returns all candidates above 10% similarity
- Lower thresholds should increase result count, not eliminate all results

**Impact**:
- Users cannot discover low-similarity items that may be useful starting points
- Limits flexibility in recommendation discovery
- Reduces trust in system accuracy

### Issue #6: Model Selection Not Applied

**Current Behavior**:
- Model version dropdown displays available models
- Selecting a model has no effect on prediction results
- Always uses default model regardless of selection

**Expected Behavior**:
- Selected model version is passed to `/api/predict` endpoint
- Prediction uses the selected model for routing generation
- Different models produce different results based on training

**Impact**:
- Cannot test different model versions
- Cannot compare model performance
- Phase 7 model selection UI is non-functional

---

## Goals and Objectives

### Primary Goals

1. **Fix Similarity Threshold Calculation**
   - Investigate backend threshold filtering logic
   - Identify why 10% threshold returns empty results
   - Ensure threshold works correctly across full range (0-100%)

2. **Connect Model Selection to Prediction**
   - Add `model_version` parameter to PredictionRequest schema
   - Pass selected model from frontend to backend
   - Backend loads and uses specified model version

### Secondary Goals

- Improve prediction reliability
- Enable A/B testing between model versions
- Provide better debugging capabilities

---

## Requirements

### Functional Requirements

#### FR-1: Similarity Threshold Backend
- [ ] Investigate `prediction_service.py` similarity filtering logic
- [ ] Check if threshold is applied correctly (>=, >, multiplier issues)
- [ ] Verify threshold is not hardcoded or overridden
- [ ] Test threshold at 10%, 20%, 50%, 90% levels
- [ ] Log threshold application for debugging

#### FR-2: Similarity Threshold Testing
- [ ] Create test items with known similarity scores
- [ ] Verify results match expected threshold
- [ ] Document actual vs expected behavior

#### FR-3: Model Selection Backend Schema
- [ ] Add `model_version: Optional[str]` to PredictionRequest
- [ ] Update `/api/predict` endpoint to accept model_version
- [ ] Pass model_version to prediction_service.predict()
- [ ] Load specified model instead of default

#### FR-4: Model Selection Frontend Integration
- [ ] Add `modelVersion` to usePredictRoutings hook
- [ ] Pass selectedModelVersion from PredictionControls
- [ ] Update App.tsx to include modelVersion in predict call
- [ ] Verify different models produce different results

### Non-Functional Requirements

#### NFR-1: Performance
- Model loading should be cached (not reload on each request)
- Similarity filtering should not impact query performance

#### NFR-2: Backwards Compatibility
- If no model_version specified, use default model
- Existing API calls without model_version should work unchanged

#### NFR-3: Error Handling
- Invalid model version returns clear error message
- Missing model version falls back to default gracefully

---

## Phase Breakdown

### Phase 1: Similarity Threshold Investigation (Backend)

**Tasks**:
1. Read `backend/api/services/prediction_service.py` similarity logic
2. Check threshold filtering in `_execute_prediction()`
3. Identify root cause of 10% threshold issue
4. Test hypothesis with sample queries
5. Implement fix if identified

**Estimated Time**: 1-2 hours

**Deliverables**:
- Root cause analysis document
- Fixed threshold logic (if applicable)
- Test results at multiple thresholds

### Phase 2: Model Selection Backend Implementation

**Tasks**:
1. Update `backend/api/schemas.py` PredictionRequest
2. Update `backend/api/routes/prediction.py` predict() endpoint
3. Update `prediction_service.predict()` to accept model_version
4. Update `predictor_ml.py` to load specific model version
5. Test with different model versions

**Estimated Time**: 2-3 hours

**Deliverables**:
- Updated backend schema
- Model version parameter support
- Verified model switching

### Phase 3: Model Selection Frontend Integration

**Tasks**:
1. Update `usePredictRoutings.ts` to include modelVersion
2. Update `PredictionControls.tsx` to pass selectedModelVersion
3. Update `App.tsx` to wire model selection
4. Test end-to-end model switching

**Estimated Time**: 1-2 hours

**Deliverables**:
- Frontend model selection wired
- E2E test passed
- Different models produce different results

### Phase 4: Testing & Validation

**Tasks**:
1. Test similarity at 10%, 20%, 50%, 90%
2. Test model version switching
3. Test error cases (invalid model, missing model)
4. Verify backwards compatibility

**Estimated Time**: 1 hour

**Deliverables**:
- Test report
- Bug fixes if needed
- Documentation updates

---

## Success Criteria

### Issue #5: Similarity Threshold
- ✅ Similarity search at 10% returns results (if matches exist)
- ✅ Threshold range 0-100% works correctly
- ✅ Lower thresholds return more results, higher return fewer
- ✅ Logs show threshold being applied correctly

### Issue #6: Model Selection
- ✅ Selected model from dropdown is passed to backend
- ✅ Backend loads and uses selected model version
- ✅ Different models produce different prediction results
- ✅ Invalid model shows clear error message
- ✅ No model selected falls back to default

### Overall
- ✅ All 4 phases completed
- ✅ All tests passing
- ✅ User can control both threshold and model
- ✅ Commits merged to main branch

---

## Timeline Estimates

| Phase | Estimated Time | Dependencies |
|-------|---------------|--------------|
| Phase 1: Threshold Investigation | 1-2 hours | None |
| Phase 2: Model Backend | 2-3 hours | None (parallel) |
| Phase 3: Model Frontend | 1-2 hours | Phase 2 |
| Phase 4: Testing | 1 hour | Phase 1, 3 |
| **Total** | **5-8 hours** | |

---

## Technical Considerations

### Similarity Threshold
- May need to check if similarity score is 0-1 or 0-100 scale
- Check if threshold comparison is `>=` vs `>`
- Verify no minimum hardcoded threshold exists

### Model Selection
- Model loading should use existing model manager cache
- Don't reload model if already loaded
- Consider adding model version to metrics response

### Testing Strategy
- Use existing test items with known characteristics
- Create synthetic test cases if needed
- Log all threshold and model operations

---

## Risks and Mitigation

### Risk 1: Threshold Issue Not in Filtering
**Impact**: Medium
**Probability**: Medium
**Mitigation**: Check data source - maybe no items actually match at 10%

### Risk 2: Model Loading Performance
**Impact**: Low
**Probability**: Low
**Mitigation**: Use existing model cache, avoid redundant loads

### Risk 3: Breaking Changes
**Impact**: High
**Probability**: Low
**Mitigation**: Make model_version optional, maintain backwards compatibility

---

## Dependencies

- Existing model version management system (Phase 7)
- Model registry in `backend/maintenance/model_registry.py`
- Prediction service architecture
- React Query for frontend state

---

## Open Questions

1. What is the actual similarity distribution in the data? (Are there items at 10%?)
2. Should we add threshold validation (min 0%, max 100%)?
3. Should model version be persisted in user preferences?

---

## Approval & Sign-off

**Prepared By**: Claude (AI Assistant)
**Date**: 2025-10-24
**Status**: Ready for Implementation

---

**Next Steps**:
1. Create CHECKLIST_2025-10-24_similarity-threshold-model-selection.md
2. Begin Phase 1 implementation
3. Update checklist as tasks complete
