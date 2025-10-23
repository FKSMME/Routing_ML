# PRD: Frontend-Training 학습 메뉴 통합 및 정리

**Date**: 2025-10-23
**Author**: Claude
**Status**: Active
**Priority**: High

---

## Executive Summary

Frontend-training 애플리케이션에 학습 관련 메뉴가 과도하게 많고 중복되어 있습니다. 백엔드 로그 분석 결과, 일부 API 엔드포인트는 404 에러를 반환하며 실제로 사용되지 않고 있습니다. 본 작업은 9개의 메뉴 중 중복 및 사용되지 않는 메뉴를 제거하고, 기능을 통합하여 사용자 경험을 개선하는 것을 목표로 합니다.

---

## Problem Statement

### 현재 상황

**App.tsx 메뉴 구조 (9개)**:
1. **algorithm** - 알고리즘 블루프린트 그래프
2. **training-status** - 훈련 상태 현황 (모델 버전 카드, TensorBoard 지표)
3. **tensorboard** - 3D 임베딩 시각화
4. **model-training** - 새 모델 학습 실행
5. **options** - 시스템 옵션 (표준값, 유사도, ERP/MSSQL)
6. **quality-monitor** - Iterative Training 품질 추세
7. **training-monitor** - Iterative Training 진행 상태
8. **training-settings** - Iterative Training 파라미터
9. **log-viewer** - 훈련/예측 로그

### 발견된 문제점

**백엔드 로그 분석** (2025-10-23 16:50~16:57):

1. **404 에러가 많이 발생**:
   ```
   GET /api/training/logs - 404 (log-viewer에서 사용)
   GET /api/training/tensorboard/projectors/archive/version_20251021083443/filters - 404
   GET /api/training/tensorboard/projectors/archive/version_20251021083443/points - 404
   GET /api/training/tensorboard/metrics/archive/version_20251021083443 - 404
   GET /api/training/tensorboard/projectors/archive/version_20251021083443/tsne - 404
   ```

2. **중복 기능 추정**:
   - `training-status`와 `training-monitor` - 이름이 유사하고 기능 중복 가능성
   - `model-training`과 `training-monitor` - 학습 실행과 모니터링 기능
   - `quality-monitor`와 `training-monitor` - 모니터링 기능 중복

3. **API 사용 빈도** (로그 기준):
   - `/api/trainer/status` - 자주 호출됨 ✅
   - `/api/trainer/metrics` - 자주 호출됨 ✅
   - `/api/trainer/runs` - 자주 호출됨 ✅
   - `/api/training/features` - 자주 호출됨 ✅
   - `/api/training/tensorboard/config` - 호출되나 데이터 없음 ⚠️
   - `/api/training/tensorboard/projectors` - 호출되나 404 많음 ⚠️
   - `/api/training/logs` - 404만 발생 ❌

---

## Goals and Objectives

### Primary Goals

1. **메뉴 수 감소**: 9개 → 6개 이하로 축소
2. **중복 제거**: 유사 기능을 하나로 통합
3. **404 에러 제거**: 사용되지 않는 기능 제거 또는 수정
4. **사용자 경험 개선**: 직관적인 메뉴 구조로 재편

### Secondary Goals

1. **코드 정리**: 사용되지 않는 컴포넌트 삭제
2. **문서화**: 변경사항 기록
3. **테스트 업데이트**: 제거된 메뉴 관련 테스트 정리

---

## Requirements

### Functional Requirements

#### FR1: 메뉴 통합 계획

**통합 1: training-status + model-training**
- **새 이름**: `training-dashboard` (훈련 대시보드)
- **기능**:
  - 현재 훈련 상태 표시 (training-status)
  - 모델 버전 카드 (training-status)
  - 새 학습 실행 버튼/패널 (model-training)
- **이유**: 학습 상태 확인과 실행을 한 화면에서 관리

**통합 2: training-monitor + quality-monitor**
- **새 이름**: `training-monitor` (훈련 모니터)
- **기능**:
  - Iterative Training 진행 상태
  - 품질 지표 및 추세
- **이유**: 진행 상태와 품질을 함께 모니터링

**제거 1: log-viewer**
- **이유**: `/api/training/logs` 엔드포인트가 존재하지 않음 (404)
- **대안**: Browser DevTools 또는 서버 로그 사용

**제거 2: tensorboard (조건부)**
- **조건**: TensorBoard 데이터가 없거나 사용되지 않는 경우
- **로그 분석**: 여러 404 에러 발생
- **대안**: Training Dashboard에 주요 지표만 표시
- **보류**: 추후 TensorBoard 데이터 생성 시 재추가 가능

#### FR2: 최종 메뉴 구조 (6개)

1. **algorithm** - 알고리즘 블루프린트 그래프 (유지)
2. **training-dashboard** - 훈련 대시보드 (NEW: status + model-training 통합)
3. **training-monitor** - 훈련 모니터 (NEW: monitor + quality 통합)
4. **training-settings** - 훈련 설정 (유지)
5. **tensorboard** - TensorBoard (조건부 보류/제거)
6. **options** - 시스템 옵션 (유지)

### Non-Functional Requirements

#### NFR1: 성능
- 메뉴 전환 시간: <200ms
- API 호출 최소화: 중복 호출 제거

#### NFR2: 호환성
- 기존 북마크/URL 쿼리 파라미터 호환성 유지
- 기존 메뉴 ID를 새 ID로 리다이렉트

#### NFR3: 코드 품질
- 사용되지 않는 컴포넌트 제거
- Import 정리
- 테스트 업데이트

---

## Phase Breakdown

### Phase 1: 분석 및 문서화 (1 hour)

**Tasks**:
1. 각 컴포넌트 기능 상세 분석
   - TrainingStatusWorkspace.tsx
   - ModelTrainingPanel.tsx
   - TrainingMonitor.tsx
   - QualityDashboard.tsx
   - LogViewer.tsx
   - TensorboardWorkspace.tsx
2. API 의존성 매핑
3. 통합 계획 최종 확정

**Deliverables**:
- 컴포넌트 기능 분석 문서
- API 의존성 다이어그램
- 통합 계획 승인

### Phase 2: TrainingDashboard 통합 (2 hours)

**Tasks**:
1. TrainingDashboard.tsx 생성
2. TrainingStatusWorkspace 내용 통합
3. ModelTrainingPanel 내용 통합
4. API 호출 최적화 (중복 제거)
5. UI 레이아웃 개선

**Deliverables**:
- components/workspaces/TrainingDashboard.tsx

### Phase 3: TrainingMonitor 통합 (1.5 hours)

**Tasks**:
1. TrainingMonitor.tsx 업데이트
2. QualityDashboard 기능 통합
3. 품질 지표 차트 추가
4. 진행 상태와 품질 탭 구성

**Deliverables**:
- 업데이트된 components/training/TrainingMonitor.tsx

### Phase 4: App.tsx 메뉴 업데이트 (1 hour)

**Tasks**:
1. BASE_NAVIGATION_ITEMS 업데이트
2. Switch case 업데이트
3. 이전 메뉴 ID → 새 메뉴 ID 리다이렉트 로직 추가
4. LogViewer import 제거
5. (선택) TensorboardWorkspace 조건부 제거

**Deliverables**:
- 업데이트된 App.tsx

### Phase 5: 사용하지 않는 파일 정리 (0.5 hour)

**Tasks**:
1. TrainingStatusWorkspace.tsx 삭제
2. ModelTrainingPanel.tsx 삭제
3. QualityDashboard.tsx 삭제 (기능이 TrainingMonitor에 통합됨)
4. LogViewer.tsx 삭제
5. (선택) TensorboardWorkspace.tsx 삭제

**Deliverables**:
- 정리된 codebase

### Phase 6: 테스트 및 검증 (1 hour)

**Tasks**:
1. 각 메뉴 동작 확인
2. API 호출 검증
3. 404 에러 제거 확인
4. 메뉴 전환 성능 측정
5. 리다이렉트 동작 확인

**Deliverables**:
- 테스트 결과 보고서

---

## Success Criteria

### Quantitative Metrics

- ✅ 메뉴 수: 9개 → 6개 이하
- ✅ 404 에러: 5+ → 0개
- ✅ 중복 API 호출: 감소율 >30%
- ✅ 사용하지 않는 컴포넌트: 4~5개 삭제

### Qualitative Metrics

- ✅ 메뉴 이름이 직관적이고 명확함
- ✅ 학습 관련 기능이 논리적으로 그룹화됨
- ✅ 사용자가 원하는 기능을 빠르게 찾을 수 있음

---

## Timeline Estimates

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1 | 1.0h | None |
| Phase 2 | 2.0h | Phase 1 |
| Phase 3 | 1.5h | Phase 2 |
| Phase 4 | 1.0h | Phase 2, 3 |
| Phase 5 | 0.5h | Phase 4 |
| Phase 6 | 1.0h | Phase 5 |
| **Total** | **7.0h** | |

---

## Risks and Mitigations

### Risk 1: 사용자가 이전 메뉴를 찾지 못함
- **Mitigation**: URL 리다이렉트 로직 추가, 메뉴 이름 명확화

### Risk 2: 통합 시 기능 누락
- **Mitigation**: Phase 1에서 상세 기능 분석, Phase 6에서 철저한 검증

### Risk 3: TensorBoard 데이터 필요 시
- **Mitigation**: 조건부 제거, 필요 시 재추가 가능하도록 설계

---

## Open Questions

1. **TensorBoard 완전 제거 여부?**
   - 현재: 404 에러 많음
   - 결정 필요: 완전 제거 vs 조건부 보류

2. **이전 메뉴 북마크 호환성**
   - `?menu=training-status` → `?menu=training-dashboard`
   - 리다이렉트 기간: 영구 vs 일시적

3. **백엔드 API 정리**
   - `/api/training/logs` 엔드포인트 추가 필요 여부
   - TensorBoard API 수정 필요 여부

---

## References

- App.tsx: lines 29-84 (BASE_NAVIGATION_ITEMS)
- App.tsx: lines 236-266 (workspace switch)
- Backend logs: 2025-10-23 16:50~16:57
- WORKFLOW_DIRECTIVES.md

---

**End of PRD**
