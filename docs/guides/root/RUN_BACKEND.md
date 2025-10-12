# 백엔드 수동 실행 가이드

## 방법 1: 터미널에서 직접 실행 (추천)

새 터미널을 열고 다음 명령어를 실행하세요:

```bash
cd /workspaces/Routing_ML_4

# 환경 변수 설정
export JWT_SECRET_KEY="local-dev-secret-key-min-32-chars-long-do-not-use-in-production-12345"
export DATABASE_URL="sqlite:///./routing_ml.db"
export CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:5174,http://localhost:8080"
export ENVIRONMENT="development"
export LOG_LEVEL="INFO"

# 가상환경 활성화
source venv-linux/bin/activate

# 백엔드 서버 실행
python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000 --reload
```

**성공 시 출력**:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using WatchFiles
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**확인**:
- 브라우저: http://localhost:8000/docs
- 터미널: `curl http://localhost:8000/health`

---

## 방법 2: 짧은 명령어

```bash
cd /workspaces/Routing_ML_4
source venv-linux/bin/activate
export JWT_SECRET_KEY="local-dev-secret-key-min-32-chars-long"
python -m uvicorn backend.api.main:app --reload
```

---

## 문제 해결

### 오류: "Could not import module backend.api.main"

**해결책 1**: 현재 디렉토리 확인
```bash
pwd
# 출력: /workspaces/Routing_ML_4 이어야 함

cd /workspaces/Routing_ML_4
```

**해결책 2**: Python 경로 확인
```bash
source venv-linux/bin/activate
which python
# 출력: /workspaces/Routing_ML_4/venv-linux/bin/python

python -c "import sys; print(sys.path)"
```

**해결책 3**: 모듈 직접 확인
```bash
python -c "from backend.api.main import app; print('OK')"
```

### 오류: "Address already in use"

**해결책**: 기존 프로세스 종료
```bash
lsof -i :8000
kill -9 <PID>
```

### 오류: "ModuleNotFoundError"

**해결책**: 의존성 재설치
```bash
pip install -r requirements.txt
```

---

## 프론트엔드 실행 (별도 터미널)

### 학습 앱 (터미널 2)
```bash
cd /workspaces/Routing_ML_4/frontend-training
npm run dev
```
**URL**: http://localhost:5173

### 예측 앱 (터미널 3)
```bash
cd /workspaces/Routing_ML_4/frontend-prediction
npm run dev -- --port 5174
```
**URL**: http://localhost:5174

---

## 빠른 체크리스트

- [ ] 터미널 1: 백엔드 실행 중
- [ ] 터미널 2: 학습 앱 실행 중
- [ ] 터미널 3: 예측 앱 실행 중
- [ ] http://localhost:8000/docs 접속 가능
- [ ] http://localhost:5173 접속 가능
- [ ] http://localhost:5174 접속 가능
- [ ] admin / admin123 로그인 가능

---

## 로그인 정보

- Username: `admin`
- Password: `admin123`

---

**다음 단계**: 브라우저에서 http://localhost:5173 열고 "모델 학습" 메뉴 확인!
