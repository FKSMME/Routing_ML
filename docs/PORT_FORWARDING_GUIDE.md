# 포트 번호 없이 접속하기 가이드

## 📌 현재 상황

사용자들이 포트 번호를 입력해야 접속할 수 있습니다:
- ❌ `https://rtml.ksm.co.kr:8000/docs` (불편함)
- ❌ `https://rtml.ksm.co.kr:3000` (불편함)

## 🎯 목표

포트 번호 없이 접속:
- ✅ `https://rtml.ksm.co.kr/docs` (편리함)
- ✅ `https://rtml.ksm.co.kr` (편리함)

---

## 방법 1: Nginx 리버스 프록시 사용 (권장)

### 개요
- Nginx를 80/443 포트에 설치
- 요청을 내부 포트로 전달 (프록시)
- **장점**: 가장 전문적이고 안정적
- **단점**: Nginx 설치 및 설정 필요

### 설치 단계

#### 1. Nginx 설치

**Windows:**
```powershell
# Chocolatey 사용
choco install nginx

# 또는 수동 다운로드
# https://nginx.org/en/download.html
```

#### 2. Nginx 설정 파일 생성

**파일 위치**: `C:\nginx\conf\sites-available\rtml.conf`

```nginx
# HTTP → HTTPS 리다이렉트
server {
    listen 80;
    server_name rtml.ksm.co.kr;
    return 301 https://$server_name$request_uri;
}

# HTTPS 메인 설정
server {
    listen 443 ssl http2;
    server_name rtml.ksm.co.kr;

    # SSL 인증서
    ssl_certificate C:/Users/syyun/Documents/GitHub/Routing_ML_251014/certs/rtml.ksm.co.kr.crt;
    ssl_certificate_key C:/Users/syyun/Documents/GitHub/Routing_ML_251014/certs/rtml.ksm.co.kr.key;

    # SSL 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 기본 경로: Home Dashboard (Port 3000)
    location / {
        proxy_pass https://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Self-signed certificate 허용
        proxy_ssl_verify off;
    }

    # Backend API (Port 8000)
    location /api/ {
        proxy_pass https://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_verify off;
    }

    location /docs {
        proxy_pass https://localhost:8000/docs;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_ssl_verify off;
    }

    location /openapi.json {
        proxy_pass https://localhost:8000/openapi.json;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_ssl_verify off;
    }

    # Routing UI (Port 5173)
    location /routing/ {
        proxy_pass https://localhost:5173/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_ssl_verify off;
    }

    # Training UI (Port 5174)
    location /training/ {
        proxy_pass https://localhost:5174/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_ssl_verify off;
    }
}
```

#### 3. Nginx 시작

```cmd
# Nginx 시작
nginx

# Nginx 재시작 (설정 변경 후)
nginx -s reload

# Nginx 중지
nginx -s stop
```

#### 4. 접속 테스트

```
https://rtml.ksm.co.kr           → Home Dashboard
https://rtml.ksm.co.kr/docs      → Backend API Docs
https://rtml.ksm.co.kr/routing   → Routing UI
https://rtml.ksm.co.kr/training  → Training UI
```

---

## 방법 2: Windows 포트 포워딩 (간단하지만 제한적)

### 개요
- Windows `netsh` 명령으로 포트 전달
- **장점**: 추가 소프트웨어 불필요
- **단점**: 여러 서비스를 하나의 포트로 통합 불가

### 설정 방법 (관리자 권한 필요)

```cmd
# HTTP 80 → 3000 포워딩
netsh interface portproxy add v4tov4 listenport=80 listenaddress=0.0.0.0 connectport=3000 connectaddress=127.0.0.1

# HTTPS 443 → 3000 포워딩
netsh interface portproxy add v4tov4 listenport=443 listenaddress=0.0.0.0 connectport=3000 connectaddress=127.0.0.1

# 설정 확인
netsh interface portproxy show all

# 삭제 (원복)
netsh interface portproxy delete v4tov4 listenport=80 listenaddress=0.0.0.0
netsh interface portproxy delete v4tov4 listenport=443 listenaddress=0.0.0.0
```

### 제한사항
- **하나의 서비스만** 기본 포트 사용 가능
- 다른 서비스는 여전히 포트 번호 필요

---

## 방법 3: 서브도메인 사용 (DNS 설정 필요)

### 개요
각 서비스를 별도 서브도메인으로 분리:
- `https://rtml.ksm.co.kr` → Home (3000)
- `https://api.rtml.ksm.co.kr` → Backend (8000)
- `https://routing.rtml.ksm.co.kr` → Routing UI (5173)
- `https://training.rtml.ksm.co.kr` → Training UI (5174)

### DNS 설정 (IT 부서 요청)

```
rtml.ksm.co.kr         A    10.204.2.28
api.rtml.ksm.co.kr     A    10.204.2.28
routing.rtml.ksm.co.kr A    10.204.2.28
training.rtml.ksm.co.kr A   10.204.2.28
```

### Nginx 설정

```nginx
# api.rtml.ksm.co.kr → 8000
server {
    listen 443 ssl http2;
    server_name api.rtml.ksm.co.kr;

    ssl_certificate ...;
    ssl_certificate_key ...;

    location / {
        proxy_pass https://localhost:8000;
        proxy_ssl_verify off;
    }
}

# routing.rtml.ksm.co.kr → 5173
server {
    listen 443 ssl http2;
    server_name routing.rtml.ksm.co.kr;

    ssl_certificate ...;
    ssl_certificate_key ...;

    location / {
        proxy_pass https://localhost:5173;
        proxy_ssl_verify off;
    }
}

# training.rtml.ksm.co.kr → 5174
server {
    listen 443 ssl http2;
    server_name training.rtml.ksm.co.kr;

    ssl_certificate ...;
    ssl_certificate_key ...;

    location / {
        proxy_pass https://localhost:5174;
        proxy_ssl_verify off;
    }
}
```

---

## 📊 방법 비교

| 방법 | 난이도 | 유연성 | 권장도 |
|------|--------|--------|--------|
| **Nginx 리버스 프록시** | 중간 | ⭐⭐⭐⭐⭐ | ✅ 권장 |
| **Windows 포트 포워딩** | 쉬움 | ⭐⭐ | 제한적 |
| **서브도메인 사용** | 어려움 | ⭐⭐⭐⭐ | 대규모 시 권장 |

---

## 🚀 빠른 시작 (방법 1 권장)

### 1단계: Nginx 설치
```powershell
choco install nginx
```

### 2단계: 설정 파일 복사
위의 Nginx 설정을 `C:\nginx\conf\sites-available\rtml.conf`에 저장

### 3단계: 설정 활성화
```cmd
# nginx.conf에 include 추가
notepad C:\nginx\conf\nginx.conf
```

다음 줄을 http {} 블록 안에 추가:
```nginx
include sites-available/*.conf;
```

### 4단계: Nginx 시작
```cmd
nginx
```

### 5단계: 방화벽 설정
```cmd
netsh advfirewall firewall add rule name="Nginx HTTP" dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="Nginx HTTPS" dir=in action=allow protocol=TCP localport=443
```

### 6단계: 접속 테스트
```
https://rtml.ksm.co.kr
```

---

## ⚠️ 주의사항

1. **80/443 포트가 비어있어야 함**
   - IIS, Apache 등 다른 웹서버가 실행 중이면 충돌

2. **방화벽 설정 필수**
   - Windows 방화벽에서 80, 443 포트 허용

3. **인증서 경로 확인**
   - Nginx 설정의 인증서 경로를 절대 경로로 지정

4. **서비스 시작 순서**
   - Backend/Frontend 먼저 시작
   - 그 다음 Nginx 시작

---

## 🔧 문제 해결

### Nginx가 시작되지 않음
```cmd
# 로그 확인
type C:\nginx\logs\error.log

# 설정 파일 문법 검사
nginx -t
```

### 포트 충돌
```cmd
# 80 포트 사용 확인
netstat -ano | findstr :80

# 443 포트 사용 확인
netstat -ano | findstr :443
```

### SSL 인증서 오류
- 인증서 파일 경로가 절대 경로인지 확인
- 백슬래시(`\`) 대신 슬래시(`/`) 사용

---

## 📞 참고 자료

- [Nginx 공식 문서](https://nginx.org/en/docs/)
- [Nginx Windows 설치 가이드](https://nginx.org/en/docs/windows.html)
- [Nginx 리버스 프록시 설정](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
