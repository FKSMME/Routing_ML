> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 0 | Completed 12 | Blockers 0

# 메뉴 1 상세 계획: 기준정보 확인

## 체크리스트 (최대 20개 관리)
- [x] 스토리보드 확정 및 샘플 디자인(main/4.jpg) 매핑 — `docs/Design/samples` Glass UI 요소 재사용.
- [x] Access 메타데이터 API 매핑 정의 — `backend/api/routes/access.py`, `backend/api/routes/workspace.py` 검토 완료.
- [x] 컴포넌트 구조 정리 — `frontend/src/components/master-data/*` 모듈 구성을 도식화.
- [x] 감사 로그/저장 경로 문서화 — `logs/audit/master_data.log`, `logs/audit/ui_actions.log` 레코드 규칙 정리.
- [x] 데이터·UI 상태 동기화 흐름 점검 — `frontend/src/hooks/useMasterData.ts` 상태 전파 구조 확인.
- [x] 검색/트리/행렬 상호작용 QA 시나리오 작성 — `docs/sprint/routing_enhancement_qa.md` Master Data 섹션 갱신.
- [x] Access 연결 테스트 플로우 정의 — `/api/access/connection/test` 엔드포인트와 UI 버튼 연결 설명 추가.
- [x] 즐겨찾기/최근 조회 저장 위치 검토 — IndexedDB 스냅샷과 서버 설정(`workspace_settings.json`) 동기화 문서화.
- [x] 로컬/공유 드라이브 Access 파일 경로 처리 가이드 작성 — `docs/install_guide_ko.md`와 본 문서에 반영.
- [x] UI 감사 로그 필드(IP, 사용자, 작업) 표 작성 — `docs/absolute_directive_report.md`와 연동.
- [x] 오프라인 복원 시나리오 문서화 — IndexedDB + 서버 재동기화 단계 정리.
- [x] 승인 로그 확보 — `docs/sprint/logbook.md` 2025-09-29 "Master data tree/matrix" 기록 참조.

## 참고 리소스
- 샘플 프로젝트: docs/Design/samples 내 Navigation/Glass UI 패턴 (Navigation.tsx, components/ui/*).
- 디자인 시안: main/4.jpg (상단 그라데이션 헤더, 카드형 레이아웃, 다중 패널 배치).
- 현행 요구: Access DB dbo_BI_ITEM_INFO_VIEW 중심 검색/트리/행렬 뷰, 감시 로그 logs/audit/master_data.log.

## 레이아웃 개요
1. **상단 고정 헤더**
   - 샘플의 glass-overlay 네비게이션을 기반으로, 상단 80px 고정.
   - 좌측: 서비스 로고 + 메뉴 명 "기준정보 확인" Subtitle.
   - 우측: 검색 프리셋, 로그 보기 버튼 (hover 시 outline glow).
2. **주 그리드 (20 / 55 / 25 비율)**
   - 좌측 패널: Siemens Teamcenter 유사 트리 + 품목 검색 (샘플 Navigation의 아이콘/토글 상호작용 차용).
   - 중앙 패널: 품목 상세 행렬 (column sticky header, zebra row), 상단 탭바로 품목 간 전환.
   - 우측 패널: 관련 메타정보 카드(최근 조회, Access 연결 상태, ERP 링크), 감사 로그 요약.
3. **하단 상태바**
   - 마지막 동기화 시간, 선택 품목 수, 현재 Access 경로 표시.

## 인터랙션 흐름
1. **검색 & 트리 탐색**
   - 상단 다중 검색 (품목코드/자재명/치수). 검색 시 좌측 트리와 중앙 행렬 동시 업데이트.
   - 트리 구성: 그룹 (itemGroup) → 제품군 → 품목. 노드 hover 시 파스텔 하이라이트, 클릭 시 활성 탭 전환.
   - 노드 우클릭 메뉴: 즐겨찾기 추가, 최근 조회 고정, Access 경로 열기.
2. **품목 탭 관리**
   - 중앙 상단 탭 리스트 (샘플 Navigation Desktop 메뉴와 유사한 pill 스타일).
   - 탭 드래그로 순서 변경, X 버튼으로 닫기, Pin 버튼 클릭 시 고정 탭 컬러 진하게.
   - 5개 초과 시 가로 스크롤 + 드롭다운(샘플 모바일 메뉴 패턴 참고).
3. **행렬 뷰 컨트롤**
   - 컬럼 그룹: 기본 정보 / 치수 / 공정 속성 / ERP 매핑. 컬럼 헤더 클릭 시 정렬, shift+클릭시 다중 정렬.
   - Hover 시 row elevation, 클릭 시 우측 패널 세부 카드 업데이트 (`frontend/src/components/master-data/MasterDataMatrix.tsx`).
   - 하단 "행선택 → copy" CTA 버튼으로 Access/CSV 복사 기능 제공, 클릭 시 `master_data.matrix.copy` 감사 로그 전송.
4. **Access 연결 관리**
   - 우측 패널에 "연결 상태" 카드: 버튼으로 연결 재시도, 최근 성공시각 표시.
   - docs/Design/samples의 glass 버튼 스타일 재사용 (hover 시 accent glow).
5. **감사 로그 확인**
   - 우측 하단 카드에 최근 5건 로그 (IP, 사용자, 행위) 표시, "전체 로그 보기" 클릭 시 logs/audit/master_data.log 다운로드.

## 스토리보드 & 화면 흐름
- `MasterDataWorkspace`(좌/중앙/우 20/55/25 구성) → `MasterDataTree`(Siemens Teamcenter 스타일) → `MasterDataTabs`/`MasterDataMatrix` → `MasterDataInfoPanel`/`MasterDataMetadataPanel` 순으로 연결된다. 【F:frontend/src/components/master-data/MasterDataWorkspace.tsx†L1-L63】
- 상단 헤더/검색/로그 패널은 `docs/Design/samples/Navigation.tsx`의 Glass 효과를 Tailwind 토큰으로 이식하고, 반응형 레이아웃(`frontend/src/styles/responsive.ts`)을 통해 1024px 이하에서는 좌측 패널이 Drawer로 전환된다.
## API & 데이터 매핑
- `/api/access/metadata` — Access 테이블/컬럼 스키마/샘플 데이터를 반환, 조회 시 `AccessMetadataResponse` 스키마(`backend/api/routes/access.py`)를 사용한다. 【F:backend/api/routes/access.py†L1-L33】
- `/api/access/connection/test` — 경로와 테이블 검증, 응답(`AccessConnectionResponse`)에 path hash 및 table_profiles 포함. 【F:backend/api/routes/workspace.py†L1-L139】
- `/api/settings/workspace` — 마스터 데이터 즐겨찾기/탭/로그 보기 등의 UI 상태를 저장, 감사 로그에 mapping scope/개수를 기록한다. 【F:backend/api/routes/workspace.py†L52-L111】
- 감사 로그는 `logs/audit/master_data.log`(Access/트리 이벤트)와 `logs/audit/ui_actions.log`(`master_data.*` 이벤트)로 분리 저장, 승인 시 `docs/absolute_directive_report.md` 3.2항을 참조.
## 컴포넌트 구조
- **입력/검색 영역**: `MasterDataItemInput`, `MasterDataSearchPanel`, `MasterDataTree` — 품목 입력/트리 탐색, 검색 시 트리/매트릭스 동기화. 【F:frontend/src/components/master-data/MasterDataWorkspace.tsx†L17-L46】
- **중앙 행렬**: `MasterDataTabs` + `MasterDataMatrix` — 멀티 탭/스크롤 행렬, 복사 이벤트 감사 로깅 포함. 【F:frontend/src/components/master-data/MasterDataWorkspace.tsx†L47-L58】
- **우측 패널**: `MasterDataInfoPanel`, `MasterDataMetadataPanel` — Access 연결 상태·로그·메타데이터, `/api/access/metadata` 응답 표시. 【F:frontend/src/components/master-data/MasterDataWorkspace.tsx†L59-L63】
- **상태 훅**: `useMasterData` — 트리/탭/매트릭스/로그/메타데이터 fetch 및 IndexedDB-서버 동기화. 【F:frontend/src/hooks/useMasterData.ts†L1-L220】
## 승인 & 추적
- `docs/sprint/logbook.md` 2025-09-29 "Master data tree/matrix redesign" 항목에서 설계 승인 완료 기록.
- `docs/sprint/routing_enhancement_tasklist.md` Phase 3 해당 체크박스를 본 문서 업데이트와 함께 완료 처리.

## TODO 체크리스트 업데이트
- [ ] UI 스토리보드 제작 (Figma 또는 Excalidraw) 후 deliverables/design/menu1_master_data_storyboard.png 업로드.
- [ ] API 스펙 문서화 (docs/backend_api_overview.md에 /api/master-data/* 추가).
- [ ] React 컴포넌트 구조 정의 (rontend/src/components/master-data/*).
