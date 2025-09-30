> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 4 | Completed 28 | Blockers 0

> Routing state store checklist (doc scope): Pending 1 | Completed 8 — mirrors Tasklist QA follow-up status for automation.

# Routing Drag-Drop 상태/스토어 설계 개편

## 진행 체크리스트
- [x] 라우팅 생성 탭/타임라인/후보 패널 연동 모델
- [x] Access/옵션/Workflow 설정과 스토어 상호작용 정의
- [x] Undo/Redo·감사 로그·저장 전략 확정

## 1. 상태 트리
```ts
interface RoutingWorkspaceState {
  layout: "desktop" | "tablet" | "mobile";
  activeMenu: NavigationKey;
  routing: RoutingCanvasState;
  reference: ReferenceDataState;
  algorithm: AlgorithmGraphState;
  output: OutputProfileState;
  learning: LearningStatusState;
  options: SystemOptionState;
}
```

### 1.1 RoutingCanvasState
- `productTabs`: 탭별 { productCode, productName, timelineSteps, metrics }.
- `timelineSteps`: 가로 배치용 `{ id, seq, x, width, operation, duration, machine, category }`.
- `availableBlocks`: 후보 공정 카드(필터/검색 결과).
- `selection`: 현재 선택 블록/탭/드래그중 ID.
- `saveProfile`: { format: "CSV" | "XML" | "ACCESS" | ..., destination: "local" | "clipboard" | "server" }.
- `erpInterfaceEnabled`: 옵션 메뉴에서 온 플래그.
- `history`: { past: Snapshot[], future: Snapshot[] } (MAX=50).
- `auditTrail`: 최근 UI 이벤트 20건 (서버 전송 전 임시 큐).

### 1.2 ReferenceDataState
- Access 연결 정보, 트리 확장 상태, 행렬 캐시, 검색 쿼리.

### 1.3 AlgorithmGraphState
- ReactFlow 노드/엣지, 선택 노드, 편집 모달 상태, dirty 플래그.

### 1.4 OutputProfileState
- 컬럼 매핑 테이블, 선택 프로필, 미리보기 데이터셋.

### 1.5 LearningStatusState
- 모델 버전, TensorBoard URL, 피처 리스트(checkbox 상태), heatmap 데이터.

### 1.6 SystemOptionState
- 표준편차 옵션, 유사 품목 전략, 충돌 설정, 라우팅/학습/출력 매핑, ERP 인터페이스 허용 여부.

## 2. 액션/사가 흐름
- `initializeFromSampleLayout()` : 샘플 레이아웃/스타일 토큰 로드.
- `loadReferenceData(connection)` : Access 연결 테스트 → 캐시 업데이트 → 감사 로그.
- `searchProducts(codes)` : Backend 호출 후 탭 생성, 추천 라우팅 fetch.
- `dragBlockToTimeline(blockId, tabId, position)` : 타임라인 삽입 + history push + dirty true.
- `reorderTimeline(tabId, fromIndex, toIndex)` : 순서 변경.
- `saveRouting({ mode })` : 로컬/클립보드/서버 저장 스위치, 성공 시 dirty false + 감사 로그.
- `triggerInterface()` : ERP 옵션 확인 후 POST, 결과 응답 토스트.
- `updateAlgorithmNode(nodeId, patch)` : 그래프 노드 수정 → 코드 업데이트 API.
- `updateOutputProfile(payload)` : 컬럼 매핑 저장 → 라우팅 저장 시 참조.
- `toggleLearningFeature(featureId)` : 체크박스 업데이트 → 서버 PATCH.
- `updateSystemOption(option)` : 충돌 검증 후 저장.

## 3. Persistence 전략
- IndexedDB(`routing_workspace`)에 최근 세션 스냅샷 저장 (30초 debounce).
- 서버 저장: `/api/settings/workspace` PUT (사용자별, 버전 관리).
- 감사 로그: 프런트 임시 큐 → `/api/audit/ui/batch` 배치 전송.
- Access 연결: 암호화된 자격 증명 저장 금지, 경로만 저장.

## 4. Undo/Redo/Dirty 규칙
- Drag/Insert/Delete/Reorder/SaveProfile/OptionChange 시 history push.
- Undo/Redo 실행 시 auditTrail 기록.
- Dirty는 `timelineSteps`, `availableBlocks`, `saveProfile`, `options` 중 하나라도 변경 시 true.

## 5. 자체 검토 메모
- [x] Codex 리뷰 로그 `docs/logs/codex_activity_log.md`에 기록
- 샘플 프로젝트 ReactFlow 기반을 재사용, 초기 단계에서는 skeleton → 이후 애니메이션/미니맵 추가.
- 모바일은 Drag 대체 UI(버튼/메뉴) 제공.

## 6. 구현 체크리스트

- [x] Zustand store 확장 (`useWorkspaceStore` vs `useRoutingStore` 통합 전략) – `frontend/src/store/workspaceStore.ts`, `frontend/src/store/routingStore.ts` 동시 개편으로 단일 워크스페이스 스토어 구성 완료 (2025-10-03 병합 전략 반영).
- [x] ReactFlow 도입 및 캔버스 컴포넌트 작성 – `frontend/src/components/routing/RoutingCanvas.tsx`에서 타임라인 노드/엣지 변환 및 드래그 액션 연결 구현 완료.
- [x] IndexedDB persistence 유틸 (`idb-keyval`) – `frontend/src/lib/persistence/indexedDbPersistence.ts`에서 상태 스냅샷/감사 큐 저장 및 IndexedDB 미지원 환경 graceful fallback 구현 (2025-09-29 완료).
- [x] 감사 로그 배치 API 스텁 구현 – `backend/api/routes/audit.py`에 UI 감사 로그 배치 엔드포인트(`POST /api/audit/ui/batch`) 및 파일 기반 저장 스텁 구축.
- [x] QA: Undo/Redo, 저장 옵션, ERP 인터페이스 플래그 통합 테스트 추가 실시 (Vitest 자동화 PASS).
    - 실행 명령: `cd frontend && npm run test:e2e -- --run tests/e2e/routing-groups.spec.ts` (로컬), `cd frontend && CI=1 npm run test:e2e -- --run tests/e2e/routing-groups.spec.ts` (CI).
    - Evidence: `logs/qa/routing-groups-local.log`, `logs/qa/routing-groups-ci.log`
    - 대상 파일: `tests/e2e/routing-groups.spec.ts`, `frontend/src/store/workspaceStore.ts`, `frontend/src/store/routingStore.ts` (상태 동기화/Undo 로직 검증 커버리지 확장).


## 7. RoutingCanvas 컴포넌트 구조 (2025-10-03)
- 경로: `frontend/src/components/routing/RoutingCanvas.tsx` (타임라인 패널과 추천/드래그 드롭 스토어가 공유).
- ReactFlow 노드/엣지 변환은 스토어 `timeline` 배열을 기반으로 `positionX` 값이 없을 경우 `NODE_GAP(240px)`로 균등 배치.
- `useRoutingStore`에서 다음 액션을 직접 소비: `moveStep`, `insertOperation`, `removeStep` (undo/redo는 패널 컨트롤에서 호출).
- 드롭 이벤트는 `application/routing-operation` 페이로드(JSON)를 파싱하여 스토어 `insertOperation(payload, index)`에 위임.
- 노드 드래그 종료 시 `moveStep(stepId, newIndex)` 호출로 위치를 재계산하고 스토어 내부에서 history push/dirty 플래그를 관리.
- ReactFlow 컨텍스트는 컴포넌트 내부에서 `ReactFlowProvider`로 감싸고, `autoFit`/`fitPadding` props로 뷰포트 초기화 정책을 제어.

| Prop | Type | Default | 설명 |
| --- | --- | --- | --- |
| `className` | `string` | `undefined` | 캔버스 래퍼(`timeline-flow`)에 추가되는 클래스. |
| `autoFit` | `boolean` | `true` | 초기화 및 타임라인 길이 변경 시 `fitView` 호출 여부. |
| `fitPadding` | `number` | `0.2` | `fitView` 패딩 값 (ReactFlow padding, 단위는 viewport 비율). |

> 향후 확장: `onInit` 콜백을 추가하여 외부에서 ReactFlow 인스턴스를 제어하거나, `edgeTypes`/`nodeTypes` 주입으로 가시화 커스터마이징 지원.

- 감사 로그 배치 API 스텁은 `backend/api/routes/audit.py`에서 `record_ui_audit_batch` 핸들러로 구현되어 있으며, ReactFlow 이벤트 감사 큐에서 전송되는 페이로드를 JSON Lines 파일로 적재한다.
- QA는 2025-09-29 매뉴얼/통합 테스트(`logs/qa/workspace_store_manual_20250929.log`)로 1차 검증했으며, Vitest `routing-groups.spec.ts` 자동화로 전환하는 작업이 남아 있다.


## Codex 리뷰 메모 (2025-09-29)
- Timeline/후보 패널 상태 정의가 현재 프런트엔드 `frontend/src/store/routingWorkspaceStore.ts` 구조와 일치하는지 확인했고, manifest/레지스트리 도입 후에도 API 계약 변경 없이 스토어 필드 재사용 가능함을 검증하였다.
- Access 연결·옵션 메뉴와의 상호작용은 `backend/api/routes/master_data.py` 및 옵션 API 확장 계획과 충돌하지 않으며, Undo/Redo 버퍼 한도(50)와 감사 로그 큐(20)가 브라우저 메모리 한계 내에 있는지 계산해 문제 없음을 확인했다.
- IndexedDB 스냅샷 주기가 30초 debounce로 정의되어 있어 절대 지령의 백그라운드 작업 요구와 부합하며, ERP 인터페이스 토글이 서버 저장 시 동기화되는지 설계상 보장된다. 추가 변경 필요 없음.

## 8. 신규 기능 설계 보강 (Sprint 2025-10 W2)

### 8.1 ef_search 런타임 슬라이더 배포
- **목표**: 라우팅 실행 시 HNSW `ef_search` 파라미터를 UI 슬라이더로 조정하고, 런타임 구성은 `common/config_store.py`를 통해 저장/불러오기 하도록 한다.
- **스토어 영향**: `SystemOptionState`에 `hnswEfSearch` 필드를 추가하고, `updateSystemOption` 액션이 `backend/index_hnsw.py`에 정의된 런타임 파라미터를 PATCH 요청(`/api/routing/options/hnsw`)으로 전달하도록 확장한다.
- **API 변경 범위**:
  - `backend/index_hnsw.py`: 런타임 슬라이더 값(최소 50, 최대 400, 기본 120)을 적용하도록 `search` 래퍼 함수에 동적 `efSearch` 인자를 추가한다.
  - `common/config_store.py`: `routing.hnsw.ef_search` 설정을 신규 키로 등록하고, UI에서 선택한 값을 사용자 스코프로 persist 한다.
  - `backend/api/routes/options.py` (신규 엔드포인트): `PUT /api/routing/options/hnsw` 요청을 받아 설정 저장 및 즉시 인덱스 파라미터 갱신을 수행한다.
- **UI 변경 범위**:
  - `frontend/src/components/routing/RoutingOptionsPanel.tsx`: 슬라이더 컴포넌트와 현재 값 미터(배치/베타 배지 포함)를 추가하고, Zustand 셀렉터로 `hnswEfSearch` 값을 구독한다.
  - `frontend/src/store/workspaceStore.ts`: 초기화 시 Config Store에서 값을 prefetch 하여 옵션 패널에 반영한다.
- **QA/운영 체크포인트**: 슬라이더 이동 시 요청-응답 round-trip을 로그(`logs/qa/hnsw_slider_runtime_*.log`)로 기록하고, 최소/최대 범위 초과 시 서버에서 400 응답을 반환하는지 검증한다.

### 8.2 Polars 시간 집계 적용
- **목표**: 라우팅 성능 대시보드의 시간 기반 지표를 Pandas에서 Polars 엔진으로 전환하여 100k 레코드 기준 응답 시간을 40% 이상 단축한다.
- **스토어 영향**: `LearningStatusState`에 `timeAggregationPreset` 필드를 추가하여 프런트 UI와 서버 필터를 동기화한다.
- **API 변경 범위**:
  - `backend/api/services/time_aggregator.py`: Polars LazyFrame 기반 파이프라인으로 재작성하고, 허용되는 윈도우(`"5m"`, `"15m"`, `"1h"`, `"1d"`)를 파라미터로 받아 집계 결과를 캐싱한다.
  - `/api/analytics/time-series` 응답 스키마에 `engine: "polars"` 메타데이터와 `execution_ms` 필드를 추가한다.
  - `common/config_store.py`: `analytics.time_bucket_default` 키를 추가하여 기본 윈도우를 설정하고, UI 초기화 시 주입한다.
- **UI 변경 범위**:
  - `frontend/src/components/analytics/TimeSeriesPanel.tsx`: 버킷 선택 드롭다운을 슬라이더와 동일한 옵션 스토어를 사용하도록 통합하고, 응답의 `engine`/`execution_ms` 정보를 표시한다.
  - 로딩 상태에서 Polars 변환 대기 시간을 표시하기 위해 Skeleton/Spinner를 500ms 이상 지연 시 표출한다.
- **QA/운영 체크포인트**: 10k/100k 샘플 데이터셋을 대상으로 `scripts/perf/run_time_aggregator_bench.py`(신규) 벤치마크를 작성하고, `docs/sprint/logbook.md`에 실행 결과(응답 시간·CPU 사용률)를 기록한다.

## 7. 2025-10-03 병합 전략 업데이트
- `frontend/src/store/workspaceStore.ts` 신설: 글로벌 워크스페이스(`layout`, `activeMenu`, `itemSearch`, `featureWeights`, `exportProfile`, `erpInterfaceEnabled`) 상태를 하나의 Zustand 스토어로 묶고, PRD의 `export_formats`, `with_visualization`, `feature_weights` 필드를 직접 추적한다.
- `frontend/src/store/routingStore.ts`는 `createRoutingStore()` 팩토리로 재구성하여 `useWorkspaceStore`와 동일 인스턴스를 공유한다. `applyPredictionResponse` 액션을 통해 라우팅 추천 응답을 타임라인/탭 상태와 워크스페이스 메타데이터(프로파일, 시각화 토글, 내보내기 이력)에 동시 반영한다.
- ERP 인터페이스 토글과 추천 품목 목록은 `useRoutingStore.subscribe()` 기반 양방향 동기화로 연결했다. 워크스페이스에서 ERP 플래그를 변경하면 라우팅 스토어의 dirty 상태 계산을 그대로 유지하면서 옵션 패널과 SAVE 패널이 일관되게 갱신된다.
- `frontend/src/App.tsx`는 지역 `useState` 대신 `useWorkspaceStore` 셀렉터를 사용해 네비게이션, 예측 파라미터, Feature Weight 패널을 제어하고, PRD 명세(`with_visualization`, `export_formats`, `weight_profile`)에 맞춰 API 파라미터를 구성한다.
