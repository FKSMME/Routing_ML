# Docker 배포 가이드

**문서 ID**: DOCKER-2025-10-06
**버전**: 1.0.0
**작성일**: 2025-10-06

---

## 개요

Routing ML v4 프로젝트의 Docker 컨테이너 배포 가이드입니다.

### 구성 요소

- **backend**: FastAPI 백엔드 (포트 8000)
- **frontend-prediction**: React 예측 UI (포트 5173)
- **frontend-training**: React 학습 UI (포트 5174)

---

## 빠른 시작

### 1. 환경 변수 설정

```bash
# .env 파일 생성
cp .env.example .env

# MSSQL 비밀번호 설정
nano .env
# MSSQL_PASSWORD=your_password_here
```

### 2. 빌드 및 실행

```bash
# 모든 서비스 빌드 및 실행
docker-compose up --build

# 백그라운드 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

### 3. 접속

- **Backend API**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs
- **Prediction UI**: http://localhost:5173
- **Training UI**: http://localhost:5174

---

## 개별 컨테이너 빌드

### Backend

```bash
# 빌드
docker build -t routing-ml-backend:latest -f Dockerfile.backend .

# 실행
docker run -d \
  --name routing-ml-backend \
  -p 8000:8000 \
  -e DB_TYPE=MSSQL \
  -e MSSQL_PASSWORD=your_password \
  -v $(pwd)/models:/app/models \
  -v $(pwd)/reports:/app/reports \
  routing-ml-backend:latest

# 로그 확인
docker logs -f routing-ml-backend
```

### Frontend Prediction

```bash
# 빌드
docker build -t routing-ml-frontend-prediction:latest \
  -f Dockerfile.frontend-prediction \
  --build-arg VITE_API_URL=http://localhost:8000 \
  .

# 실행
docker run -d \
  --name routing-ml-frontend-prediction \
  -p 5173:80 \
  routing-ml-frontend-prediction:latest
```

### Frontend Training

```bash
# 빌드
docker build -t routing-ml-frontend-training:latest \
  -f Dockerfile.frontend-training \
  --build-arg VITE_API_URL=http://localhost:8000 \
  .

# 실행
docker run -d \
  --name routing-ml-frontend-training \
  -p 5174:80 \
  routing-ml-frontend-training:latest
```

---

## 환경 변수

### 필수 환경 변수

| 변수 | 설명 | 기본값 | 예시 |
|------|------|--------|------|
| `DB_TYPE` | 데이터베이스 타입 | `MSSQL` | `MSSQL` 또는 `ACCESS` |
| `MSSQL_SERVER` | MSSQL 서버 주소 | `K3-DB.ksm.co.kr,1433` | `localhost,1433` |
| `MSSQL_DATABASE` | 데이터베이스 이름 | `KsmErp` | `routing_ml` |
| `MSSQL_USER` | 사용자 이름 | `FKSM_BI` | `sa` |
| `MSSQL_PASSWORD` | 비밀번호 | (필수) | `your_password` |

### 선택적 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `MSSQL_ENCRYPT` | 암호화 사용 | `False` |
| `MSSQL_TRUST_CERTIFICATE` | 인증서 신뢰 | `True` |
| `LOG_LEVEL` | 로그 레벨 | `INFO` |
| `WEB_CONCURRENCY` | Worker 수 | `4` |

---

## 볼륨 마운트

### Backend 볼륨

```yaml
volumes:
  - ./models:/app/models          # ML 모델 저장
  - ./reports:/app/reports        # 리포트 저장
  - ./data/db:/app/data/db        # Access DB (선택)
  - ./logs:/app/logs              # 로그 파일
```

### 권장 디렉토리 구조

```
Routing_ML_4/
├── models/
│   ├── anomaly_detection/
│   │   ├── isolation_forest.pkl
│   │   ├── scaler.pkl
│   │   └── config.json
│   └── drift_detection/
├── reports/
│   └── weekly/
├── data/
│   └── db/
└── logs/
```

---

## 헬스체크

### Backend

```bash
# 헬스체크
curl http://localhost:8000/api/health

# 응답
{
  "status": "healthy",
  "version": "4.0.0",
  "uptime_seconds": 123.45
}
```

### Frontend

```bash
# Prediction UI
curl http://localhost:5173

# Training UI
curl http://localhost:5174
```

---

## 트러블슈팅

### 1. MSSQL 연결 실패

**오류**:
```
ConnectionError: MSSQL DB 연결 실패: Login timeout expired
```

**해결**:
1. `.env` 파일에서 `MSSQL_PASSWORD` 확인
2. 네트워크 연결 확인 (VPN, 방화벽)
3. MSSQL 서버 주소 확인

```bash
# 컨테이너 내부에서 연결 테스트
docker exec -it routing-ml-backend bash
curl telnet://K3-DB.ksm.co.kr:1433
```

### 2. ODBC Driver 오류

**오류**:
```
Can't open lib 'ODBC Driver 17 for SQL Server'
```

**해결**:
ODBC Driver는 Dockerfile에 포함되어 있습니다. 재빌드 시도:

```bash
docker-compose build --no-cache backend
```

### 3. Frontend API 연결 실패

**오류**: Frontend에서 API 호출 실패

**해결**:
1. 빌드 시 `VITE_API_URL` 확인
2. 네트워크 설정 확인

```bash
# 컨테이너 네트워크 확인
docker network inspect routing-ml-network

# Frontend 컨테이너 로그
docker logs routing-ml-frontend-prediction
```

### 4. 포트 충돌

**오류**:
```
Bind for 0.0.0.0:8000 failed: port is already allocated
```

**해결**:
```bash
# 사용 중인 포트 확인
lsof -i :8000

# docker-compose.yml에서 포트 변경
ports:
  - "8001:8000"  # 8000 → 8001
```

---

## 프로덕션 배포

### 1. Docker Swarm 배포

```bash
# Swarm 초기화
docker swarm init

# Stack 배포
docker stack deploy -c docker-compose.yml routing-ml

# 서비스 확인
docker service ls
docker service logs routing-ml_backend
```

### 2. Kubernetes 배포

```yaml
# k8s-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: routing-ml-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: routing-ml-backend
  template:
    metadata:
      labels:
        app: routing-ml-backend
    spec:
      containers:
      - name: backend
        image: routing-ml-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DB_TYPE
          value: "MSSQL"
        - name: MSSQL_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mssql-secret
              key: password
        volumeMounts:
        - name: models
          mountPath: /app/models
      volumes:
      - name: models
        persistentVolumeClaim:
          claimName: routing-ml-models-pvc
```

### 3. 보안 설정

```bash
# 비밀번호를 환경 변수 대신 Docker Secret 사용
echo "your_password" | docker secret create mssql_password -

# docker-compose.yml 수정
services:
  backend:
    secrets:
      - mssql_password
    environment:
      - MSSQL_PASSWORD_FILE=/run/secrets/mssql_password

secrets:
  mssql_password:
    external: true
```

---

## 성능 최적화

### 1. Multi-stage Build

Dockerfile은 이미 multi-stage build를 사용하여 이미지 크기 최적화:

- **Frontend**: 빌드 단계 (Node.js) + 실행 단계 (Nginx) → 약 30MB
- **Backend**: Python slim 이미지 사용 → 약 500MB

### 2. 캐시 활용

```dockerfile
# 패키지 파일만 먼저 복사하여 캐시 활용
COPY requirements.txt .
RUN pip install -r requirements.txt

# 이후 소스 코드 복사
COPY backend/ ./backend/
```

### 3. 리소스 제한

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

---

## 모니터링

### 1. 컨테이너 리소스 모니터링

```bash
# 실시간 리소스 사용량
docker stats

# 특정 컨테이너
docker stats routing-ml-backend
```

### 2. Prometheus + Grafana

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
```

### 3. 로그 수집

```bash
# 로그 드라이버 설정
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## 백업 및 복구

### 1. 볼륨 백업

```bash
# 모델 볼륨 백업
docker run --rm \
  -v routing_ml_models:/models \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/models-$(date +%Y%m%d).tar.gz -C /models .

# 복구
docker run --rm \
  -v routing_ml_models:/models \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/models-20251006.tar.gz -C /models
```

### 2. 데이터베이스 백업

```bash
# MSSQL 백업 (컨테이너 내부)
docker exec routing-ml-backend \
  python -c "from backend.database import backup_database; backup_database()"
```

---

## CI/CD 통합

### GitHub Actions

```yaml
# .github/workflows/docker-build.yml
name: Docker Build and Push

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and push Backend
        uses: docker/build-push-action@v4
        with:
          context: .
          file: ./Dockerfile.backend
          push: true
          tags: |
            myorg/routing-ml-backend:latest
            myorg/routing-ml-backend:${{ github.ref_name }}

      - name: Build and push Frontend Prediction
        uses: docker/build-push-action@v4
        with:
          context: .
          file: ./Dockerfile.frontend-prediction
          push: true
          tags: |
            myorg/routing-ml-frontend-prediction:latest
            myorg/routing-ml-frontend-prediction:${{ github.ref_name }}
```

---

## 체크리스트

### 배포 전

- [ ] `.env` 파일 설정 완료
- [ ] MSSQL 연결 테스트 성공
- [ ] 모델 파일 준비 (`models/`)
- [ ] Docker 및 Docker Compose 설치 확인

### 배포 후

- [ ] 헬스체크 통과 확인
- [ ] API 문서 접근 확인 (`/docs`)
- [ ] Frontend UI 접근 확인
- [ ] 로그 확인 (오류 없음)
- [ ] 리소스 사용량 모니터링

### 운영 중

- [ ] 주기적 볼륨 백업 (일 1회)
- [ ] 로그 로테이션 설정
- [ ] 모니터링 대시보드 확인
- [ ] 보안 업데이트 적용

---

## 참고 자료

- [Docker 공식 문서](https://docs.docker.com/)
- [Docker Compose 문서](https://docs.docker.com/compose/)
- [FastAPI Docker 배포 가이드](https://fastapi.tiangolo.com/deployment/docker/)
- [Multi-stage Build 최적화](https://docs.docker.com/build/building/multi-stage/)

---

**문서 종료**
