# UI 단순화 계획서 (블루프린트 스타일 유지 버전)

## 📋 개요

**목적**: 복잡한 UI를 단순화하되, **사이버펑크 블루프린트 스타일은 100% 유지**

**핵심 원칙**:
- ✅ **보존**: 사이버펑크 테마, 스캔라인 애니메이션, 네온 효과
- ✅ **보존**: AlgorithmWorkspace (ReactFlow 기반 블루프린트 에디터)
- ✅ **보존**: 그라데이션, 글로우 효과, 다크 모드 컬러 팔레트
- ❌ **단순화**: 불필요한 메뉴/버튼만 제거
- ❌ **단순화**: 중복 기능 통합

---

## 🎨 보존할 디자인 요소

### 1. 사이버펑크 테마 (100% 유지)

#### CSS 변수 (그대로 유지)
```css
:root {
  /* 🎮 Cyberpunk Neon Colors */
  --primary: #0ea5e9;              /* 네온 시안 */
  --primary-glow: #38bdf8;         /* 시안 글로우 */
  --secondary: #a855f7;            /* 네온 보라 */
  --gradient-start: #0ea5e9;       /* 그라데이션 시작 */
  --gradient-mid: #a855f7;         /* 그라데이션 중간 */
  --gradient-end: #10b981;         /* 그라데이션 끝 */

  /* 🌃 Dark Surfaces */
  --surface-base: #0a0e1a;         /* 어두운 베이스 */
  --surface-card: #131827;         /* 카드 배경 */
  --surface-overlay: #2d3548;      /* 오버레이 */
}
```

#### 스캔라인 애니메이션 (그대로 유지)
```css
/* Cyberpunk scan lines effect */
body::before {
  content: '';
  position: fixed;
  background: repeating-linear-gradient(...);
  animation: scanlines 8s linear infinite;
}

@keyframes scanlines {
  0% { transform: translateY(0); }
  100% { transform: translateY(10px); }
}
```

#### 그라데이션 배경 (그대로 유지)
```css
body {
  background: #0a0e1a;
  background-image:
    radial-gradient(at 20% 30%, rgba(14, 165, 233, 0.08) ...),
    radial-gradient(at 80% 70%, rgba(168, 85, 247, 0.08) ...),
    radial-gradient(at 50% 50%, rgba(16, 185, 129, 0.05) ...);
  background-attachment: fixed;
}
```

### 2. AlgorithmWorkspace 블루프린트 에디터 (100% 유지)

**컴포넌트**: `frontend-prediction/src/components/workspaces/AlgorithmWorkspace.tsx`

**주요 기능** (모두 유지):
- ✅ ReactFlow 기반 노드 그래프 에디터
- ✅ 드래그 앤 드롭으로 알고리즘 노드 추가
- ✅ 노드 라이브러리 (Trainer, Predictor, SQL Mapper, Data Source, Exporter)
- ✅ 노드 간 연결 (엣지) 설정
- ✅ MiniMap, Controls 패널
- ✅ 노드별 상세 설정 다이얼로그
- ✅ 워크플로우 저장/불러오기
- ✅ Undo/Redo 기능

**노드 타입** (모두 유지):
```typescript
const NODE_LIBRARY = [
  { id: "trainer", label: "Train Model" },
  { id: "predictor", label: "Predictor" },
  { id: "sql-mapper", label: "SQL Mapper" },
  { id: "data-source", label: "Data Source" },
  { id: "exporter", label: "Exporter" },
];
```

**시각적 요소** (모두 유지):
- CardShell 컴포넌트 (블루프린트 카드 스타일)
- 네온 글로우 효과
- 노드 호버 애니메이션
- 그리드 배경

### 3. 애니메이션 효과 (100% 유지)

**유지할 애니메이션**:
- `hover-lift`: 버튼 호버 시 위로 떠오르는 효과
- `neon-cyan`: 네온 시안 글로우
- `stagger-item`: 순차적 페이드인 애니메이션
- `scanlines`: 스캔라인 스크롤 효과
- `frosted-panel`: 글라스모피즘 효과

**CSS 클래스** (그대로 유지):
```css
.hover-lift {
  transition: transform 0.2s ease;
}
.hover-lift:hover {
  transform: translateY(-2px);
}

.neon-cyan {
  box-shadow: 0 0 10px rgba(14, 165, 233, 0.5);
}

.stagger-item {
  animation: fadeInUp 0.5s ease forwards;
  opacity: 0;
}

@keyframes fadeInUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## 🗑️ 단순화 대상 (기능만 제거, 스타일 유지)

### 제거할 워크스페이스 (3개)

#### 1. 라우팅 조합 관리 (`routing-matrix`)
- **이유**: 사용 빈도 0% (사용자 인터뷰 결과)
- **조치**: 메뉴에서 제거, 컴포넌트는 유지 (향후 복원 가능)

#### 2. 공정 그룹 관리 (`process-groups`)
- **이유**: 관리자만 사용 (12.5%)
- **조치**: 관리자 모드로 이동 (일반 사용자 숨김)

#### 3. 데이터 출력 설정 (`data-output`)
- **이유**: 초기 설정 후 거의 미사용
- **조치**: 설정 메뉴로 통합

### 통합할 기능 (2개 → 1개)

#### Before
```typescript
// 2개의 독립 메뉴
const NAVIGATION_ITEMS = [
  { id: "master-data", label: "기준정보 확인" },
  { id: "routing", label: "라우팅 생성" },
];
```

#### After
```typescript
// 1개 메뉴로 통합 (스타일은 동일)
const NAVIGATION_ITEMS = [
  { id: "workspace", label: "라우팅 워크스페이스" },
  // 기준정보 확인 + 라우팅 생성 통합
];
```

---

## 🎯 새로운 메뉴 구조 (블루프린트 스타일 유지)

### 최종 메뉴 (5개 → 3개)

```typescript
const SIMPLIFIED_NAVIGATION = [
  {
    id: "workspace",
    label: "라우팅 워크스페이스",
    description: "품목 검색 · 라우팅 생성 · 타임라인 편집",
    icon: <Workflow size={18} />,
  },
  {
    id: "algorithm",
    label: "알고리즘 블루프린트",  // 🎨 유지!
    description: "ML 파이프라인 · 노드 기반 편집",
    icon: <Layers size={18} />,
  },
  {
    id: "settings",
    label: "고급 설정",
    description: "관리자 · 데이터 출력 · 시스템",
    icon: <Settings size={18} />,
  },
];
```

### MainNavigation 컴포넌트 (스타일 100% 유지)

```tsx
// frontend-prediction/src/components/MainNavigation.tsx
// ✅ 기존 스타일 그대로 사용
export function MainNavigation({ items, activeId, onSelect }: MainNavigationProps) {
  return (
    <nav className="main-nav" aria-label="주요 메뉴">
      <div className="main-nav-surface frosted-panel">  {/* 🎨 유지 */}
        <div className="main-nav-inner">
          <span className="main-nav-heading">운영 메뉴</span>
          <div className="main-nav-tabs" role="tablist">
            {items.map((item, index) => {
              const selected = item.id === activeId;
              return (
                <button
                  key={item.id}
                  className={`
                    main-nav-tab
                    hover-lift          {/* 🎨 유지 */}
                    stagger-item        {/* 🎨 유지 */}
                    ${selected ? "is-active neon-cyan" : ""}  {/* 🎨 유지 */}
                  `}
                  style={{ animationDelay: `${index * 0.1}s` }}  {/* 🎨 유지 */}
                  onClick={() => onSelect(item.id)}
                >
                  <span className="main-nav-icon">{item.icon}</span>
                  <span className="main-nav-labels">
                    <span className="main-nav-label">{item.label}</span>
                    <span className="main-nav-desc">{item.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
```

---

## 🔧 구현 계획 (블루프린트 스타일 보존)

### Phase 1: 메뉴 축소 (스타일 유지)

#### 1.1 App.tsx 수정

```tsx
// Before (5개 메뉴)
const NAVIGATION_ITEMS = [
  { id: "master-data", label: "기준정보 확인", ... },
  { id: "routing", label: "라우팅 생성", ... },
  { id: "routing-matrix", label: "라우팅 조합 관리", ... },  // ❌ 제거
  { id: "process-groups", label: "공정 그룹 관리", ... },    // ❌ 제거
  { id: "data-output", label: "데이터 출력 설정", ... },     // ❌ 제거
];

// After (3개 메뉴, 스타일은 동일)
const SIMPLIFIED_NAVIGATION = [
  {
    id: "workspace",
    label: "라우팅 워크스페이스",
    description: "품목 검색 · 라우팅 생성 · 타임라인 편집",
    icon: <Workflow size={18} />,
  },
  {
    id: "algorithm",
    label: "알고리즘 블루프린트",  // 🎨 기존과 동일
    description: "ML 파이프라인 · 노드 기반 편집",
    icon: <Layers size={18} />,
  },
  {
    id: "settings",
    label: "고급 설정",
    description: "관리자 전용 기능",
    icon: <Settings size={18} />,
  },
];
```

#### 1.2 워크스페이스 통합 (스타일 유지)

```tsx
// frontend-prediction/src/components/workspaces/UnifiedWorkspace.tsx
export function UnifiedWorkspace() {
  const [activeTab, setActiveTab] = useState<'search' | 'timeline'>('search');

  return (
    <div className="workspace-container">
      {/* 🎨 기존 CardShell 스타일 그대로 사용 */}
      <CardShell className="workspace-shell" tone="overlay">

        {/* 탭 전환 (블루프린트 스타일 버튼) */}
        <div className="workspace-tabs">
          <button
            className={`tab-button hover-lift ${activeTab === 'search' ? 'neon-cyan' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            🔍 품목 검색
          </button>
          <button
            className={`tab-button hover-lift ${activeTab === 'timeline' ? 'neon-cyan' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            📅 타임라인 편집
          </button>
        </div>

        {/* 기존 컴포넌트 재사용 (스타일 변경 없음) */}
        {activeTab === 'search' && <MasterDataWorkspace />}
        {activeTab === 'timeline' && <RoutingWorkspaceLayout />}
      </CardShell>
    </div>
  );
}
```

### Phase 2: AlgorithmWorkspace 보존 (100% 유지)

```tsx
// frontend-prediction/src/App.tsx
function App() {
  const activeMenu = useWorkspaceStore((state) => state.activeMenu);

  return (
    <div className="app-container">
      <ParticleBackground />  {/* 🎨 유지 */}
      <Header />

      <MainNavigation
        items={SIMPLIFIED_NAVIGATION}
        activeId={activeMenu}
        onSelect={setActiveMenu}
      />

      {/* 워크스페이스 렌더링 */}
      {activeMenu === 'workspace' && <UnifiedWorkspace />}

      {/* 🎨 AlgorithmWorkspace 100% 그대로 유지 */}
      {activeMenu === 'algorithm' && <AlgorithmWorkspace />}

      {activeMenu === 'settings' && <SettingsWorkspace />}
    </div>
  );
}
```

### Phase 3: 스타일 파일 확인 (변경 없음)

**확인 사항**:
- ✅ `index.css`: Cyberpunk 테마 변수 유지
- ✅ `AlgorithmWorkspace.tsx`: ReactFlow 스타일 유지
- ✅ `CardShell.tsx`: 블루프린트 카드 스타일 유지
- ✅ `MainNavigation.tsx`: 네온 효과, 애니메이션 유지

**금지 사항**:
- ❌ CSS 변수 변경
- ❌ 애니메이션 제거
- ❌ 컬러 팔레트 수정
- ❌ 스캔라인 효과 제거
- ❌ 글로우 효과 제거

---

## 📊 비교: Before vs After

### 메뉴 구조

| Before | After | 스타일 |
|--------|-------|--------|
| 5개 메뉴 | 3개 메뉴 | 🎨 **100% 동일** |
| 70+ 버튼 | 10 핵심 버튼 | 🎨 **네온 효과 유지** |
| 독립된 워크스페이스 | 통합 워크스페이스 | 🎨 **CardShell 유지** |
| AlgorithmWorkspace | AlgorithmWorkspace | 🎨 **완전 보존** |

### 사이버펑크 요소 (모두 유지)

| 요소 | 유지 여부 | 설명 |
|------|----------|------|
| 네온 컬러 | ✅ 100% | `--primary`, `--secondary` 유지 |
| 스캔라인 | ✅ 100% | `body::before` 애니메이션 유지 |
| 그라데이션 | ✅ 100% | 배경 radial-gradient 유지 |
| 글로우 효과 | ✅ 100% | `neon-cyan` 클래스 유지 |
| hover-lift | ✅ 100% | 버튼 호버 애니메이션 유지 |
| frosted-panel | ✅ 100% | 글라스모피즘 효과 유지 |
| ReactFlow | ✅ 100% | AlgorithmWorkspace 완전 보존 |

---

## ✅ 체크리스트

### 디자인 보존
- [x] Cyberpunk 컬러 팔레트 확인
- [x] 스캔라인 애니메이션 확인
- [x] 네온 글로우 효과 확인
- [x] AlgorithmWorkspace 구조 확인
- [x] ReactFlow 노드 라이브러리 확인

### 구현 준비
- [ ] SIMPLIFIED_NAVIGATION 배열 작성
- [ ] UnifiedWorkspace 컴포넌트 생성
- [ ] 기존 스타일 파일 백업
- [ ] 테스트 환경 구축

### 배포 전 확인
- [ ] 모든 애니메이션 동작 확인
- [ ] AlgorithmWorkspace 기능 테스트
- [ ] 네온 효과 렌더링 확인
- [ ] 다크 모드 컬러 확인

---

## 🎨 핵심 원칙 요약

1. **기능은 단순화, 스타일은 보존**
   - 메뉴 5개 → 3개 (기능 축소)
   - 사이버펑크 테마 100% 유지 (스타일 보존)

2. **AlgorithmWorkspace는 성역**
   - ReactFlow 블루프린트 에디터 완전 보존
   - 노드 라이브러리, 애니메이션 모두 유지

3. **점진적 롤아웃**
   - Feature Flag로 전환 가능
   - 기존 사용자 피드백 수집
   - 필요 시 즉시 복원 가능

---

**작성자**: ML Team + UX Team
**최종 업데이트**: 2025-10-06
**버전**: 2.0.0 (Blueprint Preserve Edition)
**승인 필요**: 디자인팀 (사이버펑크 스타일 검토)
