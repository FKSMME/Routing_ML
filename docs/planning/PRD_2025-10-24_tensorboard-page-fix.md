# Product Requirements Document — TensorBoard 페이지 복구

**Date**: 2025-10-24  
**Author**: Codex (GPT-5)  
**Related Checklist**: `docs/planning/CHECKLIST_2025-10-24_tensorboard-page-fix.md`

---

## Executive Summary

TensorBoard Embedding Explorer 화면이 정상적으로 렌더링되지 않고 API 연동도 실패해 학습 임베딩, 메트릭, 필터 데이터를 보여주지 못하고 있다. 본 작업은 백엔드 TensorBoard projector/metrics API 계약을 재검증하고, 프런트엔드 상태 관리 및 3D/차트 렌더링 로직을 안정화하여 교육 대시보드에서 TensorBoard 페이지가 실데이터 기반으로 작동하도록 복구하는 것을 목표로 한다.

## Problem Statement

1. `fetchTensorboardConfig`, `fetchTensorboardProjectors` 등 API 호출에서 4xx/5xx가 발생하거나, 응답 구조가 컴포넌트 예상과 불일치한다.  
2. `TensorboardEmbeddingPanel` 내부의 3D Scatter/Heatmap 렌더링이 비동기 데이터 로딩 실패 시에도 fallback 없이 중단되어 빈 화면 또는 오류 메시지가 출력된다.  
3. Tensorboard store(`useTensorboardStore`)의 상태 플래그 및 폴링 로직이 UI 요구사항과 맞지 않아 재시도/로딩 표시, 내보내기(export) 버튼 동작이 실패한다.  
4. 현재 TensorBoard 경로/상태 정보는 더미 데이터로 하드코딩되어 있어 실제 학습 artefact를 탐색할 수 없다.

## Goals and Objectives

- **데이터 계약 정합성**: 백엔드 TensorBoard 관련 엔드포인트 응답 스키마를 문서화하고 프런트엔드 타입 정의와 동기화한다.
- **안정적인 데이터 로딩**: 프런트엔드에서 Config, Projector Points, Metrics를 단계별로 로드하고 오류/빈 데이터 상황을 graceful하게 처리한다.
- **시각화 복구**: 3D 임베딩/히트맵/클러스터 차트를 실제 벡터 데이터로 렌더링하며, 축 매핑/필터/클러스터 UI 상호작용을 정상화한다.
- **Export & 상태 표시**: TensorBoard 내보내기 버튼과 진행 상태 표시를 실제 백엔드 API와 연결하여 유저에게 명확한 피드백을 제공한다.
- **검증 및 문서화**: QA 체크리스트와 운영 매뉴얼을 업데이트하여 TensorBoard 페이지 운용 절차를 정리한다.

## Requirements

### 기능 요구사항

1. TensorBoard Config/Status/Projector API 호출이 성공 시 상태가 `Ready`로 전환되고, 실패 시 사용자에게 재시도 액션 및 오류 메시지를 제공한다.
2. 벡터 데이터(`vectors.tsv` 기반) 로드 시 최대 10k 포인트까지 렌더링되며, 클러스터/축 선택이 적용된다.
3. Metrics 탭은 최소 3개 학습 지표(Loss, Accuracy, F1 등)를 시계열 차트로 렌더링한다.
4. Export 버튼 클릭 시 진행 다이얼로그, 성공/실패 토스트가 표시되고 스냅샷 목록이 새로고침된다.
5. 로딩 중 Skeleton/Spinner, 빈 상태 메시지, 오류 상태 UI가 Figma 스펙과 일치한다.

### 비기능 요구사항

- API 호출 실패 시 최소 3회 지수 백오프 재시도를 수행하고, 백엔드 장애 시에도 프런트가 중단되지 않는다.
- 3D 렌더링은 60fps 목표로 성능 최적화(메모리/GC 최소화)한다.
- 모든 새 코드에 대해 ESLint/Prettier 규칙을 통과하고, Vite 개발 서버에서 경고 없이 구동된다.
- 테스트: 최소 1개의 Zustand store 단위 테스트와 1개의 렌더링 스냅샷/행동 테스트 작성.

## Phase Breakdown

### Phase 1 — API 계약 점검 및 데이터 파이프라인 복원

- 백엔드 엔드포인트(`GET /api/tensorboard/config`, `GET /api/tensorboard/projectors` 등) 실제 응답 확인.
- 타입 정의(`@app-types/tensorboard`)와 API 클라이언트 매핑 재작성.
- Mock data 제거 및 환경설정(`workflow_settings.json`) 검수.

### Phase 2 — 프런트엔드 상태/시각화 개선

- `useTensorboardStore` 비동기 흐름, 로딩/에러 상태, 폴링 로직 수정.
- `TensorboardEmbeddingPanel` 내 데이터 파이프라인/컴포넌트 분리 및 렌더링 개선.
- Export/상태 표시 UI 연결 및 접근성/에러 핸들링 강화.

### Phase 3 — QA, 테스트, 문서화

- Vitest/React Testing Library를 활용한 단위/통합 테스트 작성.
- 수동 QA 체크리스트 실행 및 결과 캡처.
- `docs/guides/frontend-training/` 관련 문서 업데이트 및 운영 가이드 배포.

## Success Criteria

- TensorBoard 페이지에서 Config/Projector/Metric 데이터를 실시간으로 로드하고, 페이지 리프레시 후에도 정상 동작한다.
- Export 버튼 사용 시 백엔드 로그와 UI 토스트 모두 성공을 나타낸다.
- QA 체크리스트 항목을 100% 통과하고, 주요 시나리오(데이터 없음, 오류 발생, 성공 시각화)가 재현 가능하다.
- 릴리즈 노트/문서가 갱신되어 운영팀이 TensorBoard 기능을 사용할 수 있다.

## Timeline Estimates

- Phase 1: 0.75일 (6시간) — 백엔드 확인, 타입/클라이언트 재정의.
- Phase 2: 1.25일 (10시간) — 상태/컴포넌트 리팩터링 및 UI 개선.
- Phase 3: 0.5일 (4시간) — 테스트, QA, 문서 업데이트.

**총 예상 기간**: 2.5일 (20시간)
