> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 34 | Completed 8 | Blockers 0

# Routing Enhancement QA 시나리오 (Codex 자가 테스트)

## 테스트 환경
- [ ] 프런트엔드 빌드 `npm run build` 결과 확인 (`dist/` 산출물)
- [ ] 백엔드 라우팅 그룹 API 스텁 또는 개발 서버 연결 상태 확인
- [ ] 브라우저 Chrome 127+, 화면 너비 ≥ 1440px 기준 수동 테스트

## 기능 시나리오
1. **Drag & Drop 구성**
   - [ ] 추천 공정 카드가 리스트로 출력되고 `draggable` 속성이 노출되는지 확인
   - [ ] 타임라인 Drop Zone으로 드래그 시 하이라이트(`drop-zone.is-active`)가 표시되는지 확인
   - [ ] 더블 클릭 시 타임라인에 공정이 삽입되는지 확인
2. **타임라인 편집/히스토리**
   - [ ] 순서 변경(드래그 후 Drop) 시 `dirty` 표시가 활성화되는지 확인
   - [ ] 삭제 버튼으로 공정을 제거하면 Undo 버튼이 활성화되는지 확인
   - [ ] Undo/Redo 버튼이 예상대로 작동하고 `history` 스택이 초기화되는지 확인
3. **그룹 저장/불러오기**
   - [ ] 그룹 이름 입력 후 저장 버튼 클릭 시 API `POST /api/routing/groups` 호출 로그 확인
   - [ ] 저장 실패 응답(400/409) 시 타임라인이 직전 스냅샷으로 롤백되는지 확인
   - [ ] 그룹 목록 카드에서 `불러오기` 클릭 시 타임라인이 교체되고 `dirty` 플래그가 해제되는지 확인
   - [ ] 수동 ID 입력 후 불러오기 버튼 클릭 시 동일 흐름 동작 여부 확인
4. **ERP 옵션 토글**
   - [ ] ERP 옵션 토글 변경 시 스토어 `erpRequired` 값이 업데이트되고 `dirty` 상태로 전환되는지 확인
   - [ ] ERP 옵션이 true일 때 저장 payload에 `erp_required: true`가 포함되는지 확인

## API 통합 검증
- [ ] `createRoutingGroup` 호출 시 payload(`group_name`, `item_codes`, `steps`) 구조가 명세와 일치하는지 확인
- [ ] `fetchRoutingGroup` 응답을 `applyGroup`에서 정상적으로 타임라인으로 변환하는지 확인
- [ ] 감사 로그 필드(`activeGroupId`, `lastSavedAt`)가 스토어에 반영되는지 확인

## 회귀 검증
- [ ] 기존 `PredictionControls` 동작(예: 임계치 변경 후 재예측)이 정상인지 확인
- [ ] Metrics/Visualization 패널이 기존과 동일하게 렌더링되는지 확인
- [ ] `WorkflowGraphPanel` 등 다른 메뉴 전환 시 상태가 누수되지 않는지 확인

## 위험/대응 메모
- 타임라인 상태를 외부 API 응답으로 덮어쓸 때 `dirty` 상태 장치 필요 → 현재는 새 추천 도착 시 자동 초기화 (향후 사용자 확인 다이얼로그 고려).
- Drag 이벤트는 기본 HTML5 API에 의존 → 모바일 터치 지원 범위 미확인 (추후 `dnd-kit` 도입 검토).
- 감사 로그 서버 미응답 시 UI는 오류 메시지만 제공 → 재시도 전략 추가 필요.

## API 통합 테스트(/api/routing/groups)
- [ ] POST 성공 케이스 (ERP OFF)
- [ ] POST 충돌(409) 시 타임라인 롤백 확인
- [ ] GET 단건 로드 후 dirty 해제
- [ ] ERP 옵션 ON → INTERFACE 버튼 활성 및 payload 검증
- [ ] 감사 로그(UI/서버) 샘플 수집 및 IP/시간 확인
