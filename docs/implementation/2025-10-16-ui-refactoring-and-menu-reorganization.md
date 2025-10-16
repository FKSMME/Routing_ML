# UI 리팩토링 및 메뉴 재구성 작업 로그

**날짜**: 2025년 10월 16일
**작업자**: Claude (Sonnet 4.5)
**브랜치**: 251014

---

## 작업 개요

프론트엔드 UI 구조 개선 및 메뉴 재구성을 통한 사용자 경험 향상 작업

---

## 타임라인

### 14:00 - 작업 시작 및 문제 파악

**발견된 문제점:**
1. 프로필 관리에서 404 에러 발생 (`/api/data-mapping/profiles`)
2. 라우팅 생성 페이지의 제어판에 불필요한 UI 섹션 혼재
3. 기준정보 페이지의 검색 바 너비가 좁아 텍스트 깨짐

**초기 진단:**
- API URL 중복 문제: `baseURL`이 `/api`로 설정되어 있는데 호출 시 `/api` 재추가
- 메뉴 구조가 비직관적: 제어판에 MSSQL 미리보기와 공정 그룹 정의 혼재

### 14:15 - API URL 중복 문제 해결

**문제 원인:**
- `apiClient.ts:10`: `baseURL`이 `/api`로 설정됨
- `ProfileManagement.tsx`와 `ProfileEditor.tsx`에서 `/api/data-mapping/profiles` 호출
- 결과: `/api/api/data-mapping/profiles` (404 에러)

**수정 작업:**

1. **ProfileManagement.tsx** - 3개 엔드포인트 수정
   - Line 27: `GET /api/data-mapping/profiles` → `/data-mapping/profiles`
   - Line 45: `POST /api/data-mapping/profiles` → `/data-mapping/profiles`
   - Line 72: `DELETE /api/data-mapping/profiles/${id}` → `/data-mapping/profiles/${id}`

2. **ProfileEditor.tsx** - 1개 엔드포인트 수정
   - Line 38: `PATCH /api/data-mapping/profiles/${id}` → `/data-mapping/profiles/${id}`

### 14:30 - 백엔드 라우터 누락 문제 해결

**문제 발견:**
- 프론트엔드는 `localhost:8000` (메인 앱)으로 프록시 설정됨
- `data_mapping_router`는 `prediction_app.py`에만 등록됨 (8002 포트)
- 메인 앱(`app.py`)에는 미등록

**백엔드 서버 확인:**
```
8000 포트 - 메인 앱 (app.py)
8001 포트 - Training 앱
8002 포트 - Prediction 앱
```

**수정 작업:**

**backend/api/app.py**
- Line 23: `data_mapping_router` import 추가
- Line 69: `app.include_router(data_mapping_router)` 등록

### 14:45 - 출력설정 프로필 생성 버그 수정

**문제:**
- 새 프로필 저장 시 프로필 리스트가 업데이트되지 않음

**원인 분석:**
- `DataOutputWorkspace.tsx:681`에서 프로필 생성 후 모달 닫기와 refresh 순서 문제

**수정:**
```typescript
// Before
setShowNewProfileModal(false);
setSelectedProfileId(result.id);
setStatusMessage(result.message || "프로파일이 생성되었습니다.");
await profilesQuery.refresh();

// After
await profilesQuery.refresh();  // refresh를 먼저 실행
setShowNewProfileModal(false);
setSelectedProfileId(result.id);
setStatusMessage(result.message || "프로파일이 생성되었습니다.");
```

**파일:** `frontend-prediction/src/components/workspaces/DataOutputWorkspace.tsx:675-681`

### 15:00 - 기준정보 페이지 검색 바 너비 수정

**문제:**
- 좌측 패널 너비가 20%로 고정되어 있어 품목 코드/이름이 깨짐

**수정:**
```css
/* Before */
.master-data-simple-workspace {
  grid-template-columns: 20% 1fr;
}

/* After */
.master-data-simple-workspace {
  grid-template-columns: minmax(300px, 28%) 1fr;
}
```

**변경 사항:**
- 최소 너비 300px 보장
- 최대 28%로 확장 가능
- 반응형 레이아웃 개선

**파일:** `frontend-prediction/src/index.css:5304`

### 15:20 - 새 메뉴 "데이터 매핑 설정" 생성

**요구사항:**
- MSSQL 테이블/컬럼 매핑을 전용 메뉴로 분리
- 관리자 전용 기능

**작업 내용:**

1. **App.tsx** - 관리자 메뉴 추가
```typescript
const ADMIN_NAVIGATION_ITEMS = [
  {
    id: "data-mapping",
    label: "데이터 매핑 설정",
    description: "MSSQL 테이블 · 컬럼 매핑",
    icon: <Table size={18} />,
  },
  // ... 기존 메뉴들
];
```

2. **워크스페이스 라우팅 추가**
```typescript
case "data-mapping":
  workspace = (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-2xl font-semibold mb-6 text-slate-200">MSSQL 테이블 매핑</h2>
          <ReferenceMatrixPanel />
        </div>
      </div>
    </div>
  );
  break;
```

3. **타입 정의 업데이트**
```typescript
// workspaceStore.ts
export type NavigationKey =
  | "master-data"
  | "routing"
  | "routing-matrix"
  | "process-groups"
  | "data-output"
  | "algorithm"
  | "algorithm-viz"
  | "training-status"
  | "options"
  | "data-mapping"        // 추가
  | "data-relationship"
  | "profile-management";
```

**수정 파일:**
- `frontend-prediction/src/App.tsx:75-79, 316-327`
- `frontend-prediction/src/store/workspaceStore.ts:26`

### 15:40 - "공정 그룹 정의"를 "데이터 관계 설정"으로 이동

**요구사항:**
- 공정 그룹 정의를 데이터 관계 설정 메뉴로 이동
- 학습→예측→출력 매핑과 함께 관리

**작업 내용:**

**DataRelationshipManager.tsx** 하단에 섹션 추가:
```typescript
{/* 공정 그룹 정의 섹션 */}
<div className="mt-8">
  <div className="glass-morphism p-6 rounded-xl">
    <h2 className="heading-2 mb-4">📦 공정 그룹 정의</h2>
    <p className="body-text-secondary mb-6">
      워크스페이스에서 공정 그룹을 만들어 놓으면 시각화에 있는 라우팅 순서를
      출력할때 공정 그룹이 부 라우팅으로 같이 출력됩니다.
    </p>
    <RoutingGroupControls variant="embedded" />
  </div>
</div>
```

**파일:** `frontend-prediction/src/components/admin/DataRelationshipManager.tsx:529-538`

### 16:00 - 제어판 UI 정리

**작업 내용:**

**RoutingTabbedWorkspace.tsx** - 제어판 탭 간소화:

**Before:** 3-섹션 레이아웃 (그리드 + 하단)
- 좌측: 제어판
- 우측: MSSQL 행렬 프리뷰
- 하단: 공정 그룹 정의

**After:** 단일 섹션 레이아웃
- 제어판만 유지 (maxWidth: 800px)

**제거된 컴포넌트:**
- `ReferenceMatrixPanel` - 데이터 매핑 설정으로 이동
- `RoutingGroupControls` - 데이터 관계 설정으로 이동

**불필요한 import 제거:**
```typescript
// 제거됨
import { ReferenceMatrixPanel } from "../routing/ReferenceMatrixPanel";
import { RoutingGroupControls } from "../RoutingGroupControls";
```

**파일:** `frontend-prediction/src/components/workspaces/RoutingTabbedWorkspace.tsx:1-96`

### 16:15 - 작업 완료 및 검증

---

## 수정된 파일 목록

### 백엔드
1. `backend/api/app.py`
   - Line 23: data_mapping_router import 추가
   - Line 69: router 등록

### 프론트엔드

#### API 클라이언트
2. `frontend-prediction/src/components/ProfileManagement.tsx`
   - Line 27, 45, 72: API URL 수정 (중복 제거)

3. `frontend-prediction/src/components/ProfileEditor.tsx`
   - Line 38: API URL 수정 (중복 제거)

#### 워크스페이스
4. `frontend-prediction/src/components/workspaces/DataOutputWorkspace.tsx`
   - Line 675-681: 프로필 refresh 순서 수정

5. `frontend-prediction/src/components/workspaces/RoutingTabbedWorkspace.tsx`
   - Line 1-10: 불필요한 import 제거
   - Line 78-96: 제어판 UI 간소화 (단일 섹션)

6. `frontend-prediction/src/components/admin/DataRelationshipManager.tsx`
   - Line 13: RoutingGroupControls import 추가
   - Line 529-538: 공정 그룹 정의 섹션 추가

#### 라우팅 및 상태관리
7. `frontend-prediction/src/App.tsx`
   - Line 75-79: 데이터 매핑 설정 메뉴 추가
   - Line 316-327: 워크스페이스 라우팅 추가

8. `frontend-prediction/src/store/workspaceStore.ts`
   - Line 26: NavigationKey 타입에 "data-mapping" 추가

#### 스타일
9. `frontend-prediction/src/index.css`
   - Line 5304: 기준정보 좌측 패널 너비 수정 (20% → minmax(300px, 28%))

---

## 변경 사항 요약

### 1. API 통신 수정
- ✅ 중복된 `/api` prefix 제거하여 404 에러 해결
- ✅ 메인 앱에 data_mapping_router 등록

### 2. UI 구조 개선
- ✅ 새 메뉴 "데이터 매핑 설정" 추가 (관리자 전용)
- ✅ "공정 그룹 정의"를 "데이터 관계 설정"으로 이동
- ✅ 제어판 UI 간소화 (3섹션 → 1섹션)

### 3. 사용자 경험 개선
- ✅ 프로필 리스트 실시간 업데이트
- ✅ 기준정보 검색 바 너비 확대 (텍스트 깨짐 방지)
- ✅ 메뉴 구조 직관화

---

## 새로운 메뉴 구조

### 일반 사용자 메뉴
- **라우팅 생성**: 제어판 (품목 선택 및 예측 실행)
- **기준정보**: 품목 마스터 데이터 탐색
- **라우팅 조합**: Variant 조합 편집
- **공정 그룹**: 대체 경로 관리
- **출력설정**: 미리보기 및 내보내기

### 관리자 전용 메뉴
- **데이터 매핑 설정** (신규): MSSQL 테이블·컬럼 매핑
- **데이터 관계 설정**: 학습→예측→출력 매핑 + 공정 그룹 정의
- **프로파일 관리**: 데이터 매핑 프로파일 편집

---

## 테스트 체크리스트

### 백엔드
- [ ] 메인 앱(8000) 재시작 후 `/api/data-mapping/profiles` 엔드포인트 접근 확인
- [ ] 프로필 CRUD 작업 정상 동작 확인

### 프론트엔드
- [ ] 프로필 관리 페이지 로딩 확인
- [ ] 새 프로필 생성 시 리스트 즉시 업데이트 확인
- [ ] 기준정보 페이지에서 긴 품목명 표시 확인
- [ ] 데이터 매핑 설정 메뉴 접근 및 MSSQL 미리보기 정상 동작 확인
- [ ] 데이터 관계 설정 메뉴에서 공정 그룹 정의 UI 확인
- [ ] 라우팅 생성 > 제어판 간소화 확인

---

## 기술적 고려사항

### API URL 패턴
```
baseURL = "/api"

❌ 잘못된 호출: apiClient.get('/api/data-mapping/profiles')
   → 실제 URL: /api/api/data-mapping/profiles

✅ 올바른 호출: apiClient.get('/data-mapping/profiles')
   → 실제 URL: /api/data-mapping/profiles
```

### 메뉴 ID 컨벤션
```typescript
// NavigationKey 타입
"master-data"          // 하이픈 케이스
"data-mapping"         // 일관성 유지
"profile-management"   // 복합 단어
```

### 컴포넌트 재사용
```typescript
// RoutingGroupControls는 variant prop으로 레이아웃 조정
<RoutingGroupControls variant="embedded" />  // 데이터 관계 설정용
<RoutingGroupControls />                     // 독립 페이지용
```

---

## 후속 작업 제안

1. **백엔드 재시작**: 메인 앱 재시작 필요 (data_mapping_router 등록 반영)
2. **E2E 테스트**: 프로필 관리 전체 플로우 테스트
3. **문서 업데이트**: 사용자 가이드에 새 메뉴 구조 반영
4. **모바일 반응형**: 새 메뉴의 모바일 UI 검증

---

## 참고 자료

- [ProfileManagement.tsx](../../frontend-prediction/src/components/ProfileManagement.tsx)
- [DataOutputWorkspace.tsx](../../frontend-prediction/src/components/workspaces/DataOutputWorkspace.tsx)
- [RoutingTabbedWorkspace.tsx](../../frontend-prediction/src/components/workspaces/RoutingTabbedWorkspace.tsx)
- [App.tsx](../../frontend-prediction/src/App.tsx)
- [backend/api/app.py](../../backend/api/app.py)

---

**작업 완료 시각**: 2025-10-16 16:20
**소요 시간**: 약 2시간 20분
**커밋 권장**: 각 섹션별 개별 커밋 또는 통합 커밋
