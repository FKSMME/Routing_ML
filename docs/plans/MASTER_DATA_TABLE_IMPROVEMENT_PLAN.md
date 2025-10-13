# 기준정보 테이블 개선 계획서
**작성일**: 2025-10-13
**작성자**: Claude Code
**목표**: 엑셀 및 Power Query 스타일의 고급 테이블 UI 구현

---

## 📋 프로젝트 개요

### 현재 문제점
**사용자 피드백**: "prediction의 기준정보 메뉴 하단 구성이 이상해"

**현재 구조 분석**:
```
┌─────────────────────────────────────────┐
│ 좌측 (20%)     │ 우측 (80%)             │
│ ─────────────  │ ───────────────────    │
│ 품목 목록      │ 4열 그리드 레이아웃    │
│ (Item_CD)      │ (50+ 컬럼)             │
│                │                         │
│ [검색창]       │ [label: value 형식]    │
│                │                         │
│ • ITEM001      │ 품목명: ABC            │
│ • ITEM002      │ 재질: SUS304           │
│ • ITEM003      │ 직경: 100mm            │
│                │ ...                     │
└─────────────────────────────────────────┘
```

**문제점**:
1. ❌ 한 번에 하나의 품목만 조회 가능
2. ❌ 컬럼 순서 변경 불가능
3. ❌ 개별 컬럼 검색 기능 없음
4. ❌ 라우팅 이력 필터링 기능 없음
5. ❌ 엑셀처럼 데이터를 테이블로 보기 어려움

---

## 🎯 목표 요구사항

### 1. MSSQL 데이터 소스
- **테이블**: `dbo_BI_ITEM_INFO_VIEW` (품목 마스터)
- **보조 테이블**: `dbo_BI_ROUTING_VIEW` (라우팅 이력)
- **연결 정보**: `.env` 파일의 MSSQL 설정 사용

### 2. 엑셀 스타일 테이블 뷰
```
┌────────────────────────────────────────────────────────────┐
│ 🔍 필터 & 도구모음                                         │
├─────────┬─────────┬──────────┬──────────┬────────┬────────┤
│ ITEM_CD │ ITEM_NM │ MATERIAL │ DIAMETER │ ... (N개 컬럼)  │
├─────────┼─────────┼──────────┼──────────┼────────┼────────┤
│ [검색]  │ [검색]  │ [검색]   │ [검색]   │               │ ← 컬럼별 검색
├─────────┼─────────┼──────────┼──────────┼────────┼────────┤
│ A001    │ 샤프트  │ SUS304   │ 100      │ ...            │
│ A002    │ 베어링  │ Steel    │ 50       │ ...            │
│ A003    │ 너트    │ Brass    │ 20       │ ...            │
│ ...     │ ...     │ ...      │ ...      │ ...            │
└─────────┴─────────┴──────────┴──────────┴────────┴────────┘
```

### 3. Power Query 기능
- ✅ 컬럼 순서 드래그 앤 드롭으로 변경
- ✅ 컬럼 표시/숨김 토글
- ✅ 컬럼별 개별 검색/필터
- ✅ 정렬 (오름차순/내림차순)
- ✅ 페이지네이션 (대용량 데이터 처리)

### 4. 라우팅 이력 필터
```sql
-- 라우팅 이력이 없는 품목만 표시
SELECT i.*
FROM dbo_BI_ITEM_INFO_VIEW i
LEFT JOIN dbo_BI_ROUTING_VIEW r ON i.ITEM_CD = r.ITEM_CD
WHERE r.ITEM_CD IS NULL
```

---

## 📐 기술 스택 및 구현 방식

### Frontend
| 항목 | 기술 | 용도 |
|------|------|------|
| **테이블 라이브러리** | TanStack Table v8 | 고성능 가상화, 정렬, 필터링 |
| **드래그 앤 드롭** | dnd-kit | 컬럼 순서 변경 |
| **가상화** | @tanstack/react-virtual | 수천 개 행 렌더링 최적화 |
| **스타일** | 기존 CSS + Tailwind | 기존 디자인 시스템 유지 |

### Backend
| 항목 | 기술 | 용도 |
|------|------|------|
| **ORM** | SQLAlchemy | MSSQL 연결 및 쿼리 |
| **API** | FastAPI | REST API 엔드포인트 |
| **페이지네이션** | Offset/Limit | 대용량 데이터 분할 조회 |
| **필터링** | Dynamic WHERE 절 | 컬럼별 검색 조건 생성 |

---

## 🗂️ 데이터베이스 스키마

### dbo_BI_ITEM_INFO_VIEW (품목 마스터)
**예상 컬럼 (54개)**:
```
ITEM_CD, PART_TYPE, PartNm, ITEM_SUFFIX,
ITEM_SPEC, ITEM_NM, ADDITIONAL_SPEC,
ITEM_MATERIAL, MATERIAL_DESC, ITEM_ACCT,
ITEM_TYPE, ITEM_UNIT,
ITEM_GRP1, ITEM_GRP1NM, STANDARD_YN,
GROUP1, GROUP2, GROUP3,
DRAW_NO, DRAW_REV, DRAW_SHEET_NO, DRAW_USE,
ITEM_NM_ENG,
OUTDIAMETER, INDIAMETER, OUTTHICKNESS, OUTDIAMETER_UNIT,
ROTATE_CLOCKWISE, ROTATE_CTRCLOCKWISE,
SealTypeGrup,
IN_SEALTYPE_CD, IN_SEALSIZE, IN_SEALSIZE_UOM,
MID_SEALTYPE_CD, MID_SEALSIZE, MID_SEALSIZE_UOM,
OUT_SEALTYPE_CD, OUT_SEALSIZE, OUT_SEALSIZE_UOM,
RAW_MATL_KIND, RAW_MATL_KINDNM,
... (추가 컬럼)
```

### dbo_BI_ROUTING_VIEW (라우팅 이력)
**주요 컬럼**:
```
ITEM_CD, PROC_SEQ, JOB_CD, RES_CD,
SETUP_TIME, RUN_TIME, WAIT_TIME,
VALID_FROM_DT, VALID_TO_DT,
... (공정 상세 정보)
```

---

## 📝 구현 단계 (Phase 1-5)

### Phase 1: 백엔드 API 개발 (2-3시간)

#### 1.1 API 엔드포인트 설계
```
GET /api/master-data/items
  ?page=1
  &limit=100
  &sort_by=ITEM_CD
  &sort_order=asc
  &filters={\"ITEM_NM\": \"샤프트\", \"MATERIAL_DESC\": \"SUS304\"}
  &exclude_with_routing=true  # 라우팅 이력 있는 품목 제외

Response:
{
  \"total\": 1234,
  \"page\": 1,
  \"limit\": 100,
  \"data\": [
    {
      \"ITEM_CD\": \"A001\",
      \"ITEM_NM\": \"샤프트\",
      \"MATERIAL_DESC\": \"SUS304\",
      ...
    },
    ...
  ],
  \"columns\": [
    {\"key\": \"ITEM_CD\", \"label\": \"품목코드\", \"type\": \"string\"},
    {\"key\": \"ITEM_NM\", \"label\": \"품목명\", \"type\": \"string\"},
    {\"key\": \"OUTDIAMETER\", \"label\": \"외경\", \"type\": \"number\"},
    ...
  ]
}
```

#### 1.2 SQL 쿼리 최적화
```python
# backend/api/routes/master_data.py

from sqlalchemy import select, func, text
from sqlalchemy.orm import Session

async def get_items_table_data(
    db: Session,
    page: int = 1,
    limit: int = 100,
    sort_by: str = \"ITEM_CD\",
    sort_order: str = \"asc\",
    filters: dict = None,
    exclude_with_routing: bool = False
):
    # Base query
    query = select(ItemInfoView)

    # 라우팅 이력 제외 필터
    if exclude_with_routing:
        subq = select(RoutingView.ITEM_CD).distinct()
        query = query.where(
            ItemInfoView.ITEM_CD.notin_(subq)
        )

    # 컬럼별 필터 적용
    if filters:
        for col, value in filters.items():
            if value:
                query = query.where(
                    getattr(ItemInfoView, col).ilike(f\"%{value}%\")
                )

    # 정렬
    order_col = getattr(ItemInfoView, sort_by)
    query = query.order_by(
        order_col.desc() if sort_order == \"desc\" else order_col.asc()
    )

    # 페이지네이션
    total = db.execute(
        select(func.count()).select_from(query.subquery())
    ).scalar()

    offset = (page - 1) * limit
    items = db.execute(query.offset(offset).limit(limit)).scalars().all()

    return {
        \"total\": total,
        \"page\": page,
        \"limit\": limit,
        \"data\": [item.to_dict() for item in items]
    }
```

#### 1.3 파일 수정 목록
```
✏️ backend/api/routes/master_data.py
  - 신규 엔드포인트 추가: GET /api/master-data/items

✏️ backend/api/services/master_data_service.py
  - get_items_table_data() 함수 추가
  - 동적 필터링 로직 구현

✏️ backend/database.py
  - ItemInfoView 모델 확인/추가
  - RoutingView 모델 확인/추가
```

---

### Phase 2: Frontend 테이블 컴포넌트 (3-4시간)

#### 2.1 TanStack Table 설치 및 설정
```bash
cd frontend-prediction
npm install @tanstack/react-table @tanstack/react-virtual
npm install @dnd-kit/core @dnd-kit/sortable
```

#### 2.2 테이블 컴포넌트 구조
```tsx
// frontend-prediction/src/components/tables/MasterDataTable.tsx

import { useReactTable, getCoreRowModel, ... } from '@tanstack/react-table';
import { useDndContext, DndContext, ... } from '@dnd-kit/core';

interface MasterDataTableProps {
  data: any[];
  columns: ColumnDef[];
  totalCount: number;
  onPageChange: (page: number) => void;
  onSortChange: (column: string, order: string) => void;
  onFilterChange: (filters: Record<string, string>) => void;
  onColumnOrderChange: (newOrder: string[]) => void;
}

export function MasterDataTable(props: MasterDataTableProps) {
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [columnFilters, setColumnFilters] = useState([]);

  const table = useReactTable({
    data: props.data,
    columns: props.columns,
    state: {
      columnOrder,
      columnVisibility,
      columnFilters,
    },
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className=\"master-data-table-container\">
        {/* 도구모음 */}
        <TableToolbar />

        {/* 테이블 헤더 */}
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <DraggableColumnHeader key={header.id} header={header} />
              ))}
            </tr>
          ))}
        </thead>

        {/* 테이블 바디 (가상화) */}
        <VirtualizedTableBody table={table} />

        {/* 페이지네이션 */}
        <TablePagination />
      </div>
    </DndContext>
  );
}
```

#### 2.3 컬럼별 검색 필터
```tsx
// 각 컬럼 헤더에 검색 입력창 추가
function ColumnHeader({ column }: { column: Column }) {
  const [filterValue, setFilterValue] = useState('');

  return (
    <th>
      <div className=\"column-header\">
        <span>{column.columnDef.header}</span>

        {/* 정렬 버튼 */}
        <button onClick={() => column.toggleSorting()}>
          {column.getIsSorted() === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* 검색 입력창 */}
      <input
        type=\"text\"
        value={filterValue}
        onChange={(e) => {
          setFilterValue(e.target.value);
          column.setFilterValue(e.target.value);
        }}
        placeholder={`검색...`}
        className=\"column-filter-input\"
      />
    </th>
  );
}
```

#### 2.4 드래그 앤 드롭 컬럼 순서 변경
```tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function DraggableColumnHeader({ header }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: header.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <ColumnHeader column={header.column} />
    </th>
  );
}
```

#### 2.5 파일 수정 목록
```
📂 frontend-prediction/src/components/tables/
  ✨ MasterDataTable.tsx (신규)
  ✨ ColumnHeader.tsx (신규)
  ✨ DraggableColumnHeader.tsx (신규)
  ✨ TableToolbar.tsx (신규)
  ✨ TablePagination.tsx (신규)

✏️ frontend-prediction/src/components/workspaces/MasterDataSimpleWorkspace.tsx
  - 완전히 재작성: 단일 품목 상세 → 전체 테이블 뷰

✨ frontend-prediction/src/hooks/useMasterDataTable.ts (신규)
  - 테이블 상태 관리 커스텀 훅

✨ frontend-prediction/src/lib/apiClient.ts
  - fetchMasterDataTableItems() 함수 추가
```

---

### Phase 3: 라우팅 이력 필터 (1시간)

#### 3.1 필터 체크박스 추가
```tsx
<div className=\"filter-toolbar\">
  <label>
    <input
      type=\"checkbox\"
      checked={excludeWithRouting}
      onChange={(e) => setExcludeWithRouting(e.target.checked)}
    />
    라우팅 이력 없는 품목만 표시
  </label>
</div>
```

#### 3.2 백엔드 쿼리 수정
```python
# backend/api/services/master_data_service.py

def get_items_without_routing(db: Session):
    \"\"\"라우팅 이력이 없는 품목만 조회\"\"\"
    subquery = (
        select(RoutingView.ITEM_CD)
        .distinct()
        .subquery()
    )

    query = (
        select(ItemInfoView)
        .where(~ItemInfoView.ITEM_CD.in_(subquery))
    )

    return db.execute(query).scalars().all()
```

---

### Phase 4: 스타일링 및 UX 개선 (2시간)

#### 4.1 엑셀 스타일 CSS
```css
/* frontend-prediction/src/styles/master-data-table.css */

.master-data-table-container {
  width: 100%;
  height: calc(100vh - 150px);
  display: flex;
  flex-direction: column;
}

.master-data-table {
  flex: 1;
  overflow: auto;
  border: 1px solid var(--border-color);
}

.master-data-table thead {
  position: sticky;
  top: 0;
  background: var(--surface-elevated);
  z-index: 10;
}

.master-data-table th {
  padding: 0;
  border-right: 1px solid var(--border-color);
  border-bottom: 2px solid var(--border-color);
  background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
  user-select: none;
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-weight: 600;
  cursor: pointer;
}

.column-header:hover {
  background: rgba(0, 0, 0, 0.05);
}

.column-filter-input {
  width: 100%;
  padding: 4px 8px;
  border: none;
  border-top: 1px solid var(--border-color);
  font-size: 12px;
}

.master-data-table td {
  padding: 8px 12px;
  border-right: 1px solid var(--border-lighter);
  border-bottom: 1px solid var(--border-lighter);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.master-data-table tr:hover {
  background: rgba(59, 130, 246, 0.05);
}

.dragging-column {
  opacity: 0.5;
  background: rgba(59, 130, 246, 0.1);
}
```

#### 4.2 반응형 디자인
```css
@media (max-width: 1366px) {
  .master-data-table th,
  .master-data-table td {
    font-size: 12px;
    padding: 6px 8px;
  }
}
```

---

### Phase 5: 테스트 및 문서화 (1-2시간)

#### 5.1 기능 테스트 체크리스트
```
✅ 전체 데이터 로딩 및 표시
✅ 페이지네이션 (100/500/1000 행)
✅ 정렬 (오름차순/내림차순)
✅ 컬럼별 검색 필터
✅ 컬럼 순서 드래그 앤 드롭
✅ 컬럼 표시/숨김 토글
✅ 라우팅 이력 필터 (체크박스)
✅ 가상화 스크롤 (1만+ 행 테스트)
✅ API 에러 핸들링
✅ 로딩 스피너
```

#### 5.2 성능 테스트
```
- 10,000 행 로딩 시간: < 2초
- 컬럼 필터 적용 시간: < 500ms
- 페이지 전환 시간: < 300ms
- 가상화 스크롤 FPS: > 30fps
```

#### 5.3 문서 작성
```
📄 docs/guides/MASTER_DATA_TABLE_USER_GUIDE.md
  - 사용자 가이드: 컬럼 순서 변경, 필터 사용법
  - 스크린샷 및 GIF

📄 docs/technical/MASTER_DATA_TABLE_ARCHITECTURE.md
  - 기술 아키텍처: 컴포넌트 구조, API 명세

📄 docs/reports/WORK_LOG_2025-10-13_MASTER_DATA_TABLE.md
  - 작업 로그: 단계별 진행 상황, 코드 변경 내역
```

---

## 📊 예상 작업 시간

| Phase | 작업 | 예상 시간 | 우선순위 |
|-------|------|-----------|----------|
| Phase 1 | 백엔드 API 개발 | 2-3시간 | P0 |
| Phase 2 | 프론트엔드 테이블 | 3-4시간 | P0 |
| Phase 3 | 라우팅 이력 필터 | 1시간 | P1 |
| Phase 4 | 스타일링 & UX | 2시간 | P1 |
| Phase 5 | 테스트 & 문서화 | 1-2시간 | P2 |
| **합계** | | **9-12시간** | |

---

## 🎨 UI 목업 (Before & After)

### Before (현재)
```
┌──────────────────────────────────────────┐
│ 품목 목록       │ 품목 상세 정보         │
│                 │                        │
│ [검색]          │ 품목코드: A001         │
│                 │ 품목명: 샤프트          │
│ • A001          │ 재질: SUS304           │
│ • A002          │ 외경: 100mm            │
│ • A003          │ 내경: 50mm             │
│                 │ ... (수직 나열)        │
└──────────────────────────────────────────┘
❌ 한 번에 1개 품목만 조회
❌ 비교 불가능
❌ 컬럼 순서 고정
```

### After (개선안)
```
┌──────────────────────────────────────────────────────────────┐
│ 🔍 전체 검색                          [ ] 라우팅 없는 품목만 │
├─────────┬─────────┬──────────┬──────────┬────────┬──────────┤
│ ITEM_CD │ ITEM_NM │ MATERIAL │ DIAMETER │ WEIGHT │ ...      │ ← 드래그 가능
│ [검색]  │ [검색]  │ [검색]   │ [검색]   │ [검색] │ ...      │ ← 컬럼별 검색
├─────────┼─────────┼──────────┼──────────┼────────┼──────────┤
│ A001    │ 샤프트  │ SUS304   │ 100      │ 1.5kg  │ ...      │
│ A002    │ 베어링  │ Steel    │ 50       │ 0.8kg  │ ...      │
│ A003    │ 너트    │ Brass    │ 20       │ 0.1kg  │ ...      │
│ ...     │ ...     │ ...      │ ...      │ ...    │ ...      │
├─────────┴─────────┴──────────┴──────────┴────────┴──────────┤
│ ◀ 1 2 3 ... 123 ▶    [100개씩 보기 ▼]            1,234건    │
└──────────────────────────────────────────────────────────────┘
✅ 전체 품목 한눈에 비교
✅ 컬럼 순서 자유 변경
✅ 컬럼별 검색/필터
```

---

## 🚀 실행 계획

### Day 1 (Phase 1-2)
```
09:00-12:00  Phase 1: 백엔드 API 개발
  - API 엔드포인트 추가
  - SQL 쿼리 최적화
  - 테스트용 데이터 확인

14:00-18:00  Phase 2: 프론트엔드 테이블 (Part 1)
  - TanStack Table 설치
  - 기본 테이블 컴포넌트 구현
  - 페이지네이션 연동
```

### Day 2 (Phase 3-5)
```
09:00-12:00  Phase 2: 프론트엔드 테이블 (Part 2)
  - 컬럼 드래그 앤 드롭
  - 컬럼별 검색 필터
  - 정렬 기능

14:00-15:00  Phase 3: 라우팅 이력 필터
  - 체크박스 추가
  - 백엔드 쿼리 수정

15:00-17:00  Phase 4: 스타일링
  - 엑셀 스타일 CSS
  - 반응형 디자인

17:00-18:00  Phase 5: 테스트 & 문서화
  - 기능 테스트
  - 문서 작성
```

---

## 📌 주의사항

### 1. 데이터 보안
```python
# 민감 정보 마스킹 (필요시)
MASKED_COLUMNS = ['EMPLOYEE_ID', 'SALARY']

def mask_sensitive_data(row):
    for col in MASKED_COLUMNS:
        if col in row:
            row[col] = '***'
    return row
```

### 2. 성능 최적화
```tsx
// 대용량 데이터 가상화
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: data.length,
  getScrollElement: () => scrollContainerRef.current,
  estimateSize: () => 35, // 행 높이
  overscan: 10, // 버퍼 행 수
});
```

### 3. 백엔드 캐싱 (선택사항)
```python
from functools import lru_cache
from datetime import timedelta

@lru_cache(maxsize=128)
def get_column_metadata():
    \"\"\"컬럼 메타데이터 캐싱\"\"\"
    return db.execute(select(ItemInfoView)).keys()
```

---

## 🎯 성공 기준

### 기능 완성도
- [ ] 50+ 컬럼 모두 테이블에 표시
- [ ] 컬럼 순서 드래그 앤 드롭 작동
- [ ] 각 컬럼별 검색 필터 작동
- [ ] 라우팅 이력 없는 품목 필터 작동
- [ ] 정렬 (오름차순/내림차순) 작동
- [ ] 페이지네이션 (100/500/1000) 작동

### 성능
- [ ] 1만 행 로딩 < 2초
- [ ] 필터 적용 < 500ms
- [ ] 가상화 스크롤 > 30fps

### UX
- [ ] 엑셀과 유사한 UI/UX
- [ ] 직관적인 컬럼 조작
- [ ] 로딩 상태 명확
- [ ] 에러 메시지 친화적

---

## 📚 참고 자료

### 라이브러리 문서
- [TanStack Table v8](https://tanstack.com/table/v8)
- [TanStack Virtual](https://tanstack.com/virtual/v3)
- [dnd-kit](https://docs.dndkit.com/)
- [SQLAlchemy ORM](https://docs.sqlalchemy.org/)

### 유사 구현 사례
- Microsoft Excel Online
- Google Sheets
- Airtable
- Notion Database

---

## ✅ 다음 단계

1. **사용자 승인 대기**
   - 이 계획서 검토 및 피드백
   - 우선순위 조정 (필요시)

2. **Phase 1 시작**
   - 백엔드 API 엔드포인트 구현
   - MSSQL 테이블 구조 확인
   - 테스트용 쿼리 실행

3. **진행 상황 보고**
   - 각 Phase 완료 후 작업 로그 업데이트
   - 스크린샷 및 데모 제공

---

**작성 완료**: 2025-10-13 15:00
**검토 요청**: 사용자에게 계획서 승인 요청
