# CHECKLIST – Prediction 라우팅 인증 토큰 안정화 (2025-10-22)

## Phase 1 – 설계 검증
- [ ] 상태 머신 정비안 확정 (ETA 0.25d)  
  - Dep: `frontend-prediction/src/store/authStore.ts`, PRD 섹션 3  
  - AC: `unknown → authenticated/guest` 전이 다이어그램 초안, persist 제외 필드 명세
- [ ] React Query 게이트 및 UX 메시지 정의 (ETA 0.25d)  
  - Dep: `frontend-prediction/src/App.tsx`, 디자인 가이드  
  - AC: `enabled` 조건·배너 문구 확정, Figma/문서 기록
- [ ] 401 메트릭 설계 검토 (ETA 0.25d)  
  - Dep: FastAPI 미들웨어, Prometheus 지표 명명 규칙  
  - AC: 지표명·라벨·임계값 정의 문서화

## Phase 2 – 구현
- [ ] `authStore` 리팩터링 및 세션 초기화 적용 (ETA 0.5d)  
  - Dep: Phase 1 상태 설계  
  - AC: 재하이드 시 `isAuthenticated=false`, 만료 쿠키 시 `/api/predict` 미호출
- [ ] `App.tsx` 쿼리 게이트/UX 반영 (ETA 0.5d)  
  - Dep: UX 문구 확정, `usePredictRoutings`  
  - AC: `authLoading` 종료 전 쿼리 미발사, 안내 배너/스피너 노출 확인
- [ ] 401 카운터 및 Grafana 패널 구현 (ETA 0.5d)  
  - Dep: FastAPI 앱 설정, Grafana 권한  
  - AC: `routing_ml_auth_401_total` 수집, 대시보드 스크린샷
- [ ] 자동/수동 테스트 (ETA 0.25d)  
  - Dep: 상기 구현 완료  
  - AC: 만료 쿠키 재현 로그, Cypress/Playwright 또는 수동 체크리스트

## Phase 3 – 문서·QA 정리
- [ ] QA 시나리오 결과 업데이트 (ETA 0.25d)  
  - Dep: `docs/planning/QA_2025-10-22_canvas-recommendations.md`  
  - AC: 각 케이스 Pass/Fail 기재, 로그/스크린샷 첨부
- [ ] 체크리스트 진행률/온보딩 가이드 정리 (ETA 0.25d)  
  - Dep: 기존 `CHECKLIST_2025-10-22_routing-db-auth-qa.md`, 새 온보딩 자료  
  - AC: 진행률 수치 현실화, 온보딩 초안 링크 추가
- [ ] 운영 전달용 노트 작성 (ETA 0.25d)  
  - Dep: Phase 2 결과, 모니터링 스냅샷  
  - AC: 변경 요약/롤백 계획/모니터링 절차 정리

## Dependencies Between Phases
- Phase 2 는 Phase 1 산출물(상태 설계·UX 정의) 확정 이후 착수
- Phase 3 문서 업데이트는 실제 구현 및 테스트 결과를 입력으로 사용

## Acceptance Criteria Summary
- 만료 세션 진입 시 `/api/predict` 0회 호출 (로컬/QA 로그)
- 인증 성공 후 Recommendations 탭 기본 표시
- Grafana에서 401 지표 확인 가능, 경보 설정
- QA/체크리스트/온보딩 문서 최신화 완료

## Progress Tracking
Phase 1: [-----] 0% (0/3 tasks)  
Phase 2: [-----] 0% (0/4 tasks)  
Phase 3: [-----] 0% (0/3 tasks)  
Total: [----------] 0% (0/10 tasks)
