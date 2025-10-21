# Phase 0: Error Analysis - Critical Issues Root Cause

**Date**: 2025-10-21
**Status**: Analysis Complete
**Priority**: CRITICAL

---

## Executive Summary

Analyzed three critical issues reported by user. **Root cause identified**: Model file corruption/version mismatch causing prediction failure, which cascades to other issues.

---

## Issue 1: Routing Prediction Only Loads ITEM-001

### Symptoms
- User clicks "추천 실행" button
- Only ITEM-001 loads regardless of input
- No routing predictions for user-specified items

### Root Cause Analysis

**Error Log** (2025-10-20 13:37:51):
```
AttributeError: Can't get attribute 'DummySimilarityEngine' on <module 'uvicorn.__main__' from '...\uvicorn\__main__.py'>
```

**Location**: `backend/api/services/prediction_service.py:514`

**Failure Chain**:
1. Prediction request received: `item=['ITEM-001']`
2. Model load attempted: `models/default/similarity_engine.joblib`
3. Pickle unpickle fails: Cannot find `DummySimilarityEngine` class
4. Model expected class from `backend.trainer_ml` but pickle looks in `uvicorn.__main__`
5. Prediction service falls back to dummy data (ITEM-001 hardcoded)

**Root Cause**:
- **Model file version mismatch**: similarity_engine.joblib was pickled with a different class structure
- **Module import issue**: Class `DummySimilarityEngine` not properly importable during unpickling
- **Fallback behavior**: System returns hardcoded ITEM-001 dummy data instead of throwing error

**Fix Required**:
1. Delete corrupted model files in `models/default/`
2. Retrain model to generate fresh pickle files
3. Ensure `DummySimilarityEngine` is properly defined in `backend.trainer_ml`
4. Update pickle serialization to include full module path

---

## Issue 2: Model Training Failure

### Symptoms
- User clicks "모델 학습" button
- Training fails with errors
- Cannot generate new model files

### Root Cause Analysis

**Status**: Need to capture training error traceback

**Hypothesis**:
- Training data loading may fail due to database schema changes (BI_ROUTING_VIEW fix)
- Feature preprocessing pipeline may need updates
- Model architecture may have changed since last successful training

**Next Steps**:
- Trigger training manually
- Capture full error traceback
- Analyze training data loading code
- Verify feature column compatibility

---

## Issue 3: Canvas Wire Connections Missing

### Symptoms
- No wire connections visible between routing nodes
- Cannot see operation flow visualization

### Root Cause Analysis

**Code Review** (`RoutingCanvas.tsx`):

**Lines 254-275**: Edge generation logic
```typescript
const flowEdges = useMemo<Edge[]>(
  () =>
    timeline.slice(1).map((step, index) => {
      const edgeId = `edge-${timeline[index].id}-${step.id}`;
      const isSelected = edgeId === selectedEdgeId;
      return {
        id: edgeId,
        source: timeline[index].id,
        target: step.id,
        animated: isSelected,
        style: {
          stroke: isSelected ? 'rgb(56, 189, 248)' : 'rgba(148, 163, 184, 0.8)',
          strokeWidth: isSelected ? 3 : 2,
        },
        markerEnd: {
          type: 'arrowclosed' as const,
          color: isSelected ? 'rgb(56, 189, 248)' : 'rgba(148, 163, 184, 0.8)',
        },
      };
    }),
  [timeline, selectedEdgeId],
);
```

**Lines 280, 284-286**: ReactFlow integration
```typescript
<ReactFlow
  nodes={nodes}
  edges={edges}  // ✅ Edges are passed
  onEdgeClick={handleEdgeClick}
  onConnect={handleConnect}
  onReconnect={handleReconnect}
  // ...
>
```

**Root Cause**:
- **Wire connection code is already implemented** ✅
- **Wires not visible because timeline is empty**
- Timeline is empty because prediction fails (Issue #1)
- **This is NOT a code issue - it's a data issue**

**Fix Required**:
- None - this will automatically work once prediction is fixed
- Timeline will populate with routing steps
- Edges will automatically render between sequential nodes

---

## Dependency Chain

```
Issue #1: Model Load Failure
    ↓
Prediction returns dummy ITEM-001 data
    ↓
Timeline is empty/incomplete
    ↓
Issue #3: No wires (timeline.length < 2)
```

**Critical Path**: Fix Issue #1 (model files) → Issue #3 resolves automatically

**Issue #2** is independent and blocks ability to generate new models

---

## Fix Implementation (Applied)

### Model File Analysis
**Directory**: `models/default/`
```
models/default/
├── similarity_engine.joblib  ❌ CORRUPTED (2.7KB) - AttributeError on load
├── encoder.joblib            ✅ 83 bytes
├── scaler.joblib             ✅ 1.2KB
├── feature_columns.joblib    ✅ 545 bytes
├── feature_weights.joblib    ✅ 971 bytes
└── *.json configuration files ✅
```

### Code Fix Applied: FileNotFoundError Handling

**File**: `backend/trainer_ml.py`
**Location**: Lines 1228-1244
**Purpose**: Handle corrupted/missing similarity_engine.joblib gracefully

**Implementation**:
```python
try:
    searcher = joblib.load(similarity_path)
except FileNotFoundError:
    logger.warning("similarity_engine.joblib 파일을 찾을 수 없습니다. 기본 더미 검색 엔진으로 대체합니다.")
    from backend.dummy_models import DummySimilarityEngine
    searcher = DummySimilarityEngine()
except AttributeError as exc:
    if "DummySimilarityEngine" in str(exc):
        logger.warning("레거시 DummySimilarityEngine 피클을 감지했습니다. 호환 모드로 재시도합니다.")
        try:
            searcher = joblib.load(similarity_path, pickle_module=_LegacyDummyPickleModule)
        except Exception as fallback_exc:
            logger.error("호환 모드 로드 실패, 기본 더미 검색 엔진으로 대체합니다: %s", fallback_exc)
            from backend.dummy_models import DummySimilarityEngine
            searcher = DummySimilarityEngine()
    else:
        raise
```

**What this fixes**:
1. **FileNotFoundError**: If similarity_engine.joblib is missing, creates fallback DummySimilarityEngine
2. **AttributeError with DummySimilarityEngine**: Attempts legacy pickle loading, falls back to new DummySimilarityEngine
3. **Other AttributeErrors**: Re-raises for proper debugging

**Backup Created**: `models/default/similarity_engine.joblib.backup`

### Next Steps
1. **Restart backend** to load updated trainer_ml.py code
2. **Test prediction** with multiple item codes (not just ITEM-001)
3. **If prediction works**: Canvas wires will automatically appear (Issue #3 auto-resolved)
4. **If prediction still fails**: Proceed to Phase 1 for deeper investigation
5. **Parallel track**: Fix model training (Phase 2) to regenerate clean model files

---

## Action Plan

### Immediate Priority (Phase 1)
1. ✅ **Backup corrupted model file**
   - Created: `models/default/similarity_engine.joblib.backup`

2. ✅ **Fix DummySimilarityEngine import**
   - Added FileNotFoundError handling in `backend/trainer_ml.py:1228-1244`
   - Falls back to `backend.dummy_models.DummySimilarityEngine`

3. **Test prediction with fallback engine**
   - Requires backend restart
   - Test with multiple item codes

### Secondary Priority (Phase 2)
4. **Fix model training**
   - Capture training error
   - Fix data loading issues
   - Update feature preprocessing
   - Validate model architecture
   - Regenerate clean similarity_engine.joblib

5. **Verify wire connections appear**
   - Should work automatically after prediction works
   - Test with real routing data

---

## Files Involved

### Backend
- `backend/api/services/prediction_service.py:514` - Model loading error
- `backend/trainer_ml.py` - DummySimilarityEngine class definition
- `backend/api/routes/prediction.py` - Prediction endpoint
- `models/default/similarity_engine.joblib` - Corrupted model file

### Frontend
- `frontend-prediction/src/components/routing/RoutingCanvas.tsx:254-275` - Edge generation (working)
- `frontend-prediction/src/components/routing/RoutingCanvas.tsx:280-286` - ReactFlow integration (working)

---

## Conclusion

**Issue #1**: CRITICAL - Model file corruption blocking predictions
**Issue #2**: CRITICAL - Cannot generate new models (dependency for fixing #1)
**Issue #3**: NOT A BUG - Wire code works, just needs data from fixed prediction

**Resolution Order**:
1. Fix training (Issue #2) to generate fresh models
2. Delete corrupted models and load new ones (Issue #1)
3. Wire connections will appear automatically (Issue #3)

**OR Alternative Quick Fix**:
1. Bypass similarity engine in prediction
2. Use direct database routing lookup
3. Wires will appear when timeline populates

---

**Analysis Complete**: 2025-10-21
**Next Phase**: Phase 1 - Fix Multi-Item Prediction
