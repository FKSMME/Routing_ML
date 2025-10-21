# Integration Test Checklist: Multi-Candidate Routing Prediction

**Date**: 2025-10-21
**Related PRD**: [PRD_2025-10-21_routing-ml-fix-multi-candidate-prediction.md](PRD_2025-10-21_routing-ml-fix-multi-candidate-prediction.md)
**Status**: Ready for Testing
**Test Environment**: Live system required

---

## Overview

이 체크리스트는 다중 후보 라우팅 예측 시스템의 런타임 통합 테스트를 위한 가이드입니다.
**Prerequisites**: 백엔드 및 프론트엔드 배포 완료

---

## Phase 1: Backend Multi-Candidate Aggregation Tests

### 1.1 Basic Multi-Candidate Functionality
- [ ] **Test Case 1.1.1**: 3개 이상의 유사 품목이 있는 품목 조회
  - **Input**: 유사 품목 3개 이상인 ITEM_CD
  - **Expected**: 모든 유사 품목의 라우팅이 병합됨 (break 없음)
  - **Verify**: 로그에서 "다중 후보 병합" 메시지 확인

- [ ] **Test Case 1.1.2**: 유사도 기반 가중 평균 검증
  - **Input**: 유사도 점수가 다른 후보들 (예: 0.9, 0.7, 0.5)
  - **Expected**: 높은 유사도 후보의 영향력이 더 큼
  - **Verify**: 예측된 시간이 가중 평균 범위 내

- [ ] **Test Case 1.1.3**: 단일 후보 품목 처리
  - **Input**: 유사 품목 1개만 있는 ITEM_CD
  - **Expected**: 정상 동작 (병합 로직이 단일 항목 처리)
  - **Verify**: 오류 없이 예측 반환

### 1.2 Edge Cases
- [ ] **Test Case 1.2.1**: 유사 품목 없음 (zero similar items)
  - **Input**: 매우 독특한 품목 (유사 품목 0개)
  - **Expected**: 기본 라우팅 또는 빈 결과 graceful 반환
  - **Verify**: 500 에러 없이 처리

- [ ] **Test Case 1.2.2**: 모든 후보가 동일한 유사도
  - **Input**: 유사도 점수가 모두 동일한 후보들
  - **Expected**: 균등 가중 평균
  - **Verify**: 예측 결과가 산술 평균과 동일

---

## Phase 2: WORK_ORDER Integration Tests

### 2.1 Similar Items Fallback
- [ ] **Test Case 2.1.1**: 입력 품목 실적 있음
  - **Input**: WORK_ORDER 실적이 있는 ITEM_CD
  - **Expected**: 입력 품목 실적 사용, confidence = 1.0
  - **Verify**: `data_source: 'input'`, `has_work_data: true`

- [ ] **Test Case 2.1.2**: 입력 품목 실적 없음, 유사 품목 실적 있음
  - **Input**: 신규 품목 (실적 없음), 유사 품목 실적 있음
  - **Expected**: 유사 품목 실적으로 fallback, confidence < 0.8
  - **Verify**: `data_source: 'similar'`, 로그에 "유사 품목 조회 시작"

- [ ] **Test Case 2.1.3**: 입력 및 유사 품목 모두 실적 없음
  - **Input**: 신규 품목, 유사 품목도 실적 없음
  - **Expected**: `has_work_data: false`, confidence = 0.0
  - **Verify**: `data_source: 'none'`

### 2.2 Similarity-Weighted Averaging
- [ ] **Test Case 2.2.1**: 유사 품목 실적 가중 평균
  - **Input**: 유사 품목 3개, 각각 다른 SETUP_TIME/RUN_TIME
  - **Expected**: 유사도로 가중된 시간 평균
  - **Verify**: `predicted_setup_time`, `predicted_run_time` 계산 확인

- [ ] **Test Case 2.2.2**: Confidence score 계산
  - **Input**: 다양한 sample_count (1, 5, 10, 20)
  - **Expected**:
    - input: min(1.0, sample_count / 10.0)
    - similar: min(0.8, (sample_count / 20.0) * avg_similarity)
  - **Verify**: confidence 값이 0-1 범위 내

---

## Phase 3: UI Candidate Nodes Display Tests

### 3.1 CandidateNodeTabs Rendering
- [ ] **Test Case 3.1.1**: 후보 노드 표시
  - **Input**: 유사 품목 5개 있는 예측 실행
  - **Expected**: "Similar Items" 섹션에 5개 카드 표시
  - **Verify**: 각 카드에 ITEM_CD, 유사도 %, Rank 표시

- [ ] **Test Case 3.1.2**: 빈 후보 처리
  - **Input**: 유사 품목 0개인 예측 실행
  - **Expected**: CandidateNodeTabs가 렌더링되지 않음 (null 반환)
  - **Verify**: 컴포넌트 숨김, 에러 없음

- [ ] **Test Case 3.1.3**: 유사도 색상 코딩
  - **Input**: 유사도 95%, 85%, 75%, 60%인 후보들
  - **Expected**:
    - 95% → 녹색 배지
    - 85% → 파란색 배지
    - 75% → 노란색 배지
    - 60% → 회색 배지
  - **Verify**: 시각적으로 색상 확인

### 3.2 Candidate Selection
- [ ] **Test Case 3.2.1**: 후보 노드 클릭
  - **Input**: 두 번째 후보 카드 클릭
  - **Expected**:
    - 파란 테두리/배경 활성화
    - 하단에 선택 정보 패널 표시
  - **Verify**: `activeCandidateIndex = 1`

- [ ] **Test Case 3.2.2**: Clear selection 버튼
  - **Input**: 후보 선택 후 "Clear selection" 클릭
  - **Expected**: 선택 해제, 정보 패널 사라짐
  - **Verify**: `activeCandidateIndex = null`

- [ ] **Test Case 3.2.3**: 라우팅 전환 (Future Feature)
  - **Note**: 현재 구현되지 않음, 향후 개발 필요
  - **Expected**: 후보 클릭 시 해당 품목 라우팅으로 타임라인 전환

### 3.3 Responsive Design
- [ ] **Test Case 3.3.1**: 모바일 화면 (< 640px)
  - **Expected**: min-w-[140px], px-3 py-2, text-xs
  - **Verify**: 카드 크기 및 간격 확인

- [ ] **Test Case 3.3.2**: 태블릿/데스크톱 (≥ 640px)
  - **Expected**: min-w-[160px], px-4 py-3, text-sm
  - **Verify**: 카드 크기 및 간격 확인

### 3.4 Accessibility
- [ ] **Test Case 3.4.1**: 키보드 네비게이션
  - **Input**: Tab 키로 후보 카드 이동, Enter/Space로 선택
  - **Expected**: focus ring 표시, Enter/Space로 선택 가능
  - **Verify**: 키보드만으로 완전한 조작 가능

- [ ] **Test Case 3.4.2**: 스크린 리더
  - **Input**: 스크린 리더 활성화
  - **Expected**:
    - aria-label 읽기: "Candidate item XXX, rank N, XX% similarity"
    - aria-live로 선택 상태 변경 알림
  - **Verify**: NVDA/JAWS로 테스트

---

## Phase 4: Feature Cleanup Verification

### 4.1 Removed Features Handling
- [ ] **Test Case 4.1.1**: 기존 모델 예측 (41 features trained)
  - **Input**: 현재 TRAIN_FEATURES (38개) → 기존 모델 (41개)
  - **Expected**: 정상 예측, 로그에 "Phase 4.2 제거 피처 감지" 메시지
  - **Verify**: GROUP3, DRAW_USE, ITEM_NM_ENG이 'missing'/'0.0'으로 처리

- [ ] **Test Case 4.1.2**: Feature weights 적용
  - **Input**: feature_weights.json (38 features)
  - **Expected**: 제거된 피처 가중치 0.0
  - **Verify**: 로그에서 "비활성화된 피처 N개가 예측에서 제외됨"

### 4.2 Data Quality
- [ ] **Test Case 4.2.1**: 고결측 피처 제외 효과
  - **Input**: 여러 품목 예측 실행
  - **Expected**: 결측률 100% 피처(DRAW_USE, ITEM_NM_ENG)가 예측에 영향 없음
  - **Verify**: 예측 품질 유지 또는 향상

---

## Phase 5: Model Compatibility Tests

### 5.1 Graceful Degradation
- [ ] **Test Case 5.1.1**: Encoder reindex 동작
  - **Input**: 38개 피처 입력 → 41개 피처 기대 모델
  - **Expected**: 누락 피처 'missing'으로 채움
  - **Verify**: 로그 "입력 데이터 누락 피처: {...} → 'missing'으로 처리"

- [ ] **Test Case 5.1.2**: Scaler reindex 동작
  - **Input**: 인코딩 후 수치형 피처 누락
  - **Expected**: 누락 피처 0.0으로 채움
  - **Verify**: scaled 벡터 차원 정확함 (모델 기대 차원과 일치)

### 5.2 Model Version Compatibility
- [ ] **Test Case 5.2.1**: 기존 v2.1 모델 로드
  - **Input**: models/default/ 디렉토리
  - **Expected**: 모델 로드 성공, metadata 읽기 성공
  - **Verify**: "개선된 모델 로드 시도..." 로그

- [ ] **Test Case 5.2.2**: FeatureWeightManager 로드
  - **Input**: feature_weights.json (v2.1)
  - **Expected**: active_features 반영
  - **Verify**: "FeatureWeightManager 사용 - 활성화된 피처만 가중치 적용"

---

## Performance Tests

### P.1 Response Time
- [ ] **Test Case P.1.1**: 단일 품목 예측 응답 시간
  - **Target**: < 3초
  - **Measure**: 백엔드 API 응답 시간
  - **Verify**: 평균 10회 측정

- [ ] **Test Case P.1.2**: UI 렌더링 시간
  - **Target**: < 500ms
  - **Measure**: CandidateNodeTabs 렌더링 완료까지
  - **Verify**: React DevTools Profiler 사용

### P.2 Concurrent Requests
- [ ] **Test Case P.2.1**: 동시 10개 요청
  - **Input**: 10개 품목 동시 예측
  - **Expected**: 모두 성공, 응답 시간 degradation < 50%
  - **Verify**: 부하 테스트 도구 사용

---

## Regression Tests

### R.1 Existing Functionality
- [ ] **Test Case R.1.1**: 기존 단일 후보 예측
  - **Input**: Phase 1 이전 방식으로 예측 (레거시 호환)
  - **Expected**: 기존 동작 유지
  - **Verify**: 결과 일관성

- [ ] **Test Case R.1.2**: 기존 라우팅 표시
  - **Input**: 예측 결과 → 타임라인 표시
  - **Expected**: 기존 타임라인 렌더링 동작 유지
  - **Verify**: 시각적 회귀 없음

### R.2 Cross-Browser
- [ ] **Test Case R.2.1**: Chrome (최신)
- [ ] **Test Case R.2.2**: Firefox (최신)
- [ ] **Test Case R.2.3**: Edge (최신)
- [ ] **Test Case R.2.4**: Safari (Mac only)

---

## Test Data Preparation

### Required Test Items

1. **다중 후보 품목** (3-5개 유사 품목):
   - 예: `ITEM-MULTI-001`

2. **신규 품목** (실적 없음):
   - 예: `ITEM-NEW-001`

3. **기존 품목** (실적 있음):
   - 예: `ITEM-EXIST-001`

4. **독특한 품목** (유사 품목 없음):
   - 예: `ITEM-UNIQUE-001`

5. **다양한 유사도 품목**:
   - 예: 유사도 95%, 85%, 75%, 60%

---

## Test Execution Plan

### Phase 1: Smoke Tests (1h)
1. 기본 예측 기능 동작 확인
2. UI 렌더링 확인
3. 에러 없이 완료 확인

### Phase 2: Functional Tests (2h)
1. Phase 1-5 모든 테스트 케이스 실행
2. 실패 케이스 기록 및 버그 리포트

### Phase 3: Performance & Regression (1h)
1. 응답 시간 측정
2. 동시 요청 테스트
3. 크로스 브라우저 테스트

### Phase 4: Acceptance (0.5h)
1. 모든 critical 테스트 통과 확인
2. Known issues 문서화
3. Acceptance sign-off

---

## Acceptance Criteria

### Must Pass (Critical)
- [x] Phase 1: 다중 후보 병합 동작
- [ ] Phase 2: 유사 품목 실적 fallback 동작
- [ ] Phase 3: UI 후보 노드 표시
- [ ] Phase 4: 제거 피처 graceful handling
- [ ] Phase 5: 기존 모델 호환성

### Should Pass (High Priority)
- [ ] 성능: < 3초 응답 시간
- [ ] 접근성: 키보드 네비게이션
- [ ] 반응형: 모바일/태블릿/데스크톱

### Nice to Have (Medium Priority)
- [ ] 크로스 브라우저 완벽 호환
- [ ] 동시 요청 성능
- [ ] 스크린 리더 완벽 지원

---

## Bug Reporting Template

```markdown
## Bug Report

**Test Case**: [Test Case ID]
**Severity**: Critical / High / Medium / Low
**Environment**: [Browser, OS, Backend version]

**Steps to Reproduce**:
1.
2.
3.

**Expected Result**:


**Actual Result**:


**Screenshots/Logs**:


**Related Code**: [file:line]
```

---

## Sign-Off

- [ ] **QA Lead**: ___________________ Date: ___________
- [ ] **Backend Developer**: ___________________ Date: ___________
- [ ] **Frontend Developer**: ___________________ Date: ___________
- [ ] **Product Owner**: ___________________ Date: ___________

---

**Created**: 2025-10-21
**Last Updated**: 2025-10-21
**Status**: Ready for Execution
