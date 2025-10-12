# 복구 계획 (Remediation Plan)

**작성 일시**: 2025-10-03
**목표**: 서비스 정상화 및 코드 안정화

---

## 🎯 목표

1. **즉시**: 503 Service Unavailable 해결 (서비스 복구)
2. **단기 (1-2시간)**: 불필요한 컴포넌트 제거
3. **중기 (1일)**: Frontend 기능 분리 및 정리
4. **장기 (1주)**: 코드 품질 개선 및 테스트 추가

---

## 📋 Phase 1: 긴급 서비스 복구 (30분)

### ✅ Task 1.1: ML 모델 파일 생성
**우선순위**: CRITICAL
**예상 소요**: 10-20분

#### 방법 A: 모델 훈련 실행 (권장)
```bash
# Backend로 이동
cd /workspaces/Routing_ML_4

# 가상환경에서 훈련 실행
venv-linux/bin/python -m backend.api.routes.trainer
```

#### 방법 B: 기존 모델 복사 (있는 경우)
```bash
# 기존 모델 파일 확인
ls -la models/releases/v*/

# 모델 파일이 있다면 default로 복사
cp models/releases/v0.9.0/*.joblib models/default/ 2>/dev/null || echo "No model files found"
```

#### 검증
```bash
# 모델 파일 확인
ls -la models/default/*.joblib

# 필요한 파일들:
# - encoder.joblib
# - feature_columns.joblib
# - scaler.joblib
# - similarity_engine.joblib

# API 테스트
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<your-session>" \
  -d '{
    "item_codes": ["ITEM-001"],
    "top_k": 10,
    "similarity_threshold": 0.3
  }'
```

**성공 기준**:
- [ ] 4개 .joblib 파일이 models/default/에 존재
- [ ] /api/predict 요청 시 200 OK 응답
- [ ] 예측 결과 정상 반환

---

### ✅ Task 1.2: 서비스 재시작 및 확인
**우선순위**: HIGH
**예상 소요**: 5분

```bash
# Backend 재시작 (현재 background 실행 중이면 skip)
# Ctrl+C로 중단 후
venv-linux/bin/python -m uvicorn backend.run_api:app --host 0.0.0.0 --port 8000 --reload

# Frontend 재시작
# Prediction (port 5173)
cd frontend-prediction && npm run dev

# Training (port 5174)
cd frontend-training && npm run dev
```

**검증**:
- [ ] Backend 로그에 에러 없음
- [ ] Frontend 빌드 성공
- [ ] 브라우저에서 로그인 가능
- [ ] 예측 요청 정상 작동

---

## 📋 Phase 2: 불필요한 코드 제거 (1-2시간)

### ✅ Task 2.1: Prediction Frontend 정리
**우선순위**: HIGH
**예상 소요**: 30-40분

#### 2.1.1: Master Data 관련 파일 제거
```bash
cd /workspaces/Routing_ML_4/frontend-prediction/src

# 파일 삭제
rm -rf components/master-data/
rm hooks/useMasterData.ts

# import 구문 제거
# 수동으로 다음 파일들 확인:
# - App.tsx
# - 기타 master data import하는 파일
```

**제거할 파일 목록**:
```
components/master-data/MasterDataTree.tsx
components/master-data/MasterDataWorkspace.tsx
components/master-data/MasterDataMetadataPanel.tsx
hooks/useMasterData.ts
```

#### 2.1.2: Workflow 관련 파일 제거
```bash
cd /workspaces/Routing_ML_4/frontend-prediction/src

# 파일 삭제
rm hooks/useWorkflowConfig.ts
rm components/workspaces/AlgorithmWorkspace.tsx
rm components/WorkflowGraphPanel.tsx

# OptionsWorkspace.tsx 수정 필요 (workflow 관련 코드만 제거)
```

#### 2.1.3: RoutingGroupControls 완전 제거
```bash
cd /workspaces/Routing_ML_4/frontend-prediction/src

# 파일 삭제
rm components/RoutingGroupControls.tsx
rm components/SaveInterfacePanel.tsx

# App.tsx에서 import 제거 확인
```

#### 2.1.4: 빌드 및 검증
```bash
cd /workspaces/Routing_ML_4/frontend-prediction

# 타입 체크
npm run build

# 실행 확인
npm run dev
```

**성공 기준**:
- [ ] 빌드 에러 없음
- [ ] 타입스크립트 에러 없음
- [ ] 예측 기능 정상 작동
- [ ] Timeline, Candidate 패널 정상 표시

---

### ✅ Task 2.2: Training Frontend 정리
**우선순위**: HIGH
**예상 소요**: 30-40분

#### 2.2.1: 불필요한 파일 제거
```bash
cd /workspaces/Routing_ML_4/frontend-training/src

# Master Data 제거
rm -rf components/master-data/
rm hooks/useMasterData.ts

# Workflow 제거
rm hooks/useWorkflowConfig.ts
rm components/workspaces/AlgorithmWorkspace.tsx
rm components/WorkflowGraphPanel.tsx

# Routing Groups 제거
rm components/RoutingGroupControls.tsx
rm hooks/usePredictRoutings.ts
```

**제거할 파일 목록**:
```
components/master-data/* (전체)
components/workspaces/AlgorithmWorkspace.tsx
components/workspaces/OptionsWorkspace.tsx (검토 후)
components/RoutingGroupControls.tsx
components/WorkflowGraphPanel.tsx
hooks/useMasterData.ts
hooks/useWorkflowConfig.ts
hooks/usePredictRoutings.ts
hooks/useRoutingGroups.ts (검토 후)
```

#### 2.2.2: 빌드 및 검증
```bash
cd /workspaces/Routing_ML_4/frontend-training

# 빌드
npm run build

# 실행
npm run dev
```

**성공 기준**:
- [ ] 빌드 에러 없음
- [ ] TrainingStatusWorkspace 정상 작동
- [ ] 훈련 시작/중지 기능 작동
- [ ] 훈련 이력 조회 가능

---

### ✅ Task 2.3: API Client 정리
**우선순위**: MEDIUM
**예상 소요**: 15분

#### 2.3.1: Stub 함수 검토
```typescript
// frontend-prediction/src/lib/apiClient.ts
// frontend-training/src/lib/apiClient.ts

// 현재 상태:
// - 일부 함수: throw Error (사용 시 크래시)
// - 일부 함수: 빈 객체 반환 (안전)

// 모든 stub 함수를 안전하게 변경:
export async function fetchMasterDataTree(...args: any[]): Promise<any> {
  console.warn("fetchMasterDataTree is not available in this version");
  return { nodes: [], total: 0, default_item_code: null };
}
```

#### 2.3.2: 검증
```bash
# 브라우저 콘솔에서 확인
# - 에러 대신 경고만 표시되어야 함
# - 앱이 크래시하지 않아야 함
```

---

## 📋 Phase 3: 코드 정리 및 최적화 (1일)

### ✅ Task 3.1: IndexedDB 재검토
**우선순위**: MEDIUM
**예상 소요**: 1-2시간

#### 3.1.1: 스키마 확인
```typescript
// frontend-prediction/src/lib/persistence/indexedDbPersistence.ts

// 현재 object stores:
// - routing_snapshots
// - routing_audit
// - ui_audit

// 사용 여부 확인 및 불필요한 것 제거
```

#### 3.1.2: 마이그레이션 또는 초기화
```typescript
// 옵션 A: 스키마 버전 업그레이드
const DB_VERSION = 2;  // 버전 증가

// 옵션 B: 완전 초기화
// 브라우저 DevTools > Application > IndexedDB > 삭제
```

---

### ✅ Task 3.2: 타입 정의 정리
**우선순위**: LOW
**예상 소요**: 30분

```bash
cd /workspaces/Routing_ML_4

# 사용하지 않는 타입 찾기
grep -r "MasterData" frontend-prediction/src/types --include="*.ts"
grep -r "Workflow" frontend-prediction/src/types --include="*.ts"

# 불필요한 타입 제거
# frontend-prediction/src/types/masterData.ts (전체 또는 일부)
# frontend-prediction/src/types/workflow.ts (전체 또는 일부)
```

---

### ✅ Task 3.3: Import 구문 정리
**우선순위**: LOW
**예상 소요**: 20분

```bash
# 사용하지 않는 import 자동 제거
cd frontend-prediction
npx eslint --fix src/**/*.ts src/**/*.tsx

cd ../frontend-training
npx eslint --fix src/**/*.ts src/**/*.tsx
```

---

## 📋 Phase 4: 테스트 및 문서화 (1주)

### ✅ Task 4.1: 기능 테스트
**우선순위**: MEDIUM
**예상 소요**: 2-3시간

#### Prediction Frontend
- [ ] 로그인/회원가입
- [ ] 아이템 코드 입력
- [ ] 예측 실행
- [ ] 결과 표시 (Timeline, Candidates)
- [ ] Feature Weight 조정
- [ ] 시각화 표시

#### Training Frontend
- [ ] 로그인/회원가입
- [ ] 훈련 상태 조회
- [ ] 훈련 시작
- [ ] 진행률 표시
- [ ] 훈련 이력 조회
- [ ] Feature 설정 변경

---

### ✅ Task 4.2: 통합 테스트
**우선순위**: LOW
**예상 소요**: 1시간

```bash
# API 엔드포인트 전체 테스트
# 스크립트 작성 또는 Postman 사용

# /api/auth/register
# /api/auth/login
# /api/auth/me
# /api/predict
# /api/trainer/status
# /api/trainer/run
# /api/trainer/metrics
```

---

### ✅ Task 4.3: 문서 업데이트
**우선순위**: LOW
**예상 소요**: 1-2시간

#### README 업데이트
```markdown
# Routing ML 4

## 구성
- Backend: FastAPI
- Frontend-Prediction: React + TypeScript (예측 전용)
- Frontend-Training: React + TypeScript (훈련 전용)

## 제거된 기능
- Master Data 관리
- Workflow 설정
- Routing Groups (일부)
- Access DB 연결

## 현재 기능
- 사용자 인증
- ML 기반 라우팅 예측
- 모델 훈련 및 관리
- Feature 가중치 설정
```

#### API 문서
```markdown
# API Documentation

## Authentication
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

## Prediction
- POST /api/predict

## Training
- GET /api/trainer/status
- POST /api/trainer/run
- GET /api/trainer/metrics
- GET /api/trainer/runs
- GET /api/training/features
- PATCH /api/training/features
```

---

## 📊 진행 상황 추적

### Phase 1: 긴급 복구 ⏳
- [ ] Task 1.1: ML 모델 생성
- [ ] Task 1.2: 서비스 재시작

### Phase 2: 코드 정리 ⏳
- [ ] Task 2.1: Prediction Frontend 정리
- [ ] Task 2.2: Training Frontend 정리
- [ ] Task 2.3: API Client 정리

### Phase 3: 최적화 📅
- [ ] Task 3.1: IndexedDB 재검토
- [ ] Task 3.2: 타입 정의 정리
- [ ] Task 3.3: Import 정리

### Phase 4: 테스트 📅
- [ ] Task 4.1: 기능 테스트
- [ ] Task 4.2: 통합 테스트
- [ ] Task 4.3: 문서 업데이트

---

## 🎯 예상 결과

### 코드 메트릭
```
Before:
- Prediction Frontend: ~25,000 lines
- Training Frontend: ~23,000 lines
- Total files: ~180

After:
- Prediction Frontend: ~18,000 lines (-28%)
- Training Frontend: ~17,000 lines (-26%)
- Total files: ~140 (-22%)
```

### 성능 개선
```
- 빌드 시간: 30초 → 20초 (-33%)
- 번들 크기: 2.5MB → 1.8MB (-28%)
- 초기 로딩: 3초 → 2초 (-33%)
```

### 안정성
```
- 빌드 에러: 현재 다수 → 0
- 런타임 에러: 현재 다수 → 0
- 타입 에러: 현재 다수 → 0
- 테스트 커버리지: 0% → 30%+
```

---

## ⚠️ 리스크 및 대응

### 리스크 1: 모델 훈련 실패
**확률**: MEDIUM
**영향**: HIGH

**대응**:
1. 훈련 데이터 확인
2. 에러 로그 분석
3. 기존 모델 파일 찾기
4. 필요시 임시 mock predictor 사용

### 리스크 2: Frontend 빌드 실패
**확률**: LOW
**영향**: MEDIUM

**대응**:
1. 타입 에러 하나씩 해결
2. import 경로 확인
3. 필요시 해당 컴포넌트만 주석 처리

### 리스크 3: 기존 기능 손실
**확률**: LOW
**영향**: LOW

**대응**:
1. Git으로 변경사항 추적
2. 필요시 이전 버전으로 복구
3. 제거 전 사용자에게 확인

---

## 📝 체크리스트

### 시작 전 준비
- [ ] Git commit으로 현재 상태 저장
- [ ] 백업 생성
- [ ] QA_REPORT.md 읽고 이해

### 각 Phase 완료 후
- [ ] 빌드 성공 확인
- [ ] 기능 테스트 통과
- [ ] Git commit
- [ ] 다음 Phase 준비

### 최종 완료
- [ ] 모든 Phase 완료
- [ ] 통합 테스트 통과
- [ ] 문서 업데이트
- [ ] 사용자 검수

---

**작성자**: Claude AI
**최종 수정**: 2025-10-03
**다음 업데이트**: Phase 1 완료 후
