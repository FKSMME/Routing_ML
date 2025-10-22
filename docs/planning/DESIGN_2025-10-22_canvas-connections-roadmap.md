# Canvas 와이어 저장 로드맵 (2025-10-22)

**작성자**: Codex  
**대상**: `frontend-prediction` Routing Visualization, 백엔드 routing group 저장소  
**목표**: Canvas 상의 커스텀 연결(와이어)을 UI → Zustand 스토어 → 백엔드 → DB로 일관되게 저장/복원할 수 있는 단계별 실행 계획 수립

---

## 1. 현황 정리
- Canvas 엣지는 타임라인 순서를 기반으로 자동 생성되며, 수동 연결은 `RoutingCanvas.handleConnect` 에서 콘솔 로그만 남기고 종료. (`frontend-prediction/src/components/routing/RoutingCanvas.tsx`)
- Zustand 스토어(`routingStore`)에는 `connections` 배열과 `addConnection/removeConnection/updateConnection` API가 정의되어 있으나 UI에서 호출되지 않음.
- 백엔드 모델(`routing_groups` 테이블)에는 `steps(JSON)` 필드만 있고 커스텀 연결을 저장할 공간이 없음.

---

## 2. 기능 요구사항
1. **UI/UX**: 사용자 드래그로 생성한 와이어를 즉시 Canvas에 렌더링하고, 연결 편집·삭제를 지원.
2. **Persistence**: 라우팅 그룹 저장 시 커스텀 연결을 함께 직렬화해 Postgres에 저장(또는 별도 테이블).
3. **추천 연동**: 커스텀 연결은 추천 시나리오 재계산에 영향을 미치지 않되, 시각화 시 명확히 식별 가능해야 함(예: 스타일 차별화).
4. **Undo/Redo**: 현재 히스토리 스택에 연결 추가/삭제 이벤트를 포함.

---

## 3. 단계별 로드맵
### Phase A – 프론트엔드 스토어 연동 (ETA 0.5d)
- `RoutingCanvas.handleConnect` 에서 `routingStore.addConnection(sourceId, targetId)` 호출.
- `useEffect` 로 타임라인 변경 시 `autoGenerateConnections` 와 커스텀 연결 병합 로직 추가.
- UI 표시: 커스텀 엣지 스타일(`data-createdBy="manual"`) 및 컨텍스트 메뉴(삭제).
- Undo/Redo: `history` 스택에 `add-connection`/`remove-connection` 이유 기록.

### Phase B – 직렬화 및 API 확장 (ETA 1.0d)
- 저장 시나리오: `routingStore` → `routing_groups` API payload에 `connections` 배열 포함.
- 백엔드 스키마: `routing_groups` JSON 컬럼에 `manual_connections` 필드 추가 또는 별도 테이블 `routing_group_connections`.
  - 제안: JSON 필드 예시  
    ```json
    {
      "id": "conn-uuid",
      "source_step_id": "step-uuid",
      "target_step_id": "step-uuid",
      "created_at": "ISO8601",
      "created_by": "username"
    }
    ```
- FastAPI 모델 업데이트: `RoutingGroupDetail` 스키마 확장 + 데이터 검증(존재하지 않는 노드 참조 차단).

### Phase C – 복원 & 검증 (ETA 0.5d)
- 그룹 로드 시 `manual_connections` 를 스토어로 전달하고 Canvas에 병합.
- QA:  
  - 저장 → 새로고침 → Canvas에 수동 와이어 유지  
  - 삭제/Undo → 저장 → 복원 검증  
  - 추천/타임라인 자동 연결과 충돌 없는지 확인

### Phase D – 확장 고려 사항
- 권한: 수동 연결 변동 이력(감사 로그) 기록 여부 결정.
- 추천 엔진 영향: 후속 설계에서 `manual_connections` 를 후보 순서 가중치에 반영할지 논의.
- 성능: 연결 수가 많은 경우 Canvas 렌더링 성능 관찰.

---

## 4. 의존성 & 리스크
- 백엔드 마이그레이션 필요 시 Alembic 스크립트 작성.
- 기존 그룹 데이터에는 `manual_connections` 가 없으므로 backwards compatibility 확인.
- 테스트 범위 확대: Playwright e2e (드래그 → 저장 → 로드) 추가 권장.

---

## 5. 산출물/체크리스트 매핑
- Phase 3 Checklist – “Canvas 신규 와이어 저장 로드맵” 항목 충족.
- 후속 개발 시 Phase A~C에 맞춘 티켓 발행 권장.*** End Patch*** End Patch
