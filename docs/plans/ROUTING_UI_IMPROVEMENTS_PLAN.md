# 라우팅 UI 개선 계획서

**작성일**: 2025-10-13 17:00 KST
**요청자**: syyun
**작업자**: Claude Code

---

## 📋 요구사항 분석

### 1. 가로 스크롤 제거 (하드코딩 width 제거)
**문제**:
- 라우팅 생성 메뉴의 하부 캔버스에 가로 스크롤이 적용되어 있음
- width가 하드코딩되어 있어 반응형 레이아웃이 작동하지 않음

**목표**:
- 하드코딩된 width 값 제거
- 부모 컨테이너 크기에 맞춰 자동 조절

**영향받는 파일**:
- `frontend-prediction/src/index.css` (`.timeline-flow` 등)
- `frontend-prediction/src/components/routing/RoutingCanvas.tsx`
- 기타 하드코딩된 width가 있는 컴포넌트

---

### 2. 노드-바 시각화 동기화 + 드래그앤드롭
**문제**:
- "공정 추가" 버튼으로 캔버스에 노드 추가 가능
- 노드 추가 시 바(bar) 형태의 시각화에 동기화되지 않음
- 바 시각화에서 드래그앤드롭으로 공정 추가 불가능

**목표**:
1. 캔버스 노드 추가 → 바 시각화 자동 추가
2. 바 시각화에서 드래그앤드롭으로 공정 추가 가능

**구현 방안**:
- 공통 상태 관리 (Zustand store 또는 React Context)
- 양방향 동기화 로직
- 드래그앤드롭 핸들러 구현

**영향받는 파일**:
- `frontend-prediction/src/components/routing/RoutingCanvas.tsx` (캔버스)
- `frontend-prediction/src/components/routing/RoutingExplanationPanel.tsx` 또는 유사 바 컴포넌트
- `frontend-prediction/src/store/` (상태 관리)

---

### 3. MSSQL 연결 설정 확인 및 수정
**문제**:
- 라우팅 생성과 기준정보 관리 탭에 MSSQL 데이터가 연결되지 않음
- View/Table 연결 설정 위치 불명확

**목표**:
1. 현재 MSSQL 연결 설정 파악
2. 연결이 안 되는 원인 진단
3. 설정 UI 추가 (없으면)
4. 연결 테스트 기능 구현

**확인 사항**:
- `backend/database.py` - MSSQL 연결 설정
- `backend/api/config.py` - 환경 변수 설정
- `.env` 파일 - 데이터베이스 연결 문자열
- 프론트엔드 API 호출 경로

---

## 🔍 현재 상태 분석

### MSSQL 연결 구조

**백엔드**:
- `/api/master-data/tree` - 품목 트리 조회
- `/api/master-data/items/{itemCode}` - 품목 상세 정보
- `/api/mssql/metadata` - 데이터베이스 메타데이터
- `/api/mssql/tables` - 테이블 목록

**프론트엔드**:
- `MasterDataSimpleWorkspace.tsx` - 기준정보 관리 탭
- `fetchMasterDataTree()` - API 호출
- `fetchMasterDataItem()` - API 호출

**연결 설정**:
```python
# backend/database.py 에서 확인 필요
MSSQL_SERVER = os.getenv("MSSQL_SERVER")
MSSQL_DATABASE = os.getenv("MSSQL_DATABASE")
MSSQL_USER = os.getenv("MSSQL_USER")
MSSQL_PASSWORD = os.getenv("MSSQL_PASSWORD")
```

---

## 📝 작업 계획

### Phase 1: 분석 및 문서화 (30분)
1. ✅ 현재 코드 구조 파악
2. ⏳ 가로 스크롤 원인 파악
3. ⏳ 노드-바 동기화 구조 파악
4. ⏳ MSSQL 연결 설정 파악

### Phase 2: 가로 스크롤 제거 (30분)
1. `index.css`에서 하드코딩된 width 찾기
2. Flexbox/Grid로 변경
3. 반응형 레이아웃 적용
4. 테스트 및 검증

### Phase 3: 노드-바 동기화 (1시간)
1. 공통 상태 저장소 설계
2. 캔버스 노드 추가 → 바 업데이트 로직
3. 바에서 드래그앤드롭 구현
4. 양방향 동기화 테스트

### Phase 4: MSSQL 연결 설정 (45분)
1. 현재 연결 상태 확인
2. 연결 실패 원인 진단
3. 설정 UI 추가 (필요시)
4. 연결 테스트 및 검증

### Phase 5: 문서화 및 보고 (15분)
1. 실행 결과 문서 작성
2. 변경 사항 요약
3. 테스트 결과 정리
4. 커밋 및 푸시

---

## 🎯 예상 결과

### 1. 가로 스크롤 제거
```css
/* Before */
.timeline-flow {
  width: 1200px; /* 하드코딩 */
  overflow-x: hidden;
}

/* After */
.timeline-flow {
  width: 100%; /* 부모 크기에 맞춤 */
  overflow-x: hidden;
}
```

### 2. 노드-바 동기화
```typescript
// Store에 공정 목록 관리
interface RoutingStore {
  processes: Process[];
  addProcess: (process: Process) => void;
  removeProcess: (id: string) => void;
}

// 캔버스에서 추가
const handleAddNode = () => {
  const newProcess = { id: generateId(), name: "공정", ... };
  addProcess(newProcess); // 자동으로 바에도 반영
};

// 바에서 드래그앤드롭
const handleDrop = (e: DragEvent) => {
  const processData = e.dataTransfer.getData("process");
  addProcess(JSON.parse(processData));
};
```

### 3. MSSQL 설정 UI
```tsx
<DatabaseSettingsPanel>
  <Input label="Server" value={server} onChange={setServer} />
  <Input label="Database" value={database} onChange={setDatabase} />
  <Input label="User" value={user} onChange={setUser} />
  <Input label="Password" type="password" value={password} onChange={setPassword} />
  <Button onClick={testConnection}>연결 테스트</Button>
  <Button onClick={saveSettings}>저장</Button>
</DatabaseSettingsPanel>
```

---

## ⚠️ 주의사항

1. **가로 스크롤**: 기존 레이아웃이 깨지지 않도록 점진적으로 수정
2. **노드 동기화**: 성능 이슈 방지 (debounce, throttle 사용)
3. **MSSQL 연결**: 보안 - 비밀번호 암호화, HTTPS 사용
4. **테스트**: 각 단계마다 철저한 테스트 필요

---

## 📦 변경 예상 파일

### 프론트엔드
- `frontend-prediction/src/index.css`
- `frontend-prediction/src/components/routing/RoutingCanvas.tsx`
- `frontend-prediction/src/components/routing/RoutingExplanationPanel.tsx`
- `frontend-prediction/src/store/routingStore.ts` (신규)
- `frontend-prediction/src/components/settings/DatabaseSettingsPanel.tsx` (신규)

### 백엔드
- `backend/api/routes/database_config.py` (신규 또는 수정)
- `backend/database.py` (연결 로직 확인)
- `backend/api/config.py` (설정 값 추가)

### 문서
- `docs/plans/ROUTING_UI_IMPROVEMENTS_PLAN.md` (본 문서)
- `docs/implementation/ROUTING_UI_IMPROVEMENTS_EXECUTION.md` (실행 기록)
- `docs/results/ROUTING_UI_IMPROVEMENTS_RESULTS.md` (결과 보고)

---

**다음 단계**: Phase 1 분석 완료 후 실행 문서 작성
