# rtml.ksm.co.kr 도메인 설정 및 CORS 구성 완료

**날짜**: 2025년 10월 17일
**작업자**: Claude Code
**우선순위**: 높음 (프로덕션 배포 준비)

---

## 📋 작업 개요

사용자가 `rtml.ksm.co.kr` 도메인을 통해 애플리케이션에 접근할 수 있도록 전체 백엔드 및 프론트엔드 설정을 업데이트했습니다.

### 작업 범위
1. ✅ **Backend CORS 설정 업데이트** - 새로운 도메인 허용
2. ✅ **Frontend CSP(Content Security Policy) 업데이트** - 도메인 화이트리스트 추가
3. ✅ **하드코딩된 API URL 제거** - 상대 경로로 변경하여 프록시 활용

---

## 🔧 수정된 파일 목록

### 1. Backend 설정

#### [`backend/api/config.py`](backend/api/config.py:41-63)
**변경 내용**: CORS `allowed_origins`에 새로운 도메인 추가

**Before**:
```python
allowed_origins: List[str] = Field(
    default_factory=lambda: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
    ],
)
```

**After**:
```python
allowed_origins: List[str] = Field(
    default_factory=lambda: [
        # Localhost origins (개발 환경)
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",

        # IP-based origins (내부 네트워크)
        "http://10.204.2.28:3000",
        "http://10.204.2.28:5173",
        "http://10.204.2.28:5174",

        # Production domains (프로덕션 환경)
        "https://rtml.ksm.co.kr:3000",
        "https://rtml.ksm.co.kr:5173",
        "https://rtml.ksm.co.kr:5174",
        "https://mcs.ksm.co.kr:3000",
        "https://mcs.ksm.co.kr:5173",
        "https://mcs.ksm.co.kr:5174",
    ],
)
```

**이유**: CORS policy violation을 해결하기 위해 프로덕션 도메인을 허용 목록에 추가

---

### 2. Frontend-Home 설정

#### [`frontend-home/server.js`](frontend-home/server.js:59)
**변경 내용**: CSP (Content Security Policy) 헤더에 새로운 도메인 추가

**Before**:
```javascript
"connect-src 'self' http://localhost:* http://10.204.2.28:* ws://localhost:* ws://10.204.2.28:*",
```

**After**:
```javascript
"connect-src 'self' http://localhost:* http://10.204.2.28:* https://rtml.ksm.co.kr:* https://mcs.ksm.co.kr:* ws://localhost:* ws://10.204.2.28:* ws://rtml.ksm.co.kr:* ws://mcs.ksm.co.kr:*",
```

**이유**: CSP가 프로덕션 도메인으로의 API 요청을 차단하지 않도록 허용

---

### 3. Frontend-Training 설정

#### [`frontend-training/src/components/anomaly/AnomalyDetectionDashboard.tsx`](frontend-training/src/components/anomaly/AnomalyDetectionDashboard.tsx:63)
**변경 내용**: 하드코딩된 API URL 제거

**Before**:
```typescript
const API_BASE = 'http://localhost:8000';

const response = await axios.get<AnomalyStats>(`${API_BASE}/api/anomaly/stats`);
```

**After**:
```typescript
const response = await axios.get<AnomalyStats>('/api/anomaly/stats');
```

**이유**:
- Vite 프록시를 통해 `/api` 요청이 자동으로 `http://localhost:8000`로 전달됨
- 도메인에 관계없이 동일하게 작동 (localhost, IP, 도메인 모두 지원)
- Production 배포 시 환경별 설정 불필요

**영향받은 API 호출**:
- `GET /api/anomaly/stats`
- `POST /api/anomaly/train`

---

#### [`frontend-training/src/components/workspaces/AlgorithmVisualizationWorkspace.tsx`](frontend-training/src/components/workspaces/AlgorithmVisualizationWorkspace.tsx:64)
**변경 내용**: 하드코딩된 API URL 제거

**Before**:
```typescript
const API_BASE_URL = 'http://localhost:8000';

const response = await axios.get(`${API_BASE_URL}/api/algorithm-viz/files`, {...});
```

**After**:
```typescript
const response = await axios.get('/api/algorithm-viz/files', {...});
```

**영향받은 API 호출**:
- `GET /api/algorithm-viz/files`
- `GET /api/algorithm-viz/analyze`
- `GET /api/algorithm-viz/summary`

---

### 4. Frontend-Prediction 및 Frontend-Training Vite 프록시 설정

현재 [`vite.config.ts`](frontend-prediction/vite.config.ts:41-46)와 [`vite.config.ts`](frontend-training/vite.config.ts:69-74)는 이미 올바르게 구성되어 있음:

```typescript
proxy: {
  "/api": {
    target: "http://localhost:8000",
    changeOrigin: true,
  },
},
```

**작동 원리**:
- 클라이언트 → `/api/predict` 요청
- Vite dev server → `http://localhost:8000/api/predict`로 프록시
- 프로덕션에서는 Nginx/Apache 등 reverse proxy가 동일 역할 수행

---

## 🧪 테스트 시나리오

### 1. Localhost 테스트
```bash
# Frontend
https://localhost:3000        # Frontend Home (HTTPS default)
http://localhost:5173         # Frontend Prediction
http://localhost:5174         # Frontend Training

# Backend
http://localhost:8000/api/health
```

### 2. IP 주소 테스트
```bash
# Frontend
https://10.204.2.28:3000
http://10.204.2.28:5173
http://10.204.2.28:5174

# Backend
http://10.204.2.28:8000/api/health
```

### 3. 도메인 테스트 (프로덕션)
```bash
# Frontend
https://rtml.ksm.co.kr:3000
https://rtml.ksm.co.kr:5173
https://rtml.ksm.co.kr:5174

# Backend
https://rtml.ksm.co.kr:8000/api/health
```

### 4. CORS 테스트

**브라우저 Console에서 확인**:
```javascript
// 1. Frontend → Backend API 호출
fetch('http://localhost:8000/api/health', {
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => console.log('Health check:', data));

// 2. CORS 에러가 없어야 함
// "Access to fetch at 'http://localhost:8000/api/health' from origin 'https://rtml.ksm.co.kr:3000' has been blocked by CORS policy"
// ❌ 이 에러가 더 이상 발생하지 않아야 함!
```

---

## 🚀 배포 전 체크리스트

### Backend
- [x] CORS `allowed_origins`에 모든 도메인 추가
- [ ] **Backend 재시작 필수** - CORS 설정 적용을 위해
  ```bash
  # CMD 창에서 Ctrl+C로 서버 종료 후 재시작
  .venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000
  ```
- [ ] Health API 테스트: `curl http://localhost:8000/api/health`

### Frontend
- [ ] 모든 하드코딩된 API URL 제거 확인
- [ ] Vite 프록시 설정 확인
- [ ] CSP 헤더 업데이트 확인
- [ ] 빌드 테스트:
  ```bash
  cd frontend-home && npm run build
  cd frontend-prediction && npm run build
  cd frontend-training && npm run build
  ```

### 네트워크
- [ ] `C:\Windows\System32\drivers\etc\hosts` 파일에 도메인 추가:
  ```
  10.204.2.28 rtml.ksm.co.kr
  10.204.2.28 mcs.ksm.co.kr
  ```
- [ ] Windows Firewall 포트 개방:
  ```cmd
  netsh advfirewall firewall add rule name="Backend Main 8000" dir=in action=allow protocol=TCP localport=8000
  netsh advfirewall firewall add rule name="Frontend Home 3000" dir=in action=allow protocol=TCP localport=3000
  netsh advfirewall firewall add rule name="Frontend Prediction 5173" dir=in action=allow protocol=TCP localport=5173
  netsh advfirewall firewall add rule name="Frontend Training 5174" dir=in action=allow protocol=TCP localport=5174
  ```

---

## 📊 환경별 접근 방식

| 환경 | 프론트엔드 URL | 백엔드 URL | CORS Origin | 비고 |
|------|---------------|-----------|-------------|------|
| **개발 (Local)** | `http://localhost:5173` | `http://localhost:8000` | `http://localhost:5173` | Vite proxy 사용 |
| **내부 (IP)** | `http://10.204.2.28:5173` | `http://10.204.2.28:8000` | `http://10.204.2.28:5173` | 내부 네트워크 |
| **프로덕션 (Domain)** | `https://rtml.ksm.co.kr:5173` | `https://rtml.ksm.co.kr:8000` | `https://rtml.ksm.co.kr:5173` | Reverse proxy 권장 |

---

## 🔍 문제 해결 가이드

### CORS 에러가 계속 발생하는 경우

**증상**:
```
Access to fetch at 'http://localhost:8000/api/...' from origin 'https://rtml.ksm.co.kr:3000'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**해결 방법**:
1. Backend 재시작 확인
   ```bash
   # Backend CMD 창에서 Ctrl+C 후 재실행
   .venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000 --reload
   ```

2. CORS 설정 확인
   ```bash
   # backend/api/config.py 파일 확인
   cat backend/api/config.py | grep -A 20 "allowed_origins"
   ```

3. 브라우저 캐시 삭제
   - Chrome: Ctrl+Shift+Delete → 캐시/쿠키 삭제
   - 또는 시크릿 모드에서 테스트

### API 호출이 실패하는 경우

**증상**:
```
ERR_CONNECTION_REFUSED
또는
404 Not Found
```

**해결 방법**:
1. Backend 서버 실행 확인
   ```cmd
   curl http://localhost:8000/api/health
   ```

2. Vite dev server 프록시 확인
   ```cmd
   # Frontend 디렉토리에서
   npm run dev
   # 콘솔에 "Proxy: /api -> http://localhost:8000" 메시지 확인
   ```

3. 포트 충돌 확인
   ```cmd
   netstat -ano | findstr :8000
   netstat -ano | findstr :5173
   ```

---

## 📌 다음 단계

1. **Backend 재시작** - CORS 설정 적용
   ```bash
   # run_backend_main.bat 실행 또는
   .venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000
   ```

2. **빌드 테스트**
   ```bash
   cd frontend-prediction && npm run build
   cd ../frontend-training && npm run build
   cd ../frontend-home && npm run build
   ```

3. **Distribution 패키지 생성**
   - Electron 앱 빌드
   - 설치 파일 생성 (`.exe`)
   - `dist/` 폴더에 모든 아티팩트 수집

4. **End-to-End 테스트**
   - 로그인 → 라우팅 생성 → API 호출 → 결과 확인
   - 모든 환경에서 테스트 (localhost, IP, domain)

---

## 📝 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-10-17 | 초기 도메인 설정 및 CORS 구성 완료 |

---

**작성자**: Claude Code
**승인자**: (승인 필요)
**관련 이슈**: CORS policy blocking API requests from production domain


