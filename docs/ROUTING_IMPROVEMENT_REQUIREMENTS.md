# 라우팅 생성 메뉴 기능 개선 요구서

**문서 ID**: RIR-2025-10-05
**작성일시**: 2025-10-05 04:45 UTC
**작성자**: Claude Code Agent
**관련 문서**: QA_ROUTING_GENERATION_REPORT.md, PRD.md (v2025-09-28.1)
**승인자**: (대기중)

---

## 목차
1. [개요](#1-개요)
2. [현황 분석](#2-현황-분석)
3. [개선 요구사항](#3-개선-요구사항)
4. [우선순위 로드맵](#4-우선순위-로드맵)
5. [기술 사양](#5-기술-사양)
6. [검증 계획](#6-검증-계획)
7. [리스크 평가](#7-리스크-평가)

---

## 1. 개요

### 1.1 배경

**라우팅 생성 메뉴**는 Routing ML 시스템의 핵심 UI로, 사용자가 품목 코드를 입력하여 ML 기반 라우팅 추천을 받고, 이를 드래그앤드롭으로 편집하여 저장하는 기능을 제공합니다.

2025-10-05 QA 점검 결과, 다음과 같은 문제가 확인되었습니다:

- ✅ **해결됨**: 서버 에러 (백엔드 API 시작 완료)
- ❌ **미해결**: 센터 영역 시각화 부족 ("workflow 시각화 처럼 가로 블럭" 기획과 불일치)
- ❌ **미해결**: 드롭 UX 피드백 부족 (삽입 위치 미리보기 없음)
- ⚠️ **부분 구현**: 저장 옵션 선택 UI 불명확
- ⚠️ **부분 구현**: 칸 크기 일관성 문제
- ⚠️ **부분 구현**: 색감 조정 필요

### 1.2 목표

본 요구서는 다음을 달성하기 위해 작성되었습니다:

1. **PRD 준수**: 초기 기획 요구사항을 100% 구현
2. **UX 개선**: 드래그앤드롭 인터랙션을 직관적으로 개선
3. **시각화 강화**: 워크플로우 블록 스타일 구현
4. **일관성 확보**: UI 칸 크기, 색감 표준화
5. **기능 완성**: ACCESS 저장, XML 포맷 등 누락 기능 추가

### 1.3 범위

**포함**:
- 라우팅 생성 메뉴 (`/routing`) 전체 개선
- 좌측(20%) / 센터(60%) / 우측(20%) 모든 영역
- 드래그앤드롭 UX 개선
- 저장 기능 확장

**제외**:
- 기준정보 확인 메뉴 (별도 개선 계획)
- 백엔드 API 로직 변경 (UI만 개선)
- 모바일 전용 최적화 (반응형은 포함)

---

## 2. 현황 분석

### 2.1 기획 요구사항 (PRD.md 및 사용자 제공)

```
라우팅 생성: 좌측 20%, 센터 60%, 우측 20% 구역 설정

- 좌측 상단: 품목명 입력란, 여러줄 입력 가능, 세로 스크롤바 적용
- 좌측 하단: 행렬 구조, Access DB 컬럼명에 대응하는 값들
- 센터:
  ✅ 추천된 라우팅 열을 드래그앤 드롭으로 상하를 바꿀수 있도록 구성
  ❌ workflow 시각화 처럼 가로 블럭을 생성
  ✅ 가로/세로 스크롤바 기능
  ✅ 여러 품목 입력시 상단 탭으로 품목 선택
  ✅ 선택된 탭은 짙은색으로 유지
- 우측 상단 80%:
  ✅ 라우팅 개별 요소 블럭 리스트
  ⚠️ 센터 라우팅 리스트의 중간에 드래그앤드롭으로 삽입 가능
- 우측 하단 20%:
  ✅ SAVE, INTERFACE 버튼
  ⚠️ SAVE는 LOCAL과 클립보드 저장 선택
  ⚠️ CSV나 ACCESS, XML등 여러 데이터 확장명 지원
  ✅ INTERFACE 버튼은 옵션에서 ERP INTERFACE 설정 ON시 활성화
```

**범례**:
- ✅ 구현 완료
- ⚠️ 부분 구현
- ❌ 미구현

### 2.2 현재 구현 상태 (총점 74/100)

| 영역 | 점수 | 주요 문제 |
|-----|-----|---------|
| 레이아웃 구조 | 95/100 | 20/60/20 정확 |
| 기능 구현 | 75/100 | 시각화 부족 |
| UI/UX | 60/100 | 드롭 피드백 없음 |
| 코드 품질 | 85/100 | 양호 |
| 테스트 커버리지 | 50/100 | 일부만 테스트 |
| **총점** | **74/100** | **양호** |

### 2.3 Gap 우선순위

| 우선순위 | Gap | 영향도 | 난이도 | 예상 공수 |
|---------|-----|-------|-------|---------|
| 🔴 P0 | 센터 워크플로우 블록 시각화 | 높음 | 중간 | 3일 |
| 🔴 P0 | 드롭 존 하이라이트 및 미리보기 | 높음 | 낮음 | 1일 |
| 🟡 P1 | SAVE 버튼 LOCAL/클립보드 선택 UI | 중간 | 낮음 | 0.5일 |
| 🟡 P1 | ACCESS 데이터베이스 저장 기능 | 중간 | 중간 | 2일 |
| 🟡 P1 | 칸 크기 일관성 CSS 표준화 | 중간 | 낮음 | 0.5일 |
| 🟡 P1 | 색감 조정 (파스텔 톤 최적화) | 중간 | 낮음 | 0.5일 |
| 🟢 P2 | XML 저장 포맷 추가 | 낮음 | 낮음 | 0.5일 |
| 🟢 P2 | 드래그 성능 최적화 (16ms 목표) | 낮음 | 높음 | 2일 |
| 🟢 P2 | Screen reader 접근성 | 낮음 | 중간 | 1일 |

---

## 3. 개선 요구사항

### REQ-01: 센터 영역 워크플로우 블록 시각화 🔴 P0

**ID**: RIR-01
**우선순위**: P0 (긴급)
**담당**: Frontend 팀
**예상 공수**: 3일

#### 현재 상태
- 센터 영역이 단순 리스트 형태로 표시됨
- `TimelinePanel.tsx`, `RecommendationsTab.tsx`에서 텍스트 목록만 렌더링

#### 기획 요구사항
> "workflow 시각화 처럼 **가로 블럭을 생성**, 상하 순서로 라우팅 시간 순서를 보여 주도록 구성"

#### 개선 요구
1. **ReactFlow 통합**:
   - `@xyflow/react` 라이브러리 활용 (이미 `package.json`에 포함됨)
   - 각 라우팅 단계를 **가로 블록 노드**로 표시
   - 상하 순서를 **세로 연결선(Edge)**로 표시

2. **블록 디자인**:
   ```
   ┌────────────────────────────────────┐
   │  CNC 선반 1차                      │
   │  Setup: 15분 | Run: 30분           │
   │  유사도: 92%                        │
   └────────────────────────────────────┘
              ↓ (연결선)
   ┌────────────────────────────────────┐
   │  MCT 2차                           │
   │  Setup: 20분 | Run: 45분           │
   │  유사도: 89%                        │
   └────────────────────────────────────┘
   ```

3. **인터랙션**:
   - 블록을 드래그하여 순서 변경
   - 블록 클릭 시 상세 정보 표시 (우측 Drawer)
   - 블록 간 연결선은 자동 재계산

4. **레이아웃**:
   - 가로 스크롤: 블록이 많을 경우 가로로 확장
   - 세로 스크롤: 품목이 많을 경우 세로로 확장
   - Minimap 제공 (우하단 소형 전체 뷰)

#### 기술 스택
- **라이브러리**: `@xyflow/react` (v12.8.6)
- **스타일**: Tailwind CSS + Custom CSS
- **상태**: Zustand (`routingStore.ts`)

#### Acceptance Criteria
- [ ] 각 라우팅 단계가 가로 블록으로 표시됨
- [ ] 블록을 드래그하여 순서 변경 가능
- [ ] 블록 간 연결선이 자동으로 그려짐
- [ ] 가로/세로 스크롤 정상 작동
- [ ] Minimap 제공
- [ ] 다크모드 테마 적용 (사이버펑크)

#### 구현 참조
- **기존 파일**: `frontend-training/src/components/blueprint/BlueprintGraphPanel.tsx` (ReactFlow 사용 예시)
- **목표 파일**: `frontend-prediction/src/components/TimelinePanel.tsx` 개선

---

### REQ-02: 드롭 존 하이라이트 및 삽입 위치 미리보기 🔴 P0

**ID**: RIR-02
**우선순위**: P0 (긴급)
**담당**: Frontend 팀
**예상 공수**: 1일

#### 현재 상태
- `CandidatePanel.tsx`에서 드래그 시작 이벤트만 구현됨
- 센터 영역에 드롭할 때 시각적 피드백 없음

#### 기획 요구사항
> "센터 라우팅 리스트의 중간에 드래그앤드롭으로 유저가 원하는 위치에 삽입 가능"

#### 개선 요구
1. **드롭 존 하이라이트**:
   - 우측에서 블록을 드래그 시작하면 센터 영역 전체에 **파란색 테두리 애니메이션**
   - 예시:
     ```css
     .drop-zone-active {
       border: 2px dashed rgba(14, 165, 233, 0.8);
       background: rgba(14, 165, 233, 0.1);
       box-shadow: inset 0 0 30px rgba(14, 165, 233, 0.2);
       animation: pulse 1s infinite;
     }
     ```

2. **삽입 위치 미리보기**:
   - 마우스를 블록 위/아래로 가져가면 **삽입 선** 표시
   - 예시:
     ```
     ┌─────────────────┐
     │  CNC 선반 1차   │
     └─────────────────┘
     ═════════════════════ ← 삽입 선 (파란색, 2px)
     ┌─────────────────┐
     │  MCT 2차        │
     └─────────────────┘
     ```

3. **드롭 핸들러**:
   - `onDrop` 이벤트에서 삽입 인덱스 계산
   - `routingStore.insertOperation(operation, index)` 호출

4. **피드백 애니메이션**:
   - 드롭 성공 시 **초록색 체크 아이콘** 1초간 표시
   - 드롭 실패 시 **빨간색 X 아이콘** 1초간 표시

#### Acceptance Criteria
- [ ] 드래그 시작하면 센터 영역에 파란색 테두리
- [ ] 마우스 위치에 따라 삽입 선 표시
- [ ] 드롭하면 정확한 위치에 블록 삽입
- [ ] 성공/실패 피드백 애니메이션

#### 구현 참조
- **CSS**: `frontend-prediction/src/index.css` L4489-4499 (기존 `.drop-zone` 스타일)
- **목표 파일**: `frontend-prediction/src/components/routing/RoutingCanvas.tsx` 개선

---

### REQ-03: SAVE 버튼 LOCAL/클립보드 선택 UI 🟡 P1

**ID**: RIR-03
**우선순위**: P1 (중요)
**담당**: Frontend 팀
**예상 공수**: 0.5일

#### 현재 상태
- SAVE 버튼 존재하나 LOCAL/클립보드 선택 UI 불명확

#### 기획 요구사항
> "SAVE는 LOCAL과 클립보드 저장 선택되도록 구성"

#### 개선 요구
1. **드롭다운 메뉴**:
   ```
   ┌─────────────────┐
   │ SAVE ▼         │ ← 버튼 클릭 시 드롭다운
   └─────────────────┘
         ↓
   ┌──────────────────┐
   │ 💾 LOCAL 저장    │
   │ 📋 클립보드 복사 │
   └──────────────────┘
   ```

2. **LOCAL 저장**:
   - 파일 형식 선택: CSV, Excel, JSON, Parquet, XML, ACCESS
   - 브라우저 다운로드 API 사용

3. **클립보드 복사**:
   - `navigator.clipboard.writeText(csvData)`
   - 복사 성공 시 토스트 알림: "클립보드에 복사되었습니다"

4. **기본 동작**:
   - 버튼 단독 클릭 (드롭다운 없이): LOCAL 저장
   - 화살표 클릭: 드롭다운 열기

#### Acceptance Criteria
- [ ] SAVE 버튼 클릭 시 드롭다운 표시
- [ ] LOCAL 저장 선택 시 파일 다운로드
- [ ] 클립보드 복사 선택 시 CSV 데이터 복사
- [ ] 복사 성공 시 토스트 알림

#### 구현 참조
- **목표 파일**: `frontend-prediction/src/components/SaveInterfacePanel.tsx` 개선

---

### REQ-04: ACCESS 데이터베이스 저장 기능 🟡 P1

**ID**: RIR-04
**우선순위**: P1 (중요)
**담당**: Backend 팀
**예상 공수**: 2일

#### 현재 상태
- ACCESS 데이터베이스 **읽기**만 지원 (`dbo_BI_ROUTING_VIEW` 등)
- **쓰기** 기능 미구현

#### 기획 요구사항
> "저장되는 파일은 CSV나 ACCESS, XML등 여러 데이터 확장명을 지원해야함"

#### 개선 요구
1. **Backend API 추가**:
   - `POST /api/candidates/save/access`
   - Request Body:
     ```json
     {
       "item_code": "ITEM-001",
       "candidate_id": "c1",
       "operations": [
         {
           "PROC_SEQ": 10,
           "PROC_CD": "CNC01",
           ...
         }
       ],
       "access_db_path": "C:/data/routing.accdb",
       "table_name": "dbo_BI_ROUTING_VIEW"
     }
     ```

2. **ODBC INSERT**:
   - Python `pyodbc` 사용
   - 트랜잭션 관리 (COMMIT/ROLLBACK)
   - 중복 체크: `ITEM_CD` + `PROC_SEQ` 기준

3. **에러 처리**:
   - 연결 실패: "ACCESS 데이터베이스에 연결할 수 없습니다"
   - 권한 없음: "쓰기 권한이 없습니다"
   - 중복 키: "이미 존재하는 라우팅입니다"

4. **Frontend 연동**:
   - SAVE 드롭다운에 "ACCESS 저장" 추가
   - 파일 경로 입력 모달 표시
   - 저장 성공 시 토스트 알림

#### Acceptance Criteria
- [ ] POST /api/candidates/save/access 구현
- [ ] ACCESS DB에 INSERT 성공
- [ ] 중복 키 체크 및 에러 처리
- [ ] Frontend에서 ACCESS 저장 선택 가능

#### 구현 참조
- **Backend**: `backend/database.py` (기존 ACCESS 읽기 코드)
- **Frontend**: `frontend-prediction/src/components/SaveInterfacePanel.tsx`

---

### REQ-05: 칸 크기 일관성 CSS 표준화 🟡 P1

**ID**: RIR-05
**우선순위**: P1 (중요)
**담당**: Frontend 팀
**예상 공수**: 0.5일

#### 현재 상태
- 사용자 피드백: "전체적은 ui는 칸 크기가 뒤죽 박죽이고"
- 카드 컴포넌트 크기가 일관성 없음

#### 개선 요구
1. **CSS 변수 표준화**:
   ```css
   :root {
     /* 카드 크기 */
     --card-min-height: 120px;
     --card-max-width: 100%;
     --card-padding: 1.5rem; /* 24px */
     --card-margin-bottom: 1.5rem;

     /* 패널 크기 */
     --panel-min-height: 200px;
     --panel-max-height: 600px;
   }
   ```

2. **클래스 표준화**:
   ```css
   .panel-card {
     min-height: var(--card-min-height);
     max-width: var(--card-max-width);
     padding: var(--card-padding);
     margin-bottom: var(--card-margin-bottom);
   }

   .panel-card--large {
     min-height: 300px;
   }

   .panel-card--small {
     min-height: 80px;
   }
   ```

3. **Grid 간격 통일**:
   ```css
   .routing-workspace__grid {
     gap: 1.5rem; /* 24px */
   }
   ```

4. **반응형 조정**:
   ```css
   @media (max-width: 1024px) {
     :root {
       --card-padding: 1rem; /* 16px */
       --card-margin-bottom: 1rem;
     }
   }
   ```

#### Acceptance Criteria
- [ ] 모든 카드의 padding이 24px로 통일
- [ ] Grid gap이 24px로 통일
- [ ] min-height/max-height 일관성 확보
- [ ] 반응형 화면에서도 일관성 유지

#### 구현 참조
- **파일**: `frontend-prediction/src/index.css` L140-178 (기존 spacing 변수)

---

### REQ-06: 색감 조정 (파스텔 톤 최적화) 🟡 P1

**ID**: RIR-06
**우선순위**: P1 (중요)
**담당**: Frontend 팀
**예상 공수**: 0.5일

#### 현재 상태
- 사용자 피드백: "색감도 이상해"
- 사이버펑크 네온 테마가 과도하게 적용되었을 가능성

#### 개선 요구
1. **색상 팔레트 조정**:
   ```css
   :root {
     /* 현재: 너무 밝은 사이버펑크 네온 */
     --primary: #0ea5e9; /* cyan - 너무 밝음 */
     --secondary: #a855f7; /* purple - 너무 밝음 */

     /* 개선: 파스텔 톤 */
     --primary: #7dd3fc; /* sky-300 - 부드러운 하늘색 */
     --primary-dark: #0ea5e9; /* 강조용 */
     --secondary: #c4b5fd; /* violet-300 - 부드러운 보라 */
     --secondary-dark: #a855f7; /* 강조용 */

     /* 배경 밝기 증가 */
     --surface-base: #1e293b; /* slate-800 (현재 너무 어두움) */
     --surface-card: #334155; /* slate-700 */
   }
   ```

2. **텍스트 대비 향상**:
   ```css
   --text-primary: #f1f5f9; /* slate-100 (더 밝게) */
   --text-muted: #cbd5e1; /* slate-300 (더 밝게) */
   ```

3. **그림자 조정**:
   ```css
   /* 현재: 너무 강한 네온 그림자 */
   --shadow-glow: 0 0 40px rgba(14, 165, 233, 0.5);

   /* 개선: 부드러운 그림자 */
   --shadow-glow: 0 0 20px rgba(125, 211, 252, 0.3);
   ```

4. **호버 효과 조정**:
   ```css
   .panel-card:hover {
     /* 현재: 너무 밝은 네온 */
     box-shadow: 0 0 60px rgba(168, 85, 247, 0.3);

     /* 개선: 부드러운 글로우 */
     box-shadow: 0 0 30px rgba(196, 181, 253, 0.2);
   }
   ```

#### Acceptance Criteria
- [ ] Primary/Secondary 색상이 파스텔 톤으로 변경
- [ ] 배경과 텍스트 대비율 WCAG AA 준수 (4.5:1 이상)
- [ ] 네온 그림자가 부드러운 글로우로 변경
- [ ] 사용자가 "눈이 편하다"고 느낄 수 있는 색감

#### 구현 참조
- **파일**: `frontend-prediction/src/index.css` L46-106

---

### REQ-07: XML 저장 포맷 추가 🟢 P2

**ID**: RIR-07
**우선순위**: P2 (권장)
**담당**: Backend 팀
**예상 공수**: 0.5일

#### 개선 요구
1. **Backend API 수정**:
   - `POST /api/candidates/save`에 `export_formats: ["xml"]` 추가

2. **XML 변환**:
   ```python
   import xml.etree.ElementTree as ET

   def to_xml(routing_data):
       root = ET.Element("RoutingCandidates")
       for candidate in routing_data:
           item = ET.SubElement(root, "Candidate", item_cd=candidate['item_cd'])
           for operation in candidate['operations']:
               op = ET.SubElement(item, "Operation")
               ET.SubElement(op, "PROC_SEQ").text = str(operation['PROC_SEQ'])
               ET.SubElement(op, "PROC_CD").text = operation['PROC_CD']
               # ...
       return ET.tostring(root, encoding='utf-8')
   ```

3. **Frontend 드롭다운 추가**:
   - SAVE → 파일 형식 선택에 "XML (.xml)" 추가

#### Acceptance Criteria
- [ ] XML 저장 옵션 선택 가능
- [ ] XML 파일 다운로드 성공
- [ ] XML 스키마 유효성 확인

---

### REQ-08: 드래그 성능 최적화 (16ms 목표) 🟢 P2

**ID**: RIR-08
**우선순위**: P2 (권장)
**담당**: Frontend 팀
**예상 공수**: 2일

#### 현재 상태
- **성능 측정**: 572ms (16ms 목표 초과)
- **증거**: `deliverables/2025-09-29/routing_canvas_profile.json`

#### 개선 요구
1. **가상 스크롤** (React Window):
   ```tsx
   import { FixedSizeList } from 'react-window';

   <FixedSizeList
     height={600}
     itemCount={operations.length}
     itemSize={80}
   >
     {({ index, style }) => (
       <div style={style}>
         <OperationBlock operation={operations[index]} />
       </div>
     )}
   </FixedSizeList>
   ```

2. **메모이제이션 강화**:
   ```tsx
   const MemoizedOperationBlock = React.memo(OperationBlock);
   ```

3. **Throttle 드래그 이벤트**:
   ```tsx
   const throttledDrag = useCallback(
     throttle((e) => handleDrag(e), 16), // 60fps
     []
   );
   ```

4. **CSS `will-change`**:
   ```css
   .operation-block {
     will-change: transform;
   }
   ```

#### Acceptance Criteria
- [ ] 드래그 프레임 레이트 60fps (16ms) 달성
- [ ] 100개 블록에서도 성능 유지
- [ ] 메모리 누수 없음

---

### REQ-09: Screen Reader 접근성 🟢 P2

**ID**: RIR-09
**우선순위**: P2 (권장)
**담당**: Frontend 팀
**예상 공수**: 1일

#### 개선 요구
1. **ARIA 속성 강화**:
   ```tsx
   <div
     role="region"
     aria-label="라우팅 타임라인"
     aria-live="polite"
     aria-atomic="true"
   >
     {timeline.map((step, index) => (
       <div
         key={step.id}
         role="listitem"
         aria-label={`공정 ${index + 1}: ${step.PROC_CD}, Setup ${step.SETUP_TIME}분`}
       >
         ...
       </div>
     ))}
   </div>
   ```

2. **키보드 네비게이션**:
   - `Tab`: 다음 블록으로 이동
   - `Shift+Tab`: 이전 블록으로 이동
   - `Enter`: 블록 선택/편집
   - `Space`: 드래그 시작/종료

3. **Focus 스타일**:
   ```css
   .operation-block:focus-visible {
     outline: 2px solid var(--accent);
     outline-offset: 4px;
   }
   ```

#### Acceptance Criteria
- [ ] NVDA/VoiceOver에서 모든 요소 읽힘
- [ ] 키보드만으로 전체 기능 사용 가능
- [ ] Focus 스타일 명확히 표시

---

## 4. 우선순위 로드맵

### Phase 1: 긴급 (1주일) 🔴 P0

**목표**: 기획 요구사항 핵심 Gap 해소

| 주차 | 작업 | 담당 | 예상 공수 |
|-----|------|------|---------|
| Week 1 | REQ-01: 센터 워크플로우 블록 시각화 | Frontend | 3일 |
| Week 1 | REQ-02: 드롭 존 하이라이트 | Frontend | 1일 |

**산출물**:
- [ ] ReactFlow 기반 가로 블록 타임라인
- [ ] 드래그앤드롭 삽입 위치 미리보기

### Phase 2: 중요 (2주일) 🟡 P1

**목표**: 사용자 경험 개선 및 기능 완성

| 주차 | 작업 | 담당 | 예상 공수 |
|-----|------|------|---------|
| Week 2 | REQ-03: SAVE 버튼 UI 개선 | Frontend | 0.5일 |
| Week 2 | REQ-04: ACCESS 저장 기능 | Backend | 2일 |
| Week 2 | REQ-05: 칸 크기 일관성 | Frontend | 0.5일 |
| Week 2 | REQ-06: 색감 조정 | Frontend | 0.5일 |

**산출물**:
- [ ] SAVE 드롭다운 (LOCAL/클립보드)
- [ ] ACCESS DB 저장 기능
- [ ] 표준화된 CSS 변수
- [ ] 파스텔 톤 색상 팔레트

### Phase 3: 권장 (1개월) 🟢 P2

**목표**: 성능 및 접근성 향상

| 주차 | 작업 | 담당 | 예상 공수 |
|-----|------|------|---------|
| Week 3-4 | REQ-07: XML 포맷 추가 | Backend | 0.5일 |
| Week 3-4 | REQ-08: 드래그 성능 최적화 | Frontend | 2일 |
| Week 3-4 | REQ-09: Screen Reader 접근성 | Frontend | 1일 |

**산출물**:
- [ ] XML 저장 지원
- [ ] 60fps 드래그 성능
- [ ] WCAG AA 접근성 인증

---

## 5. 기술 사양

### 5.1 Frontend 기술 스택

| 기술 | 버전 | 용도 |
|-----|------|-----|
| React | 18.2.0 | UI 프레임워크 |
| TypeScript | 5.3.3 | 타입 안정성 |
| @xyflow/react | 12.8.6 | 워크플로우 시각화 |
| Zustand | 5.0.8 | 상태 관리 |
| Tailwind CSS | 3.4.1 | 스타일링 |
| Vite | 5.0.0 | 빌드 도구 |

### 5.2 Backend 기술 스택

| 기술 | 버전 | 용도 |
|-----|------|-----|
| Python | 3.12 | 언어 |
| FastAPI | 최신 | API 서버 |
| pyodbc | 최신 | ACCESS ODBC 연결 |
| uvicorn | 최신 | ASGI 서버 |

### 5.3 브라우저 호환성

| 브라우저 | 최소 버전 | 비고 |
|---------|----------|-----|
| Chrome | 90+ | ✅ 권장 |
| Firefox | 88+ | ✅ 지원 |
| Edge | 90+ | ✅ 지원 |
| Safari | 14+ | ⚠️ 제한적 (Clipboard API) |

---

## 6. 검증 계획

### 6.1 테스트 체크리스트

| 항목 | 테스트 유형 | 담당 | 증거 문서 |
|-----|-----------|------|---------|
| 워크플로우 블록 렌더링 | Unit | Frontend | Vitest |
| 드래그앤드롭 순서 변경 | E2E | QA | Playwright |
| 드롭 존 하이라이트 | E2E | QA | Playwright |
| SAVE 드롭다운 | Unit | Frontend | Vitest |
| ACCESS 저장 | Integration | Backend | pytest |
| 칸 크기 일관성 | Visual | QA | Percy |
| 색감 WCAG AA | Accessibility | QA | axe-core |
| XML 저장 | Unit | Backend | pytest |
| 드래그 성능 60fps | Performance | Frontend | Chrome DevTools |
| Screen Reader | Accessibility | QA | NVDA/VoiceOver |

### 6.2 UAT (User Acceptance Test)

**대상**: 실제 사용자 5명
**기간**: Phase 2 완료 후 1주일
**시나리오**:
1. 품목 코드 입력 및 추천 실행
2. 워크플로우 블록 드래그하여 순서 변경
3. 우측 후보 블록을 센터에 삽입
4. LOCAL 저장 (CSV, Excel) 테스트
5. 클립보드 복사 테스트
6. ACCESS 저장 테스트

**성공 기준**:
- 사용자 만족도 4.0/5.0 이상
- 주요 태스크 성공률 90% 이상

---

## 7. 리스크 평가

### 7.1 기술 리스크

| 리스크 | 확률 | 영향 | 완화 방안 |
|-------|-----|-----|---------|
| ReactFlow 성능 저하 | 중간 | 높음 | 가상 스크롤 적용, 최대 50개 블록 제한 |
| ACCESS ODBC 권한 문제 | 높음 | 중간 | 사용자 가이드 작성, 관리자 권한 필수 명시 |
| 브라우저 Clipboard API 호환 | 낮음 | 낮음 | Fallback to `document.execCommand('copy')` |
| 드래그 성능 16ms 미달성 | 중간 | 중간 | Throttle, 메모이제이션, will-change |

### 7.2 일정 리스크

| 리스크 | 확률 | 영향 | 완화 방안 |
|-------|-----|-----|---------|
| ReactFlow 학습 곡선 | 중간 | 높음 | 기존 `BlueprintGraphPanel.tsx` 참조 |
| ACCESS 저장 테스트 환경 | 높음 | 중간 | Docker에서 ACCESS ODBC 드라이버 설치 스크립트 |
| 디자이너 리소스 부족 | 낮음 | 낮음 | Tailwind 기본 컴포넌트 활용 |

### 7.3 사용자 리스크

| 리스크 | 확률 | 영향 | 완화 방안 |
|-------|-----|-----|---------|
| 새로운 UI에 적응 어려움 | 중간 | 중간 | 튜토리얼 모달, 툴팁 제공 |
| ACCESS 저장 실패 | 높음 | 높음 | 에러 메시지 명확화, FAQ 문서 |
| 색감 호불호 | 낮음 | 낮음 | 테마 선택 옵션 제공 (추후) |

---

## 8. 승인 및 이행

### 8.1 승인 체크리스트

- [ ] 제품 책임자 승인
- [ ] 기술 리드 승인
- [ ] QA 리드 승인
- [ ] 예산 승인 (없음 - 기존 인력)

### 8.2 이행 계획

| 단계 | 기간 | 담당 | 체크포인트 |
|-----|------|------|-----------|
| Phase 1 착수 | Week 1 | Frontend 팀 | Kick-off 미팅 |
| Phase 1 완료 | Week 1 종료 | Frontend 팀 | Demo 세션 |
| Phase 2 착수 | Week 2 | Frontend/Backend 팀 | 중간 리뷰 |
| Phase 2 완료 | Week 2 종료 | Frontend/Backend 팀 | UAT 시작 |
| Phase 3 착수 | Week 3 | Frontend/Backend 팀 | 성능 테스트 |
| Phase 3 완료 | Week 4 종료 | Frontend/Backend 팀 | 최종 릴리스 |

### 8.3 산출물

**문서**:
- [ ] QA 보고서 (완료) - `docs/QA_ROUTING_GENERATION_REPORT.md`
- [ ] 개선 요구서 (현재 문서)
- [ ] 구현 명세서 (Phase별)
- [ ] 사용자 가이드
- [ ] API 문서 (ACCESS 저장)

**코드**:
- [ ] `frontend-prediction/src/components/TimelinePanel.tsx` (ReactFlow 통합)
- [ ] `frontend-prediction/src/components/routing/RoutingCanvas.tsx` (드롭 존)
- [ ] `frontend-prediction/src/components/SaveInterfacePanel.tsx` (드롭다운)
- [ ] `backend/api/routes/candidates.py` (ACCESS 저장)
- [ ] `frontend-prediction/src/index.css` (CSS 표준화)

**테스트**:
- [ ] Vitest 테스트 케이스 (+20건)
- [ ] Playwright E2E 테스트 (+10건)
- [ ] pytest Backend 테스트 (+5건)

---

## 부록 A: 용어 정의

| 용어 | 정의 |
|-----|-----|
| **라우팅 생성** | 품목 코드를 입력하여 ML 기반 공정 순서를 추천받고 편집하는 기능 |
| **워크플로우 블록** | 공정 단계를 시각적 블록으로 표시한 UI 요소 |
| **드롭 존** | 드래그한 블록을 놓을 수 있는 영역 |
| **ReactFlow** | React 기반 노드 그래프 시각화 라이브러리 |
| **Zustand** | React 경량 상태 관리 라이브러리 |

---

## 부록 B: 참조 문서

1. [QA_ROUTING_GENERATION_REPORT.md](QA_ROUTING_GENERATION_REPORT.md)
2. [PRD.md](../PRD.md) (v2025-09-28.1)
3. [routing_ui_gap_analysis.md](Design/routing_ui_gap_analysis.md)
4. [frontend_layout_reactflow_checklist.md](Design/frontend_layout_reactflow_checklist.md)
5. [requirements_traceability_matrix.md](requirements_traceability_matrix.md)

---

**문서 종료**

승인일자: _________________
승인자 서명: _______________
