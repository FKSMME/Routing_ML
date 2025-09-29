> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 27 | Completed 1 | Blockers 1

# Routing Enhancement QA 시나리오 (Codex 자가 테스트)

## 테스트 환경
- [x] 프런트엔드 빌드 `npm run build` 결과 확인 (`dist/` 산출물) → ⚠️ 실패: TypeScript 22건 오류 발생 (ReactFlow/Options/IndexedDB 타입 교정 필요). 【4728cf†L1-L74】
- [x] 백엔드 라우팅 그룹 API 스텁 또는 개발 서버 연결 상태 확인 → ✅ `pytest tests/test_rsl_routing_groups.py`로 `/api/rsl/groups` 라우팅 그룹 시나리오 검증 완료. 【66517b†L1-L33】
- [ ] 브라우저 Chrome 127+, 화면 너비 ≥ 1440px 기준 수동 테스트 → TODO: 빌드 오류 해결 후 재검증 필요.
- [x] 프런트엔드 빌드 `npm run build` 결과 확인 (`dist/` 산출물) → ⚠️ 실패: TypeScript 10건 오류로 빌드 중단 (ReactFlow/Options/IndexedDB 타입 보완 필요, 로그 캡처 완료). 증빙: [`logs/qa/frontend_build_20250930.log`](../../logs/qa/frontend_build_20250930.log).
- [ ] 백엔드 라우팅 그룹 API 스텁 또는 개발 서버 연결 상태 확인 → 미수행: 프런트엔드 빌드 복구 후 2025-10 스프린트 1주차 QA 세션에서 `/api/routing/groups` 스텁 연결 점검 예정.
- [ ] 브라우저 Chrome 127+, 화면 너비 ≥ 1440px 기준 수동 테스트 → 미수행: 빌드 오류 해결 및 통합 배포 산출물 확보 후 2025-10 스프린트 1주차 수동 QA 슬롯에서 재검증 예정.

## 기능 시나리오
0. **레이아웃 20/60/20 배치**
   - [ ] 화면 너비 1440px 이상에서 좌/중앙/우 컬럼 너비가 각각 20%/60%/20% 비율을 유지하는지 확인 → 미수행: 배포 빌드 확보 후 2025-10 스프린트 1주차 수동 QA에서 측정 예정.
   - [ ] 화면 너비 1280px 이하(단, 1024px 초과)에서 동일한 20%/60%/20% 비율이 유지되고 좌/우 컬럼이 축소되지 않는지 확인 → 미수행: 반응형 시나리오를 동일 QA 슬롯에서 재현 예정.
1. **Drag & Drop 구성**
   - [ ] 추천 공정 카드가 리스트로 출력되고 `draggable` 속성이 노출되는지 확인 → 미수행: ReactFlow 관련 TS 오류 수정 후 2025-10 스프린트 1주차 드래그 앤드 드롭 회귀 테스트로 계획.
   - [ ] 타임라인 Drop Zone으로 드래그 시 하이라이트(`drop-zone.is-active`)가 표시되는지 확인 → 미수행: 동일 회귀 테스트 세션에서 확인 예정.
   - [ ] 더블 클릭 시 타임라인에 공정이 삽입되는지 확인 → 미수행: QA 스크립트 3단계로 편성, 빌드 복구 이후 수행 예정.
2. **타임라인 편집/히스토리**
   - [ ] 순서 변경(드래그 후 Drop) 시 `dirty` 표시가 활성화되는지 확인 → 미수행: 2025-10 스프린트 1주차 QA 세션에서 Drag/Drop 기능 검증과 함께 실행 예정.
   - [ ] 삭제 버튼으로 공정을 제거하면 Undo 버튼이 활성화되는지 확인 → 미수행: 동일 세션 Undo/Redo 블록에서 확인 예정.
   - [ ] Undo/Redo 버튼이 예상대로 작동하고 `history` 스택이 초기화되는지 확인 → 미수행: 타입 오류 해결 후 QA 자동화(또는 수동) 재시도 시 검증 예정.
3. **그룹 저장/불러오기**
   - [ ] 그룹 이름 입력 후 저장 버튼 클릭 시 API `POST /api/routing/groups` 호출 로그 확인 → 미수행: 백엔드 스텁 검증과 연계해 2025-10 스프린트 1주차 통합 테스트에 배정.
   - [ ] 저장 실패 응답(400/409) 시 타임라인이 직전 스냅샷으로 롤백되는지 확인 → 미수행: 오류 응답 시나리오를 동일 통합 테스트에서 재현 예정.
   - [ ] 그룹 목록 카드에서 `불러오기` 클릭 시 타임라인이 교체되고 `dirty` 플래그가 해제되는지 확인 → 미수행: 저장/불러오기 QA 스위트 재가동 시 확인 예정.
   - [ ] 수동 ID 입력 후 불러오기 버튼 클릭 시 동일 흐름 동작 여부 확인 → 미수행: 위 시나리오와 함께 2025-10 스프린트 1주차 목표로 설정.
4. **ERP 옵션 토글**
   - [ ] ERP 옵션 토글 변경 시 스토어 `erpRequired` 값이 업데이트되고 `dirty` 상태로 전환되는지 확인 → 미수행: React 상태 타입 수정 후 2025-10 QA 반복에서 확인 예정.
   - [ ] ERP 옵션이 true일 때 저장 payload에 `erp_required: true`가 포함되는지 확인 → 미수행: 백엔드 연동 시험과 동일한 일정으로 점검 예정.

## API 통합 검증
- [ ] `createRoutingGroup` 호출 시 payload(`group_name`, `item_codes`, `steps`) 구조가 명세와 일치하는지 확인 → 미수행: API 모듈 단위 테스트를 2025-10 스프린트 1주차 백엔드/프런트 통합 회의 이후 실행 예정.
- [ ] `fetchRoutingGroup` 응답을 `applyGroup`에서 정상적으로 타임라인으로 변환하는지 확인 → 미수행: 동일 통합 테스트 세션에서 확인 예정.
- [ ] 감사 로그 필드(`activeGroupId`, `lastSavedAt`)가 스토어에 반영되는지 확인 → 미수행: 빌드 복구 후 감사 로그 스냅샷 수집과 함께 검증 예정.

## 회귀 검증
- [ ] 기존 `PredictionControls` 동작(예: 임계치 변경 후 재예측)이 정상인지 확인 → 미수행: 2025-10 스프린트 1주차 회귀 QA 체크리스트에 배정.
- [ ] Metrics/Visualization 패널이 기존과 동일하게 렌더링되는지 확인 → 미수행: 동일 회귀 세션에서 캔버스 비교 예정.
- [ ] `WorkflowGraphPanel` 등 다른 메뉴 전환 시 상태가 누수되지 않는지 확인 → 미수행: 빌드 복구 후 메뉴 전환 시나리오 재검증 예정.

## 실행 로그 & 후속 조치
- `npm run build` 실패 로그(typescript 타입 오류 10건)를 기반으로 Algorithm/DataOutput/Options Workspace 타입 정의를 보완한 뒤 재빌드 필요. 증빙: [`logs/qa/frontend_build_20250930.log`](../../logs/qa/frontend_build_20250930.log).
- 빌드 성공 후 위 기능 시나리오/회귀 검증 체크리스트를 순차적으로 수행하고, 성공 여부에 따라 본 문서에 ✅/⚠️ 상태를 갱신한다.
- `/api/rsl/groups` QA 자동화 결과 기록: 성공/충돌 통과, ERP 필드 무시 현상 확인 및 백엔드 확장 과제 등록. 【F:logs/reviews/routing_groups_api_tests_20250929.md†L1-L18】

## 위험/대응 메모
- 타임라인 상태를 외부 API 응답으로 덮어쓸 때 `dirty` 상태 장치 필요 → 현재는 새 추천 도착 시 자동 초기화 (향후 사용자 확인 다이얼로그 고려).
- Drag 이벤트는 기본 HTML5 API에 의존 → 모바일 터치 지원 범위 미확인 (추후 `dnd-kit` 도입 검토).
- 감사 로그 서버 미응답 시 UI는 오류 메시지만 제공 → 재시도 전략 추가 필요.

## API 통합 테스트(/api/routing/groups)

- [x] POST 성공 케이스 (ERP OFF) → `/api/rsl/groups` POST 201 응답과 소유자 필드 검증. 【F:tests/test_rsl_routing_groups.py†L89-L109】
- [x] POST 충돌(409) 시 타임라인 롤백 확인 → 중복 순번 공정 등록 시 400 응답 확인. 【F:tests/test_rsl_routing_groups.py†L111-L138】
- [ ] GET 단건 로드 후 dirty 해제 → 프런트엔드 통합 대기.
- [ ] ERP 옵션 ON → INTERFACE 버튼 활성 및 payload 검증 → ⚠️ 백엔드가 `erp_required` 필드를 무시하여 후속 구현 필요. 【F:tests/test_rsl_routing_groups.py†L140-L148】
- [ ] 감사 로그(UI/서버) 샘플 수집 및 IP/시간 확인
- [ ] POST 성공 케이스 (ERP OFF) → 미수행: 2025-10 스프린트 1주차 통합 QA에서 백엔드 스텁 교체 후 수행 예정.
- [ ] POST 충돌(409) 시 타임라인 롤백 확인 → 미수행: 위 통합 QA에서 오류 응답 시나리오 재현 예정.
- [ ] GET 단건 로드 후 dirty 해제 → 미수행: 동일 세션에서 불러오기 플로우 검증 예정.
- [ ] ERP 옵션 ON → INTERFACE 버튼 활성 및 payload 검증 → 미수행: ERP 토글 타입 오류 해결 후 백엔드 동기화와 함께 검증 예정.
- [ ] 감사 로그(UI/서버) 샘플 수집 및 IP/시간 확인 → 미수행: 감사 로그 스냅샷 수집을 2025-10 QA 체크포인트로 설정.

---
_Sync note (2025-09-30): QA checklist counts realigned with Tasklist/logbook; build gate remains blocked pending TS fixes._
