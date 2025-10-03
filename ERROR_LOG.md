# 오류 로그 (Error Log)

**생성 일시**: 2025-10-03 11:50:00
**로그 기간**: 2025-10-03 10:00:00 ~ 2025-10-03 11:50:00

---

## 🔴 Backend 오류

### [ERROR-001] Model Manifest Validation Failed
**시각**: 2025-10-03 11:41:14
**위치**: `backend/api/services/prediction_service.py:518`
**심각도**: CRITICAL

```python
Traceback (most recent call last):
  File "/workspaces/Routing_ML_4/backend/api/services/prediction_service.py", line 512, in _ensure_model
    manifest = self._refresh_manifest(strict=True)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/workspaces/Routing_ML_4/backend/api/services/prediction_service.py", line 350, in _refresh_manifest
    manifest = read_model_manifest(self._model_reference, strict=strict)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/workspaces/Routing_ML_4/models/manifest.py", line 170, in read_model_manifest
    write_manifest(ref_path, strict=strict)
  File "/workspaces/Routing_ML_4/models/manifest.py", line 112, in write_manifest
    manifest = build_manifest(directory, strict=strict, metadata=metadata)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/workspaces/Routing_ML_4/models/manifest.py", line 89, in build_manifest
    raise FileNotFoundError(
FileNotFoundError: Missing required artifacts for manifest: encoder.joblib, feature_columns.joblib, scaler.joblib, similarity_engine.joblib
```

**요청 정보**:
- Method: POST
- Path: /api/predict
- Item: ITEM-001
- Top K: 10
- Threshold: 0.30

**응답**:
- Status: 503 Service Unavailable
- Message: "Missing required artifacts for manifest: encoder.joblib, feature_columns.joblib, scaler.joblib, similarity_engine.joblib"

**발생 횟수**: 4회
- 11:41:14
- 11:44:34
- 11:44:37
- 11:44:40

**영향**:
- 모든 예측 요청 실패
- 서비스 핵심 기능 중단

---

### [WARN-001] No Active Model Version
**시각**: 2025-10-03 11:37:37 (및 이후 반복)
**위치**: `backend/api/services/prediction_service.py:283`
**심각도**: MEDIUM

```
활성화된 모델 버전이 없어 기본 디렉토리를 사용합니다: /workspaces/Routing_ML_4/models/default
```

**영향**:
- 모델 버전 관리 기능 미작동
- 기본 디렉토리 사용 (모델 파일 누락 시 에러)

---

### [INFO-001] Authentication Events
**시각**: 2025-10-03 11:38:58 ~ 11:41:03

**회원가입**:
```json
{
  "timestamp": "2025-10-03 11:38:58",
  "action": "register",
  "username": "syyun@ksm.co.kr",
  "status": "pending"
}
```

**로그인 실패**:
```json
{
  "timestamp": "2025-10-03 11:39:08",
  "action": "login_failed",
  "username": "syyun@ksm.co.kr",
  "client_host": "127.0.0.1",
  "reason": "User not approved"
}
```

**로그인 성공** (승인 후):
```json
{
  "timestamp": "2025-10-03 11:41:03",
  "action": "login_success",
  "username": "syyun@ksm.co.kr",
  "client_host": "127.0.0.1"
}
```

---

## 🟡 Frontend-Prediction 오류

### [ERROR-101] RoutingGroupControls TypeError
**시각**: 2025-10-03 11:44:00 (추정)
**위치**: `frontend-prediction/src/components/RoutingGroupControls.tsx:1920`
**심각도**: HIGH

```javascript
Uncaught TypeError: Cannot read properties of undefined (reading 'length')
    at RoutingGroupControls.tsx:1920
```

**근본 원인**:
- 컴포넌트가 삭제된 API 함수 호출 시도
- props 또는 state 값이 undefined

**상태**: 부분 해결 (App.tsx에서 컴포넌트 제거)

---

### [ERROR-102] IndexedDB NotFoundError
**시각**: 반복 발생
**위치**: `frontend-prediction/src/lib/persistence/indexedDbPersistence.ts:558`
**심각도**: MEDIUM

```javascript
NotFoundError: Failed to execute 'transaction' on 'IDBDatabase':
One of the specified object stores was not found
```

**영향 위치**:
- indexedDbPersistence.ts:558
- routingStore.ts:1754

**근본 원인**:
- IndexedDB 스키마 불일치
- Object store 정의와 실제 DB 구조 차이

---

### [ERROR-103] API Function Import Errors
**시각**: 빌드 타임
**위치**: 여러 파일
**심각도**: HIGH

#### Master Data API
```
frontend-prediction/src/hooks/useMasterData.ts:11-13
  - fetchMasterDataItem (imported but throws error)
  - fetchMasterDataLogs (imported but throws error)
  - fetchMasterDataTree (imported but throws error)

frontend-prediction/src/hooks/useMasterData.ts:105
  - fetchMasterDataTree() called

frontend-prediction/src/hooks/useMasterData.ts:222
  - fetchMasterDataItem() called

frontend-prediction/src/hooks/useMasterData.ts:237
  - fetchMasterDataItem() called

frontend-prediction/src/hooks/useMasterData.ts:272
  - fetchMasterDataLogs() called
```

#### Workflow API
```
frontend-prediction/src/hooks/useWorkflowConfig.ts:2
  - fetchWorkflowConfig (imported but throws error)
  - patchWorkflowConfig (imported but throws error)

frontend-prediction/src/components/workspaces/AlgorithmWorkspace.tsx:12
  - fetchWorkflowConfig, patchWorkflowConfig (imported)

frontend-prediction/src/components/workspaces/AlgorithmWorkspace.tsx:495
  - fetchWorkflowConfig() called

frontend-prediction/src/components/workspaces/AlgorithmWorkspace.tsx:594
  - patchWorkflowConfig() called
```

#### Routing Interface API
```
frontend-prediction/src/components/RoutingGroupControls.tsx:4
  - triggerRoutingInterface (imported but throws error)
  - fetchWorkspaceSettings (imported, returns {})

frontend-prediction/src/components/RoutingGroupControls.tsx:302
  - fetchWorkspaceSettings() called

frontend-prediction/src/components/RoutingGroupControls.tsx:1135
  - triggerRoutingInterface() called
```

---

## 🟠 Frontend-Training 오류

### [ERROR-201] usePredictRoutings is not defined
**시각**: 2025-10-03 10:00:00 ~ 11:30:00 (수정 전)
**위치**: `frontend-training/src/App.tsx:96`
**심각도**: CRITICAL

```javascript
Uncaught ReferenceError: usePredictRoutings is not defined
    at App.tsx:96
```

**수정 완료**: ✅
- App.tsx 전체 재작성
- 예측 관련 코드 전체 제거

---

### [ERROR-202] API Function Imports (Training)
**시각**: 빌드 타임
**위치**: 여러 파일
**심각도**: HIGH

Training frontend에도 동일한 17+ 곳에서 삭제된 API 함수 import 및 호출:
- fetchMasterDataTree
- fetchMasterDataItem
- fetchWorkflowConfig
- patchWorkflowConfig
- createRoutingGroup
- fetchRoutingGroup
- triggerRoutingInterface

**파일 목록**:
```
frontend-training/src/hooks/useMasterData.ts
frontend-training/src/hooks/useWorkflowConfig.ts
frontend-training/src/hooks/usePredictRoutings.ts (미사용)
frontend-training/src/components/master-data/MasterDataTree.tsx
frontend-training/src/components/master-data/MasterDataWorkspace.tsx
frontend-training/src/components/master-data/MasterDataMetadataPanel.tsx
frontend-training/src/components/workspaces/AlgorithmWorkspace.tsx
frontend-training/src/components/workspaces/OptionsWorkspace.tsx
frontend-training/src/components/RoutingGroupControls.tsx
frontend-training/src/components/WorkflowGraphPanel.tsx
```

---

## 📊 오류 통계

### 심각도별 분류
```
CRITICAL: 2건 (Backend 모델 누락, Training usePredictRoutings)
HIGH:     30+ 건 (삭제된 API 함수 호출)
MEDIUM:   3건 (RoutingGroupControls, IndexedDB, 모델 버전)
LOW:      5+ 건 (기타 경고)
```

### 카테고리별 분류
```
Backend:              4건
Frontend-Prediction:  20+ 건
Frontend-Training:    18+ 건
```

### 시간대별 발생 패턴
```
10:00-11:00: usePredictRoutings 오류 (Training)
11:00-11:30: 서버 재시작, 캐시 정리
11:30-11:40: RoutingGroupControls 오류 (Prediction)
11:40-11:50: 503 Service Unavailable (반복)
```

---

## 🔧 수정 이력

### 2025-10-03 11:00:00 - 11:30:00
1. **frontend-training/src/App.tsx** 재작성 ✅
   - usePredictRoutings 제거
   - 예측 관련 의존성 전체 제거
   - 300+ lines → 110 lines

2. **frontend-prediction/src/lib/apiClient.ts** stub 함수 추가 ✅
   - 모든 삭제된 API 함수 stub 구현
   - 일부는 에러 throw, 일부는 빈 응답

3. **frontend-prediction/src/hooks/useRoutingGroups.ts** mock 응답 ✅
   - createRoutingGroup → mock response
   - fetchRoutingGroup → error message
   - listRoutingGroups → empty list

4. **frontend-prediction/src/store/workspaceStore.ts** mock 응답 ✅
   - saveWorkspaceSettings → mock response

5. **frontend-prediction/src/lib/persistence/indexedDbPersistence.ts** ⚠️
   - postRoutingSnapshotsBatch 호출 주석 처리
   - IndexedDB 구조 오류는 미해결

6. **frontend-prediction/src/App.tsx** 부분 수정 ⚠️
   - RoutingGroupControls 주석 처리
   - 완전 제거 필요

---

## 🎯 미해결 이슈

### Priority 1: 서비스 복구
- [ ] **Backend 모델 파일 누락** - 훈련 실행 필요

### Priority 2: 코드 정리
- [ ] **Master Data 관련 파일 제거** (Prediction, Training)
- [ ] **Workflow 관련 파일 제거** (Prediction, Training)
- [ ] **RoutingGroupControls 완전 제거**
- [ ] **usePredictRoutings 제거** (Training)

### Priority 3: 구조 개선
- [ ] **IndexedDB 스키마 재검토**
- [ ] **모델 버전 관리 설정**
- [ ] **Dead code 정리**

---

## 📝 비고

### 발견된 패턴
1. **대량 API 삭제 시 호출 위치 미확인**
   - Grep으로 사용 위치 검색 필수
   - 의존성 트리 분석 필요

2. **Frontend 코드 중복**
   - Prediction/Training 두 frontend가 동일 파일 공유
   - 기능별 명확한 분리 필요

3. **Stub 함수의 한계**
   - 에러를 throw하는 stub는 런타임 오류 발생
   - 빈 응답 반환하는 stub는 안전하나 기능 미작동

### 권장사항
1. **API 제거 전 체크리스트**
   - [ ] Backend 엔드포인트 제거
   - [ ] Frontend apiClient stub 함수 추가
   - [ ] Grep으로 모든 호출 위치 검색
   - [ ] 각 호출 위치 수정 또는 제거
   - [ ] 컴포넌트 테스트
   - [ ] 통합 테스트

2. **Frontend 리팩토링**
   - Prediction: 예측 기능만
   - Training: 훈련 및 모델 관리만
   - 공통 기능은 shared 패키지로 분리

3. **모니터링**
   - 로그 레벨 분리 (ERROR, WARN, INFO)
   - 에러 추적 시스템 도입
   - API 호출 실패 알림

---

**작성자**: Claude AI
**로그 수집 방법**: Backend logs, Browser console, File analysis
**다음 업데이트**: 모델 훈련 후 재점검
