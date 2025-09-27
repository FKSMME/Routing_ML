# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

## 4단계 상세 태스크: 프런트엔드 (React)

### Gate Review Checklist
- [x] 절대 지령 1~7 준수 여부 재확인 및 승인 근거 `docs/stage4_frontend_report.md#gate-review-summary` 확인
- [x] UI 범위(3열 레이아웃, 카드 구성) 리뷰 및 승인 로그 확보
- [x] 선행 단계 API/데이터 계약 안정성 확인 (`docs/predictor_service_plan.md` 재점검)
- [x] 디자인 산출물 뷰어 접근 전 승인 상태 확인
- [x] 백그라운드 빌드/테스트 파이프라인 계획 수립

### 실행 산출물 요약
- [x] `docs/stage4_frontend_report.md`에 설계·구현·테스트·배포 준비 결과 기록
- [x] `Tasklist.md` Stage 4 구간 체크 및 산출물 링크 반영
- [x] `logs/task_execution_20250925.log` Stage 4 진행 로그 추가

### 설계(Design)
- [x] 3열 레이아웃 와이어프레임 및 카드 컴포넌트 계층 구조 설계 — `docs/stage4_frontend_report.md#설계`
- [x] 유사도 슬라이더, Top-K 드롭다운 UX 흐름 다이어그램 텍스트 정의 — `docs/stage4_frontend_report.md#설계`
- [x] 후보 라우팅 테이블 컬럼 구성 및 정렬/필터 조건 정의 — `docs/stage4_frontend_report.md#설계`
- [x] TensorBoard Projector 안내 UX 문구 확정 — `docs/stage4_frontend_report.md#설계`
- [x] 주니어 사용자 설명 패널 콘텐츠 초안 확정 — `docs/stage4_frontend_report.md#설계`
- [x] 블루스크린 스타일 워크플로우 그래프 뷰 시나리오 정의(노드 타입, 에지 관계, 드래그/드롭 동작, 더블클릭 설정 팝업 요구, 디자인 레퍼런스 `main/1.jpg`~`main/4.jpg` 반영) — `docs/graph_workflow_ui_plan.md#ux-시나리오`


### 구현(Implementation)
- [x] React 프로젝트 구조 점검 및 라우트/폴더 매핑 정의 — `docs/stage4_frontend_report.md#구현-계획`
- [x] 공통 UI 컴포넌트 스켈레톤 정의(카드, 슬라이더, 드롭다운) — `docs/stage4_frontend_report.md#구현-계획`
- [x] 후보 라우팅 테이블 컴포넌트 데이터 바인딩 전략 수립 — `docs/stage4_frontend_report.md#구현-계획`
- [x] 설명 패널/툴팁 상태 관리 전략 설계 — `docs/stage4_frontend_report.md#구현-계획`
- [x] TensorBoard Projector 안내 링크 컴포넌트 초안 작성 — `docs/stage4_frontend_report.md#구현-계획`
- [x] Vite 기반 실구현(컨트롤·후보·타임라인 컴포넌트) 완료 — `frontend/src/components/*`
- [x] React Query를 이용한 FastAPI 연동 훅 구현 — `frontend/src/hooks/usePredictRoutings.ts`
- [x] 그래프 렌더링 라이브러리 조사 및 선택 기준 정립(Dagre, Cytoscape, React Flow 등) — `docs/graph_workflow_ui_plan.md#기술-선택`
- [x] 모듈 그래프 컴포넌트 구조 설계(상위 컨테이너, 노드, 에지, 팝업 패널, SAVE → `/api/workflow/graph` PATCH 흐름) — `docs/graph_workflow_ui_plan.md#컴포넌트-구조`
- [x] 더블클릭 설정 패널 상태 관리/폼 구성 설계 — `docs/graph_workflow_ui_plan.md#설정-패널`


### 테스트(Test)
- [x] 주요 인터랙션 테스트 케이스 정의 — `docs/stage4_frontend_report.md#테스트-전략`
- [x] 접근성 체크리스트 초안 작성 — `docs/stage4_frontend_report.md#테스트-전략`
- [x] 주니어 사용자 피드백 수집 계획 수립 — `docs/stage4_frontend_report.md#테스트-전략`
- [x] 빌드/렌더링 성능 예비 점검 계획 수립 — `docs/stage4_frontend_report.md#테스트-전략`
- [x] 그래프 상호작용 테스트 계획 수립(노드 선택/이동, 줌, 팝업 검증, SAVE 이후 trainer/predictor 런타임 재확인) — `docs/graph_workflow_ui_plan.md#테스트-전략`


### 배포(Deployment)
- [x] 프런트엔드 백그라운드 CI 파이프라인 정의 — `docs/stage4_frontend_report.md#배포-준비`
- [x] 정적 호스팅/리버스 프록시 구성안 문서화 — `docs/stage4_frontend_report.md#배포-준비`
- [x] 사용자 안내 문서 업데이트 계획 정리 — `docs/stage4_frontend_report.md#배포-준비`
- [x] 단계 완료 보고 및 다음 단계 승인 요청 준비 — `docs/stage4_frontend_report.md#배포-준비`

- [x] 그래프 UI 배포 전략 수립(대상 페이지 라우팅, 점진적 롤아웃, 피쳐 토글, `config/workflow_settings.json` 접근 제어) — `docs/graph_workflow_ui_plan.md#배포-전략`

### 그래프 워크플로우 문서 업데이트
- 2025-09-25T09:10:00Z, Stage 4 UI 범위에 React Flow 기반 그래프 캔버스 구조 및 설정 패널 동기화 흐름을 추가하고 Tasklist Stage 4 항목 업데이트 사실을 Stakeholder에게 통보했다.
- 2025-09-25T09:12:00Z, Stage 3 문서와 교차 검증하여 그래프 데이터 계약 변경 사항이 프런트엔드 구현 계획과 일치함을 확인 후 `docs/graph_workflow_ui_plan.md#컴포넌트-구조` 링크를 재정리했다.
- 2025-09-25T09:16:00Z, React Flow 의존성에 대한 사내 배포 정책 검토 결과를 UI 승인 라인에 보고하고, 승인 로그를 `logs/task_execution_20250925.log`에 백그라운드 기록으로 남겼다.

### 로그 참고
- [x] `logs/task_execution_20250925.log` 2025-09-25T07:00Z~07:40Z 구간에 Stage 4 백그라운드 진행 기록 저장
- [x] 그래프 워크플로우 UI 추가 계획 수립 로그 작성 및 승인 근거 확보 — `logs/task_execution_20250925.log`


### 로그 참고
- [x] `logs/task_execution_20250925.log` 2025-09-25T07:00Z~07:40Z 구간에 Stage 4 백그라운드 진행 기록 저장

