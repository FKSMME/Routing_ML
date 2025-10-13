# 라우팅 UI 개선 실행 기록

**작성일**: 2025-10-13 17:15 KST
**실행자**: Claude Code
**참조**: [계획서](../plans/ROUTING_UI_IMPROVEMENTS_PLAN.md)

---

## 📊 현재 상태 분석 완료

### 1. 가로 스크롤 문제

**원인 파악**:
- `frontend-prediction/src/index.css`의 `.timeline-flow` 클래스에 고정 width 존재
- 여러 컴포넌트에서 하드코딩된 width 사용 확인 필요

**영향받는 파일**:
```
frontend-prediction/src/index.css
frontend-prediction/src/components/routing/RoutingCanvas.tsx
frontend-prediction/src/components/routing/RoutingExplanationPanel.tsx
```

---

### 2. 노드-바 동기화

**현재 구조**:
- RoutingCanvas: React Flow 기반 노드 시각화
- RoutingExplanationPanel: 바 형태 시각화
- **문제**: 두 컴포넌트 간 상태 공유 없음

**해결 방안**:
- Zustand store 생성하여 공정 목록 관리
- 양방향 동기화 구현
- 드래그앤드롭 핸들러 추가

---

### 3. MSSQL 연결 설정

**현재 설정** (`backend/database.py` 47-55행):
```python
MSSQL_CONFIG = {
    "server": os.getenv("MSSQL_SERVER", "K3-DB.ksm.co.kr,1433"),
    "database": os.getenv("MSSQL_DATABASE", "KsmErp"),
    "user": os.getenv("MSSQL_USER", "FKSM_BI"),
    "password": os.getenv("MSSQL_PASSWORD", ""),
    "encrypt": os.getenv("MSSQL_ENCRYPT", "False").lower() == "true",
    "trust_certificate": os.getenv("MSSQL_TRUST_CERTIFICATE", "True").lower() == "true",
}
```

**뷰/테이블 설정** (57-61행):
```python
VIEW_ITEM_MASTER = "dbo.BI_ITEM_INFO_VIEW"
VIEW_ROUTING     = "dbo.BI_ROUTING_HIS_VIEW"
VIEW_WORK_RESULT = "dbo.BI_WORK_ORDER_RESULTS"
VIEW_PURCHASE_ORDER = "dbo.BI_PUR_PO_VIEW"
```

**API 엔드포인트 확인**:
- ✅ `/api/master-data/tree` - 품목 트리 (기준정보 관리)
- ✅ `/api/master-data/items/{itemCode}` - 품목 상세
- ✅ `/api/mssql/metadata` - 메타데이터 조회
- ✅ `/api/mssql/tables` - 테이블 목록

**연결 테스트 기능**:
- ✅ `test_connection()` 함수 존재 (1043행)
- ✅ `get_database_info()` 함수 존재 (1056행)
- ❌ 프론트엔드 설정 UI 없음

---

## 🔧 작업 진행 상황

### Phase 1: 분석 및 문서화 ✅ 완료

**완료 시간**: 2025-10-13 17:15 KST

**파악한 내용**:
1. 가로 스크롤: CSS 하드코딩 width 제거 필요
2. 노드-바 동기화: 상태 관리 store 필요
3. MSSQL 연결: 백엔드는 정상, 프론트엔드 설정 UI 부재

---

### Phase 2: MSSQL 설정 UI 추가 (우선 작업)

**이유**: 사용자가 MSSQL 연결 설정을 변경할 수 있어야 함

**계획**:
1. 백엔드 설정 API 추가
   - `GET /api/database/config` - 현재 설정 조회
   - `POST /api/database/config` - 설정 저장
   - `POST /api/database/test-connection` - 연결 테스트 (이미 존재)

2. 프론트엔드 설정 UI 추가
   - DatabaseSettingsPanel 컴포넌트 생성
   - 기준정보 관리 탭에 설정 버튼 추가
   - 설정 다이얼로그 구현

**대안**:
- 환경 변수로만 관리하고, 프론트엔드 UI는 추가하지 않음
- 이 경우 `.env` 파일 수정 후 서버 재시작 필요

**결정**: 사용자 요청 대기 중

---

### Phase 3: 가로 스크롤 제거 (진행 중)

**상태**: 대기

**작업 예정**:
1. `frontend-prediction/src/index.css` 확인
2. `.timeline-flow` 및 관련 클래스 width 제거
3. Flexbox/Grid로 변경
4. 테스트

---

### Phase 4: 노드-바 동기화 (진행 중)

**상태**: 대기

**작업 예정**:
1. Zustand store 생성
2. RoutingCanvas 연결
3. RoutingExplanationPanel 연결
4. 드래그앤드롭 구현
5. 양방향 동기화 테스트

---

## ⚠️ 발견된 이슈

### 이슈 1: MSSQL 비밀번호 누락
**상태**: ⚠️ 경고
**설명**: `MSSQL_PASSWORD` 환경 변수가 빈 문자열로 설정되어 있음
**영향**: MSSQL 연결 실패 가능성
**해결 방법**: `.env` 파일에 실제 비밀번호 설정 필요

### 이슈 2: 프론트엔드 MSSQL 설정 UI 부재
**상태**: 🔧 개선 필요
**설명**: 현재 MSSQL 설정은 백엔드 환경 변수로만 관리됨
**영향**: 설정 변경 시 서버 재시작 필요
**해결 방법**:
- Option A: 프론트엔드 설정 UI 추가
- Option B: 환경 변수 방식 유지 (더 안전)

---

## 📋 다음 단계

**사용자 확인 필요**:
1. MSSQL 설정 UI가 필요한가요?
   - 필요하면: 설정 UI 구현
   - 불필요하면: 환경 변수 방식 유지

2. 작업 우선순위는?
   - Option A: 가로 스크롤 → 노드-바 동기화 → MSSQL 설정
   - Option B: MSSQL 설정 → 가로 스크롤 → 노드-바 동기화
   - Option C: 노드-바 동기화 → 가로 스크롤 → MSSQL 설정

3. 현재 MSSQL 연결이 작동하나요?
   - 백엔드 서버 로그 확인
   - 기준정보 관리 탭에서 품목 조회 테스트

---

**대기 중**: 사용자 피드백
**예상 소요 시간**: 각 Phase 당 30-60분
**총 예상 시간**: 2-3시간
