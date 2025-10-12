# 남은 작업 실행 계획

**문서 ID**: RTEP-2025-10-06
**버전**: 1.0.0
**작성일**: 2025-10-06
**작성자**: ML Team

---

## 현재 진행 상황

**완료된 작업**: 12/18 (67%)
**남은 작업**: 6/18 (33%)

---

## Task #13: CPU 가상서버 최적화 가이드

### 우선순위
**긴급** (1-2주)

### 목적
GPU 없이 CPU 가상서버에서 ML 성능 최적화

### 현재 환경
- **서버**: CPU 가상서버 (GPU 없음)
- **제약**: 온프레미스, 예산 제한
- **목표**: CPU 최적화로 성능 향상

### CPU 최적화 전략

#### 1. 멀티스레드 활용

```python
# HNSW 인덱스 빌드 (멀티스레드)
import nmslib

index = nmslib.init(method='hnsw', space='cosine')
index.addDataPointBatch(embeddings)
index.createIndex(
    {
        'M': 32,
        'efConstruction': 400,
        'post': 2,
        'num_threads': -1,  # 모든 CPU 코어 사용
    }
)

# scikit-learn 병렬 처리
from sklearn.ensemble import IsolationForest

model = IsolationForest(
    n_estimators=100,
    n_jobs=-1,  # 모든 코어 사용
)
```

#### 2. BLAS 라이브러리 최적화

```bash
# OpenBLAS 설치 (CPU 최적화된 선형대수 라이브러리)
sudo apt-get install libopenblas-dev

# NumPy가 OpenBLAS 사용하도록 설정
export OPENBLAS_NUM_THREADS=8
export MKL_NUM_THREADS=8

# 확인
python -c "import numpy as np; np.__config__.show()"
```

#### 3. 경량 모델 사용

```python
# Sentence-BERT 경량 모델 선택
from sentence_transformers import SentenceTransformer

# 권장: MiniLM (384차원, 빠름)
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

# 대안: DistilBERT (768차원, 중간)
# model = SentenceTransformer('distiluse-base-multilingual-cased-v1')
```

#### 4. 배치 처리 최적화

```python
# 작은 배치 크기로 메모리 효율 향상
embeddings = model.encode(
    texts,
    batch_size=16,  # 32 → 16 (메모리 절약)
    show_progress_bar=True,
)
```

#### 5. 캐싱 적극 활용

```python
# Redis 캐싱으로 재계산 방지
import redis
import pickle

redis_client = redis.Redis(host='localhost', port=6379, db=0)

def get_cached_embedding(item_code):
    key = f"embedding:{item_code}"
    cached = redis_client.get(key)
    if cached:
        return pickle.loads(cached)
    return None

def set_cached_embedding(item_code, embedding):
    key = f"embedding:{item_code}"
    redis_client.setex(key, 3600, pickle.dumps(embedding))  # 1시간 TTL
```

### 예상 효과 (CPU 최적화)

| 작업 | 현재 (단일스레드) | 최적화 후 (멀티스레드) | 개선률 |
|-----|-----------------|---------------------|--------|
| HNSW 인덱스 빌드 | 5분 | 1-2분 | 60-80% |
| 임베딩 생성 (1,000개) | 30초 | 10초 | 67% |
| 이상 탐지 학습 | 2분 | 30초 | 75% |
| API 응답 (캐시 히트) | 500ms | 50ms | 90% |

### 실행 체크리스트
- [x] 멀티스레드 설정 (num_threads=-1)
- [ ] OpenBLAS 설치 및 설정
- [ ] 경량 Sentence-BERT 모델 전환
- [ ] Redis 캐싱 구현
- [ ] 배치 크기 튜닝
- [ ] 벤치마크 실행 (최적화 전후 비교)
- [ ] 문서화 (CPU 최적화 가이드)

---

## Task #14: 지식 전달 계획

### 우선순위
**중요** (2-4주)

### 목적
Bus Factor 1 → 3+ 증가, 팀 역량 강화

### 지식 전달 대상
1. **신규 개발자** (2명)
2. **데이터 엔지니어** (1명)
3. **운영 담당자** (1명)

### 전달 내용

#### Week 1: 시스템 개요 및 아키텍처
- **교육 자료**: ONBOARDING_GUIDE.md
- **실습**: 로컬 환경 셋업
- **산출물**: 환경 구축 완료 인증

#### Week 2: ML 파이프라인 이해
- **교육 자료**:
  - trainer/ml/ 디렉토리 구조
  - HNSW 벡터 검색 원리
  - 메타 앙상블 알고리즘
- **실습**:
  - 모델 재학습
  - 유사도 검색 테스트
- **산출물**: 학습 실행 로그

#### Week 3: Backend API 및 Frontend
- **교육 자료**:
  - FastAPI 라우터 구조
  - React 컴포넌트 계층
  - Zustand 상태 관리
- **실습**:
  - API 엔드포인트 추가
  - UI 컴포넌트 수정
- **산출물**: PR 1개 제출

#### Week 4: 운영 및 모니터링
- **교육 자료**:
  - Grafana 대시보드 사용법
  - 데이터 품질 리포트 해석
  - 트러블슈팅 가이드
- **실습**:
  - 주간 리포트 생성
  - 이상치 조사
- **산출물**: 주간 리포트 1회 생성

### 지식 전달 방법
- **페어 프로그래밍**: 주 2회, 2시간
- **코드 리뷰**: 모든 PR 리뷰
- **주간 발표**: 학습 내용 공유
- **문서화**: 학습 내용 Wiki 정리

### 성공 기준
- **Bus Factor**: 1 → 3 이상
- **신규 개발자 독립 작업**: 4주 내
- **문서 커버리지**: 90% 이상
- **팀 만족도**: 4.0/5.0 이상

---

## Task #15: Docker 컨테이너화

### 우선순위
**중요** (2-4주)

### 목적
배포 일관성, 환경 격리, 확장성 향상

### 컨테이너 구조

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Backend API
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DB_TYPE=MSSQL
      - MSSQL_HOST=db
      - MSSQL_PASSWORD=${MSSQL_PASSWORD}
    volumes:
      - ./models:/app/models
      - ./reports:/app/reports
    depends_on:
      - db
      - redis

  # Frontend Prediction
  frontend-prediction:
    build: ./frontend-prediction
    ports:
      - "5173:80"
    environment:
      - VITE_API_URL=http://localhost:8000

  # Frontend Training
  frontend-training:
    build: ./frontend-training
    ports:
      - "5174:80"
    environment:
      - VITE_API_URL=http://localhost:8000

  # PostgreSQL (마이그레이션 후)
  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=routing_ml
      - POSTGRES_USER=routing_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Redis (캐싱)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # Grafana (모니터링)
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana:/etc/grafana/provisioning

  # Prometheus (메트릭)
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

volumes:
  postgres_data:
  grafana_data:
```

### Dockerfile 예시

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성 설치
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

# Python 패키지 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

# 포트 노출
EXPOSE 8000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

# 실행
CMD ["uvicorn", "backend.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 실행 체크리스트
- [ ] Dockerfile 작성 (backend, frontend-prediction, frontend-training)
- [ ] docker-compose.yml 작성
- [ ] .dockerignore 작성
- [ ] 환경 변수 관리 (.env.example)
- [ ] 볼륨 마운트 설정 (모델, 데이터)
- [ ] 헬스체크 구현
- [ ] 빌드 및 테스트
- [ ] 문서화 (README.Docker.md)

---

## Task #16: CI/CD 파이프라인 강화

### 우선순위
**권장** (1-3개월)

### 목적
자동화된 테스트, 빌드, 배포 파이프라인 구축

### GitHub Actions 워크플로우

#### 1. 테스트 파이프라인 (.github/workflows/test.yml)

```yaml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov
      - name: Run tests
        run: pytest --cov=backend tests/
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  frontend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
        working-directory: frontend-prediction
      - name: Run tests
        run: npm test
        working-directory: frontend-prediction
      - name: Type check
        run: npm run type-check
        working-directory: frontend-prediction
```

#### 2. 빌드 파이프라인 (.github/workflows/build.yml)

```yaml
name: Build

on:
  push:
    tags:
      - 'v*'

jobs:
  build-docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: ./backend
          push: true
          tags: routingml/backend:${{ github.ref_name }}
```

#### 3. 배포 파이프라인 (.github/workflows/deploy.yml)

```yaml
name: Deploy

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        run: |
          ssh ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} \
            "cd /app/routing-ml && \
             docker-compose pull && \
             docker-compose up -d"
```

### 실행 체크리스트
- [ ] GitHub Actions 워크플로우 작성 (test, build, deploy)
- [ ] 시크릿 설정 (DOCKER_USERNAME, SERVER_HOST 등)
- [ ] 환경별 설정 (staging, production)
- [ ] 배포 승인 프로세스
- [ ] 롤백 전략
- [ ] 알림 설정 (Slack, Email)

---

## Task #17: 성능 메트릭 추적

### 우선순위
**권장** (1-3개월)

### 목적
시스템 성능 모니터링 및 병목 지점 식별

### 주요 메트릭

#### 1. API 성능 메트릭

```python
# backend/api/middleware/metrics.py
from prometheus_client import Counter, Histogram, Gauge
import time

# API 요청 카운터
api_requests_total = Counter(
    'api_requests_total',
    'Total API requests',
    ['method', 'endpoint', 'status']
)

# API 지연시간 히스토그램
api_latency_seconds = Histogram(
    'api_latency_seconds',
    'API latency in seconds',
    ['method', 'endpoint'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0]
)

# 활성 연결 수
active_connections = Gauge(
    'active_connections',
    'Number of active connections'
)

# 미들웨어
async def metrics_middleware(request, call_next):
    start = time.time()
    active_connections.inc()

    try:
        response = await call_next(request)
        latency = time.time() - start

        api_requests_total.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code
        ).inc()

        api_latency_seconds.labels(
            method=request.method,
            endpoint=request.url.path
        ).observe(latency)

        return response
    finally:
        active_connections.dec()
```

#### 2. ML 성능 메트릭

```python
# 검색 성능
vector_search_latency = Histogram(
    'vector_search_latency_seconds',
    'Vector search latency',
    buckets=[0.01, 0.05, 0.1, 0.2, 0.5, 1.0]
)

# 예측 정확도
prediction_accuracy = Gauge(
    'prediction_accuracy',
    'Prediction accuracy (top-k recall)'
)

# 모델 버전
model_version = Gauge(
    'model_version_info',
    'Model version',
    ['version', 'trained_at']
)
```

#### 3. 데이터 품질 메트릭

```python
# 품질 점수
data_quality_score = Gauge(
    'data_quality_score',
    'Data quality score (0-100)'
)

# 이상치 비율
anomaly_rate = Gauge(
    'anomaly_rate',
    'Anomaly rate (0-1)'
)

# Critical 이슈 수
critical_issues = Gauge(
    'critical_issues_count',
    'Number of critical issues'
)
```

### Grafana 대시보드

**대시보드 구성**:
1. **시스템 개요**
   - API 요청/초
   - 평균 응답 시간
   - 에러율
   - 활성 연결 수

2. **ML 성능**
   - 검색 지연시간 분포
   - 예측 정확도 추이
   - 모델 버전 정보

3. **데이터 품질**
   - 품질 점수 추이
   - 이상치 비율
   - 이슈 현황

4. **리소스 사용량**
   - CPU 사용률
   - 메모리 사용률
   - 디스크 I/O

### 알림 규칙

```yaml
# monitoring/alerts.yml
groups:
  - name: api_alerts
    interval: 1m
    rules:
      - alert: HighLatency
        expr: api_latency_seconds{quantile="0.95"} > 1
        for: 5m
        annotations:
          summary: "API 지연시간 높음 (>1초)"

      - alert: HighErrorRate
        expr: rate(api_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "에러율 5% 초과"

      - alert: LowDataQuality
        expr: data_quality_score < 70
        for: 10m
        annotations:
          summary: "데이터 품질 점수 70점 미만"
```

---

## Task #18: 추가 개선사항

### 우선순위
**선택** (필요 시)

### 개선 아이디어

#### 1. 자동 재학습 파이프라인
- **스케줄**: 매주 일요일 새벽 2시
- **트리거**: 데이터 변화 10% 이상
- **검증**: A/B 테스트로 성능 비교
- **롤백**: 성능 저하 시 이전 모델로 복원

#### 2. 사용자 피드백 수집
- **UI**: 예측 결과에 👍👎 버튼
- **저장**: feedback 테이블에 저장
- **분석**: 주간 리포트에 만족도 포함
- **활용**: 모델 재학습 시 가중치 조정

#### 3. 다국어 지원 (영문)
- **i18n 라이브러리**: react-i18next
- **번역 파일**: locales/en.json, locales/ko.json
- **UI**: 언어 선택 드롭다운
- **API**: Accept-Language 헤더 지원

#### 4. 모바일 반응형 최적화
- **브레이크포인트**: 768px, 1024px, 1440px
- **레이아웃**: 모바일에서 세로 스택
- **터치 제스처**: 스와이프 네비게이션
- **성능**: 이미지 lazy loading

#### 5. 오프라인 모드 (PWA)
- **Service Worker**: 캐싱 전략
- **IndexedDB**: 로컬 데이터 저장
- **동기화**: 온라인 복귀 시 서버 동기화

---

## 실행 우선순위 요약

### 즉시 (1-2주) 🔴
- ✅ Task #13: GPU 서버 세팅 (성능 10배 향상)

### 단기 (2-4주) 🟡
- ✅ Task #14: 지식 전달 계획 (Bus Factor 해결)
- ✅ Task #15: Docker 컨테이너화 (배포 일관성)

### 중기 (1-3개월) 🟢
- ✅ Task #16: CI/CD 파이프라인 (자동화)
- ✅ Task #17: 성능 메트릭 추적 (모니터링)

### 장기 (필요 시) ⚪
- ✅ Task #18: 추가 개선사항 (UX 향상)

---

## 최종 체크리스트

### 문서
- [x] Phase 1 범위 정의서
- [x] 온보딩 가이드
- [x] PostgreSQL 마이그레이션 가이드
- [x] UI 개선 계획
- [x] 튜토리얼 비디오 가이드
- [x] 파일럿 프로그램 계획
- [x] 벡터 검색 최적화 가이드
- [ ] GPU 서버 세팅 가이드 (본 문서 포함)
- [ ] Docker 배포 가이드
- [ ] CI/CD 파이프라인 가이드

### 코드
- [x] 이상 탐지 알고리즘 (Isolation Forest)
- [x] 주간 리포트 자동화
- [x] 온프레미스 NLP
- [x] 데이터 품질 대시보드
- [ ] GPU 가속 벡터 검색
- [ ] Docker 설정
- [ ] GitHub Actions 워크플로우
- [ ] Prometheus 메트릭

### 인프라
- [ ] GPU 서버 구매/할당
- [ ] Docker 환경 구축
- [ ] GitHub Actions 설정
- [ ] Grafana 대시보드 배포
- [ ] 알림 채널 설정 (Slack)

---

**문서 종료**

**작성자**: ML Team
**다음 액션**: GPU 서버 예산 승인 요청
