# Master Data View Enhancement

- 작성일: 2025-10-20 12:49 (UTC-4)
- 작성자: Codex (GPT-5)

## 개요
기준정보(Master Data) 페이지의 우측 패널을 확장하고, ERP View `dbo.BI_ITEM_INFO_VIEW`의 컬럼과 데이터를 하단 노드 카드 형태로 시각화했습니다. 검색과 컬럼 필터를 추가하여 시안성과 탐색성을 개선했습니다.

## 주요 변경
1. **레이아웃 확장**
   - `MasterDataSimpleWorkspace` 우측 영역을 flex 레이아웃으로 재구성하고 상단 필드 그리드와 하단 ERP 뷰 패널을 분리.
   - `index.css`의 `master-data-simple-workspace` 스타일을 업데이트하여 좌측 패널 폭 확대, 전체 높이 여유 확보.

2. **ERP View 데이터 패널 추가**
   - `useErpViewSample` 훅을 활용해 `dbo.BI_ITEM_INFO_VIEW`에서 최대 200건을 로드.
   - 컬럼 칩과 검색 입력을 제공하여 특정 컬럼 또는 전체 텍스트 필터링 가능.
   - 각 행을 노드 카드(`master-data-view-card`)로 렌더링하여 주요 필드 확인이 쉽도록 구성.

3. **스타일 개선**
   - 하단 뷰 전용 CSS(`master-data-view-*`)를 추가해 카드 레이아웃, 칩, 검색 입력을 정의.
   - 기존 아이템 리스트/필드 카드 스타일은 유지하되, 그리드 열 수를 반응형으로 조정.

## 테스트
- `npm run build` (frontend-prediction) 실행 → 성공 (Vite 빌드 완료)
- 수동 UI 확인: 품목 선택, ERP 데이터 검색/필터링, 노드 카드 표시

## 후속 작업 제안
1. ERP View 데이터량이 많을 경우 pagination 또는 lazy loading 고려
2. 노드 카드에서 즐겨찾기/드래그 기능 필요 시 추가 검토
