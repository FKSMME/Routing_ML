# 라우팅 생성 UI 개선 요구사항

**날짜**: 2025년 10월 17일
**요청자**: 사용자
**우선순위**: 높음

---

## 📋 요구사항 목록

### 1. MSSQL ItemCode 리스트 뷰 추가 ✨

**위치**: 라우팅 생성 페이지 > 제어판 탭 > 좌측

**기능 설명**:
- MSSQL에 연결된 View 중 ItemCode 목록을 표시하는 새로운 UI 컴포넌트 추가
- 사용자가 미리 설정할 수 있는 기능 제공
- 검색 및 필터링 기능 포함

**기술 요구사항**:
```typescript
// 컴포넌트 구조
<ItemCodeListView>
  <SearchBar />
  <FilterOptions />
  <ItemCodeList items={mssqlItemCodes} />
</ItemCodeListView>
```

**API 엔드포인트**:
- `GET /api/view-explorer/views` - View 목록 조회
- `GET /api/view-explorer/views/{view_name}/sample` - ItemCode 데이터 조회

**UI 레이아웃**:
```
┌─────────────────────────────────────────────┐
│  라우팅 생성                                  │
├─────────────────────────────────────────────┤
│  [제어판 탭]                                 │
│                                              │
│  ┌──────────────┬─────────────────────────┐ │
│  │ ItemCode     │  제어판                  │ │
│  │ 리스트       │                          │ │
│  │              │  품목 코드 목록:         │ │
│  │ [검색...]    │  ┌──────────────────┐   │ │
│  │              │  │ (드롭 영역)       │   │ │
│  │ - ITEM001    │  │                  │   │ │
│  │ - ITEM002    │  │                  │   │ │
│  │ - ITEM003    │  └──────────────────┘   │ │
│  │   ...        │                          │ │
│  └──────────────┴─────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

### 2. 생산 접수 품목 드롭다운 삭제 🗑️

**삭제 대상**: 제어판의 "생산 접수 품목" 드롭다운 메뉴

**이유**: 새로운 ItemCode 리스트 뷰와 드래그 앤 드롭 기능으로 대체

**영향 범위**:
- `RoutingTabbedWorkspace.tsx` - 제어판 컴포넌트
- 품목 선택 관련 상태 로직

---

### 3. 드래그 앤 드롭 기능 구현 🎯

**기능 설명**:
- 좌측 ItemCode 리스트에서 품목 코드를 마우스로 드래그
- 우측 "품목 코드 목록" 영역으로 드롭하여 추가

**기술 스택**:
- React DnD 또는 HTML5 Drag and Drop API
- 추천: `@dnd-kit/core` 라이브러리 사용

**구현 상세**:
```typescript
// ItemCode 리스트 아이템 (Draggable)
<ItemCodeListItem
  itemCode="ITEM001"
  onDragStart={handleDragStart}
  draggable
/>

// 품목 코드 목록 (Drop Zone)
<DropZone
  onDrop={handleItemDrop}
  items={selectedItemCodes}
/>
```

**UX 요구사항**:
- 드래그 시 시각적 피드백 (커서 변경, 반투명 효과)
- 드롭 가능 영역 하이라이트
- 드롭 성공 시 애니메이션
- 중복 아이템 방지

---

### 4. 3D 모델 로딩 문제 수정 🎨

**현재 상태**:
- 3D 모델 파일 존재: `frontend-prediction/public/models/background.glb` (88KB)
- 문제: 페이지에서 사각형 모델만 로드됨

**원인 분석**:
- GLB 파일 경로 문제
- Three.js GLTFLoader 설정 문제
- 모델 렌더링 설정 문제

**수정 방향**:
1. ModelViewer 컴포넌트 확인
2. GLTFLoader 경로 및 설정 검증
3. 모델 스케일 및 카메라 설정 조정

**파일**:
- `frontend-prediction/src/components/ModelViewer.tsx`
- `frontend-prediction/src/components/HeroBanner.tsx`
- `frontend-prediction/src/components/FullScreen3DBackground.tsx`

---

### 5. 데이터 매핑 설정 메뉴 삭제 🗑️

**삭제 대상**: 관리자 메뉴의 "데이터 매핑 설정"

**이유**: 사용 빈도 낮음, UI 간소화

**삭제 파일/코드**:
- `App.tsx` - 관리자 메뉴 항목 제거
- 워크스페이스 라우팅 케이스 제거
- `NavigationKey` 타입에서 "data-mapping" 제거

**변경 전**:
```typescript
const ADMIN_NAVIGATION_ITEMS = [
  {
    id: "data-mapping",
    label: "데이터 매핑 설정",
    description: "MSSQL 테이블 · 컬럼 매핑",
    icon: <Table size={18} />,
  },
  // ...
];
```

**변경 후**:
```typescript
const ADMIN_NAVIGATION_ITEMS = [
  // "data-mapping" 항목 제거됨
  {
    id: "data-relationship",
    label: "데이터 관계 설정",
    // ...
  },
  // ...
];
```

---

### 6. 출력설정 메뉴 삭제 🗑️

**삭제 대상**: "출력설정" 메뉴

**이유**: 기능이 "프로파일 관리" 메뉴로 이관됨

**삭제 파일/코드**:
- `App.tsx` - "출력설정" 메뉴 항목 제거
- `DataOutputWorkspace.tsx` - 컴포넌트 삭제 또는 주석 처리
- `NavigationKey` 타입에서 "data-output" 제거

**마이그레이션 계획**:
- 기존 "출력설정" 기능 → "프로파일 관리"로 통합
- 프로파일 생성/수정/삭제 기능 유지
- 미리보기 및 내보내기 기능 프로파일 관리에서 제공

---

### 7. 라우팅 (미완성 요구사항)

**상태**: 요구사항 불완전

**후속 조치 필요**: 사용자에게 추가 설명 요청

---

## 🎯 구현 우선순위

### Phase 1: 메뉴 정리 (1시간)
1. ✅ 데이터 매핑 설정 메뉴 삭제
2. ✅ 출력설정 메뉴 삭제
3. ✅ NavigationKey 타입 정리

### Phase 2: 제어판 개선 (3시간)
1. ✅ 생산 접수 품목 드롭다운 삭제
2. ✅ ItemCode 리스트 뷰 컴포넌트 생성
3. ✅ MSSQL View 연동 API 구현
4. ✅ 검색 및 필터링 기능

### Phase 3: 드래그 앤 드롭 (2시간)
1. ✅ @dnd-kit/core 라이브러리 설치
2. ✅ Draggable ItemCode 컴포넌트
3. ✅ Drop Zone 컴포넌트
4. ✅ 드래그 앤 드롭 이벤트 핸들러

### Phase 4: 3D 모델 수정 (1시간)
1. ✅ ModelViewer 컴포넌트 디버깅
2. ✅ GLB 파일 로딩 확인
3. ✅ 렌더링 설정 조정

---

## 📐 기술 설계

### 컴포넌트 구조

```
RoutingTabbedWorkspace
├── 제어판 탭
│   ├── ItemCodeListView (새로 추가)
│   │   ├── SearchBar
│   │   ├── FilterDropdown
│   │   └── DraggableItemList
│   │       └── DraggableItemCodeItem (여러 개)
│   └── ControlPanel (수정)
│       ├── 품목 코드 목록 (Drop Zone)
│       ├── Top-K 슬라이더
│       ├── Threshold 슬라이더
│       └── 실행 버튼
├── 시각화 탭
└── 분석결과 탭
```

### 상태 관리

```typescript
// ItemCode 리스트 상태
const [mssqlItemCodes, setMssqlItemCodes] = useState<string[]>([]);
const [filteredItemCodes, setFilteredItemCodes] = useState<string[]>([]);
const [searchQuery, setSearchQuery] = useState<string>("");

// 선택된 품목 코드 (드롭된 아이템들)
const [selectedItemCodes, setSelectedItemCodes] = useState<string[]>([]);

// 드래그 상태
const [isDragging, setIsDragging] = useState(false);
```

### API 통신

```typescript
// MSSQL View에서 ItemCode 조회
async function fetchItemCodesFromView(): Promise<string[]> {
  // 1. View 목록 조회
  const views = await apiClient.get('/view-explorer/views');

  // 2. ItemCode가 포함된 View 선택 (예: 'ItemMaster')
  const itemMasterView = views.data.find(v => v.name === 'ItemMaster');

  // 3. View 데이터 샘플 조회
  const sample = await apiClient.get(`/view-explorer/views/${itemMasterView.name}/sample`);

  // 4. ItemCode 컬럼 추출
  const itemCodes = sample.data.rows.map(row => row.ItemCd);

  return itemCodes;
}
```

---

## 🧪 테스트 시나리오

### 테스트 1: ItemCode 리스트 표시
1. 라우팅 생성 페이지 접속
2. 제어판 탭 클릭
3. 좌측에 ItemCode 리스트가 표시됨
4. 검색 바에 "TEST" 입력 → 필터링된 결과 표시

### 테스트 2: 드래그 앤 드롭
1. ItemCode 리스트에서 "ITEM001" 드래그 시작
2. 커서가 변경되고 아이템이 반투명해짐
3. 우측 "품목 코드 목록" 위로 이동 → 영역 하이라이트
4. 드롭 → "ITEM001"이 품목 코드 목록에 추가됨
5. 동일한 아이템 재드롭 시도 → 무시됨 (중복 방지)

### 테스트 3: 메뉴 삭제 확인
1. 좌측 메뉴에서 "데이터 매핑 설정" 메뉴 없음
2. 좌측 메뉴에서 "출력설정" 메뉴 없음
3. 기존 기능이 "프로파일 관리"에서 정상 작동

### 테스트 4: 3D 모델 로딩
1. 페이지 로드 시 background.glb 모델이 정상 렌더링됨
2. 사각형이 아닌 실제 3D 모델 표시
3. 자동 회전 또는 마우스 인터랙션 동작

---

## 🚧 알려진 제약사항

1. **ItemCode View 이름 하드코딩**
   - 현재: View 이름을 코드에 하드코딩 (예: 'ItemMaster')
   - 개선: 설정 파일 또는 환경변수로 관리

2. **대용량 ItemCode 처리**
   - ItemCode가 10,000개 이상일 경우 성능 이슈 가능
   - 가상 스크롤링 (Virtual Scrolling) 적용 필요

3. **드래그 앤 드롭 모바일 지원**
   - 터치 디바이스에서 드래그 앤 드롭 동작 제한적
   - 대체: 버튼 클릭으로 추가하는 옵션 제공

---

## 📝 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2025-10-17 | 1.0 | 초기 요구사항 작성 |

---

**작성자**: Claude Code
**승인자**: (승인 필요)
**다음 단계**: 구현 시작 전 요구사항 검토 및 승인
