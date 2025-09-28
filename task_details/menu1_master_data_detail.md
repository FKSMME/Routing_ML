> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 36 | Completed 5 | Blockers 0

# 메뉴 1 상세 계획: 기준정보 확인

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
   - Hover 시 row elevation, 클릭 시 우측 패널 세부 카드 업데이트.
   - 하단 "행선택 → copy" CTA 버튼으로 Access/CSV 복사 기능 제공.
4. **Access 연결 관리**
   - 우측 패널에 "연결 상태" 카드: 버튼으로 연결 재시도, 최근 성공시각 표시.
   - docs/Design/samples의 glass 버튼 스타일 재사용 (hover 시 accent glow).
5. **감사 로그 확인**
   - 우측 하단 카드에 최근 5건 로그 (IP, 사용자, 행위) 표시, "전체 로그 보기" 클릭 시 logs/audit/master_data.log 다운로드.

## 데이터 바인딩 & API 요구사항
- GET /api/master-data/tree: item_group → item_family → item nodes 반환 (캐시 60초, optimistic update).
- GET /api/master-data/matrix?itemCodes=...: Access ODBC fetch 결과.
- POST /api/master-data/search: 고급 검색 (AND/OR, 범위, 텍스트) → tree + matrix 동시 응답 구조.
- PATCH /api/master-data/favorites: 즐겨찾기 관리 (Body: { itemCode, pinned }).
- 모든 액션 시 logs/audit/master_data.log JSON 라인 append (schema = common/logging/schema.json).

## 시각 디자인 가이드
- 배경: rontend/src/styles/theme.ts pastelSkyTheme 사용, 메뉴 대비 낮게, 카드 대비 높게.
- 트리/탭 active 컬러: --accent, hover: --accent-soft, focus halo: --shadow-focus.
- 패널 카드 그림자 수준: resting (좌측), hover 시 중앙/우측만 lifting.
- 아이콘: lucide-react 18px, 색상 --text-muted 기본.
- Typography: Heading = 	ext-heading, 본문 = 	ext-primary, 서브라벨 = 	ext-muted.

## 반응형 고려사항
- 데스크톱(≥1440): 3컬럼.
- 랩탑(≥1280): 좌측+중앙 2컬럼, 우측 패널 하단 스태킹.
- 태블릿(≥1024): 트리/탭/행렬 순으로 세로 스택, 탭 가로 스크롤 유지.
- 모바일(<768): 기본 기능 축소 (검색 + 최근 조회 리스트 + Access 상태 카드) 후 "데스크톱에서 전체 기능 사용 안내" 토스트.

## QA & 로그
- 유닛 테스트: 검색 -> 트리 -> 행렬 데이터 일관성 3 케이스 (mock Access 데이터).
- E2E: Cypress 시나리오 (검색, 탭 전환, 즐겨찾기 추가, 로그 확인).
- 감사 로그 샘플: action search.master_data, 	ree.expand, avorites.pin, matrix.copy.

## TODO 체크리스트 업데이트
- [ ] UI 스토리보드 제작 (Figma 또는 Excalidraw) 후 deliverables/design/menu1_master_data_storyboard.png 업로드.
- [ ] API 스펙 문서화 (docs/backend_api_overview.md에 /api/master-data/* 추가).
- [ ] React 컴포넌트 구조 정의 (rontend/src/components/master-data/*).
