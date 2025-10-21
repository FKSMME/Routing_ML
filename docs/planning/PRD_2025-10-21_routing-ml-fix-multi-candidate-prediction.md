# PRD: Routing ML Multi-Candidate Prediction Enhancement

**Date**: 2025-10-21
**Status**: APPROVED
**Priority**: CRITICAL
**Related QA Report**: [QA_REPORT_2025-10-21_routing-ml-training-prediction-review.md](../../deliverables/QA_REPORT_2025-10-21_routing-ml-training-prediction-review.md)

---

## Executive Summary

현재 라우팅 예측 시스템은 첫 번째 유사 품목만 사용하여 예측하고, 나머지 후보들을 버리고 있습니다. 또한 유사 품목의 실적 데이터를 활용하지 않으며, UI에서 유사 품목 노드를 표시하지 않습니다. 본 프로젝트는 **다중 후보 병합**, **유사 품목 실적 활용**, **UI 시각화 개선**을 통해 예측 정확도와 사용자 경험을 향상시킵니다.

---

## Problem Statement

### 현재 문제점 (QA Report 기반)

1. **단일 후보 선호 문제** (High Priority)
   - `predict_routing_from_similar_items()`가 첫 번째 라우팅 발견 시 `break` (Line 1231)
   - 다수 후보의 공정 정보를 버림 → 예측 안정성 저하
   - 다양한 경로 비교/조합 불가

2. **WORK_ORDER 실적 미활용** (High Priority)
   - `fetch_and_calculate_work_order_times()`는 입력 품목만 조회 (Line 1384)
   - 유사 품목 실적 데이터 미활용 → 시간 예측 부정확
   - 신규 품목의 경우 실적 없음 → 예측 실패

3. **UI 후보 노드 미연동** (High Priority)
   - `PredictionResponse.candidates` 미사용 (routingStore.ts:1194)
   - 유사 품목 목록이 UI에 표시되지 않음
   - 노드 클릭 시 해당 품목 라우팅 전환 불가

4. **고결측 피처 포함** (Medium Priority)
   - DRAW_USE (100%), ITEM_NM_ENG (100%), GROUP3 (99%), SealTypeGrup (84%) 등
   - 모델 신뢰도 저하

---

## Goals and Objectives

### Primary Goals

1. **다중 후보 병합 시스템 구축**
   - 모든 유사 품목의 라우팅을 가중 평균으로 병합
   - 유사도 기반 가중치 적용
   - 공정별 confidence score 산출

2. **유사 품목 실적 데이터 활용**
   - 입력 품목 + 유사 품목 실적 통합 조회
   - 실적 없는 경우 유사 품목 실적으로 대체
   - 가중 평균 기반 시간 예측

3. **UI 시각화 개선**
   - 상단에 유사 품목 노드 리스트 표시
   - 노드 클릭 시 해당 라우팅 시각화
   - 현재 예측 vs 유사 품목 비교 기능

### Success Metrics

- 예측 시 평균 3개 이상 후보 활용
- 실적 없는 품목도 80% 이상 시간 예측 성공
- UI에서 유사 품목 노드 클릭률 50% 이상

---

## Requirements

### Functional Requirements

#### FR-1: Multi-Candidate Routing Aggregation
- **FR-1.1**: 모든 유사 품목 (top_k)의 라우팅 조회
- **FR-1.2**: 공통 공정 추출 및 병합
- **FR-1.3**: 유사도 기반 가중 평균 계산
- **FR-1.4**: 병합된 라우팅에 source items 정보 추가

#### FR-2: Similar Item Work Order Integration
- **FR-2.1**: 유사 품목의 WORK_ORDER 실적 조회
- **FR-2.2**: 입력 품목 실적 우선, 없으면 유사 품목 실적 사용
- **FR-2.3**: 공정별 가중 평균 시간 계산
- **FR-2.4**: Confidence level 산출 (실적 샘플 수 기반)

#### FR-3: UI Candidate Node Visualization
- **FR-3.1**: `PredictionResponse.candidates`를 routingStore에 저장
- **FR-3.2**: 상단에 후보 품목 노드 탭 표시
- **FR-3.3**: 노드 클릭 시 해당 품목 라우팅으로 timeline 전환
- **FR-3.4**: 현재 노드 vs 예측 노드 비교 뷰

#### FR-4: High-Missing-Rate Feature Cleanup
- **FR-4.1**: 결측률 80% 이상 피처 식별
- **FR-4.2**: 제거 또는 대체 전략 수립
- **FR-4.3**: 학습 전처리에서 제외
- **FR-4.4**: 가중치 재계산

### Non-Functional Requirements

- **NFR-1**: 예측 응답 시간 < 3초 유지
- **NFR-2**: UI 렌더링 < 500ms
- **NFR-3**: 기존 단일 품목 예측 기능 100% 호환
- **NFR-4**: 레거시 v1 모델 호환성 유지

---

## Phase Breakdown

### Phase 1: Backend - Multi-Candidate Aggregation (ETA: 4h)
**Goal**: `predict_routing_from_similar_items()` 수정하여 모든 후보 병합

**Tasks**:
1. `backend/predictor_ml.py:1185-1250` 수정
2. `break` 제거, 모든 후보 루프 완료
3. 공통 공정(PROC_SEQ) 추출
4. 유사도 기반 가중 평균 로직 구현
5. 병합 결과에 source_items, similarity_scores 추가
6. 단위 테스트 작성

**Acceptance Criteria**:
- 모든 유사 품목 라우팅 조회
- 병합된 라우팅 DataFrame 반환
- source_items 메타데이터 포함
- 기존 단일 품목 예측 테스트 통과

---

### Phase 2: Backend - Similar Item Work Order (ETA: 3h)
**Goal**: `fetch_and_calculate_work_order_times()` 확장

**Tasks**:
1. `backend/predictor_ml.py:1384` 수정
2. 유사 품목 실적 조회 추가
3. 입력 품목 우선, fallback to similar items
4. 가중 평균 계산 (유사도 기반)
5. Confidence level 산출
6. 단위 테스트 작성

**Acceptance Criteria**:
- 유사 품목 실적 조회 성공
- 입력 품목 실적 없어도 예측 가능
- Confidence score 포함
- 테스트 커버리지 80% 이상

---

### Phase 3: Frontend - Candidate Node UI (ETA: 5h)
**Goal**: 유사 품목 노드 시각화 및 상호작용

**Tasks**:
1. `routingStore.loadRecommendations()` 수정하여 candidates 저장
2. 상단 노드 탭 컴포넌트 생성 (`CandidateNodeTabs.tsx`)
3. 노드 클릭 이벤트 핸들러 구현
4. timeline 전환 로직 추가
5. 현재 vs 유사 품목 비교 뷰
6. 스타일링 및 반응형 디자인

**Acceptance Criteria**:
- 유사 품목 노드 리스트 표시
- 노드 클릭 시 라우팅 전환
- 유사도 점수 표시
- 현재/이전 노드 하이라이트

---

### Phase 4: Feature Cleanup (ETA: 2h)
**Goal**: 고결측 피처 제거

**Tasks**:
1. 결측률 80% 이상 피처 목록 작성
2. `backend/constants.py` TRAIN_FEATURES 수정
3. 제외 피처 목록 문서화
4. 학습 파이프라인 테스트
5. 가중치 파일 재생성

**Acceptance Criteria**:
- DRAW_USE, ITEM_NM_ENG, GROUP3 제외
- 학습 정상 완료
- 예측 정확도 유지 또는 향상
- 문서 업데이트

---

### Phase 5: Integration Testing (ETA: 2h)
**Goal**: 전체 플로우 검증

**Tasks**:
1. End-to-end 예측 테스트 (다중 후보)
2. UI 노드 클릭 플로우 테스트
3. 성능 테스트 (응답 시간)
4. 레거시 호환성 테스트
5. 문서 업데이트

**Acceptance Criteria**:
- 전체 플로우 정상 작동
- 응답 시간 < 3초
- UI 렌더링 < 500ms
- 모든 테스트 통과

---

## Timeline Estimates

| Phase | ETA | Dependencies |
|-------|-----|--------------|
| Phase 1 | 4h | None |
| Phase 2 | 3h | Phase 1 |
| Phase 3 | 5h | Phase 1, 2 |
| Phase 4 | 2h | None (parallel) |
| Phase 5 | 2h | All phases |
| **Total** | **16h** | |

---

## Technical Design

### Backend Changes

#### 1. `predict_routing_from_similar_items()` Refactoring

**Before**:
```python
for sim_item, sim_score in similar_items:
    routing_df = fetch_routing_for_item(sim_item)
    if not routing_df.empty:
        return routing_df  # ❌ Early exit
        break
```

**After**:
```python
candidate_routings = []
for sim_item, sim_score in similar_items:
    routing_df = fetch_routing_for_item(sim_item)
    if not routing_df.empty:
        candidate_routings.append({
            'item': sim_item,
            'score': sim_score,
            'routing': routing_df
        })

# Merge all candidates with weighted averaging
merged_routing = _merge_candidate_routings(candidate_routings)
return merged_routing
```

#### 2. `_merge_candidate_routings()` Implementation

```python
def _merge_candidate_routings(candidates: List[Dict]) -> pd.DataFrame:
    """
    Merge multiple routing candidates using weighted averaging.

    Args:
        candidates: List of {item, score, routing} dicts

    Returns:
        Merged routing DataFrame with source_items metadata
    """
    # 1. Extract common PROC_SEQ
    # 2. For each PROC_SEQ, weighted average of time/params
    # 3. Add metadata: source_items, similarity_scores
    pass
```

#### 3. `fetch_and_calculate_work_order_times()` Extension

```python
def fetch_and_calculate_work_order_times(
    item_cd: str,
    similar_items: List[Tuple[str, float]] = None
) -> Dict:
    # 1. Try input item first
    # 2. If empty, try similar items
    # 3. Weighted average based on similarity
    # 4. Calculate confidence level
    pass
```

### Frontend Changes

#### 1. Store Enhancement

```typescript
interface RoutingState {
  candidates: CandidateRouting[];  // NEW
  activeCandidateIndex: number | null;  // NEW
  // ... existing fields
}

const loadRecommendations = (response: PredictionResponse) => {
  state.candidates = response.candidates;  // NEW
  // ... existing logic
};
```

#### 2. Component Structure

```
CandidateNodeTabs.tsx (NEW)
  ├── CandidateNodeCard.tsx
  │   ├── Item Code
  │   ├── Similarity Score
  │   └── Click Handler
  └── ComparisonView.tsx
      ├── Current Routing
      └── Selected Candidate
```

---

## Success Criteria

### Technical Criteria
- [ ] All unit tests pass (coverage ≥ 80%)
- [ ] Integration tests pass
- [ ] Performance metrics met (< 3s response)
- [ ] No regression in existing features

### Business Criteria
- [ ] 평균 3개 이상 후보 활용
- [ ] 실적 없는 품목 예측 성공률 ≥ 80%
- [ ] UI 노드 표시 정상 작동
- [ ] 사용자 피드백 긍정적

### Documentation Criteria
- [ ] PRD 완료
- [ ] CHECKLIST 완료
- [ ] API 문서 업데이트
- [ ] Work history 문서 생성

---

## Risks and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 병합 로직 복잡도 | High | Medium | 단계별 테스트, 명확한 알고리즘 문서화 |
| 성능 저하 | High | Low | 캐싱 전략, 병렬 처리 |
| UI 복잡도 증가 | Medium | Medium | 단순한 UX 디자인, 점진적 공개 |
| 레거시 호환성 | Medium | Low | 철저한 회귀 테스트 |

---

## Dependencies

- Backend: Python 3.10+, pandas, numpy
- Frontend: React, TypeScript, Zustand
- Database: MSSQL (ERP), PostgreSQL (internal)
- Models: v1 compatibility layer

---

## Out of Scope

- PostgreSQL test migration (별도 태스크)
- DB 비밀 관리 개선 (별도 태스크)
- ERP 뷰 전환 로드맵 (별도 태스크)
- 새로운 ML 모델 학습 (현재 모델 사용)

---

**Approved By**: System Analysis (QA Report 2025-10-21)
**Next Steps**: Create detailed CHECKLIST
