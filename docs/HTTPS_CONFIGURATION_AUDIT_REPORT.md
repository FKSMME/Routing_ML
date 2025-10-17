# HTTPS 설정 전수 점검 보고서

**작성일**: 2025년 10월 17일
**프로젝트**: Routing ML Auto-Generation System
**작성자**: Claude Code
**점검 범위**: 전체 시스템 HTTPS/SSL/URL 설정

---

## 📋 Executive Summary

전체 시스템에 대한 HTTPS 설정 점검을 완료했습니다. **3개의 Frontend 서비스는 HTTPS를 지원**하지만, **Backend API는 HTTP만 지원**하는 **혼합 구성** 상태입니다. 7개의 중요한 보안 이슈와 다수의 개선 권장사항을 발견했습니다.

### 긴급 조치 필요 (High Priority)
1. ⚠️ Backend API HTTPS 미지원
2. ⚠️ JWT Cookie Secure 플래그 비활성화
3. ⚠️ JWT Secret Key 기본값 사용 (보안 취약)
4. ⚠️ CSP에 HTTPS 프로토콜 누락

---

## 🔍 1. 인증서 현황

### 📁 위치: `certs/`

| 파일명 | 용도 | 상태 |
|--------|------|------|
| `rtml.ksm.co.kr.crt` | 프로덕션 도메인 인증서 | ✅ 존재 |
| `rtml.ksm.co.kr.key` | 프로덕션 도메인 개인키 | ✅ 존재 |
| `localhost.key` | Localhost 개인키 | ✅ 존재 |
| `ksm.pem`, `ksm-root.pem` | CA 인증서 체인 | ✅ 존재 |
| `ca-bundle.pem` | CA 번들 | ✅ 존재 |
| `corp-chain.pem` | 기업 인증서 체인 | ✅ 존재 |
| `openssl.conf` | OpenSSL 설정 | ✅ 존재 |

**결론**: 인증서 파일은 모두 준비되어 있음. ✅

---

## 🔧 2. Backend API (FastAPI)

### 파일: `backend/api/config.py`

#### CORS 설정 (Lines 41-84)
```python
allowed_origins: List[str] = Field(
    default_factory=lambda: [
        # HTTP - Localhost
        "http://localhost:3000", "http://127.0.0.1:3000",
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        # HTTPS - Localhost
        "https://localhost:3000", "https://127.0.0.1:3000",
        "https://localhost:5173", "https://127.0.0.1:5173",
        "https://localhost:5174", "https://127.0.0.1:5174",
        # HTTP - IP Address (10.204.2.28)
        "http://10.204.2.28:3000", ":5173", ":5174",
        # HTTPS - IP Address
        "https://10.204.2.28:3000", ":5173", ":5174",
        # HTTP/HTTPS - Production Domains
        "http://rtml.ksm.co.kr:3000", ":5173", ":5174",
        "https://rtml.ksm.co.kr:3000", ":5173", ":5174",
        "http://mcs.ksm.co.kr:3000", ":5173", ":5174",
        "https://mcs.ksm.co.kr:3000", ":5173", ":5174",
    ],
)
```

**상태**: ✅ HTTP와 HTTPS 모두 허용

#### JWT 설정 (Lines 111-141)

⚠️ **Critical Issues**:

```python
jwt_secret_key: str = Field(default="INSECURE-CHANGE-ME-IN-PRODUCTION")  # 🚨 보안 취약!
jwt_algorithm: str = Field(default="HS256")
jwt_access_token_expire_minutes: int = Field(default=60)
jwt_cookie_name: str = Field(default="routing_ml_session")
jwt_cookie_httponly: bool = Field(default=True)
jwt_cookie_samesite: str = Field(default="lax")
jwt_cookie_secure: bool = Field(default=False)  # 🚨 HTTPS에서 False!
```

**문제점**:
1. **JWT Secret Key가 기본값** - 프로덕션에서 반드시 변경 필요
2. **Cookie Secure 플래그가 False** - HTTPS 환경에서도 쿠키가 HTTP로 전송됨

**권장 조치**:
```python
jwt_secret_key: str = Field(default_factory=lambda: os.getenv("JWT_SECRET_KEY", "INSECURE-CHANGE-ME-IN-PRODUCTION"))
jwt_cookie_secure: bool = Field(default=True)  # HTTPS 환경에서 True로 변경
```

#### API 서버 설정 (Lines 161-167)

```python
api_host: str = Field(default="0.0.0.0")
api_port: int = Field(default=8000)
```

**현재 상태**: HTTP만 지원 (포트 8000)

### 파일: `run_backend_main.bat`

```batch
echo Starting Main Backend Service on http://0.0.0.0:8000
echo API Docs: http://localhost:8000/docs

.venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000 --reload
```

⚠️ **문제**: HTTPS 지원 없음

**HTTPS 활성화 방법**:
```batch
.venv\Scripts\python.exe -m uvicorn backend.api.app:app ^
  --host 0.0.0.0 --port 8000 ^
  --ssl-keyfile=certs/rtml.ksm.co.kr.key ^
  --ssl-certfile=certs/rtml.ksm.co.kr.crt ^
  --reload
```

---

## 🌐 3. Frontend Home (Node.js + Express-like)

### 파일: `frontend-home/server.js`

#### HTTPS 설정 (Lines 7-16)
```javascript
const PORT = Number(process.env.PORT || 3000);
const USE_HTTPS = process.env.USE_HTTPS === "true" || false;
const HOST = "0.0.0.0";
const API_TARGET = process.env.API_TARGET || "http://localhost:8000";

// SSL Certificate paths
const SSL_KEY = path.join(__dirname, "../certs/rtml.ksm.co.kr.key");
const SSL_CERT = path.join(__dirname, "../certs/rtml.ksm.co.kr.crt");
```

**상태**: ✅ HTTPS 지원 (`USE_HTTPS` 환경 변수로 제어)

#### CSP 설정 (Lines 58-66)

⚠️ **문제**:
```javascript
"connect-src 'self' http://localhost:* http://10.204.2.28:* http://rtml.ksm.co.kr:* http://mcs.ksm.co.kr:* ws://localhost:* ws://10.204.2.28:* ws://rtml.ksm.co.kr:* ws://mcs.ksm.co.kr:*"
```

**누락된 프로토콜**:
- `https://` (HTTPS 연결)
- `wss://` (Secure WebSocket)

**수정 필요**:
```javascript
"connect-src 'self' " +
  "http://localhost:* https://localhost:* " +
  "http://10.204.2.28:* https://10.204.2.28:* " +
  "http://rtml.ksm.co.kr:* https://rtml.ksm.co.kr:* " +
  "http://mcs.ksm.co.kr:* https://mcs.ksm.co.kr:* " +
  "ws://localhost:* wss://localhost:* " +
  "ws://10.204.2.28:* wss://10.204.2.28:* " +
  "ws://rtml.ksm.co.kr:* wss://rtml.ksm.co.kr:* " +
  "ws://mcs.ksm.co.kr:* wss://mcs.ksm.co.kr:*"
```

### 파일: `run_frontend_home.bat`

```batch
echo Starting Home Dashboard with HTTPS support
echo   - HTTP:  http://localhost:3000
echo   - HTTPS: https://localhost:3000
echo   - Domain: https://rtml.ksm.co.kr:3000

set USE_HTTPS=true
node server.js
```

**상태**: ✅ HTTPS 기본 활성화

---

## ⚛️ 4. Frontend Prediction (React + Vite)

### 파일: `frontend-prediction/vite.config.ts`

#### HTTPS 설정 (Lines 40-43)
```typescript
server: {
  host: "0.0.0.0",
  port: 5173,
  https: {
    key: fs.readFileSync(path.resolve(__dirname, "../certs/rtml.ksm.co.kr.key")),
    cert: fs.readFileSync(path.resolve(__dirname, "../certs/rtml.ksm.co.kr.crt")),
  },
  // ...
}
```

**상태**: ✅ HTTPS 활성화

#### API Proxy 설정 (Lines 47-52)
```typescript
proxy: {
  "/api": {
    target: "http://localhost:8000",  // Backend는 HTTP
    changeOrigin: true,
    secure: false,  // 자체 서명 인증서 허용
  },
}
```

**상태**: ⚠️ Backend가 HTTP이므로 `secure: false` 필요 (현재는 적절)

### 파일: `frontend-prediction/src/lib/apiClient.ts`

```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",  // ✅ 상대 경로 사용
  timeout: 60_000,
  withCredentials: true,
});
```

**상태**: ✅ 하드코딩 없음, 프록시 활용

---

## 🧠 5. Frontend Training (React + Vite)

### 파일: `frontend-training/vite.config.ts`

동일 설정 (포트만 5174로 다름):
```typescript
server: {
  port: 5174,
  https: {
    key: fs.readFileSync(path.resolve(__dirname, "../certs/rtml.ksm.co.kr.key")),
    cert: fs.readFileSync(path.resolve(__dirname, "../certs/rtml.ksm.co.kr.crt")),
  },
}
```

**상태**: ✅ HTTPS 활성화

---

## 🖥️ 6. Server Monitor Dashboard

### 파일: `scripts/server_monitor_dashboard_v5_1.py`

#### 버전 정보 (Lines 31-34)
```python
__version__ = "5.2.2"
__build_date__ = "2025-10-17"
```

#### 서비스 설정 (Lines 106-151)

```python
SERVICES: Tuple[Service, ...] = (
    Service(
        key="backend",
        name="Backend API",
        check_url="http://localhost:8000/api/health",  # ⚠️ HTTP
        links=(
            ("Local", "http://localhost:8000/docs"),
            ("Domain", "http://rtml.ksm.co.kr:8000/docs"),
        ),
    ),
    Service(
        key="home",
        check_url="https://localhost:3000/",  # ✅ HTTPS
        links=(
            ("Local", "https://localhost:3000"),
            ("Domain", "https://rtml.ksm.co.kr:3000"),
        ),
    ),
    Service(
        key="prediction",
        check_url="https://localhost:5173/",  # ✅ HTTPS
        links=(
            ("Local", "https://localhost:5173"),
            ("Domain", "https://rtml.ksm.co.kr:5173"),
        ),
    ),
    Service(
        key="training",
        check_url="https://localhost:5174/",  # ✅ HTTPS
        links=(
            ("Local", "https://localhost:5174"),
            ("Domain", "https://rtml.ksm.co.kr:5174"),
        ),
    ),
)
```

**일관성 문제**: Backend만 HTTP, 나머지는 HTTPS

#### SSL Context (Lines 166-169)
```python
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE
```

**상태**: ✅ 자체 서명 인증서 허용

---

## 📊 7. 전체 시스템 HTTPS 현황

| 컴포넌트 | 프로토콜 | 포트 | HTTPS 지원 | 인증서 | 상태 |
|----------|---------|------|------------|--------|------|
| **Backend API** | HTTP | 8000 | ❌ NO | N/A | HTTP만 지원 |
| **Frontend Home** | HTTPS | 3000 | ✅ YES | rtml.ksm.co.kr | 정상 작동 |
| **Frontend Prediction** | HTTPS | 5173 | ✅ YES | rtml.ksm.co.kr | 정상 작동 |
| **Frontend Training** | HTTPS | 5174 | ✅ YES | rtml.ksm.co.kr | 정상 작동 |
| **Neo4j Browser** | HTTP | 7474 | ❌ NO | N/A | 하드코딩 |

---

## 🚨 8. 발견된 중요 이슈

### Priority 1 (Critical - 즉시 조치 필요)

#### 1. Backend API HTTPS 미지원 ⚠️
- **파일**: `run_backend_main.bat`
- **문제**: Uvicorn이 HTTP만 제공
- **영향**: API 통신이 암호화되지 않음 (로컬 개발은 괜찮지만 프로덕션은 위험)
- **해결**:
  ```batch
  .venv\Scripts\python.exe -m uvicorn backend.api.app:app ^
    --host 0.0.0.0 --port 8000 ^
    --ssl-keyfile=certs/rtml.ksm.co.kr.key ^
    --ssl-certfile=certs/rtml.ksm.co.kr.crt ^
    --reload
  ```

#### 2. JWT Cookie Secure 플래그 비활성화 ⚠️
- **파일**: `backend/api/config.py` Line 141
- **문제**: `jwt_cookie_secure: bool = Field(default=False)`
- **영향**: HTTPS 환경에서도 쿠키가 HTTP로 전송될 수 있음
- **해결**:
  ```python
  jwt_cookie_secure: bool = Field(default=True)
  ```

#### 3. JWT Secret Key 기본값 사용 🚨
- **파일**: `backend/api/config.py` Line 112
- **문제**: `jwt_secret_key: str = Field(default="INSECURE-CHANGE-ME-IN-PRODUCTION")`
- **영향**: 심각한 보안 취약점 - JWT 토큰이 쉽게 위조될 수 있음
- **해결**:
  ```python
  jwt_secret_key: str = Field(
      default_factory=lambda: os.getenv("JWT_SECRET_KEY", "INSECURE-CHANGE-ME-IN-PRODUCTION")
  )
  ```
  환경 변수 설정:
  ```cmd
  set JWT_SECRET_KEY=your-very-long-random-secret-key-here-minimum-32-characters
  ```

#### 4. CSP에 HTTPS 프로토콜 누락 ⚠️
- **파일**: `frontend-home/server.js` Line 64
- **문제**: `connect-src`에 `https://`와 `wss://` 누락
- **영향**: HTTPS API 호출 및 보안 WebSocket 연결 차단 가능
- **해결**: 위 섹션 3 참고

### Priority 2 (Medium - 개선 권장)

#### 5. 시작 스크립트 문구 불일치
- **파일**: `run_frontend_prediction.bat`, `run_frontend_training.bat`
- **문제**: "http://localhost:5173" 표시하지만 실제로는 HTTPS로 실행됨
- **해결**: 배치 파일 echo 문구를 "https://"로 수정

#### 6. Neo4j URL 하드코딩
- **파일**: `config/workflow_settings.json` Line 1052
- **문제**: `"neo4j_browser_url": "http://localhost:7474"` 하드코딩
- **해결**: 환경 변수로 설정 가능하도록 변경

#### 7. API Proxy secure: false
- **파일**: Vite config 파일들
- **문제**: `secure: false` 설정
- **영향**: 로컬 개발에서는 괜찮지만, 프로덕션에서는 보안 위험
- **해결**: 프로덕션 빌드 시 `secure: true`로 변경하거나 Backend를 HTTPS로 변경

---

## 📝 9. 하드코딩된 URL 목록

### Backend API
- `http://localhost:8000` - `run_backend_main.bat`, 여러 설정 파일
- `http://10.204.2.28:8000` - 내부 네트워크 (문서)

### Frontend 서비스
- `http://localhost:3000` - 실제로는 HTTPS
- `http://localhost:5173` - 실제로는 HTTPS
- `http://localhost:5174` - 실제로는 HTTPS

### Neo4j
- `http://localhost:7474` - `workflow_settings.json`

### 권장사항
- 모든 URL을 환경 변수로 설정 가능하도록 변경
- `.env.production` 파일 생성하여 프로덕션 URL 관리

---

## ✅ 10. 권장 조치 사항

### 즉시 조치 (High Priority)

#### A. Backend HTTPS 활성화
1. `run_backend_main.bat` 수정:
   ```batch
   .venv\Scripts\python.exe -m uvicorn backend.api.app:app ^
     --host 0.0.0.0 --port 8000 ^
     --ssl-keyfile=certs/rtml.ksm.co.kr.key ^
     --ssl-certfile=certs/rtml.ksm.co.kr.crt ^
     --reload
   ```

2. Vite proxy 설정 업데이트 (https로 변경):
   ```typescript
   proxy: {
     "/api": {
       target: "https://localhost:8000",  // HTTP → HTTPS
       changeOrigin: true,
       secure: false,  // 자체 서명 인증서이므로 유지
     },
   }
   ```

3. 서버 모니터 URL 업데이트:
   ```python
   Service(
       key="backend",
       check_url="https://localhost:8000/api/health",  # HTTP → HTTPS
       links=(
           ("Local", "https://localhost:8000/docs"),
           ("Domain", "https://rtml.ksm.co.kr:8000/docs"),
       ),
   )
   ```

#### B. JWT 보안 강화
1. `backend/api/config.py` 수정:
   ```python
   jwt_secret_key: str = Field(
       default_factory=lambda: os.getenv("JWT_SECRET_KEY", "INSECURE-CHANGE-ME-IN-PRODUCTION")
   )
   jwt_cookie_secure: bool = Field(default=True)
   ```

2. 환경 변수 설정 (.env 파일 생성):
   ```bash
   JWT_SECRET_KEY=your-super-secret-key-minimum-32-characters-long-use-random-generator
   ```

#### C. CSP 업데이트
`frontend-home/server.js` 수정:
```javascript
"connect-src 'self' " +
  "http://localhost:* https://localhost:* " +
  "http://10.204.2.28:* https://10.204.2.28:* " +
  "http://rtml.ksm.co.kr:* https://rtml.ksm.co.kr:* " +
  "http://mcs.ksm.co.kr:* https://mcs.ksm.co.kr:* " +
  "ws://localhost:* wss://localhost:* " +
  "ws://10.204.2.28:* wss://10.204.2.28:* " +
  "ws://rtml.ksm.co.kr:* wss://rtml.ksm.co.kr:* " +
  "ws://mcs.ksm.co.kr:* wss://mcs.ksm.co.kr:*"
```

### 중기 조치 (Medium Priority)

1. **배치 파일 문구 수정**
   - `run_frontend_prediction.bat`, `run_frontend_training.bat`
   - "http://" → "https://" 표시

2. **Neo4j URL 설정 가능하도록 변경**
   - `workflow_settings.json`에서 환경 변수 참조로 변경

3. **.env 파일 생성**
   - `.env.development` - 개발 환경
   - `.env.production` - 프로덕션 환경
   - VITE_API_URL, JWT_SECRET_KEY 등 설정

4. **문서 업데이트**
   - README에 HTTPS 설정 가이드 추가
   - 환경 변수 설정 방법 문서화

### 장기 조치 (Long Term)

1. **Reverse Proxy 도입 (Nginx/Caddy)**
   - 중앙 집중식 SSL 종료
   - 포트 통합 (443 포트로 모든 서비스 제공)
   - 자동 HTTPS 인증서 갱신 (Let's Encrypt)

2. **HTTPS 전용 모드 구현**
   - HTTP 요청 자동 HTTPS 리다이렉트
   - HSTS (HTTP Strict Transport Security) 헤더 추가

3. **프로덕션 배포 프로세스 구축**
   - CI/CD 파이프라인
   - 자동 인증서 배포
   - 보안 감사 자동화

---

## 📚 11. 관련 문서

- [HTTPS 설정 가이드](implementation/2025-10-17-https-ssl-configuration.md)
- [도메인 설정 가이드](implementation/2025-10-17-domain-configuration-rtml-ksm-co-kr.md)
- [서버 모니터 HTTPS 업데이트](implementation/2025-10-17-server-monitor-https-update.md)
- [빌드 완료 보고서](BUILD_COMPLETE.md)

---

## 🎯 12. 체크리스트

### 보안 체크리스트

- [ ] JWT Secret Key 변경 (환경 변수 사용)
- [ ] JWT Cookie Secure 플래그 활성화
- [ ] Backend API HTTPS 활성화
- [ ] CSP에 HTTPS/WSS 프로토콜 추가
- [ ] Neo4j URL 환경 변수화
- [ ] .env 파일 생성 및 .gitignore 추가
- [ ] CORS 정책 프로덕션 재검토
- [ ] SSL 인증서 만료일 확인 (10년 유효)

### 기능 테스트 체크리스트

- [ ] Backend HTTPS 접속 테스트
- [ ] Frontend → Backend HTTPS API 호출 테스트
- [ ] 로그인/로그아웃 JWT 쿠키 테스트
- [ ] WebSocket 연결 테스트 (WSS)
- [ ] Domain URL 접속 테스트 (rtml.ksm.co.kr)
- [ ] 서버 모니터 모든 버튼 테스트
- [ ] 브라우저 인증서 경고 처리 확인

---

## 📞 13. 지원 정보

### 인증서 관련
- 인증서 위치: `C:\Users\syyun\Documents\GitHub\Routing_ML_251014\certs\`
- 유효 기간: 10년 (자체 서명 인증서)
- 도메인: rtml.ksm.co.kr, localhost, mcs.ksm.co.kr

### 포트 정보
- Backend API: 8000 (HTTP/HTTPS)
- Frontend Home: 3000 (HTTPS)
- Frontend Prediction: 5173 (HTTPS)
- Frontend Training: 5174 (HTTPS)
- Neo4j: 7474 (HTTP)

---

**보고서 작성 완료**: 2025년 10월 17일
**다음 검토 일정**: Backend HTTPS 활성화 후 재검토
**작성자**: Claude Code
**버전**: 1.0