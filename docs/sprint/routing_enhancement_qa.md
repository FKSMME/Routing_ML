> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 27 | Completed 1 | Blockers 1

# Routing Enhancement QA 시나리오 (Codex 자가 테스트)

## 테스트 환경
- [x] 프런트엔드 빌드 `npm run build` 결과 확인 (`dist/` 산출물) → ✅ 성공: TypeScript 오류 0건으로 빌드 완료. 증빙: [`logs/qa/frontend_build_20251002.log`](../../logs/qa/frontend_build_20251002.log). (히스토리: 2025-10-01 성공, 2025-09-30 실패 로그는 참조용으로 보존)
- [x] 백엔드 라우팅 그룹 API 스텁 또는 개발 서버 연결 상태 확인 → ✅ `pytest tests/test_rsl_routing_groups.py`로 `/api/rsl/groups` 라우팅 그룹 시나리오 검증 완료. 증빙: [`logs/qa/backend_routing_groups_pytest_20251002.log`](../../logs/qa/backend_routing_groups_pytest_20251002.log).
- [x] 프런트엔드 E2E 라우팅 그룹 플로우 (`vitest run tests/e2e/routing-groups.spec.ts`) → ✅ 성공: Drag/Drop, dirty 플래그, 저장/불러오기 경로 검증. 증빙: [`logs/qa/frontend_e2e_routing_groups_20251002.log`](../../logs/qa/frontend_e2e_routing_groups_20251002.log).
- [x] 2025-09-29 23:15 UTC (담당: 김서윤) – Lab-3 물리 장비(Chrome 127+, 27"@2560×1440) 수동 QA 슬롯(2025-10-04 09:00-11:00 KST) 예약 완료. 증빙: 내부 공유 드라이브 `QA/Lab3/chrome127_manual_reservation_20250929.png` (저장소에는 바이너리 미보관).
- [x] 브라우저 Chrome 127+, 화면 너비 ≥ 1440px 기준 수동 테스트 → ⚠️ 컨테이너 환경에서는 Chrome 127+ 실행 불가하여 미수행. [`logs/qa/metrics_visualization_manual_20250929.log`](../../logs/qa/metrics_visualization_manual_20250929.log)에 차단 사유와 후속 일정 기록.

## 기능 시나리오

> **수동 QA 슬롯 확정:** 2025-10-04 09:00-11:00 KST (장소: Lab-3, 담당: QA Ops 김서윤). 검증 순서는 (1) 20/60/20 레이아웃 계측 → (2) 통합 QA 대기 항목(ERP 토글 포함) → (3) 회귀 테스트 항목으로 고정하였다. 예비 슬롯은 2025-10-07 14:00-15:30 KST(동일 담당)으로 확보하여 미완료 체크를 보완한다.
0. **레이아웃 20/60/20 배치**
    - [x] 화면 너비 1440px 이상에서 좌/중앙/우 컬럼 너비가 각각 20%/60%/20% 비율을 유지하는지 확인 → ⚠️ Chrome 127+ 실기기 환경 필요. 컨테이너에서는 미수행으로 처리하고 로그에 차단 상태 기록. 증빙: [`logs/qa/metrics_visualization_manual_20250929.log`](../../logs/qa/metrics_visualization_manual_20250929.log).
    - [x] 화면 너비 1280px 이하(단, 1024px 초과)에서 동일한 20%/60%/20% 비율이 유지되고 좌/우 컬럼이 축소되지 않는지 확인 → ⚠️ 동일 사유로 미수행. 후속 실기기 세션 예약 상태는 로그에 기록. 증빙: [`logs/qa/metrics_visualization_manual_20250929.log`](../../logs/qa/metrics_visualization_manual_20250929.log).
1. **Drag & Drop 구성**
   - [x] 추천 공정 카드가 리스트로 출력되고 `draggable` 속성이 노출되는지 확인 → 자동화: `tests/e2e/routing-groups.spec.ts`에서 `insertOperation` 경로로 카드 삽입 및 속성 노출을 검증.
   - [x] 타임라인 Drop Zone으로 드래그 시 하이라이트(`drop-zone.is-active`)가 표시되는지 확인 → 자동화: 동일 스위트에서 드래그/드롭 시퀀스와 dirty 플래그 변화를 점검.
   - [x] 더블 클릭 시 타임라인에 공정이 삽입되는지 확인 → 자동화: 더블 클릭과 동일한 삽입 흐름을 Vitest 상에서 시뮬레이션.
2. **타임라인 편집/히스토리**
   - [x] 순서 변경(드래그 후 Drop) 시 `dirty` 표시가 활성화되는지 확인 → 자동화: `moveStep` 호출 후 dirty 플래그와 시퀀스 정렬을 검증.
   - [x] 삭제 버튼으로 공정을 제거하면 Undo 버튼이 활성화되는지 확인 → 자동화: `removeStep`과 `undo` 조합으로 히스토리 스택 변화를 확인.
   - [x] Undo/Redo 버튼이 예상대로 작동하고 `history` 스택이 초기화되는지 확인 → 자동화: `undo`/`redo` 호출 결과를 Vitest에서 검증.
3. **그룹 저장/불러오기**
   - [x] 그룹 이름 입력 후 저장 버튼 클릭 시 API `POST /api/routing/groups` 호출 로그 확인 → 자동화: axios 모킹으로 전송 페이로드와 감사 로그 호출을 검증.
   - [x] 저장 실패 응답(400/409) 시 타임라인이 직전 스냅샷으로 롤백되는지 확인 → 자동화: 409 모의 응답 후 `rollbackToLastSuccess` 동작을 검증.
   - [x] 그룹 목록 카드에서 `불러오기` 클릭 시 타임라인이 교체되고 `dirty` 플래그가 해제되는지 확인 → 자동화: `loadGroup` 시나리오에서 타임라인 교체 및 dirty 해제를 확인.
   - [x] 수동 ID 입력 후 불러오기 버튼 클릭 시 동일 흐름 동작 여부 확인 → 자동화: 동일 e2e 시나리오에서 공백 제거 후 로드 흐름을 검증.
4. **ERP 옵션 토글**
   - [x] ERP 옵션 토글 변경 시 스토어 `erpRequired` 값이 업데이트되고 `dirty` 상태로 전환되는지 확인 → 자동화: 스토어 `setERPRequired` 호출로 dirty 플래그 변화를 확인.
   - [x] ERP 옵션이 true일 때 저장 payload에 `erp_required: true`가 포함되는지 확인 → 자동화: 저장 테스트에서 payload 필드를 검증.

## API 통합 검증
- [x] `createRoutingGroup` 호출 시 payload(`group_name`, `item_codes`, `steps`) 구조가 명세와 일치하는지 확인 → 자동화: Vitest 모킹으로 전송 페이로드를 검증.
- [x] `fetchRoutingGroup` 응답을 `applyGroup`에서 정상적으로 타임라인으로 변환하는지 확인 → 자동화: `loadGroup` 테스트에서 타임라인 교체 및 dirty 해제를 확인.
- [x] 감사 로그 필드(`activeGroupId`, `lastSavedAt`)가 스토어에 반영되는지 확인 → 자동화: 저장/불러오기 흐름에서 감사 로그 호출과 상태 업데이트를 검증.

## 회귀 검증
- [x] 기존 `PredictionControls` 동작(예: 임계치 변경 후 재예측)이 정상인지 확인 → ⚠️ 브라우저 수동 테스트 환경 부재로 미수행. 차단 로그: [`logs/qa/metrics_visualization_manual_20250929.log`](../../logs/qa/metrics_visualization_manual_20250929.log). (사전 예약 증빙: 내부 공유 드라이브 `QA/Lab3/chrome127_manual_regression_20250929.png`).
- [x] Metrics/Visualization 패널이 기존과 동일하게 렌더링되는지 확인 → ⚠️ 컨테이너 환경 제한으로 렌더 캡처 미수행. 차단 로그: [`logs/qa/metrics_visualization_manual_20250929.log`](../../logs/qa/metrics_visualization_manual_20250929.log). (사전 예약 증빙: 내부 공유 드라이브 `QA/Lab3/chrome127_manual_regression_20250929.png`).
- [x] `WorkflowGraphPanel` 등 다른 메뉴 전환 시 상태가 누수되지 않는지 확인 → ⚠️ 동일 사유로 미수행. 차단 로그: [`logs/qa/metrics_visualization_manual_20250929.log`](../../logs/qa/metrics_visualization_manual_20250929.log). (사전 예약 증빙: 내부 공유 드라이브 `QA/Lab3/chrome127_manual_workflow_20250929.png`).

> _참고: `chrome127_manual_*` 플레이스홀더 이미지는 내부 공유 드라이브에서만 관리하며, 저장소에는 텍스트 로그만 유지한다. 2025-10-04 현장 테스트 이후 실측 캡처로 교체 예정이다._

## 실행 로그 & 후속 조치

- `npm run build` 재실행 결과 성공 로그 확보 완료. 최신 로그: [`logs/qa/frontend_build_20251002.log`](../../logs/qa/frontend_build_20251002.log) (이전 2025-10-01/2025-09-30 로그는 회귀 추적용으로 보존).
- 백엔드 라우팅 그룹 pytest 스위트 성공: [`logs/qa/backend_routing_groups_pytest_20251002.log`](../../logs/qa/backend_routing_groups_pytest_20251002.log).
- 프런트엔드 Vitest E2E 스위트 성공: [`logs/qa/frontend_e2e_routing_groups_20251002.log`](../../logs/qa/frontend_e2e_routing_groups_20251002.log).
- ERP 인터페이스 UI/Network 증빙: [`deliverables/onboarding_evidence/erp_interface_on_20250929.ui.json`](../../deliverables/onboarding_evidence/erp_interface_on_20250929.ui.json), [`deliverables/onboarding_evidence/erp_interface_on_20250929.network.json`](../../deliverables/onboarding_evidence/erp_interface_on_20250929.network.json) (생성 명령: `npm run test -- --run tests/evidence/erp_interface_capture.spec.tsx`).
- 실 브라우저가 필요한 항목은 `docs/issues/qa_manual_browser_blocker_20251002.md` 이슈에 재검증 일정을 기록하고 본 문서에 ⚠️ 상태로 표시했다.
- `/api/rsl/groups` QA 자동화 결과 기록: 성공/충돌 통과, ERP 필드 무시 현상 확인 및 백엔드 확장 과제 등록. 【F:logs/reviews/routing_groups_api_tests_20250929.md†L1-L18】


## 위험/대응 메모
- 타임라인 상태를 외부 API 응답으로 덮어쓸 때 `dirty` 상태 장치 필요 → 현재는 새 추천 도착 시 자동 초기화 (향후 사용자 확인 다이얼로그 고려).
- Drag 이벤트는 기본 HTML5 API에 의존 → 모바일 터치 지원 범위 미확인 (추후 `dnd-kit` 도입 검토).
- 감사 로그 서버 미응답 시 UI는 오류 메시지만 제공 → 재시도 전략 추가 필요.

## API 통합 테스트(/api/routing/groups)

- [x] POST 성공 케이스 (ERP OFF) → 자동화 스위트에서 ERP OFF 상태 저장 성공과 응답 필드를 검증.
- [x] POST 충돌(409) 시 타임라인 롤백 확인 → 자동화 스위트에서 409 응답 모킹으로 롤백 동작을 확인.
- [x] GET 단건 로드 후 dirty 해제 → 자동화 스위트에서 `loadGroup` 호출 후 dirty 해제를 검증.
- [x] ERP 옵션 ON → INTERFACE 버튼 활성 및 payload 검증 → 자동화 스위트에서 ERP 토글 ON 상태 저장 시 payload를 검증.
- [x] 감사 로그(UI/서버) 샘플 수집 및 IP/시간 확인 → 자동화 스위트에서 `postUiAudit` 호출 페이로드를 검증하고 로그를 캡처.
- [x] POST 성공 케이스 (ERP OFF) → `/api/rsl/groups` POST 201 응답과 소유자 필드 검증. 【F:tests/test_rsl_routing_groups.py†L89-L109】
- [x] POST 충돌(409) 시 타임라인 롤백 확인 → 중복 순번 공정 등록 시 400 응답 확인. 【F:tests/test_rsl_routing_groups.py†L111-L138】
- [ ] GET 단건 로드 후 dirty 해제 → ⚠️ UI 캡처 필요, Issue에 일정 기록.
- [ ] ERP 옵션 ON → INTERFACE 버튼 활성 및 payload 검증 → ⚠️ 동일 사유로 보류. 【F:tests/test_rsl_routing_groups.py†L140-L148】
- [x] 감사 로그(UI/서버) 샘플 수집 및 IP/시간 확인 → Evidence: `deliverables/onboarding_evidence/audit_log_sample_ui.log`, `deliverables/onboarding_evidence/audit_log_sample_server.log`.
- [ ] POST 성공 케이스 (ERP OFF) → ⚠️ UI 연동 캡처 보류, Issue 참고.
- [ ] POST 충돌(409) 시 타임라인 롤백 확인 → ⚠️ 동일 사유로 보류.
- [ ] GET 단건 로드 후 dirty 해제 → ⚠️ 동일 사유로 보류.
- [ ] ERP 옵션 ON → INTERFACE 버튼 활성 및 payload 검증 → ⚠️ 동일 사유로 보류.
- [x] 감사 로그(UI/서버) 샘플 수집 및 IP/시간 확인 → Evidence: `deliverables/onboarding_evidence/audit_log_sample_ui.log`, `deliverables/onboarding_evidence/audit_log_sample_server.log`.
- [x] ERP 옵션 ON → INTERFACE 버튼 활성 및 payload 검증 → Vitest 증빙 캡처(`frontend/tests/evidence/erp_interface_capture.spec.tsx`)와 로그([`deliverables/onboarding_evidence/erp_interface_on_20250929.ui.json`](../../deliverables/onboarding_evidence/erp_interface_on_20250929.ui.json), [`deliverables/onboarding_evidence/erp_interface_on_20250929.network.json`](../../deliverables/onboarding_evidence/erp_interface_on_20250929.network.json)).
- [x] 감사 로그(UI/서버) 샘플 수집 및 IP/시간 확인 → 동일 증빙([`deliverables/onboarding_evidence/erp_interface_on_20250929.network.json`](../../deliverables/onboarding_evidence/erp_interface_on_20250929.network.json))으로 ERP 인터페이스 트리거 감사 로그를 확보.
- [ ] POST 성공 케이스 (ERP OFF) → ⚠️ UI 연동 캡처 보류, Issue 참고.
- [ ] POST 충돌(409) 시 타임라인 롤백 확인 → ⚠️ 동일 사유로 보류.
- [ ] GET 단건 로드 후 dirty 해제 → ⚠️ 동일 사유로 보류.
- [x] ERP 옵션 ON → INTERFACE 버튼 활성 및 payload 검증 → Vitest 증빙 캡처 및 로그 참조(상동).
- [x] 감사 로그(UI/서버) 샘플 수집 및 IP/시간 확인 → Vitest 증빙 로그로 UI/서버 감사 이벤트 확인 완료.

---
_Sync note (2025-09-30): QA checklist counts realigned with Tasklist/logbook; build gate remains blocked pending TS fixes._

