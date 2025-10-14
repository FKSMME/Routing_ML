# 데이터 관계 매핑 시스템 구현 진행 상황

**작성일**: 2025-10-14
**브랜치**: `251014`
**작업 상태**: 진행 중 (1/3 완료)

---

## 📋 프로젝트 개요

사용자가 **학습 데이터 → 예측 데이터 → 출력 데이터** 간의 관계를 시각적으로 설정하고, 라우팅 그룹 데이터를 CSV로 출력할 수 있는 종합 시스템 구현.

### 목표

1. ✅ **관리자 전용 데이터 관계 설정 UI** - 3단계 매핑 인터페이스
2. 🔄 **종합 라우팅 생성 버튼** - 시각화 패널에 추가
3. 🔄 **미리보기 팝업 및 CSV 출력** - 라우팅 그룹 + 매핑 적용

---

## ✅ 완료된 작업 (Phase 1)

### 1. 백엔드 API 시스템

#### 📄 `backend/api/schemas.py`
- **DataRelationshipMapping** 스키마 추가
  - `training_column`: 학습 데이터 컬럼 (예: ITEM_CD)
  - `prediction_column`: 예측 결과 컬럼 (예: JOB_NM)
  - `output_column`: 최종 출력 컬럼명 (예: 공정명)
  - `data_type`, `is_required`, `default_value`, `transform_rule`

- **DataMappingProfile** 스키마
  - 여러 매핑 규칙을 묶은 프로파일
  - `relationships`: 3단계 관계 매핑 목록
  - `mappings`: 레거시 호환성용 필드

#### 📄 `backend/api/services/data_mapping_service.py`
- **DataMappingService** 클래스 구현
  - 프로파일 CRUD 관리 (생성/조회/수정/삭제)
  - JSON 파일 기반 저장소 (`config/data_mappings/`)
  - 매핑 적용 및 CSV 변환 로직
  - 데이터 타입 변환 지원

**주요 메서드**:
```python
def create_profile(payload, created_by) -> DataMappingProfile
def update_profile(profile_id, payload) -> DataMappingProfile
def delete_profile(profile_id) -> bool
def apply_mapping(request, routing_group_data) -> DataMappingApplyResponse
```

#### 📄 `backend/api/routes/data_mapping.py`
- **RESTful API 엔드포인트**
  - `GET /api/data-mapping/profiles` - 프로파일 목록
  - `GET /api/data-mapping/profiles/{id}` - 프로파일 상세
  - `POST /api/data-mapping/profiles` - 프로파일 생성 (관리자 전용)
  - `PATCH /api/data-mapping/profiles/{id}` - 프로파일 수정 (관리자 전용)
  - `DELETE /api/data-mapping/profiles/{id}` - 프로파일 삭제 (관리자 전용)
  - `POST /api/data-mapping/apply` - 매핑 적용 및 CSV 생성

#### 📄 `backend/api/prediction_app.py`
- `data_mapping_router` 등록 완료

---

### 2. 프론트엔드 관리자 UI

#### 📄 `frontend-prediction/src/lib/apiClient.ts`
- 데이터 매핑 API 함수 추가
  - `fetchDataMappingProfiles()`
  - `fetchDataMappingProfile(profileId)`
  - `createDataMappingProfile(payload)`
  - `updateDataMappingProfile(profileId, payload)`
  - `deleteDataMappingProfile(profileId)`
  - `applyDataMapping(request)`

- TypeScript 인터페이스 정의
  - `DataRelationshipMapping`
  - `DataMappingProfile`
  - `DataMappingProfileCreate/Update`
  - `DataMappingApplyRequest/Response`

#### 📄 `frontend-prediction/src/components/admin/DataRelationshipManager.tsx`
- **관리자 전용 데이터 관계 설정 UI**
  - 3-column 레이아웃 (프로파일 목록 | 매핑 편집기)
  - 시각적 3단계 매핑 인터페이스:
    ```
    학습 컬럼 → 예측 컬럼 → 출력 컬럼
    ```
  - 프로파일 생성 모달
  - 매핑 규칙 추가/제거
  - 데이터 타입, 기본값, 변환 규칙 설정
  - 필수 필드 체크박스

**UI 컴포넌트 특징**:
- Cyberpunk 테마 적용 (glass-morphism, neon-cyan)
- 드래그앤드롭 가능한 행 (향후 추가 예정)
- 실시간 검증 및 에러 메시지
- 관리자만 접근 가능 (isAdmin 체크)

#### 📄 `frontend-prediction/src/App.tsx`
- 관리자 전용 네비게이션 아이템 추가
  - `ADMIN_NAVIGATION_ITEMS` 배열 분리
  - `useMemo`로 동적 메뉴 생성
  - "데이터 관계 설정" 메뉴 (Settings2 아이콘)
  - `data-relationship` case 추가

#### 📄 `frontend-training/` 동일 구현
- apiClient, DataRelationshipManager, App.tsx 동기화
- 학습 서비스에서도 동일하게 접근 가능

---

## 📐 시스템 아키텍처

### 데이터 흐름
```
[관리자 설정]
  1. 학습 컬럼 선택 (TRAIN_FEATURES)
       ↓
  2. 예측 컬럼 매핑 (ROUTING_OUTPUT_COLS)
       ↓
  3. 출력 컬럼명 지정 (CSV 헤더)

[실제 사용]
  사용자가 라우팅 그룹 선택
       ↓
  프로파일 적용 (매핑 변환)
       ↓
  미리보기 팝업 표시
       ↓
  CSV 다운로드
```

### 저장소 구조
```
config/
└── data_mappings/
    ├── {profile_id_1}.json
    ├── {profile_id_2}.json
    └── ...

output/
└── comprehensive_routing/
    ├── routing_{group_id}_{timestamp}.csv
    └── ...
```

---

## 🔄 진행 중인 작업 (Phase 2)

### 1. 종합 라우팅 생성 버튼
**위치**: `frontend-prediction/src/components/VisualizationSummary.tsx` 하단

**구현 계획**:
- 시각화 패널 하단에 "종합 라우팅 생성" 버튼 추가
- 현재 선택된 라우팅 그룹 데이터 가져오기
- 활성 매핑 프로파일 적용
- 미리보기 팝업 열기

### 2. 미리보기 팝업
**컴포넌트**: `ComprehensiveRoutingPreview.tsx` (새로 생성)

**기능**:
- 변환된 데이터 테이블 미리보기 (최대 10행)
- 컬럼명, 데이터 타입 표시
- 전체 행 수 표시
- "CSV 다운로드" 버튼
- "취소" 버튼

### 3. CSV 내보내기
**API**: `POST /api/data-mapping/apply` (이미 구현됨)

**프론트엔드 통합**:
- 파일 다운로드 트리거
- 성공/실패 메시지 표시
- 다운로드 경로 로깅

---

## 📊 기술 스택

### 백엔드
- FastAPI (Python)
- Pydantic 스키마 검증
- JSON 파일 저장소
- CSV 변환 (csv 모듈)

### 프론트엔드
- React 18 + TypeScript
- Zustand (상태 관리)
- Axios (API 통신)
- Lucide React (아이콘)
- Tailwind CSS + Cyberpunk 테마

---

## 🧪 테스트 시나리오 (예정)

### 관리자 워크플로우
1. 로그인 (관리자 계정)
2. "데이터 관계 설정" 메뉴 클릭
3. "새 프로파일" 생성
4. 매핑 규칙 추가:
   - 학습: `ITEM_CD` → 예측: `ITEM_CD` → 출력: `품목코드`
   - 학습: `PART_TYPE` → 예측: `JOB_NM` → 출력: `공정명`
   - 학습: `OUTDIAMETER` → 예측: `MACH_WORKED_HOURS` → 출력: `작업시간`
5. 저장 확인

### 사용자 워크플로우
1. 라우팅 생성 메뉴에서 예측 실행
2. 시각화 패널에서 "종합 라우팅 생성" 버튼 클릭
3. 미리보기 팝업에서 데이터 확인
4. "CSV 다운로드" 클릭
5. 파일 확인 (`output/comprehensive_routing/*.csv`)

---

## 🔐 보안 및 권한

### 관리자 전용 기능
- 프로파일 생성/수정/삭제
- 매핑 규칙 편집
- FastAPI 의존성 `get_current_user_admin_only()` 사용

### 일반 사용자 기능
- 프로파일 목록 조회 (읽기 전용)
- 매핑 적용 및 CSV 생성
- 미리보기 및 다운로드

---

## 📝 커밋 이력

### Phase 1 커밋
1. **feat: Add data relationship mapping system** (314c43da)
   - 백엔드 스키마, 서비스, API 라우트 구현

2. **feat: Add admin data relationship configuration UI** (ad8c9015)
   - frontend-prediction UI 구현

3. **feat: Add data relationship UI to frontend-training** (71672c6c)
   - frontend-training 동기화

---

## 🚀 다음 단계

### Phase 2: 라우팅 생성 통합
- [ ] `ComprehensiveRoutingButton` 컴포넌트 생성
- [ ] `VisualizationSummary` 하단에 버튼 추가
- [ ] 라우팅 그룹 데이터 추출 로직
- [ ] 매핑 프로파일 선택 UI

### Phase 3: 미리보기 및 출력
- [ ] `ComprehensiveRoutingPreview` 팝업 컴포넌트
- [ ] API 연동 및 데이터 변환
- [ ] CSV 다운로드 기능
- [ ] 에러 핸들링

### Phase 4: 테스트 및 최적화
- [ ] E2E 테스트 작성
- [ ] 성능 최적화 (대용량 데이터)
- [ ] 사용자 피드백 반영
- [ ] 문서 업데이트

---

## 💡 기술적 고려사항

### 확장성
- 프로파일은 JSON 파일로 저장되므로 DB 마이그레이션 고려
- 대용량 라우팅 그룹 처리 시 페이지네이션 필요
- CSV 생성 시 스트리밍 방식 검토

### 성능
- 프로파일 캐싱 (메모리 내 저장)
- 매핑 변환 시 병렬 처리
- 프론트엔드 lazy loading 적용됨

### 사용성
- 매핑 규칙 템플릿 제공
- 드래그앤드롭으로 규칙 재정렬
- 프로파일 복사/내보내기 기능

---

## 📞 참고 링크

### 관련 파일
- Backend: `backend/api/schemas.py:1044-1140`
- Backend: `backend/api/services/data_mapping_service.py`
- Backend: `backend/api/routes/data_mapping.py`
- Frontend: `frontend-prediction/src/components/admin/DataRelationshipManager.tsx`
- Frontend: `frontend-prediction/src/lib/apiClient.ts:459-556`

### 관련 이슈
- 데이터 흐름: 학습 → 예측 → 출력 3단계 매핑
- 출력 설정: CSV 업로드 대신 직접 쿼리 빌더 방식

---

**작성자**: Claude Code
**최종 수정**: 2025-10-14
