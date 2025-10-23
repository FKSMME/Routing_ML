# Checklist: Frontend-Training 학습 메뉴 통합 및 정리

**Date**: 2025-10-23
**Related PRD**: docs/planning/PRD_2025-10-23_frontend-training-menu-consolidation.md
**Status**: In Progress

---

## Phase 1: 분석 및 문서화 (1 hour)

**Goal**: 각 컴포넌트의 실제 기능을 상세히 분석하고 통합 계획을 최종 확정합니다.

- [ ] TrainingStatusWorkspace.tsx 기능 분석
  - API 호출: /api/trainer/status, /api/trainer/metrics, /api/trainer/runs, /api/training/features
  - UI 구성: 메트릭 카드, feature weights 차트, 실행 기록 테이블

- [ ] ModelTrainingPanel.tsx 기능 분석
  - API 호출 확인
  - 학습 실행 버튼/폼 구조 파악

- [ ] TrainingMonitor.tsx 기능 분석
  - Iterative Training 진행 상태 표시 방식
  - API 호출 및 polling 간격

- [ ] QualityDashboard.tsx 기능 분석
  - 품질 지표 종류
  - 차트 구성

- [ ] LogViewer.tsx 확인
  - /api/training/logs 404 에러 확인
  - 제거 필요성 검증

- [ ] TensorboardWorkspace.tsx & TensorboardEmbeddingPanel.tsx 확인
  - 404 에러 발생 패턴 분석
  - 보류 vs 제거 결정

- [ ] 통합 계획 최종 확정
  - TrainingDashboard 구성 확정
  - TrainingMonitor 통합 방식 확정
  - 제거 대상 컴포넌트 목록 확정

**Estimated Time**: 1.0 hour
**Status**: Not Started

---

## Phase 2: TrainingDashboard 생성 및 통합 (2 hours)

**Goal**: training-status와 model-training을 하나의 TrainingDashboard로 통합합니다.

- [ ] TrainingDashboard.tsx 컴포넌트 파일 생성
  - 위치: frontend-training/src/components/workspaces/TrainingDashboard.tsx
  - 초기 구조 설정 (imports, interface, layout)

- [ ] TrainingStatusWorkspace 내용 이전
  - 메트릭 카드 섹션 (status, metrics)
  - Feature weights 차트
  - 실행 기록 테이블
  - useQuery hooks 및 polling 로직

- [ ] ModelTrainingPanel 내용 통합
  - 학습 실행 버튼/폼 추가
  - 기존 위치와 다른 섹션으로 배치
  - 학습 시작 API 호출 로직

- [ ] API 호출 최적화
  - 중복 호출 제거
  - useQuery 옵션 최적화 (staleTime, cacheTime)
  - Error handling 개선

- [ ] UI 레이아웃 개선
  - Grid 또는 Flexbox 레이아웃
  - 반응형 디자인 적용
  - 섹션별 구분 (메트릭, Feature Weights, 실행 기록, 새 학습)

- [ ] Export TrainingDashboard from workspaces index (if exists)

**Estimated Time**: 2.0 hours
**Status**: Not Started

---

## Phase 3: TrainingMonitor 업데이트 및 통합 (1.5 hours)

**Goal**: training-monitor와 quality-monitor를 하나로 통합합니다.

- [ ] QualityDashboard 기능 분석 완료 확인 (Phase 1 결과 참조)

- [ ] TrainingMonitor.tsx 업데이트
  - 기존 진행 상태 표시 유지
  - 품질 지표 섹션 추가 준비

- [ ] QualityDashboard 기능 통합
  - 품질 지표 차트 컴포넌트 이전
  - API 호출 로직 통합
  - 품질 추세 데이터 처리

- [ ] 탭 구조 설계 (선택)
  - 진행 상태 탭
  - 품질 지표 탭
  - 또는 단일 화면에 모두 표시

- [ ] UI 레이아웃 조정
  - 진행 상태와 품질 지표의 시각적 조화
  - 중요 지표 강조

- [ ] API 호출 최적화
  - Polling 간격 조정
  - Error handling

**Estimated Time**: 1.5 hours
**Status**: Not Started

---

## Phase 4: App.tsx 메뉴 업데이트 (1 hour)

**Goal**: App.tsx의 메뉴 구조를 업데이트하고 이전 메뉴 ID에서 새 ID로 리다이렉트합니다.

- [ ] BASE_NAVIGATION_ITEMS 업데이트
  - "training-status" 제거
  - "model-training" 제거
  - "training-dashboard" 추가 (icon: BarChart3, label: "훈련 대시보드")
  - "quality-monitor" 제거 (기능이 training-monitor에 통합됨)
  - "log-viewer" 제거
  - (선택) "tensorboard" 제거 또는 주석 처리

- [ ] Workspace switch case 업데이트
  - case "training-dashboard": <TrainingDashboard /> 추가
  - case "training-status", "model-training" 제거
  - case "quality-monitor" 제거
  - case "log-viewer" 제거
  - (선택) case "tensorboard" 제거

- [ ] 이전 메뉴 ID → 새 메뉴 ID 리다이렉트 로직 추가
  - useEffect 또는 URL 파싱 로직에서 처리
  - "training-status" → "training-dashboard"
  - "model-training" → "training-dashboard"
  - "quality-monitor" → "training-monitor"

- [ ] Import 업데이트
  - TrainingDashboard import 추가
  - 제거된 컴포넌트 import 삭제
    - TrainingStatusWorkspace
    - ModelTrainingPanel
    - QualityDashboard (lazy import)
    - LogViewer (lazy import)
    - (선택) TensorboardWorkspace

- [ ] Lazy import 정리
  - 사용하지 않는 lazy import 제거

**Estimated Time**: 1.0 hour
**Status**: Not Started

---

## Phase 5: 사용하지 않는 파일 정리 (0.5 hour)

**Goal**: 통합 완료 후 사용되지 않는 파일을 삭제합니다.

- [ ] 파일 삭제 (git rm 사용)
  - frontend-training/src/components/workspaces/TrainingStatusWorkspace.tsx
  - frontend-training/src/components/ModelTrainingPanel.tsx
  - frontend-training/src/components/quality/QualityDashboard.tsx
  - frontend-training/src/components/quality/LogViewer.tsx
  - (선택) frontend-training/src/components/workspaces/TensorboardWorkspace.tsx
  - (선택) frontend-training/src/components/tensorboard/TensorboardEmbeddingPanel.tsx

- [ ] 관련 테스트 파일 확인 및 정리
  - 삭제된 컴포넌트의 테스트 파일 확인
  - 필요 시 테스트 업데이트 또는 삭제

- [ ] Import 정리 확인
  - 프로젝트 전체에서 삭제된 컴포넌트 import 검색
  - 남아있는 import 제거

**Estimated Time**: 0.5 hour
**Status**: Not Started

---

## Phase 6: 테스트 및 검증 (1 hour)

**Goal**: 모든 메뉴가 정상 동작하고 404 에러가 제거되었는지 확인합니다.

- [ ] 각 메뉴 동작 확인
  - algorithm 메뉴 정상 동작
  - training-dashboard 메뉴 정상 동작
    - 메트릭 카드 표시
    - Feature weights 차트 표시
    - 실행 기록 테이블 표시
    - 새 학습 버튼/폼 동작
  - training-monitor 메뉴 정상 동작
    - 진행 상태 표시
    - 품질 지표 표시
  - training-settings 메뉴 정상 동작
  - options 메뉴 정상 동작
  - (선택) tensorboard 메뉴 정상 동작 또는 제거 확인

- [ ] API 호출 검증 (Browser DevTools Network 탭)
  - 404 에러 제거 확인
    - /api/training/logs - 더 이상 호출되지 않음
    - TensorBoard 관련 404 제거 (제거 시)
  - 중복 API 호출 감소 확인
  - 정상 API 응답 확인

- [ ] 리다이렉트 동작 확인
  - ?menu=training-status → training-dashboard 리다이렉트
  - ?menu=model-training → training-dashboard 리다이렉트
  - ?menu=quality-monitor → training-monitor 리다이렉트

- [ ] 메뉴 전환 성능 측정
  - 각 메뉴 전환 시간 <200ms 확인
  - 부드러운 전환 애니메이션 확인

- [ ] 전체 기능 회귀 테스트
  - 각 메뉴의 핵심 기능 동작 확인
  - 데이터 로딩 및 표시 확인
  - Error handling 동작 확인

**Estimated Time**: 1.0 hour
**Status**: Not Started

---

## Git Operations (Phase별 수행)

### Phase 1 완료 후
- [ ] Git staging 완전성 확인
  - `git status` 실행 ✅
  - `git add -A` 실행 ✅
  - `git status` 재확인 → "Changes not staged" 없음 ✅
- [ ] Commit Phase 1: "feat: Complete Phase 1 - 학습 메뉴 분석 완료"
- [ ] Push to 251014
- [ ] Merge 전 검증
  - `git diff main..251014` 확인 ✅
  - 예상치 못한 변경사항 없음 확인 ✅
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

### Phase 2 완료 후
- [ ] Git staging 완전성 확인
- [ ] Commit Phase 2: "feat: Complete Phase 2 - TrainingDashboard 생성 및 통합"
- [ ] Push to 251014
- [ ] Merge 전 검증
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

### Phase 3 완료 후
- [ ] Git staging 완전성 확인
- [ ] Commit Phase 3: "feat: Complete Phase 3 - TrainingMonitor 업데이트 및 통합"
- [ ] Push to 251014
- [ ] Merge 전 검증
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

### Phase 4 완료 후
- [ ] Git staging 완전성 확인
- [ ] Commit Phase 4: "feat: Complete Phase 4 - App.tsx 메뉴 업데이트"
- [ ] Push to 251014
- [ ] Merge 전 검증
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

### Phase 5 완료 후
- [ ] Git staging 완전성 확인
- [ ] Commit Phase 5: "chore: Complete Phase 5 - 사용하지 않는 파일 정리"
- [ ] Push to 251014
- [ ] Merge 전 검증
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

### Phase 6 완료 후
- [ ] Git staging 완전성 확인
- [ ] Commit Phase 6: "test: Complete Phase 6 - 테스트 및 검증 완료"
- [ ] Push to 251014
- [ ] Merge 전 검증
- [ ] Merge to main
- [ ] Push main
- [ ] Return to 251014

---

## Progress Tracking

```
Phase 1: [░░░░░░░] 0% (0/7 tasks)
Phase 2: [░░░░░░] 0% (0/6 tasks)
Phase 3: [░░░░░] 0% (0/5 tasks)
Phase 4: [░░░░░] 0% (0/5 tasks)
Phase 5: [░░] 0% (0/2 tasks)
Phase 6: [░░░░░] 0% (0/5 tasks)

Total: [░░░░░░░░░░] 0% (0/30 tasks)
```

---

## Acceptance Criteria

- [ ] 메뉴 수: 9개 → 6개 이하 ✅
- [ ] 404 에러: 5+ → 0개 ✅
- [ ] 중복 API 호출: 감소율 >30% ✅
- [ ] 사용하지 않는 컴포넌트: 4~5개 삭제 ✅
- [ ] All tasks completed and marked [x]
- [ ] All phases committed and merged
- [ ] 기능 회귀 없음 (모든 핵심 기능 정상 동작)
- [ ] No empty checkboxes [ ] remaining

---

## Notes

- **TensorBoard 결정**: Phase 1에서 404 에러 분석 후 최종 결정
- **리다이렉트 기간**: 영구 리다이렉트 적용 (북마크 호환성)
- **백엔드 API**: 본 작업에서는 프론트엔드만 수정, 백엔드는 별도 작업

---

**Last Updated**: 2025-10-23
**Next Review**: After Phase 1 completion
