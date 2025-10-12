# 프로덕션 배포 가이드

**문서 ID**: PDG-2025-10-06
**버전**: 1.0.0
**작성일**: 2025-10-06
**작성자**: ML Team

---

## Executive Summary

Routing ML v4 프로젝트의 첫 번째 프로덕션 배포 가이드입니다.

### 배포 방법
- **Docker**: 컨테이너 기반 배포 (권장)
- **Manual**: 수동 설치 (대안)

### 시스템 요구사항
- **OS**: Linux (Ubuntu 20.04+ 또는 Debian 11+)
- **CPU**: 4 cores 이상
- **Memory**: 8GB 이상
- **Disk**: 50GB 이상
- **Network**: MSSQL 서버 접근 가능

---

## 사전 준비

### 1. 서버 접속 확인

```bash
# SSH 접속
ssh user@production-server.example.com

# OS 확인
cat /etc/os-release
```

### 2. Docker 설치 (없는 경우)

```bash
# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 설치 확인
docker --version
docker-compose --version
```

### 3. 프로젝트 파일 전송

```bash
# 로컬에서 실행
cd /workspaces/Routing_ML_4

# rsync로 전송 (권장)
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'venv*' \
  ./ user@production-server:/opt/routing-ml/

# 또는 git clone
# ssh user@production-server
# git clone https://github.com/your-org/routing-ml-v4.git /opt/routing-ml
```

---

## 환경 설정

### 1. .env 파일 생성

```bash
cd /opt/routing-ml
cp .env.example .env
nano .env
```

### 2. 필수 환경 변수 설정

```bash
# Database Configuration
DB_TYPE=MSSQL
MSSQL_SERVER=K3-DB.ksm.co.kr,1433
MSSQL_DATABASE=KsmErp
MSSQL_USER=FKSM_BI
MSSQL_PASSWORD=your_actual_password_here  # ⚠️ 실제 비밀번호 입력
MSSQL_ENCRYPT=False
MSSQL_TRUST_CERTIFICATE=True

# API Configuration
VITE_API_URL=http://localhost:8000

# Security
JWT_SECRET_KEY=$(openssl rand -hex 32)  # 자동 생성
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=30

# Logging
LOG_LEVEL=INFO
LOG_DIR=./logs

# Performance
WEB_CONCURRENCY=4
OPENBLAS_NUM_THREADS=8
MKL_NUM_THREADS=8

# Feature Flags
ENABLE_ANOMALY_DETECTION=true
ENABLE_DRIFT_DETECTION=true
ENABLE_WEEKLY_REPORTS=false
```

### 3. 디렉토리 생성

```bash
mkdir -p models/anomaly_detection
mkdir -p models/drift_detection
mkdir -p reports/weekly
mkdir -p logs
mkdir -p data/db
```

---

## Docker 배포

### 1. 이미지 빌드

```bash
cd /opt/routing-ml

# Backend 빌드
docker build -t routing-ml-backend:v1.0.0 -f Dockerfile.backend .

# Frontend Prediction 빌드
docker build -t routing-ml-frontend-prediction:v1.0.0 \
  -f Dockerfile.frontend-prediction \
  --build-arg VITE_API_URL=http://localhost:8000 .

# Frontend Training 빌드
docker build -t routing-ml-frontend-training:v1.0.0 \
  -f Dockerfile.frontend-training \
  --build-arg VITE_API_URL=http://localhost:8000 .
```

**예상 시간**: 각 5-10분 (총 15-30분)

### 2. docker-compose.yml 확인

```yaml
version: '3.8'

services:
  backend:
    image: routing-ml-backend:v1.0.0
    container_name: routing-ml-backend
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - ./models:/app/models
      - ./reports:/app/reports
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend-prediction:
    image: routing-ml-frontend-prediction:v1.0.0
    container_name: routing-ml-frontend-prediction
    ports:
      - "5173:80"
    depends_on:
      - backend
    restart: unless-stopped

  frontend-training:
    image: routing-ml-frontend-training:v1.0.0
    container_name: routing-ml-frontend-training
    ports:
      - "5174:80"
    depends_on:
      - backend
    restart: unless-stopped
```

### 3. 서비스 시작

```bash
# 전체 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f backend
```

### 4. 상태 확인

```bash
# 컨테이너 상태
docker-compose ps

# 헬스체크
curl http://localhost:8000/api/health

# 예상 응답
{
  "status": "healthy",
  "version": "4.0.0",
  "uptime_seconds": 123.45
}
```

---

## 수동 배포 (Docker 없이)

### 1. Python 환경 설정

```bash
cd /opt/routing-ml

# Python 3.11 설치 (Ubuntu)
sudo apt-get update
sudo apt-get install -y python3.11 python3.11-venv python3-pip

# 가상환경 생성
python3.11 -m venv venv
source venv/bin/activate

# 패키지 설치
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. ODBC Driver 설치

```bash
# Microsoft ODBC Driver 17 설치
curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /etc/apt/trusted.gpg.d/microsoft.gpg
sudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/debian/11/prod bullseye main" > /etc/apt/sources.list.d/mssql-release.list'
sudo apt-get update
sudo ACCEPT_EULA=Y apt-get install -y msodbcsql17
```

### 3. Frontend 빌드

```bash
# Node.js 설치 (v18)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Frontend Prediction 빌드
cd frontend-prediction
npm ci
npm run build
cd ..

# Frontend Training 빌드
cd frontend-training
npm ci
npm run build
cd ..
```

### 4. Nginx 설정

```bash
# Nginx 설치
sudo apt-get install -y nginx

# 설정 파일 생성
sudo nano /etc/nginx/sites-available/routing-ml
```

```nginx
server {
    listen 80;
    server_name routing-ml.example.com;

    # Frontend Prediction
    location / {
        root /opt/routing-ml/frontend-prediction/dist;
        try_files $uri $uri/ /index.html;
    }

    # Frontend Training
    location /training {
        alias /opt/routing-ml/frontend-training/dist;
        try_files $uri $uri/ /training/index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 설정 활성화
sudo ln -s /etc/nginx/sites-available/routing-ml /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. 백엔드 서비스 설정 (systemd)

```bash
sudo nano /etc/systemd/system/routing-ml-backend.service
```

```ini
[Unit]
Description=Routing ML Backend API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/routing-ml
Environment="PATH=/opt/routing-ml/venv/bin"
EnvironmentFile=/opt/routing-ml/.env
ExecStart=/opt/routing-ml/venv/bin/uvicorn backend.run_api:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 서비스 시작
sudo systemctl daemon-reload
sudo systemctl enable routing-ml-backend
sudo systemctl start routing-ml-backend

# 상태 확인
sudo systemctl status routing-ml-backend
```

---

## 검증 및 테스트

### 1. 헬스체크

```bash
# Backend
curl http://localhost:8000/api/health
# 예상: {"status":"healthy","version":"4.0.0"}

# Frontend Prediction
curl http://localhost:5173
# 예상: HTML 응답

# Frontend Training
curl http://localhost:5174
# 예상: HTML 응답
```

### 2. API 엔드포인트 테스트

```bash
# 1. Anomaly Detection Config
curl http://localhost:8000/api/anomaly/config

# 2. Routing Groups
curl http://localhost:8000/api/routing/groups

# 3. Output Profiles
curl http://localhost:8000/api/routing/output-profiles

# 4. Health with details
curl http://localhost:8000/api/health?detailed=true
```

### 3. 스모크 테스트

```bash
# 테스트 스크립트 실행
cat > /tmp/smoke_test.sh << 'EOF'
#!/bin/bash

echo "=== Routing ML v4 Smoke Test ==="

# 1. Backend Health
echo -n "Backend Health: "
if curl -sf http://localhost:8000/api/health > /dev/null; then
  echo "✅ OK"
else
  echo "❌ FAIL"
  exit 1
fi

# 2. Anomaly Config
echo -n "Anomaly Config: "
if curl -sf http://localhost:8000/api/anomaly/config > /dev/null; then
  echo "✅ OK"
else
  echo "❌ FAIL"
  exit 1
fi

# 3. Frontend Prediction
echo -n "Frontend Prediction: "
if curl -sf http://localhost:5173 > /dev/null; then
  echo "✅ OK"
else
  echo "❌ FAIL"
  exit 1
fi

# 4. Frontend Training
echo -n "Frontend Training: "
if curl -sf http://localhost:5174 > /dev/null; then
  echo "✅ OK"
else
  echo "❌ FAIL"
  exit 1
fi

echo ""
echo "=== All Tests Passed ✅ ==="
EOF

chmod +x /tmp/smoke_test.sh
/tmp/smoke_test.sh
```

---

## 모니터링

### 1. 로그 확인

#### Docker 환경

```bash
# 실시간 로그
docker-compose logs -f backend

# 최근 100줄
docker-compose logs --tail=100 backend

# 에러만 필터
docker-compose logs backend | grep -i error
```

#### 수동 환경

```bash
# systemd 로그
sudo journalctl -u routing-ml-backend -f

# 애플리케이션 로그
tail -f /opt/routing-ml/logs/app.log
```

### 2. 리소스 모니터링

```bash
# Docker
docker stats

# System
htop
# 또는
top
```

### 3. 데이터베이스 연결 테스트

```bash
# MSSQL 연결 확인
docker exec routing-ml-backend python -c "
from backend.database import get_db_connection

with next(get_db_connection()) as conn:
    cursor = conn.cursor()
    cursor.execute('SELECT TOP 1 ITEM_CD FROM dbo.BI_ITEM_INFO_VIEW')
    result = cursor.fetchone()
    print(f'✅ MSSQL Connected: {result[0]}')
"
```

---

## 트러블슈팅

### 1. MSSQL 연결 실패

**증상**:
```
ConnectionError: MSSQL DB 연결 실패: Login timeout expired
```

**해결**:
1. `.env` 파일에서 `MSSQL_PASSWORD` 확인
2. 방화벽 규칙 확인
3. VPN 연결 확인
4. MSSQL 서버 상태 확인

```bash
# 네트워크 연결 테스트
telnet K3-DB.ksm.co.kr 1433
# 또는
nc -zv K3-DB.ksm.co.kr 1433
```

### 2. 포트 충돌

**증상**:
```
Error: Port 8000 is already in use
```

**해결**:
```bash
# 사용 중인 프로세스 확인
sudo lsof -i :8000

# 프로세스 종료
sudo kill -9 <PID>

# 또는 다른 포트 사용
# docker-compose.yml 수정
ports:
  - "8001:8000"
```

### 3. Frontend 404 에러

**증상**: 페이지 새로고침 시 404

**해결**: Nginx 설정에 `try_files` 확인

```nginx
location / {
    try_files $uri $uri/ /index.html;  # ✅ 필수
}
```

---

## 백업 및 복구

### 1. 데이터 백업

```bash
# 모델 백업
tar czf backup-models-$(date +%Y%m%d).tar.gz models/

# 리포트 백업
tar czf backup-reports-$(date +%Y%m%d).tar.gz reports/

# .env 백업
cp .env .env.backup
```

### 2. 복구

```bash
# 모델 복구
tar xzf backup-models-20251006.tar.gz

# 서비스 재시작
docker-compose restart backend
# 또는
sudo systemctl restart routing-ml-backend
```

---

## 롤백 절차

### Docker 환경

```bash
# 1. 이전 이미지로 변경
docker-compose down
docker tag routing-ml-backend:v0.9.0 routing-ml-backend:v1.0.0

# 2. 재시작
docker-compose up -d
```

### 수동 환경

```bash
# 1. Git으로 롤백
cd /opt/routing-ml
git checkout v0.9.0

# 2. 서비스 재시작
sudo systemctl restart routing-ml-backend
```

---

## 보안 설정

### 1. SSL/TLS 설정 (Let's Encrypt)

```bash
# Certbot 설치
sudo apt-get install -y certbot python3-certbot-nginx

# 인증서 발급
sudo certbot --nginx -d routing-ml.example.com

# 자동 갱신 설정
sudo systemctl enable certbot.timer
```

### 2. 방화벽 설정

```bash
# UFW 활성화
sudo ufw enable

# 필수 포트만 허용
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# 확인
sudo ufw status
```

### 3. 환경 변수 암호화 (선택)

```bash
# SOPS 사용
sops --encrypt .env > .env.encrypted
sops --decrypt .env.encrypted > .env
```

---

## 성능 튜닝

### 1. Uvicorn Workers 조정

```bash
# .env
WEB_CONCURRENCY=8  # CPU 코어 수 x 2

# 또는 systemd
ExecStart=/opt/routing-ml/venv/bin/uvicorn backend.run_api:app --host 0.0.0.0 --port 8000 --workers 8
```

### 2. Nginx 캐싱

```nginx
# Nginx 설정
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;

location /api/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_key "$request_uri";
    # ... 기타 설정
}
```

---

## 업데이트 절차

### 1. 새 버전 배포

```bash
# 1. 최신 코드 가져오기
cd /opt/routing-ml
git pull origin main

# 2. 이미지 재빌드
docker build -t routing-ml-backend:v1.1.0 -f Dockerfile.backend .

# 3. docker-compose.yml 수정
# image: routing-ml-backend:v1.1.0

# 4. 무중단 배포
docker-compose up -d --no-deps backend
```

### 2. 데이터베이스 마이그레이션

```bash
# Alembic 사용 (준비 시)
docker exec routing-ml-backend alembic upgrade head
```

---

## 체크리스트

### 배포 전

- [ ] `.env` 파일 설정 완료
- [ ] MSSQL 연결 정보 확인
- [ ] 비밀번호 설정
- [ ] 디렉토리 생성 (models, reports, logs)
- [ ] Docker 설치 확인

### 배포 중

- [ ] 이미지 빌드 성공
- [ ] docker-compose.yml 검증
- [ ] 서비스 시작
- [ ] 헬스체크 통과

### 배포 후

- [ ] API 엔드포인트 테스트
- [ ] 스모크 테스트 통과
- [ ] 로그 확인 (에러 없음)
- [ ] 모니터링 설정
- [ ] 백업 설정

---

## 참고 자료

- [README.Docker.md](./README.Docker.md) - Docker 상세 가이드
- [PERFORMANCE_OPTIMIZATION_REPORT.md](./PERFORMANCE_OPTIMIZATION_REPORT.md) - 성능 최적화
- [API_VERSION_MANAGEMENT.md](./API_VERSION_MANAGEMENT.md) - API 버전 관리

---

**문서 종료**

작성자: ML Team
검토자: -
승인자: -
배포일: 2025-10-06
