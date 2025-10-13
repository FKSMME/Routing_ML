# 빠른 시작 가이드

**업데이트:** 2025-10-13 14:40
**작업자:** Claude Code

---

## 한 번에 모두 실행하기

### 1단계: START_ALL_WINDOWS.bat 실행

프로젝트 루트 디렉토리에서:

```cmd
START_ALL_WINDOWS.bat
```

이 스크립트는 다음을 자동으로 실행합니다:
1. Backend Main API (포트 8000)
2. Frontend Home Dashboard (포트 3000)
3. Frontend Prediction UI (포트 5173)
4. Frontend Training UI (포트 5174)

### 2단계: 접속 확인

#### 로컬 접속 (서버 PC에서)
- 홈 대시보드: http://localhost:3000
- 라우팅 생성: http://localhost:5173
- 모델 학습: http://localhost:5174
- API 문서: http://localhost:8000/docs

#### 내부망 접속 (다른 PC에서)
- 홈 대시보드: **http://10.204.2.28:3000**
- 라우팅 생성: **http://10.204.2.28:5173**
- 모델 학습: **http://10.204.2.28:5174**
- API 문서: **http://10.204.2.28:8000/docs**

---

## 문제 해결

### CMD 창이 에러로 닫힌 경우

#### 원인 1: Python 가상환경 문제
```cmd
# 가상환경 확인
dir .venv\Scripts\python.exe

# 없으면 재생성
python -m venv .venv
.venv\Scripts\python.exe -m pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt
.venv\Scripts\python.exe -m pip install python-multipart
```

#### 원인 2: Node.js 모듈 누락
```cmd
# frontend-home 확인
cd frontend-home
npm install

# frontend-prediction 확인
cd ..\frontend-prediction
npm install

# frontend-training 확인
cd ..\frontend-training
npm install
```

#### 원인 3: 포트 충돌
```cmd
# 사용 중인 포트 확인
netstat -ano | findstr ":8000 :3000 :5173 :5174"

# 프로세스 종료 (PID 확인 후)
taskkill /PID [프로세스ID] /F
```

### 수동으로 하나씩 실행하기

문제를 찾기 위해 서비스를 하나씩 실행해보세요:

#### 1. 백엔드 실행
```cmd
run_backend_main.bat
```

에러 메시지를 확인하세요. 정상이면 다음으로 진행합니다.

#### 2. 홈 대시보드 실행
```cmd
run_frontend_home.bat
```

#### 3. 라우팅 생성 UI 실행
```cmd
run_frontend_prediction.bat
```

#### 4. 모델 학습 UI 실행
```cmd
run_frontend_training.bat
```

---

## 서비스 중지

### 방법 1: 각 콘솔 창에서
- `Ctrl + C` 입력
- 또는 창 닫기

### 방법 2: 명령어로 일괄 종료
```cmd
taskkill /FI "WINDOWTITLE eq Backend-*" /F
taskkill /FI "WINDOWTITLE eq Frontend-*" /F
```

---

## 자주 묻는 질문

### Q1: 다른 PC에서 접속이 안 됩니다
**A:** 다음을 확인하세요:
1. 같은 네트워크(10.204.x.x)에 있는지 확인
2. 방화벽 규칙 확인:
   ```cmd
   netsh advfirewall firewall show rule name=all | findstr "Routing-ML"
   ```
3. 서버에서 서비스가 실행 중인지 확인:
   ```cmd
   netstat -ano | findstr ":8000 :3000 :5173 :5174"
   ```

### Q2: 백엔드 에러가 발생합니다
**A:** 데이터베이스 연결을 확인하세요:
```python
python
>>> from backend.database import _connect
>>> conn = _connect()
```

### Q3: 프론트엔드가 백엔드를 찾지 못합니다
**A:** 백엔드가 포트 8000에서 실행 중인지 확인하세요:
```cmd
netstat -ano | findstr ":8000"
```

출력 예시:
```
TCP    0.0.0.0:8000    0.0.0.0:0    LISTENING    12345
```

### Q4: SSL 인증서 오류가 발생합니다
**A:** `.venv` 재생성 시 다음 명령을 사용하세요:
```cmd
.venv\Scripts\python.exe -m pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt
```

---

## 추가 정보

- 상세 배포 가이드: [server_deployment_2025-10-13.md](server_deployment_2025-10-13.md)
- 원본 Windows 설정 가이드: [WINDOWS_SETUP_GUIDE.md](../../../WINDOWS_SETUP_GUIDE.md)

---

**마지막 테스트:** 2025-10-13 14:40
**상태:** ✅ 정상 작동 확인
