# PRD: 라우팅 생성 페이지 수정 및 개선

**Date**: 2025-10-23
**Status**: APPROVED
**Priority**: HIGH

---

## Executive Summary

라우팅 생성 페이지(frontend-prediction)의 여러 기능적 문제를 수정하고 사용성을 개선합니다. 주요 이슈는 도면 조회 기능, 모델 로딩 상태 표시, 그리고 UI/UX 개선입니다.

---

## Problem Statement

현재 라우팅 생성 페이지에서 다음과 같은 문제가 발생하고 있습니다:

### 1. 도면 조회 기능 불확실성
- **현상**: 품목 코드(예: 3H54529WD49)로 도면 조회 시 정상 작동 여부 불명확
- **기대 동작**: 품목 코드 → ITEM_INFO 테이블에서 DRAW_NO 조회 → 도면 표시
- **현재 구현**: 백엔드는 정상, 프론트엔드 연동 테스트 필요

### 2. 품목 고정 문제 (상태 지속성)
- **현상**: 한 번 추천 실행 후 해당 품목으로 고정되어 다른 품목 추천 불가능
- **원인**: 상태 초기화 로직 부재 또는 품목 전환 로직 미비
- **영향**: 사용자가 여러 품목을 순차적으로 검색할 수 없음

### 3. 모델 로딩 상태 미표시
- **현상**: 현재 로딩된 모델 상태 표시 없음, 예측 실패 시 원인 파악 어려움
- **필요**: 모델 로딩 상태 표시 및 수동 로딩 기능
- **위치**: "추천 실행" 버튼 근처에 모델 상태 인디케이터 추가

### 4. Canvas 탭 작동 불가
- **현상**: 시각화 패널의 특정 탭 또는 기능이 작동하지 않음
- **확인 필요**: RecommendationsTab 내부의 Canvas 뷰 또는 RoutingCanvas 컴포넌트

---

## Goals and Objectives

### Primary Goals
1. **도면 조회 기능 안정화**: activeItemId 전달 검증 및 오류 처리 개선
2. **품목 전환 개선**: 새로운 품목 검색 시 상태 초기화 및 전환 로직 개선
3. **모델 로딩 상태 표시**: 현재 로딩된 모델 정보 및 상태 표시
4. **Canvas 기능 복구**: Canvas 탭/뷰 정상 작동 확인 및 수정

### Success Metrics
- [ ] 도면 조회 성공률 100% (품목 코드 → DRAW_NO → 도면)
- [ ] 품목 전환 시 상태 초기화 정상 동작
- [ ] 모델 로딩 상태 실시간 표시
- [ ] Canvas 탭/뷰 정상 렌더링 및 상호작용

---

## Requirements

### Functional Requirements

#### FR-1: 도면 조회 개선
- **FR-1.1**: activeItemId가 정확히 품목 코드로 설정되는지 검증
- **FR-1.2**: fetchDrawingInfo() 호출 시 에러 처리 개선
- **FR-1.3**: 도면 정보 없을 시 사용자 친화적 메시지 표시
- **FR-1.4**: 도면 조회 버튼 활성화/비활성화 로직 개선

#### FR-2: 품목 전환 로직 개선
- **FR-2.1**: 새로운 품목 코드 입력 시 기존 상태 초기화
- **FR-2.2**: productTabs 상태 초기화 또는 새 탭 추가 로직 검증
- **FR-2.3**: activeItemId, activeProductId 동기화 확인
- **FR-2.4**: 품목 전환 시 UI 피드백 제공

#### FR-3: 모델 로딩 상태 표시
- **FR-3.1**: 백엔드에서 현재 로딩된 모델 정보 조회 API 추가
- **FR-3.2**: PredictionControls 컴포넌트에 모델 상태 인디케이터 추가
- **FR-3.3**: 모델 미로딩 시 경고 메시지 표시
- **FR-3.4**: 수동 모델 로딩 버튼 추가 (선택사항)

#### FR-4: Canvas 기능 복구
- **FR-4.1**: RecommendationsTab의 Canvas 뷰 렌더링 검증
- **FR-4.2**: RoutingCanvas 컴포넌트 마운트 확인
- **FR-4.3**: Canvas 탭 선택 시 이벤트 핸들링 확인
- **FR-4.4**: 에러 로그 확인 및 수정

### Non-Functional Requirements

#### NFR-1: 성능
- 도면 조회 응답 시간 < 2초
- 모델 정보 조회 응답 시간 < 1초
- 품목 전환 UI 업데이트 < 500ms

#### NFR-2: 사용성
- 에러 메시지는 한국어로 명확하게 표시
- 로딩 상태 시각적 피드백 제공
- 품목 전환 시 부드러운 애니메이션

#### NFR-3: 안정성
- 도면 정보 없을 시 앱 크래시 방지
- 모델 미로딩 시 예측 실행 차단 또는 경고
- 네트워크 오류 시 재시도 로직

---

## Phase Breakdown

### Phase 1: 도면 조회 및 품목 전환 수정 (1-2 hours)
**Tasks**:
1. activeItemId 설정 및 전달 경로 검증
2. fetchDrawingInfo() 에러 처리 개선
3. 품목 전환 시 상태 초기화 로직 추가
4. 품목 전환 UI 피드백 개선

**Deliverables**:
- DrawingViewerButton 컴포넌트 수정
- workspaceStore 또는 routingStore 상태 초기화 로직 추가
- PredictionControls 컴포넌트 개선

### Phase 2: 모델 로딩 상태 표시 (2-3 hours)
**Tasks**:
1. 백엔드 모델 상태 조회 API 추가 또는 확인
2. 프론트엔드 모델 상태 조회 hook 추가
3. PredictionControls에 모델 상태 인디케이터 추가
4. 모델 미로딩 시 예측 실행 차단 로직

**Deliverables**:
- backend/api/routes/model_status.py (새 엔드포인트)
- frontend-prediction/src/hooks/useModelStatus.ts (새 hook)
- PredictionControls 컴포넌트에 모델 상태 UI 추가

### Phase 3: Canvas 기능 검증 및 수정 (1-2 hours)
**Tasks**:
1. RecommendationsTab 내부 Canvas 뷰 렌더링 확인
2. RoutingCanvas 컴포넌트 마운트 로직 검증
3. 탭 전환 이벤트 핸들링 확인
4. 에러 로그 분석 및 수정

**Deliverables**:
- RecommendationsTab 컴포넌트 수정 (필요 시)
- RoutingCanvas 컴포넌트 수정 (필요 시)
- 에러 로그 문서화

### Phase 4: 테스트 및 검증 (1 hour)
**Tasks**:
1. 도면 조회 기능 end-to-end 테스트
2. 품목 전환 시나리오 테스트
3. 모델 로딩 상태 표시 테스트
4. Canvas 탭 작동 테스트

**Deliverables**:
- 테스트 시나리오 문서
- 버그 리포트 (발견 시)
- 사용자 가이드 업데이트

---

## Success Criteria

### 도면 조회
- [ ] 품목 코드(3H54529WD49) 입력 → DRAW_NO(3H54529) 조회 → 도면 표시 성공
- [ ] 도면 정보 없을 시 명확한 메시지 표시
- [ ] 도면 조회 실패 시 에러 메시지 표시 (네트워크 오류 등)

### 품목 전환
- [ ] 새로운 품목 입력 시 기존 상태 초기화
- [ ] 여러 품목 순차 검색 가능
- [ ] activeItemId가 현재 활성 품목과 일치

### 모델 로딩
- [ ] 현재 로딩된 모델 정보 표시 (버전, 로딩 시각)
- [ ] 모델 미로딩 시 경고 표시
- [ ] 예측 실행 전 모델 상태 검증

### Canvas 기능
- [ ] Canvas 탭 선택 시 정상 렌더링
- [ ] RoutingCanvas 컴포넌트 정상 작동
- [ ] 타임라인 노드 드래그 앤 드롭 가능

---

## Timeline Estimates

| Phase | Estimated Time | Dependencies |
|-------|----------------|--------------|
| Phase 1 | 1-2 hours | None |
| Phase 2 | 2-3 hours | Phase 1 완료 권장 |
| Phase 3 | 1-2 hours | None (병렬 가능) |
| Phase 4 | 1 hour | Phase 1-3 완료 |
| **Total** | **5-8 hours** | |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| 백엔드 모델 상태 API 없음 | High | 기존 API 확장 또는 간단한 stub 생성 |
| activeItemId 설정 로직 복잡도 | Medium | 철저한 디버깅 및 로그 추가 |
| Canvas 탭 원인 불명 | Medium | 콘솔 로그 및 React DevTools 활용 |
| 품목 전환 시 상태 충돌 | High | 상태 초기화 순서 명확히 정의 |

---

## Dependencies

- **Backend**:
  - MSSQL ITEM_INFO 테이블 DRAW_NO 컬럼
  - 모델 로딩 상태 조회 API (추가 필요)
- **Frontend**:
  - routingStore, workspaceStore 상태 관리
  - DrawingViewerButton, PredictionControls 컴포넌트
  - RecommendationsTab, RoutingCanvas 컴포넌트

---

## Out of Scope

- 새로운 도면 뷰어 개발 (기존 ERP Image Viewer 사용)
- 모델 재학습 기능 (별도 작업)
- 전체 UI 리디자인
- 다국어 지원

---

**Approved By**: Claude Code
**Next Review**: Phase 1 완료 후
