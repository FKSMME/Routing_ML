# 최종 보고서 – 인증 안정화 및 Canvas 와이어 저장 개선 (2025-10-22)

## 1. 개요
- 대상: Routing ML Prediction 생성 페이지(프론트엔드), FastAPI 백엔드, 모니터링 스택
- 기간: 2025-10-20 ~ 2025-10-22
- 주요 목표
  1. 인증 토큰 오류(초기 401) 제거 및 로딩 UX 개선
  2. Canvas 커스텀 와이어 생성/삭제/재연결을 저장 계층까지 연동
  3. 401 응답/예측 지연 모니터링 지표 확장 및 대시보드 스펙 정의

## 2. 작업 내용 요약
### 2.1 인증 안정화
- `usePredictRoutings` 에 인증 + 아이템 입력 가드를 추가해 로그인 완료 전 API 호출을 방지하고, 토큰 대기용 허브 화면을 도입함.
  - 소스: `frontend-prediction/src/App.tsx`, `frontend-prediction/src/hooks/usePredictRoutings.ts`

### 2.2 Canvas 와이어 저장
- React Flow 핸들러(`handleConnect`, `handleReconnect`, Delete 키)로 Zustand 스토어에 수동 연결을 기록하고, Undo/Redo·IndexedDB 스냅샷·라우팅 그룹 저장에 연동.
  - 프론트엔드: `frontend-prediction/src/components/routing/RoutingCanvas.tsx`, `frontend-prediction/src/store/routingStore.ts`
- 백엔드 `routing_groups` 테이블 및 Pydantic 스키마에 `connections` 필드를 추가하고, 생성/수정 API에서 JSON 직렬화를 지원.
  - 백엔드: `backend/models/routing_groups.py`, `backend/schemas/routing_groups.py`, `backend/api/routing_groups.py`
- 그룹 저장 훅이 수동 연결을 추출하여 payload/메타데이터에 포함하도록 확장.
  - 훅: `frontend-prediction/src/hooks/useRoutingGroups.ts`

### 2.3 모니터링 지표
- FastAPI 미들웨어에서 401 응답 카운터와 엔드포인트 평균 응답시간을 수집하여 `/metrics` 에 노출.
  - 백엔드: `backend/api/routes/metrics.py`, `backend/api/app.py`
- Grafana 패널/알람 설계는 `docs/planning/METRICS_2025-10-22_dashboard-spec.md` 에 문서화.

## 3. 정량 지표
| 항목 | 개선 전 | 개선 후 | 비고 |
| --- | --- | --- | --- |
| 초기 `POST /api/predict` 401 발생 | 19회/세션 (로그 2025-10-21 근거) | 0회 (인증 가드 적용 후 QA) | 로컬 QA 환경 기준 |
| Canvas 수동 연결 유지 | 새로고침 시 유실 | IndexedDB/백엔드 저장 후 복원 | 수동 연결 count >= 1 검증 |
| `/metrics` 401 지표 | 미수집 | `routing_ml_auth_401_total` 등 노출 | Prometheus 스크랩 확인 |

## 4. 산출물
- 코드 변경
  - 프론트엔드: 인증 로딩 화면, React Query 가드, Canvas/스토어/저장 훅 업데이트
  - 백엔드: `routing_groups` 모델·스키마·라우터, `/metrics` 확장
- 문서
  - 설계/QA/메트릭: `docs/planning/DESIGN_2025-10-22_auth-loading-telemetry.md`, `docs/planning/DESIGN_2025-10-22_canvas-connections-roadmap.md`, `docs/planning/QA_2025-10-22_canvas-recommendations.md`
  - 온보딩 가이드: `docs/planning/ONBOARDING_2025-10-22_canvas-auth-roadmap.md`

## 5. 미해결 과제
1. MSSQL 뷰 지연 추이 템플릿(Phase 1/metrics) – 접근 권한 확보 후 측정 필요.
2. 라우팅 그룹 로드 API 재활성화 및 end-to-end 자동화 테스트 작성.
3. 최종 배포 전 Alembic 마이그레이션 작성 (`routing_groups.connections` 컬럼) 및 staging 검증.

## 6. 결론
인증 흐름의 불필요한 401과 Canvas 커스텀 와이어의 비저장 문제를 해결하여 사용자 UX와 데이터 일관성을 개선했습니다. 다음 단계는 남은 데이터 계측 및 문서 마무리이며, 온보딩 가이드를 통해 신규 엔지니어가 즉시 작업을 이어갈 수 있도록 준비했습니다.*** End Patch
