# UI 개선 최종 계획서 (블루프린트 + 베이브 애니메이션)

## 📋 개요

**목적**: 모든 기능을 유지하면서 UI/UX를 개선하고 화려한 애니메이션 추가

**핵심 원칙**:
- ✅ **기능 100% 유지**: 그룹관리, 조합관리, 출력 설정 등 모든 기능 보존
- ✅ **블루프린트 스타일 100% 유지**: 사이버펑크 네온 효과, 스캔라인, 그라데이션
- ✅ **베이브 애니메이션 추가**: 페이지 전환 시 박스 떨어지면서 먼지 일렁이는 효과
- ✅ **드래그앤드롭 강화**: 라우팅 워크스페이스 전면 개선

---

## 🎨 새로운 애니메이션 효과

### 1. 페이지 전환 - "베이브" 효과

**설명**: 메뉴 페이지 이동 시 각 카드/패널이 위에서 쿵쿵쿵 떨어지면서 주변에 먼지가 일렁이는 효과

#### 1.1 박스 떨어지는 애니메이션

```css
/* frontend-prediction/src/styles/animations.css */

/* 🎬 베이브 효과: 박스가 떨어지면서 착지 */
@keyframes boxDrop {
  0% {
    transform: translateY(-100vh) rotateX(-15deg);
    opacity: 0;
  }
  60% {
    transform: translateY(20px) rotateX(5deg);
    opacity: 1;
  }
  80% {
    transform: translateY(-10px) rotateX(-2deg);
  }
  100% {
    transform: translateY(0) rotateX(0deg);
    opacity: 1;
  }
}

/* 순차 떨어짐 효과 (stagger) */
.drop-animation {
  animation: boxDrop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  transform-origin: center bottom;
}

.drop-animation:nth-child(1) { animation-delay: 0ms; }
.drop-animation:nth-child(2) { animation-delay: 100ms; }
.drop-animation:nth-child(3) { animation-delay: 200ms; }
.drop-animation:nth-child(4) { animation-delay: 300ms; }
.drop-animation:nth-child(5) { animation-delay: 400ms; }
```

#### 1.2 먼지 일렁이는 효과 (Particle Dust)

```css
/* 먼지 입자 애니메이션 */
@keyframes dustParticle {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 0;
  }
  20% {
    opacity: 0.6;
  }
  100% {
    transform: translate(var(--dust-x), var(--dust-y)) scale(0);
    opacity: 0;
  }
}

.dust-particle {
  position: absolute;
  width: 4px;
  height: 4px;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.8), transparent);
  border-radius: 50%;
  pointer-events: none;
  animation: dustParticle 1.2s ease-out forwards;
}

/* 먼지 색상 변형 */
.dust-particle.cyan { background: radial-gradient(circle, rgba(14, 165, 233, 0.8), transparent); }
.dust-particle.purple { background: radial-gradient(circle, rgba(168, 85, 247, 0.8), transparent); }
.dust-particle.green { background: radial-gradient(circle, rgba(16, 185, 129, 0.8), transparent); }
```

#### 1.3 React 컴포넌트 구현

```tsx
// frontend-prediction/src/components/effects/DustEffect.tsx

import { useEffect, useRef } from 'react';

interface DustEffectProps {
  trigger: boolean;
  position: { x: number; y: number };
  color?: 'cyan' | 'purple' | 'green';
}

export function DustEffect({ trigger, position, color = 'cyan' }: DustEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trigger || !containerRef.current) return;

    // 먼지 입자 생성 (20-30개)
    const particleCount = Math.floor(Math.random() * 10) + 20;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = `dust-particle ${color}`;

      // 랜덤 방향으로 퍼짐
      const angle = (Math.PI * 2 * i) / particleCount;
      const distance = 30 + Math.random() * 50; // 30-80px
      const dustX = Math.cos(angle) * distance;
      const dustY = Math.sin(angle) * distance;

      particle.style.cssText = `
        left: ${position.x}px;
        top: ${position.y}px;
        --dust-x: ${dustX}px;
        --dust-y: ${dustY}px;
        animation-delay: ${i * 20}ms;
      `;

      containerRef.current.appendChild(particle);

      // 애니메이션 종료 후 제거
      setTimeout(() => particle.remove(), 1200 + i * 20);
    }
  }, [trigger, position, color]);

  return <div ref={containerRef} className="dust-effect-container" />;
}
```

#### 1.4 워크스페이스 통합

```tsx
// frontend-prediction/src/components/workspaces/WorkspaceContainer.tsx

import { useState, useRef } from 'react';
import { DustEffect } from '@components/effects/DustEffect';

interface WorkspaceContainerProps {
  children: React.ReactNode;
  isActive: boolean;
}

export function WorkspaceContainer({ children, isActive }: WorkspaceContainerProps) {
  const [dustTrigger, setDustTrigger] = useState(false);
  const [dustPosition, setDustPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && containerRef.current) {
      // 컨테이너 하단 중앙에서 먼지 생성
      const rect = containerRef.current.getBoundingClientRect();
      setDustPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom - 20,
      });
      setDustTrigger(true);

      // 리셋
      const timer = setTimeout(() => setDustTrigger(false), 100);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  return (
    <>
      <div
        ref={containerRef}
        className={isActive ? 'drop-animation' : ''}
      >
        {children}
      </div>

      <DustEffect
        trigger={dustTrigger}
        position={dustPosition}
        color="cyan"
      />
    </>
  );
}
```

---

## 🗂️ 레이아웃 구조 (PRD 기준)

### 라우팅 생성 워크스페이스 (좌 20% | 중앙 60% | 우 20%)

```
┌───────────────────────────────────────────────────────────────────┐
│                        Header (로고, 검색, 사용자)                  │
├──────────┬──────────────────────────────────────────┬──────────────┤
│ 좌측 20% │           중앙 60%                       │   우측 20%   │
│          │                                          │              │
│ ┌──────┐ │ ┌──────────────────────────────────────┐ │ ┌──────────┐│
│ │품목명│ │ │ [품목1] [품목2] [품목3] ... (탭)      │ │ │후보 공정││
│ │입력란│ │ ├──────────────────────────────────────┤ │ │블럭 리스트││
│ │      │ │ │ ┌──────────┐                        │ │ │          ││
│ │여러줄│ │ │ │1. CNC 선반│ ← 드래그 가능           │ │ │ ┌──────┐ ││
│ │입력  │ │ │ ├──────────┤                        │ │ │ │CNC   │ ││
│ │      │ │ │ │2. MCT    │                        │ │ │ │선반  │ ││
│ │스크롤│ │ │ ├──────────┤                        │ │ │ └──────┘ ││
│ │      │ │ │ │3. 표면처리│ ← 드래그 가능           │ │ │          ││
│ └──────┘ │ │ ├──────────┤                        │ │ │ ┌──────┐ ││
│          │ │ │4. 검사    │                        │ │ │ │MCT   │ ││
│ ┌──────┐ │ │ └──────────┘                        │ │ │ └──────┘ ││
│ │행렬   │ │ │                                     │ │ │  ↓ 드래그││
│ │구조   │ │ │ 타임라인 시각화 (가로 블럭)           │ │ │          ││
│ │      │ │ │ [시작]──[CNC]──[MCT]──[표면]──[검사] │ │ │ SAVE     ││
│ │컬럼명 │ │ │                                     │ │ │ INTERFACE││
│ │↓     │ │ │ 가로/세로 스크롤                     │ │ └──────────┘│
│ │값    │ │ └──────────────────────────────────────┘ │              │
│ └──────┘ │                                          │              │
└──────────┴──────────────────────────────────────────┴──────────────┘
```

### 주요 기능

#### 좌측 영역 (20%)

**상단 - 품목명 입력란**:
- 여러 줄 입력 가능
- 세로 스크롤바
- Enter로 품목 추가

**하단 - 행렬 구조**:
- Access DB 컬럼명 표시
- 검색한 품목의 값 표시
- 예: `MATERIAL: STS`, `OUT_DIAMETER: 100`

#### 중앙 영역 (60%)

**상단 - 품목 탭**:
- 여러 품목 입력 시 탭으로 전환
- 선택된 탭은 짙은색 (neon-cyan)
- 탭 클릭 시 해당 품목 데이터 표시

**메인 - 드래그앤드롭 타임라인**:
- 추천된 라우팅을 세로로 배치
- 각 공정은 가로 블럭 형태
- 상하 드래그로 순서 변경
- 중간 삽입 가능 (drop zone 표시)

**시각화**:
- Workflow 스타일 가로 블럭
- 화살표로 연결
- 각 블럭에 공정명, 예상 시간 표시

#### 우측 영역 (20%)

**상단 80% - 후보 공정 블럭 리스트**:
- 추가 가능한 공정 목록
- 각 블럭을 드래그하여 중앙 타임라인에 삽입
- 검색/필터 기능

**하단 20% - 액션 버튼**:
- **SAVE**: Local / Clipboard 선택
  - CSV, ACCESS, XML, Excel, JSON 지원
- **INTERFACE**: ERP 연동 (옵션 ON 시 활성화)

---

## 🎯 드래그앤드롭 상세 설계

### 1. React DnD 구현

```tsx
// frontend-prediction/src/components/routing/TimelineDragDrop.tsx

import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ProcessBlock {
  id: string;
  name: string;
  duration: number;
  sequence: number;
}

function SortableProcessBlock({ process }: { process: ProcessBlock }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: process.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="process-block hover-lift neon-cyan-hover"
    >
      <div className="process-sequence">{process.sequence}</div>
      <div className="process-name">{process.name}</div>
      <div className="process-duration">{process.duration}분</div>
    </div>
  );
}

export function TimelineDragDrop({ processes, onReorder }: TimelineDragDropProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = processes.findIndex(p => p.id === active.id);
      const newIndex = processes.findIndex(p => p.id === over.id);
      onReorder(arrayMove(processes, oldIndex, newIndex));
    }

    setActiveId(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={processes.map(p => p.id)} strategy={verticalListSortingStrategy}>
        <div className="timeline-container">
          {processes.map((process) => (
            <SortableProcessBlock key={process.id} process={process} />
          ))}
        </div>
      </SortableContext>

      {/* 드래그 중인 블럭 오버레이 */}
      <DragOverlay>
        {activeId ? (
          <div className="process-block dragging-overlay">
            {processes.find(p => p.id === activeId)?.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

### 2. 후보 공정에서 타임라인으로 드래그

```tsx
// frontend-prediction/src/components/routing/CandidateToTimeline.tsx

import { useDraggable, useDroppable } from '@dnd-kit/core';

// 드래그 가능한 후보 공정
function DraggableCandidateBlock({ candidate }: { candidate: ProcessCandidate }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `candidate-${candidate.id}`,
    data: { type: 'candidate', ...candidate },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="candidate-block hover-lift cursor-grab active:cursor-grabbing"
    >
      <div className="candidate-icon">🔧</div>
      <div className="candidate-name">{candidate.name}</div>
    </div>
  );
}

// 드롭 가능한 타임라인 영역
function DroppableTimelineSlot({ index, onDrop }: DroppableTimelineSlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `timeline-slot-${index}`,
    data: { index },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'timeline-drop-zone',
        isOver && 'drop-zone-active neon-cyan-glow'
      )}
    >
      {isOver && <div className="drop-indicator">여기에 놓기</div>}
    </div>
  );
}
```

### 3. Drop Zone 시각화

```css
/* 드롭 존 애니메이션 */
.timeline-drop-zone {
  height: 60px;
  margin: 8px 0;
  border: 2px dashed transparent;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.timeline-drop-zone.drop-zone-active {
  border-color: var(--primary);
  background: var(--accent-soft);
  animation: pulseGlow 1s ease-in-out infinite;
}

@keyframes pulseGlow {
  0%, 100% {
    box-shadow: 0 0 10px rgba(14, 165, 233, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(14, 165, 233, 0.6);
  }
}

.drop-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: var(--font-size-sm);
  color: var(--primary);
  font-weight: 600;
}
```

---

## 📊 전체 메뉴 구조 (모든 기능 유지)

```typescript
const FULL_NAVIGATION_ITEMS = [
  {
    id: "workspace",
    label: "라우팅 워크스페이스",
    description: "품목 검색 · 라우팅 생성 · 드래그앤드롭 타임라인",
    icon: <Workflow size={18} />,
  },
  {
    id: "algorithm",
    label: "알고리즘 블루프린트",  // 🎨 ReactFlow 유지
    description: "ML 파이프라인 · 노드 기반 편집 · SAVE 즉시 반영",
    icon: <Layers size={18} />,
  },
  {
    id: "routing-matrix",
    label: "라우팅 조합 관리",  // ✅ 유지!
    description: "라우팅 세트 · Variant 조합 편집",
    icon: <Table size={18} />,
  },
  {
    id: "process-groups",
    label: "공정 그룹 관리",  // ✅ 유지!
    description: "대체 경로 컬럼 · 후공정 고정값 구성",
    icon: <Layers size={18} />,
  },
  {
    id: "data-output",
    label: "데이터 출력 설정",  // ✅ 유지!
    description: "컬럼 매핑 매트릭스 · 미리보기 · 프로필 저장",
    icon: <FileOutput size={18} />,
  },
  {
    id: "feature-weights",
    label: "Feature 가중치",  // ✅ PRD 명시
    description: "피처별 가중치 조정 · 프로파일 관리",
    icon: <Sliders size={18} />,
  },
  {
    id: "metrics",
    label: "예측 메트릭",  // ✅ PRD 명시
    description: "정확도 · 신뢰도 · 성능 지표",
    icon: <BarChart size={18} />,
  },
  {
    id: "visualization",
    label: "시각화",  // ✅ PRD 명시
    description: "TensorBoard · Neo4j 그래프",
    icon: <Eye size={18} />,
  },
];
```

---

## 🎬 애니메이션 타임라인

### 페이지 전환 시 (예: 워크스페이스 → 알고리즘)

```
0ms:    이전 페이지 페이드 아웃 시작
200ms:  이전 페이지 완전히 사라짐
300ms:  새 페이지 첫 번째 카드 떨어지기 시작 (boxDrop)
        ↓ 먼지 효과 트리거
400ms:  두 번째 카드 떨어지기 시작
500ms:  세 번째 카드 떨어지기 시작
...
1100ms: 모든 카드 착지 완료
1200ms: 먼지 효과 종료
1300ms: 사용자 인터랙션 가능
```

### 드래그앤드롭 시

```
드래그 시작:
  - 원본 블럭 opacity 0.5
  - 커서 변경 (grabbing)
  - DragOverlay 표시

드래그 중:
  - 드롭 존 하이라이트 (pulseGlow)
  - 주변 블럭 자동 간격 조정

드롭 시:
  - 블럭 위치 애니메이션 (transform 0.3s)
  - 먼지 효과 발생 (착지 지점)
  - 새 순서 번호 업데이트
```

---

## 🔧 구현 우선순위

### Phase 1: 베이브 애니메이션 (1주)
- [ ] `boxDrop` keyframes 구현
- [ ] `DustEffect` 컴포넌트 개발
- [ ] `WorkspaceContainer` 통합
- [ ] 모든 워크스페이스에 적용
- [ ] 성능 최적화 (requestAnimationFrame)

### Phase 2: 라우팅 워크스페이스 레이아웃 (1주)
- [ ] 좌 20% | 중앙 60% | 우 20% 그리드
- [ ] 품목명 입력란 (여러 줄)
- [ ] 행렬 구조 (Access DB 컬럼)
- [ ] 품목 탭 전환
- [ ] 타임라인 가로 블럭 시각화

### Phase 3: 드래그앤드롭 (1주)
- [ ] @dnd-kit/core 설치
- [ ] SortableContext 타임라인
- [ ] Draggable 후보 공정
- [ ] Droppable 슬롯
- [ ] 드롭 존 시각화
- [ ] 순서 변경 로직

### Phase 4: SAVE/INTERFACE 기능 (1주)
- [ ] SAVE 버튼 드롭다운 (Local/Clipboard)
- [ ] 다중 포맷 export (CSV, ACCESS, XML, Excel, JSON)
- [ ] INTERFACE 버튼 (ERP 연동 스텁)
- [ ] 저장 확인 모달

### Phase 5: 모든 메뉴 유지 (1주)
- [ ] 라우팅 조합 관리 (기존 유지)
- [ ] 공정 그룹 관리 (기존 유지)
- [ ] 데이터 출력 설정 (기존 유지)
- [ ] Feature 가중치 (탭으로 분리)
- [ ] 예측 메트릭 (탭으로 분리)
- [ ] 시각화 (TensorBoard 링크)

---

## ✅ 체크리스트

### 디자인
- [x] PRD 요구사항 분석 완료
- [ ] main/4.jpg 디자인 참조
- [ ] 베이브 애니메이션 프로토타입
- [ ] 먼지 효과 시뮬레이션
- [ ] 드래그앤드롭 UX 검증

### 개발
- [ ] animations.css 파일 생성
- [ ] DustEffect 컴포넌트
- [ ] WorkspaceContainer 래퍼
- [ ] TimelineDragDrop 컴포넌트
- [ ] CandidateToTimeline 통합

### 테스트
- [ ] 애니메이션 60fps 유지
- [ ] 드래그 모든 브라우저 동작
- [ ] 먼지 효과 메모리 누수 없음
- [ ] 모바일 터치 지원

---

**작성자**: ML Team + UX Team
**최종 업데이트**: 2025-10-06
**버전**: 3.0.0 (Full Feature + Babe Animation)
**참조**: PRD.md, main/4.jpg
