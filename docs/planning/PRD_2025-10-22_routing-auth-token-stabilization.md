# Prediction 라우팅 인증 토큰 안정화 PRD

## Executive Summary
- Prediction 라우팅 생성 페이지에서 세션 쿠키가 만료된 상태로 진입하면 프런트 상태 영속화(`zustand persist`)가 `isAuthenticated=true`로 남아 즉시 `/api/predict`를 호출하고 401을 반복한다.
- 초기 로딩 UX가 인증 핸드셰이크와 분리돼 있어 사용자가 "항상 에러"로 인식하며, Canvas 추천 탭도 데이터 로드 실패로 빈 상태가 된다.
- 목표는 프런트 상태/쿼리 가드/백엔드 모니터링 3축으로 인증 만료 시나리오를 제어하고, QA 문서 및 체크리스트를 최신화하는 것이다.

## Problem Statement
- `routing-ml-auth` 세션이 만료돼도 `isAuthenticated` 플래그가 true로 유지되고, React Query가 즉시 `/api/predict`를 호출한다.
- 인증 확인 이전에 Recommendation 데이터가 로드되지 않아 Canvas 기본 뷰가 Timeline으로 떨어지며 UX가 불안정하다.
- 401 로그는 증가하지만 Prometheus/Grafana 대시보드 연결이 미완료 상태라 조기 감지가 어렵고, QA 문서에는 미체크 항목이 존재한다.

## Goals and Objectives
1. **프런트 인증 상태 초기화**: 재접속 시 인증 플래그를 `unknown`으로 리셋하고 `checkAuth` 성공 이후에만 예측 쿼리를 활성화한다.
2. **API 호출 게이트 및 UX 개선**: `usePredictRoutings` 활성 조건을 `!authLoading`까지 확장하고, 초기 로딩 화면에서 재인증 진행 중임을 안내한다.
3. **모니터링·문서 정비**: 401 카운트 메트릭을 기존 Prometheus 스택에 반영하고, QA/체크리스트/온보딩 문서를 실제 상태에 맞게 보정한다.

## Requirements
- 상태 영속 로직에서 `isAuthenticated`, `isAdmin`을 저장하지 않거나 재하이드 시 강제 초기화한다.
- React Query `enabled` 조건에 `!authLoading` 추가, 초기 배너/토스트 메시지 정의.
- FastAPI 401 미들웨어에서 `routing_ml_auth_401_total`을 계측하고 Grafana 패널에 시각화.
- QA 문서(`QA_2025-10-22_canvas-recommendations.md`)의 시나리오 결과를 실제 값으로 갱신.
- 체크리스트 진행률(특히 미완료 항목)을 현재 상태와 일치시키고, 온보딩 가이드를 작성 또는 범위 재조정한다.
- 변경된 UX/모니터링 지표를 README 또는 운영 안내에 추가한다.

## Phase Breakdown
- **Phase 1 – 설계 검증 (0.5d)**  
  - 상태 머신 설계 (`authStore` 상태 전이, persist 설정)  
  - React Query 게이트 조건 정의 및 UX 메시지 확정  
  - 401 메트릭 필드 및 대시보드 설계
- **Phase 2 – 구현 (1.5d)**  
  - `authStore` 리팩터링, `App.tsx` 게이트 적용, 배너/토스트 구현  
  - FastAPI 미들웨어 계측 추가 및 Grafana 보드 업데이트  
  - 단위 테스트/로컬 시뮬레이션(만료 쿠키, 초기 접속)
- **Phase 3 – 문서·QA 정리 (0.5d)**  
  - QA/체크리스트/온보딩 문서 업데이트  
  - 401 재현 캡처와 Grafana 스크린샷 정리  
  - 배포 노트 초안 및 운영 전달

## Success Criteria
- 만료된 세션으로 접속 시 `/api/predict`가 인증 확인 이전에는 호출되지 않는다(로컬 재현 및 로그 확인).
- 초기 화면에서 “재인증 중” 안내가 노출되고, 인증 성공 후 Canvas Recommendations 탭이 기본으로 뜬다.
- Prometheus/Grafana에서 `routing_ml_auth_401_total` 지표가 수집되고 경고 한계가 설정된다.
- QA 문서와 체크리스트가 실제 상태를 반영하며, 온보딩 가이드 초안이 공유된다.
- 운영팀이 변경된 플로우와 모니터링을 이해할 수 있도록 문서화가 완료된다.

## Timeline Estimates
- 착수일: 2025-10-22
- Phase 1: 2025-10-22 (오전)
- Phase 2: 2025-10-22 오후 ~ 2025-10-23 오전
- Phase 3: 2025-10-23 오후
- 총 소요: 2.5 작업일
