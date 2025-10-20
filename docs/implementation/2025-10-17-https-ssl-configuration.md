# HTTPS/SSL 설정 완료

**날짜**: 2025년 10월 17일
**작업자**: Claude Code
**우선순위**: 높음 (보안 통신 활성화)

---

## 📋 작업 개요

HTTP에서 HTTPS로 전환하여 모든 프론트엔드 애플리케이션에서 암호화된 통신을 지원하도록 설정했습니다.

### 작업 범위
1. ✅ **SSL 인증서 생성** - 자체 서명 인증서 (개발/내부용)
2. ✅ **Frontend HTTPS 활성화** - Vite 개발 서버 및 프리뷰 모드
3. ✅ **Backend CORS 업데이트** - HTTPS origins 허용

---

## 🔐 생성된 SSL 인증서

### 인증서 정보
- **파일 위치**: [`certs/`](certs/)
- **인증서 파일**: `rtml.ksm.co.kr.crt`
- **개인키 파일**: `rtml.ksm.co.kr.key`
- **유효 기간**: 10년 (3650일)
- **알고리즘**: RSA 2048-bit
- **해시**: SHA-256

### 포함된 도메인 (Subject Alternative Names)
```
DNS.1 = rtml.ksm.co.kr
DNS.2 = localhost
DNS.3 = mcs.ksm.co.kr
IP.1  = 10.204.2.28
IP.2  = 127.0.0.1
```

### 인증서 생성 명령어
```bash
cd certs

# OpenSSL 설정 파일 생성
cat > openssl.conf << 'EOF'
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = KR
O = FKSM
CN = rtml.ksm.co.kr

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = rtml.ksm.co.kr
DNS.2 = localhost
DNS.3 = mcs.ksm.co.kr
IP.1 = 10.204.2.28
IP.2 = 127.0.0.1
EOF

# 인증서 생성
openssl req -new -x509 -newkey rsa:2048 -nodes \
  -keyout rtml.ksm.co.kr.key \
  -out rtml.ksm.co.kr.crt \
  -days 3650 \
  -config openssl.conf
```

---

## 🔧 수정된 파일

### 1. Frontend-Prediction Vite 설정

#### [`frontend-prediction/vite.config.ts`](frontend-prediction/vite.config.ts)

**변경 내용**: HTTPS 활성화를 위한 SSL 인증서 설정 추가

**Before**:
```typescript
import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // ...
  server: {
    host: "0.0.0.0",
    port: 5173,
    open: false,
    // ...
  },
});
```

**After**:
```typescript
import { fileURLToPath, URL } from "node:url";
import fs from "node:fs";
import path from "node:path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // ...
  server: {
    host: "0.0.0.0",
    port: 5173,
    open: false,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, "../certs/rtml.ksm.co.kr.key")),
      cert: fs.readFileSync(path.resolve(__dirname, "../certs/rtml.ksm.co.kr.crt")),
    },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,  // 자체 서명 인증서 허용
      },
    },
    // ...
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, "../certs/rtml.ksm.co.kr.key")),
      cert: fs.readFileSync(path.resolve(__dirname, "../certs/rtml.ksm.co.kr.crt")),
    },
  },
});
```

---

### 2. Frontend-Training Vite 설정

#### [`frontend-training/vite.config.ts`](frontend-training/vite.config.ts)

**동일한 HTTPS 설정 적용** (포트 5174)

---

### 3. Backend CORS 설정

#### [`backend/api/config.py`](backend/api/config.py:41-84)

**변경 내용**: HTTPS origins 추가

**Before**:
```python
allowed_origins: List[str] = Field(
    default_factory=lambda: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        # ... (HTTP만 지원)
    ],
)
```

**After**:
```python
allowed_origins: List[str] = Field(
    default_factory=lambda: [
        # HTTP - Localhost
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
        # HTTPS - Localhost
        "https://localhost:3000",
        "https://127.0.0.1:3000",
        "https://localhost:5173",
        "https://127.0.0.1:5173",
        "https://localhost:5174",
        "https://127.0.0.1:5174",
        # HTTP - IP Address
        "http://10.204.2.28:3000",
        "http://10.204.2.28:5173",
        "http://10.204.2.28:5174",
        # HTTPS - IP Address
        "https://10.204.2.28:3000",
        "https://10.204.2.28:5173",
        "https://10.204.2.28:5174",
        # HTTP - Production Domains
        "https://rtml.ksm.co.kr:3000",
        "https://rtml.ksm.co.kr:5173",
        "https://rtml.ksm.co.kr:5174",
        "https://mcs.ksm.co.kr:3000",
        "https://mcs.ksm.co.kr:5173",
        "https://mcs.ksm.co.kr:5174",
        # HTTPS - Production Domains
        "https://rtml.ksm.co.kr:3000",
        "https://rtml.ksm.co.kr:5173",
        "https://rtml.ksm.co.kr:5174",
        "https://mcs.ksm.co.kr:3000",
        "https://mcs.ksm.co.kr:5173",
        "https://mcs.ksm.co.kr:5174",
    ],
)
```

---

## 🚀 HTTPS 서버 시작 방법

### Frontend 개발 서버 (HTTPS)

```bash
# Frontend Prediction (HTTPS on port 5173)
cd frontend-prediction
npm run dev
# 이제 https://localhost:5173 으로 접속

# Frontend Training (HTTPS on port 5174)
cd frontend-training
npm run dev
# 이제 https://localhost:5174 으로 접속
```

### Frontend 프리뷰 (HTTPS)

```bash
# Frontend Prediction - Built files with HTTPS
cd frontend-prediction
npm run build
npm run preview
# https://localhost:5173

# Frontend Training - Built files with HTTPS
cd frontend-training
npm run build
npm run preview
# https://localhost:5174
```

---

## 🌐 접속 URL (HTTPS)

### 로컬 개발 환경
- Frontend Prediction: **https://localhost:5173**
- Frontend Training: **https://localhost:5174**
- Backend API: http://localhost:8000/docs (백엔드는 HTTP 유지)

### 내부 네트워크 (IP)
- Frontend Prediction: **https://10.204.2.28:5173**
- Frontend Training: **https://10.204.2.28:5174**

### 프로덕션 (도메인)
- Frontend Prediction: **https://rtml.ksm.co.kr:5173**
- Frontend Training: **https://rtml.ksm.co.kr:5174**

---

## ⚠️ 브라우저 보안 경고 해결

### 문제: "Your connection is not private" 경고

자체 서명 인증서를 사용하기 때문에 브라우저에서 보안 경고가 표시됩니다.

### 해결 방법

#### 방법 1: 브라우저에서 직접 허용 (간단, 임시)
1. Chrome/Edge에서 경고 페이지 표시 시
2. **"Advanced"** 클릭
3. **"Proceed to localhost (unsafe)"** 클릭
4. 세션 동안 인증서 수락됨

#### 방법 2: Windows 인증서 저장소에 추가 (권장, 영구)

```bash
# 1. 인증서를 Windows 인증서 관리자에 추가
# PowerShell (관리자 권한 필요)
Import-Certificate -FilePath "certs\rtml.ksm.co.kr.crt" -CertStoreLocation Cert:\LocalMachine\Root

# 2. 브라우저 재시작
# 이제 경고 없이 https://localhost:5173 접속 가능
```

**수동 설치 방법**:
1. `certs\rtml.ksm.co.kr.crt` 파일을 더블클릭
2. **"Install Certificate..."** 클릭
3. **"Local Machine"** 선택 → Next
4. **"Place all certificates in the following store"** 선택
5. **"Browse"** → **"Trusted Root Certification Authorities"** 선택
6. **Next** → **Finish**
7. 보안 경고에서 **"Yes"** 클릭

#### 방법 3: mkcert 사용 (개발자 권장)

```bash
# Chocolatey로 mkcert 설치
choco install mkcert

# 로컬 CA 설치
mkcert -install

# 인증서 생성
cd certs
mkcert localhost 127.0.0.1 10.204.2.28 rtml.ksm.co.kr mcs.ksm.co.kr

# 생성된 파일 이름을 Vite 설정에 맞게 변경
# localhost+4.pem -> rtml.ksm.co.kr.crt
# localhost+4-key.pem -> rtml.ksm.co.kr.key
```

---

## 🔍 HTTPS 작동 확인

### 1. 인증서 확인
```bash
# 인증서 내용 보기
openssl x509 -in certs/rtml.ksm.co.kr.crt -text -noout

# Subject Alternative Names 확인
openssl x509 -in certs/rtml.ksm.co.kr.crt -noout -ext subjectAltName
```

### 2. HTTPS 연결 테스트
```bash
# curl로 HTTPS 연결 테스트 (자체 서명 인증서이므로 -k 옵션 필요)
curl -k https://localhost:5173

# 브라우저 DevTools Console에서
fetch('https://localhost:5173')
  .then(r => r.text())
  .then(html => console.log('HTTPS OK:', html.substring(0, 100)));
```

### 3. CORS 테스트 (HTTPS → HTTP)
```javascript
// https://localhost:5173 에서 실행
fetch('http://localhost:8000/api/health', {
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => console.log('CORS OK:', data))
  .catch(err => console.error('CORS Error:', err));
```

---

## 📊 HTTPS vs HTTP 비교

| 항목 | HTTP | HTTPS |
|------|------|-------|
| **URL** | http://localhost:5173 | https://localhost:5173 |
| **암호화** | ❌ 없음 | ✅ TLS/SSL |
| **브라우저 경고** | ❌ 없음 | ⚠️ 자체 서명 인증서 시 경고 |
| **보안** | ⚠️ 낮음 (평문 전송) | ✅ 높음 (암호화 전송) |
| **쿠키 보안** | ⚠️ Secure flag 사용 불가 | ✅ Secure flag 사용 가능 |
| **Service Worker** | ⚠️ localhost만 가능 | ✅ 모든 도메인 가능 |
| **API 호출** | ✅ 간단 | ⚠️ Mixed Content 주의 |

---

## 🛠️ 문제 해결

### 1. "NET::ERR_CERT_AUTHORITY_INVALID" 오류

**원인**: 자체 서명 인증서를 브라우저가 신뢰하지 않음

**해결**:
- 위의 "브라우저 보안 경고 해결" 섹션 참고
- Windows 인증서 저장소에 CA로 추가
- 또는 브라우저에서 "Proceed anyway" 클릭

### 2. "Mixed Content" 경고

**원인**: HTTPS 페이지에서 HTTP 리소스 로드 시도

**증상**:
```
Mixed Content: The page at 'https://localhost:5173' was loaded over HTTPS,
but requested an insecure resource 'http://localhost:8000/api/...'.
```

**해결**:
- Backend API를 HTTPS로 변경 (권장)
- 또는 Vite proxy를 통해 우회 (현재 설정)
  ```typescript
  proxy: {
    "/api": {
      target: "http://localhost:8000",  // HTTPS → HTTP 프록시
      changeOrigin: true,
      secure: false,
    },
  }
  ```

### 3. 인증서 파일을 찾을 수 없음

**증상**:
```
Error: ENOENT: no such file or directory, open '../certs/rtml.ksm.co.kr.key'
```

**해결**:
```bash
# 인증서 파일 존재 확인
ls -l certs/rtml.ksm.co.kr.*

# 없으면 다시 생성
cd certs
openssl req -new -x509 -newkey rsa:2048 -nodes \
  -keyout rtml.ksm.co.kr.key \
  -out rtml.ksm.co.kr.crt \
  -days 3650 \
  -config openssl.conf
```

### 4. Vite 서버 시작 실패

**증상**:
```
Error: error:0909006C:PEM routines:get_name:no start line
```

**원인**: 인증서 파일 형식 오류

**해결**:
```bash
# 인증서 파일 내용 확인
cat certs/rtml.ksm.co.kr.crt | head -1
# "-----BEGIN CERTIFICATE-----" 로 시작해야 함

cat certs/rtml.ksm.co.kr.key | head -1
# "-----BEGIN PRIVATE KEY-----" 로 시작해야 함
```

---

## 🔄 프로덕션 배포 시 고려사항

### 1. 신뢰할 수 있는 CA 인증서 사용

자체 서명 인증서는 개발/내부용으로만 사용하고, 프로덕션에서는 신뢰할 수 있는 CA(Certificate Authority) 인증서를 사용해야 합니다.

**무료 SSL 인증서**:
- **Let's Encrypt**: 무료, 자동 갱신 지원
  ```bash
  # Certbot 설치
  choco install certbot

  # 인증서 발급 (Nginx 사용 시)
  certbot --nginx -d rtml.ksm.co.kr
  ```

- **ZeroSSL**: 무료, 90일 유효
- **Cloudflare**: Cloudflare 사용 시 무료 SSL

### 2. Reverse Proxy 사용 (Nginx/Apache)

포트 443에서 SSL 종료를 처리하고 내부 포트로 프록시:

**Nginx 설정 예시**:
```nginx
server {
    listen 443 ssl http2;
    server_name rtml.ksm.co.kr;

    # Let's Encrypt 인증서
    ssl_certificate /etc/letsencrypt/live/rtml.ksm.co.kr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rtml.ksm.co.kr/privkey.pem;

    # SSL 보안 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Frontend Prediction
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP → HTTPS 리다이렉트
server {
    listen 80;
    server_name rtml.ksm.co.kr;
    return 301 https://$server_name$request_uri;
}
```

### 3. Backend HTTPS 활성화 (선택사항)

현재 Backend는 HTTP로 실행 중이며, Frontend Vite 프록시를 통해 안전하게 통신합니다.

프로덕션에서는 Backend도 HTTPS로 실행하거나, Nginx reverse proxy 뒤에서 실행하는 것을 권장합니다.

**FastAPI HTTPS 설정 예시**:
```python
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "backend.api.app:app",
        host="0.0.0.0",
        port=8000,
        ssl_keyfile="certs/rtml.ksm.co.kr.key",
        ssl_certfile="certs/rtml.ksm.co.kr.crt",
    )
```

---

## ✅ 체크리스트

### 개발 환경
- [x] SSL 인증서 생성 완료
- [x] Frontend-Prediction HTTPS 설정
- [x] Frontend-Training HTTPS 설정
- [x] Backend CORS에 HTTPS origins 추가
- [ ] Windows 인증서 저장소에 CA 추가 (사용자가 직접 수행)
- [ ] 브라우저에서 https://localhost:5173 접속 테스트

### 프로덕션 배포
- [ ] 신뢰할 수 있는 CA 인증서 발급 (Let's Encrypt)
- [ ] Nginx/Apache reverse proxy 설정
- [ ] HTTP → HTTPS 리다이렉트 설정
- [ ] SSL Labs 테스트 (https://www.ssllabs.com/ssltest/)
- [ ] HSTS 헤더 추가 (HTTP Strict Transport Security)

---

## 📝 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-10-17 | 초기 HTTPS/SSL 설정 완료 (자체 서명 인증서) |

---

**작성자**: Claude Code
**승인자**: (승인 필요)
**관련 문서**:
- [도메인 설정 가이드](2025-10-17-domain-configuration-rtml-ksm-co-kr.md)
- [빌드 완료 보고서](../BUILD_COMPLETE.md)
