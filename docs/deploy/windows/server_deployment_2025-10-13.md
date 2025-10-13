# Windows 서버 배포 가이드

**작성일:** 2025-10-13 14:35
**작업자:** Claude Code
**목적:** 내부망 서버 모드 실행 및 다중 사용자 접속 설정

---

## 서버 정보

### 서버 IP 주소
- **메인 IP:** `10.204.2.28`
- **서브넷:** `10.204.0.0/16` (내부망 전용)

### 방화벽 설정
내부망(10.204.x.x) 전용으로 다음 포트를 개방했습니다:

| 포트 | 서비스 | 방화벽 규칙 이름 |
|------|--------|------------------|
| 8000 | Backend Main API | Routing-ML Backend Main (Internal) |
| 3000 | Frontend Home Dashboard | Routing-ML Frontend Home (Internal) |
| 5173 | Frontend Prediction UI | Routing-ML Frontend Prediction (Internal) |
| 5174 | Frontend Training UI | Routing-ML Frontend Training (Internal) |

---

## 접속 주소

### 서버(호스트) 로컬 접속
| 서비스 | URL | 용도 |
|--------|-----|------|
| 홈 대시보드 | http://localhost:3000 | 통합 대시보드 |
| 라우팅 생성 | http://localhost:5173 | ML 기반 라우팅 자동 생성 |
| 모델 학습 | http://localhost:5174 | 신규 데이터로 모델 재학습 |
| Backend API Docs | http://localhost:8000/docs | FastAPI Swagger 문서 |

### 내부망 다른 PC에서 접속
| 서비스 | URL | 용도 |
|--------|-----|------|
| 홈 대시보드 | **http://10.204.2.28:3000** | 통합 대시보드 |
| 라우팅 생성 | **http://10.204.2.28:5173** | ML 기반 라우팅 자동 생성 |
| 모델 학습 | **http://10.204.2.28:5174** | 신규 데이터로 모델 재학습 |
| Backend API Docs | **http://10.204.2.28:8000/docs** | FastAPI Swagger 문서 |

---

## 백엔드 구조 개선

### 기존 구조 (잘못된 설정)
- `training_app.py` → 포트 8001 (훈련 전용)
- `prediction_app.py` → 포트 8002 (예측 전용)
- 프론트엔드는 포트 8000을 기대 → **포트 불일치 문제 발생**

### 새로운 구조 (올바른 설정)
- **`app.py`** → 포트 8000 (통합 백엔드)
  - 모든 라우터 포함 (훈련 + 예측 + 기타 기능)
  - 프론트엔드와 포트 일치

### 실행 스크립트
새로 생성된 파일: `run_backend_main.bat`

```batch
.venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000 --reload
```

---

## 서버 실행 방법

### 방법 1: 개별 실행 (권장)

#### 1. 백엔드 실행
```cmd
run_backend_main.bat
```

#### 2. 프론트엔드 실행 (3개)
```cmd
run_frontend_home.bat
run_frontend_prediction.bat
run_frontend_training.bat
```

### 방법 2: 통합 실행 (기존 스크립트 사용 불가)
> **주의:** 기존 `START_ALL_WINDOWS.bat`는 잘못된 포트(8001, 8002)를 사용합니다.
> 수정이 필요하면 위의 개별 실행 스크립트를 참고하세요.

---

## Python 가상환경 재생성

### 문제점
- 기존 `.venv`는 Linux/Dev Container 환경용으로 생성됨
- Windows에서는 호환되지 않아 재생성 필요

### 해결 과정
1. 기존 가상환경 백업
   ```bash
   mv .venv .venv_old
   ```

2. 새 가상환경 생성
   ```bash
   python -m venv .venv
   ```

3. 패키지 설치 (SSL 인증서 문제 해결)
   ```bash
   .venv\Scripts\python.exe -m pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt
   ```

4. 추가 패키지 설치
   ```bash
   .venv\Scripts\python.exe -m pip install python-multipart
   ```

### 설치된 주요 패키지
- FastAPI 0.103.2
- Pydantic 2.8.2 ✅ (v1 → v2 업그레이드)
- uvicorn 0.27.1
- pandas, numpy, scikit-learn
- pyodbc (MSSQL 연결)
- python-multipart (Form 데이터 처리)

---

## 네트워크 설정 확인

### 서버측 설정
모든 서비스가 `0.0.0.0`으로 바인딩되어 외부 접속을 허용합니다:

#### 백엔드 (uvicorn)
```bash
--host 0.0.0.0 --port 8000
```

#### 프론트엔드 (Vite)
- **frontend-prediction/vite.config.ts** (Line 35)
  ```typescript
  server: {
    host: "0.0.0.0",
    port: 5173,
  }
  ```

- **frontend-training/vite.config.ts** (Line 63)
  ```typescript
  server: {
    host: "0.0.0.0",
    port: 5174,
  }
  ```

- **frontend-home/server.js** (Line 22)
  ```javascript
  server.listen(PORT, '0.0.0.0', () => { ... });
  ```

### 클라이언트측 접속 확인
1. 서버와 같은 네트워크(10.204.x.x)에 있는지 확인
2. 브라우저에서 `http://10.204.2.28:3000` 접속
3. 방화벽이나 보안 프로그램이 차단하는지 확인

---

## 문제 해결

### 1. 접속이 안 되는 경우
#### 서버에서 확인
```cmd
netstat -ano | findstr :8000
netstat -ano | findstr :3000
netstat -ano | findstr :5173
netstat -ano | findstr :5174
```

출력 예시:
```
TCP    0.0.0.0:8000    0.0.0.0:0    LISTENING    12345
```

#### 방화벽 규칙 확인
```cmd
netsh advfirewall firewall show rule name=all | findstr "Routing-ML"
```

### 2. 포트 충돌
```cmd
# 사용 중인 프로세스 확인
netstat -ano | findstr :8000

# 프로세스 종료
taskkill /PID [프로세스ID] /F
```

### 3. 백엔드 에러
#### 로그 확인
- 백엔드 콘솔 창에서 에러 메시지 확인
- `logs/` 디렉토리의 로그 파일 확인

#### 데이터베이스 연결 확인
```python
python
>>> from backend.database import _connect
>>> conn = _connect()
# 에러가 없으면 정상
```

### 4. 프론트엔드 빌드 에러
```cmd
cd frontend-prediction
npm install
npm run dev
```

---

## 보안 고려사항

### 현재 설정 (개발/내부망 환경)
- ✅ 방화벽: 내부망(10.204.0.0/16)만 허용
- ⚠️ HTTPS: 비활성화 (HTTP 사용)
- ⚠️ JWT 쿠키: HTTPS 체크 비활성화

### 외부 노출 시 필수 조치
1. **HTTPS 활성화**
   - SSL 인증서 설치
   - `JWT_COOKIE_SECURE=true`

2. **인증 강화**
   - JWT 시크릿 키 재생성
   - 비밀번호 정책 강화

3. **방화벽**
   - 특정 IP만 허용하도록 규칙 수정
   - VPN 사용 권장

---

## 서비스 중지

### 개별 종료
각 서비스의 콘솔 창에서:
- `Ctrl + C` 입력
- 또는 콘솔 창 닫기

### 일괄 종료
```cmd
taskkill /FI "WINDOWTITLE eq Backend-*" /F
taskkill /FI "WINDOWTITLE eq Frontend-*" /F
```

또는 특정 포트 프로세스 종료:
```cmd
FOR /F "tokens=5" %P IN ('netstat -ano ^| findstr :8000') DO taskkill /PID %P /F
FOR /F "tokens=5" %P IN ('netstat -ano ^| findstr :3000') DO taskkill /PID %P /F
FOR /F "tokens=5" %P IN ('netstat -ano ^| findstr :5173') DO taskkill /PID %P /F
FOR /F "tokens=5" %P IN ('netstat -ano ^| findstr :5174') DO taskkill /PID %P /F
```

---

## 성능 최적화 (선택사항)

### 1. 프로덕션 빌드
프론트엔드를 빌드하여 정적 파일로 서빙하면 더 빠릅니다:

```cmd
cd frontend-prediction
npm run build

cd ../frontend-training
npm run build
```

### 2. 백엔드 워커 수 증가
```batch
.venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000 --workers 4
```

### 3. Nginx 리버스 프록시
모든 서비스를 80번 포트로 통합하려면 Nginx 사용을 권장합니다.

---

## 다음 단계

### 즉시 가능
1. ✅ 서버 실행 완료
2. ✅ 내부망 접속 테스트
3. 다른 PC에서 `http://10.204.2.28:3000` 접속 확인

### 추가 개선 (선택)
1. Windows 서비스로 등록 (자동 시작)
2. 모니터링 대시보드 추가
3. 자동 백업 스크립트
4. 로그 로테이션

---

**작업 완료:** 2025-10-13 14:35
**상태:** ✅ 서버 모드 실행 완료, 내부망 접속 가능
