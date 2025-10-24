# Checklist: Similarity Search Threshold & Model Selection Integration

**Date**: 2025-10-24
**Related PRD**: docs/planning/PRD_2025-10-24_similarity-threshold-model-selection.md
**Status**: In Progress

---

## Phase 1: Similarity Threshold Investigation (Backend)

**Tasks**:
- [x] Read prediction_service.py similarity filtering logic
- [x] Check threshold filtering in _execute_prediction()
- [x] Identify root cause of 10% threshold issue
- [x] Implement fix for miss_thr/similarity_threshold confusion
- [x] Add similarity filtering to _execute_prediction()
- [x] Document findings

**Estimated Time**: 1-2 hours
**Status**: Completed ✅

**Root Cause Found**:
- Line 672 (prediction_service.py): `miss_thr=1.0 - similarity_threshold`
- `miss_thr` is **missing ratio threshold**, NOT similarity threshold
- When similarity_threshold=0.1 → miss_thr=0.9 (allows 90% missing data)
- No similarity filtering in predict_items_with_ml_optimized()
- Only search_similar_items() filters by similarity (Line 804)

**Changes Implemented**:
1. Fixed Line 675: `miss_thr=0.5` (50% missing data allowed)
2. Added Lines 682-691: Similarity threshold filtering
   - Filter candidates where similarity_score >= threshold
   - Log filter effectiveness (before/after counts)
3. Updated return to use `filtered_candidates`
4. Added `total_candidates_before_filter` to metrics

**Git Operations**:
- [ ] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 1
- [ ] Push to 251014
- [ ] **Merge 전 검증** (필수!)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 2: Model Selection Backend Implementation

**Tasks**:
- [ ] Update backend/api/schemas.py - Add model_version to PredictionRequest
- [ ] Update backend/api/routes/prediction.py - Accept model_version parameter
- [ ] Update prediction_service.predict() - Pass model_version to predictor
- [ ] Update predictor_ml.py or model loading logic - Use specified model
- [ ] Test with different model versions via Postman/curl

**Estimated Time**: 2-3 hours
**Status**: Not Started

**Git Operations**:
- [ ] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 2
- [ ] Push to 251014
- [ ] **Merge 전 검증** (필수!)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 3: Model Selection Frontend Integration

**Tasks**:
- [ ] Update usePredictRoutings.ts - Add modelVersion parameter
- [ ] Update PredictionControls.tsx - Pass selectedModelVersion to parent
- [ ] Update App.tsx - Wire modelVersion to usePredictRoutings
- [ ] Update apiClient.ts predictRoutings() - Include modelVersion in request
- [ ] Test E2E model switching in UI

**Estimated Time**: 1-2 hours
**Status**: Not Started

**Git Operations**:
- [ ] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 3
- [ ] Push to 251014
- [ ] **Merge 전 검증** (필수!)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Phase 4: Testing & Validation

**Tasks**:
- [ ] Test similarity threshold at 10%, 20%, 50%, 90%
- [ ] Test model version switching (default vs specific version)
- [ ] Test error cases (invalid model version)
- [ ] Test backwards compatibility (no model_version parameter)
- [ ] Verify threshold logs show correct values
- [ ] Document test results

**Estimated Time**: 1 hour
**Status**: Not Started

**Git Operations**:
- [ ] **Git staging 완전성 확인** (필수!)
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 4
- [ ] Push to 251014
- [ ] **Merge 전 검증** (필수!)
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Progress Tracking

```
Phase 1: [▓▓▓▓▓] 100% (6/6 tasks) ✅
Phase 2: [░░░░░] 0% (0/5 tasks)
Phase 3: [░░░░░] 0% (0/5 tasks)
Phase 4: [░░░░░] 0% (0/6 tasks)

Total: [▓▓░░░░░░░░] 27% (6/22 tasks)
```

---

## Acceptance Criteria

- [ ] Similarity search at 10% returns results (if matches exist)
- [ ] Threshold range 0-100% works correctly
- [ ] Selected model from dropdown is passed to backend
- [ ] Backend loads and uses selected model version
- [ ] Different models produce different results (verified)
- [ ] Invalid model shows clear error message
- [ ] All phases committed and merged to main
- [ ] No empty checkboxes [ ] remaining
- [ ] Work history document created

---

## Notes & Issues

### Investigation Notes
(To be filled during Phase 1)

### Known Limitations
- Model version list depends on Phase 7 model management being available
- Similarity results depend on actual data distribution

---

**Last Updated**: 2025-10-24
**Next Review**: After Phase 1 completion
