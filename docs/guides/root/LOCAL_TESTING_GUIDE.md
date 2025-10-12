# 로컬 개발 환경 테스트 가이드
**목적**: 배포 전에 로컬에서 전체 시스템을 실행하고 테스트하기
**소요 시간**: 약 30분

---

## 준비 사항

### 1. 필수 소프트웨어 확인

```bash
# Python 버전 확인 (3.11 이상)
python --version

# Node.js 버전 확인 (18 이상)
node --version
npm --version

# 가상환경 확인
ls -la venv-linux/
```

**필요한 경우 설치**:
```bash
# Python 가상환경 생성 (없는 경우)
python3.11 -m venv venv-linux
source venv-linux/bin/activate

# Python 패키지 설치
pip install -r requirements.txt
```

---

## 1단계: 백엔드 실행하기

### 1-1. 환경 변수 설정

```bash
# 터미널 1: 백엔드 서버
cd /workspaces/Routing_ML_4

# 환경 변수 설정
export JWT_SECRET_KEY="local-dev-secret-key-min-32-chars-long-12345"
export DATABASE_URL="sqlite:///./routing_ml.db"
export CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001,http://localhost:5173"
export ENVIRONMENT="development"
export LOG_LEVEL="INFO"
```

### 1-2. 백엔드 서버 시작

```bash
# 가상환경 활성화
source venv-linux/bin/activate

# FastAPI 서버 실행
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000 --reload
```

**예상 출력**:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using WatchFiles
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### 1-3. 백엔드 동작 확인

**새 터미널 열기** (터미널 2):

```bash
# Health check
curl http://localhost:8000/health

# 예상 응답: {"status":"ok","timestamp":"2025-10-09T..."}
```

```bash
# API 문서 확인 (브라우저에서)
# http://localhost:8000/docs
```

**로그인 테스트**:
```bash
# 테스트 계정으로 로그인
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# 예상 응답: {"access_token": "eyJ...", "token_type": "bearer", ...}
```

**토큰 저장** (다음 테스트에서 사용):
```bash
export TOKEN="<위에서 받은 access_token 복사>"
```

---

## 2단계: 프론트엔드 실행하기

### 2-1. Frontend Training (학습/모델 관리 앱) - Port 3000

**새 터미널 열기** (터미널 3):

```bash
cd /workspaces/Routing_ML_4/frontend-training

# 의존성 설치 (처음 한 번만)
npm install

# 개발 서버 시작
npm run dev
```

**예상 출력**:
```
VITE v5.0.0  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
➜  press h + enter to show help
```

**브라우저 열기**: http://localhost:5173

**확인 사항**:
- ✅ UI가 정상적으로 로드되는가?
- ✅ 로그인 화면이 나타나는가?
- ✅ "admin / admin123" 로그인이 되는가?
- ✅ 네비게이션 메뉴가 보이는가? (마스터 데이터, 라우팅, 알고리즘, **모델 학습** 등)

---

### 2-2. Frontend Prediction (예측/라우팅 생성 앱) - Port 3001

**새 터미널 열기** (터미널 4):

```bash
cd /workspaces/Routing_ML_4/frontend-prediction

# 의존성 설치 (처음 한 번만)
npm install

# 개발 서버 시작
npm run dev
```

**브라우저 열기**: http://localhost:5173 (또는 표시된 포트)

**확인 사항**:
- ✅ UI가 정상적으로 로드되는가?
- ✅ 로그인이 되는가?
- ✅ 예측 화면이 나타나는가?

---

### 2-3. Frontend Home (홈페이지) - Port 8080

**새 터미널 열기** (터미널 5):

```bash
cd /workspaces/Routing_ML_4/frontend-home

# Node.js 서버 시작
node server.js
```

**예상 출력**:
```
Server running on http://localhost:8080
```

**브라우저 열기**: http://localhost:8080

**확인 사항**:
- ✅ 랜딩 페이지가 보이는가?
- ✅ Prediction/Training 앱 링크가 있는가?

---

## 3단계: 주요 기능 테스트

### 3-1. 백엔드 API 테스트

**터미널 2에서 실행**:

```bash
# 예측 API 테스트
curl -X POST http://localhost:8000/api/routing/predict \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "item_code": "TEST_ITEM",
    "context": {}
  }' | jq

# 데이터 품질 메트릭 조회
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/data-quality/metrics | jq

# 학습 상태 조회
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/trainer/status | jq
```

---

### 3-2. 모델 학습 UI 테스트 (P2 신규 기능)

**브라우저**: http://localhost:5173 (frontend-training)

**절차**:
1. 로그인 (admin / admin123)
2. 좌측 네비게이션에서 **"모델 학습"** 클릭
3. ModelTrainingPanel 화면 확인

**테스트 시나리오 1: Dry Run**
1. Version Label: `test-ui-v1`
2. **"Dry Run" 체크박스 선택**
3. "학습 시작" 버튼 클릭
4. 확인 사항:
   - ✅ 상태가 "Scheduled" → "Running" → "Completed"로 변경되는가?
   - ✅ 진행률이 0% → 100%로 업데이트되는가?
   - ✅ 소요 시간이 표시되는가?

**테스트 시나리오 2: 실제 학습** (데이터가 있는 경우)
1. Version Label 비우기 (자동 생성)
2. "Dry Run" 체크 해제
3. "학습 시작" 버튼 클릭
4. 학습 완료 후 확인:
   ```bash
   # 터미널에서 모델 디렉토리 확인
   ls -la models/version_*/

   # metrics.json 확인
   cat models/version_*/metrics.json | jq
   ```

---

### 3-3. 예측 기능 테스트

**브라우저**: http://localhost:5173 (frontend-prediction)

**절차**:
1. 로그인
2. 품목 코드 입력 (예: "TEST_ITEM")
3. "예측" 버튼 클릭
4. 확인 사항:
   - ✅ 후보 공정 목록이 표시되는가?
   - ✅ 각 후보의 점수와 예상 시간이 나타나는가?
   - ✅ 후보를 선택하여 라우팅 그룹에 추가할 수 있는가?

---

### 3-4. 마스터 데이터 관리 테스트

**브라우저**: http://localhost:5173 (frontend-training)

**절차**:
1. 네비게이션 → "마스터 데이터"
2. 품목/공정 트리 확인
3. 데이터 추가/수정/삭제 테스트
4. 확인 사항:
   - ✅ 트리 구조가 정상적으로 표시되는가?
   - ✅ CRUD 작업이 동작하는가?

---

## 4단계: 통합 테스트

### 4-1. 전체 워크플로우 테스트

**시나리오: 신규 모델 학습 → 예측에서 사용**

1. **학습 앱에서 모델 학습**:
   - http://localhost:5173 (frontend-training)
   - "모델 학습" → Version: `integration-test-v1`
   - 학습 시작 및 완료 대기

2. **모델 파일 확인**:
   ```bash
   ls -la models/integration-test-v1/
   cat models/integration-test-v1/metrics.json | jq
   ```

3. **예측 앱에서 신규 모델 사용**:
   - http://localhost:5173 (frontend-prediction)
   - 예측 실행 (신규 모델 자동 사용됨)

4. **확인 사항**:
   - ✅ 학습 완료 후 metrics.json이 생성되었는가?
   - ✅ 예측이 정상 동작하는가?

---

### 4-2. 캐시 무효화 테스트 (P2 신규 기능)

```bash
# 1. 현재 모델의 manifest.json 백업
cp models/default/manifest.json models/default/manifest.json.backup

# 2. manifest.json 수정 (revision 변경)
cat models/default/manifest.json | jq '.revision = "test-modified"' > models/default/manifest.json.tmp
mv models/default/manifest.json.tmp models/default/manifest.json

# 3. 2-3초 대기 (mtime 기반 auto-refresh)
sleep 3

# 4. 예측 요청 (새 manifest 로드 확인)
curl -X POST http://localhost:8000/api/routing/predict \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"item_code": "TEST_ITEM", "context": {}}'

# 5. 백엔드 로그 확인
# 터미널 1에서 "manifest" 관련 로그 확인

# 6. 원본 복원
mv models/default/manifest.json.backup models/default/manifest.json
```

**확인 사항**:
- ✅ manifest.json 변경 후 자동으로 새 버전이 로드되는가?
- ✅ 예측이 계속 정상 동작하는가?

---

## 5단계: 성능 테스트 (선택)

### 5-1. 백엔드 테스트 실행

```bash
cd /workspaces/Routing_ML_4

# 환경 변수 설정
export JWT_SECRET_KEY="test-key-min-32-chars-long-do-not-use-prod"

# 전체 테스트 실행
source venv-linux/bin/activate
python -m pytest tests/backend -v --tb=short

# 예상: 56/56 tests PASSED
```

### 5-2. 프론트엔드 테스트 실행

```bash
# Frontend Training 테스트
cd frontend-training
npm run test

# Frontend Prediction 테스트
cd ../frontend-prediction
npm run test

# E2E 테스트 (Playwright)
npm run test:e2e
```

---

## 6단계: 정리 및 종료

### 종료 순서

1. **프론트엔드 서버 종료** (각 터미널에서 Ctrl+C):
   - 터미널 3: frontend-training
   - 터미널 4: frontend-prediction
   - 터미널 5: frontend-home

2. **백엔드 서버 종료**:
   - 터미널 1: uvicorn (Ctrl+C)

3. **로그 확인** (문제 발생 시):
   ```bash
   # 백엔드 로그 확인
   # 터미널 1의 출력 확인

   # 프론트엔드 로그 확인
   # 브라우저 개발자 도구 (F12) → Console 탭
   ```

---

## 문제 해결

### 문제 1: 백엔드 포트 이미 사용 중

**증상**: `Address already in use: 8000`

**해결**:
```bash
# 포트 사용 프로세스 확인
lsof -i :8000

# 프로세스 종료
kill -9 <PID>

# 또는 다른 포트 사용
uvicorn backend.api.main:app --host 0.0.0.0 --port 8001 --reload
```

---

### 문제 2: 프론트엔드 빌드 오류

**증상**: `Module not found` 또는 `Cannot find module`

**해결**:
```bash
# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install

# 캐시 클리어
npm cache clean --force
```

---

### 문제 3: CORS 에러

**증상**: 브라우저 콘솔에 `CORS policy` 에러

**해결**:
```bash
# 백엔드 환경 변수 확인
echo $CORS_ALLOWED_ORIGINS

# 프론트엔드 URL 추가
export CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:5174"

# 백엔드 재시작
```

---

### 문제 4: 로그인 실패

**증상**: `401 Unauthorized` 또는 로그인 불가

**해결**:
```bash
# JWT 시크릿 키 확인
echo $JWT_SECRET_KEY

# 올바른 시크릿 키 설정 (32자 이상)
export JWT_SECRET_KEY="local-dev-secret-key-min-32-chars-long-12345"

# 백엔드 재시작

# 기본 계정 확인 (backend/api/config.py)
# username: admin, password: admin123
```

---

### 문제 5: 모델 학습 실패

**증상**: Training UI에서 "failed" 상태

**해결**:
```bash
# 1. 백엔드 로그 확인 (터미널 1)
# "training" 또는 "error" 키워드 찾기

# 2. 데이터베이스 확인
ls -la routing_ml.db

# 3. 모델 디렉토리 권한 확인
ls -la models/
chmod -R 755 models/

# 4. 디스크 공간 확인
df -h
```

---

## 빠른 체크리스트

### ✅ 백엔드 확인
- [ ] 서버 실행됨 (http://localhost:8000)
- [ ] /health 응답 정상
- [ ] /docs 접속 가능
- [ ] 로그인 성공
- [ ] 예측 API 동작
- [ ] 학습 API 동작

### ✅ 프론트엔드 확인
- [ ] frontend-training 실행됨 (http://localhost:5173)
- [ ] frontend-prediction 실행됨
- [ ] frontend-home 실행됨 (http://localhost:8080)
- [ ] 로그인 동작
- [ ] UI 렌더링 정상

### ✅ P2 신규 기능 확인
- [ ] ModelTrainingPanel 표시됨
- [ ] 모델 학습 시작 가능
- [ ] 실시간 상태 업데이트 동작
- [ ] metrics.json 생성됨
- [ ] 캐시 무효화 동작 (manifest 변경 감지)

### ✅ 통합 테스트
- [ ] 신규 모델 학습 → 예측에서 사용
- [ ] 전체 워크플로우 동작
- [ ] 테스트 스위트 통과 (56/56)

---

## 다음 단계

로컬 테스트가 성공적으로 완료되면:

1. **스테이징 환경 테스트**: [docs/STAGING_ENVIRONMENT_TESTING_GUIDE.md](docs/STAGING_ENVIRONMENT_TESTING_GUIDE.md)
2. **프로덕션 배포**: [docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md](docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md)

---

## 추가 리소스

### 개발 도구
- **Backend API 문서**: http://localhost:8000/docs (Swagger UI)
- **Redoc**: http://localhost:8000/redoc (대체 API 문서)
- **브라우저 개발자 도구**: F12 (네트워크, 콘솔, 소스)

### 유용한 명령어
```bash
# 백엔드 로그 실시간 확인 (JSON 포맷)
# 터미널 1의 출력 확인

# 데이터베이스 직접 조회 (SQLite)
sqlite3 routing_ml.db "SELECT * FROM routing_data LIMIT 5;"

# 모델 파일 확인
ls -lah models/default/
cat models/default/manifest.json | jq

# 프론트엔드 빌드 (배포용)
cd frontend-training
npm run build
# 빌드 결과: dist/ 디렉토리
```

---

**작성일**: 2025-10-09
**대상**: 개발자 로컬 테스트
**예상 소요 시간**: 30분
