# Routing ML v4 - 신규 개발자 온보딩 가이드

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [개발 환경 설정](#개발-환경-설정)
4. [코드베이스 구조](#코드베이스-구조)
5. [주요 기능 이해하기](#주요-기능-이해하기)
6. [첫 번째 작업 시작하기](#첫-번째-작업-시작하기)
7. [트러블슈팅](#트러블슈팅)
8. [참고 자료](#참고-자료)

---

## 🎯 프로젝트 개요

### 프로젝트 미션

**Routing ML v4**는 제조 공정 라우팅을 자동으로 생성하는 온프레미스 AI 시스템입니다.

**핵심 목적**:
- 품목 속성(재질, 치수, 도면번호 등)을 기반으로 최적의 공정 라우팅을 **자동 예측**
- 과거 공정 데이터를 학습하여 **정확도 95%+ 달성**
- 기존 수작업 대비 **라우팅 생성 시간 90% 단축**

**사용자**:
- 제조 현장 생산관리 담당자
- 공정 설계 엔지니어
- 품질 관리팀

**배포 환경**:
- ⚠️ **온프레미스 전용** (내부망, 외부 API 연결 불가)
- Windows Server 또는 Linux 서버
- Docker 기반 배포

---

## 🏗️ 시스템 아키텍처

### 전체 구성도

```
┌─────────────────────────────────────────────────────────────┐
│                        사용자                                │
│                    (브라우저 접속)                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (React)                           │
│  - Prediction UI (라우팅 예측)                              │
│  - Training UI (모델 학습)                                  │
│  - Master Data UI (마스터 데이터 관리)                      │
│  - Monitoring Dashboard (모니터링)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/WebSocket
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI)                          │
│  - Prediction API (예측 서비스)                             │
│  - Training API (학습 서비스)                               │
│  - Data Quality API (품질 모니터링)                         │
│  - On-Prem NLP API (자연어 검색)                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌─────────────┐ ┌──────────┐ ┌─────────────┐
│  Database   │ │   ML     │ │ Monitoring  │
│             │ │  Models  │ │             │
│ PostgreSQL  │ │ (.joblib)│ │ Prometheus  │
│ (or Access) │ │          │ │ + Grafana   │
└─────────────┘ └──────────┘ └─────────────┘
```

### 기술 스택

**프론트엔드**:
- React 18.2 + TypeScript
- Vite (빌드 도구)
- TailwindCSS (스타일링)
- React Flow (워크플로우 시각화)

**백엔드**:
- Python 3.11+
- FastAPI (REST API 프레임워크)
- SQLAlchemy (ORM)
- Pydantic (데이터 검증)

**머신러닝**:
- Scikit-learn (Random Forest, XGBoost)
- HNSW (벡터 유사도 검색)
- Joblib (모델 직렬화)

**데이터베이스**:
- PostgreSQL (운영 환경 권장)
- MS Access (레거시 지원)
- MSSQL (선택 사항)

**모니터링**:
- Prometheus (메트릭 수집)
- Grafana (대시보드)

**중요**: 외부 API (GPT-4, OpenAI 등) 사용 금지 - 온프레미스 전용

---

## 💻 개발 환경 설정

### 1. 사전 요구사항

**필수 소프트웨어**:
- Git 2.30+
- Python 3.11+ (또는 3.12)
- Node.js 18+ (LTS)
- Docker 24+ (선택 사항)

**권장 개발 도구**:
- VSCode (IDE)
- Python extension for VSCode
- Pylance (타입 체킹)
- ESLint + Prettier (코드 포맷팅)

### 2. 저장소 클론

```bash
# 저장소 클론
git clone <repository-url> Routing_ML_4
cd Routing_ML_4

# 브랜치 확인
git branch -a

# 메인 브랜치로 이동
git checkout main
```

### 3. 백엔드 환경 설정 (Linux/WSL)

```bash
# Python 가상환경 생성
python3 -m venv venv-linux

# 가상환경 활성화
source venv-linux/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 환경변수 설정
cat > .env <<EOF
DB_TYPE=POSTGRESQL
POSTGRESQL_HOST=localhost
POSTGRESQL_PORT=5432
POSTGRESQL_USER=routing_user
POSTGRESQL_PASSWORD=your_password
POSTGRESQL_DB=routing_ml
EOF

# 데이터베이스 마이그레이션 (필요 시)
# python scripts/migrate_access_to_postgres.py
```

### 4. 백엔드 환경 설정 (Windows)

```powershell
# Python 가상환경 생성
python -m venv .venv

# 가상환경 활성화
.venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경변수 설정 (.env 파일 생성)
```

### 5. 프론트엔드 환경 설정

```bash
# Prediction UI
cd frontend-prediction
npm install
npm run dev  # 개발 서버 시작 (http://localhost:5173)

# Training UI (별도 터미널)
cd frontend-training
npm install
npm run dev  # 개발 서버 시작 (http://localhost:5174)
```

### 6. 백엔드 서버 시작

```bash
# 가상환경 활성화 상태에서
cd /workspaces/Routing_ML_4

# Uvicorn으로 FastAPI 서버 시작
python -m uvicorn backend.run_api:app --host 0.0.0.0 --port 8000 --reload

# 또는 (Linux/WSL)
venv-linux/bin/python -m uvicorn backend.run_api:app --host 0.0.0.0 --port 8000 --reload
```

**확인**:
- API 문서: http://localhost:8000/docs
- 헬스 체크: http://localhost:8000/api/health

### 7. 전체 시스템 확인

```bash
# 백엔드 API 확인
curl http://localhost:8000/api/health

# 프론트엔드 접속
# Prediction UI: http://localhost:5173
# Training UI: http://localhost:5174
```

---

## 📁 코드베이스 구조

### 디렉토리 구조 개요

```
Routing_ML_4/
├── backend/                    # 백엔드 (Python/FastAPI)
│   ├── api/                    # API 레이어
│   │   ├── routes/             # API 엔드포인트
│   │   │   ├── prediction.py   # 예측 API
│   │   │   ├── training.py     # 학습 API
│   │   │   ├── data_quality.py # 품질 모니터링 API
│   │   │   ├── onprem_nlp.py   # 자연어 검색 API
│   │   │   └── ...
│   │   ├── services/           # 비즈니스 로직
│   │   │   ├── prediction_service.py
│   │   │   ├── data_quality_service.py
│   │   │   ├── onprem_nlp_service.py
│   │   │   └── ...
│   │   ├── app.py              # FastAPI 앱 초기화
│   │   ├── database.py         # DB 연결 설정
│   │   └── config.py           # 설정 관리
│   ├── models/                 # SQLAlchemy 모델
│   │   ├── items.py            # 품목 테이블
│   │   ├── routings.py         # 라우팅 테이블
│   │   └── ...
│   ├── ml/                     # ML 코어 로직
│   │   ├── trainer.py          # 모델 학습
│   │   ├── predictor.py        # 예측 로직
│   │   └── evaluator.py        # 모델 평가
│   └── run_api.py              # 진입점 (uvicorn 실행)
│
├── frontend-prediction/        # Prediction UI (React)
│   ├── src/
│   │   ├── components/         # React 컴포넌트
│   │   │   ├── routing/        # 라우팅 관련 UI
│   │   │   ├── master-data/    # 마스터 데이터 UI
│   │   │   ├── onprem-nlp/     # 자연어 검색 UI
│   │   │   └── ...
│   │   ├── hooks/              # Custom React Hooks
│   │   ├── store/              # Zustand 상태 관리
│   │   ├── lib/                # 유틸리티
│   │   └── App.tsx             # 메인 앱
│   └── package.json
│
├── frontend-training/          # Training UI (React)
│   └── (구조는 frontend-prediction과 유사)
│
├── common/                     # 공통 유틸리티
│   ├── logger.py               # 로깅 유틸
│   └── ...
│
├── migration/                  # DB 마이그레이션
│   ├── schema.sql              # PostgreSQL 스키마
│   └── ...
│
├── scripts/                    # 유틸리티 스크립트
│   ├── migrate_access_to_postgres.py
│   └── ...
│
├── monitoring/                 # 모니터링 설정
│   ├── grafana/
│   │   └── data-quality-dashboard.json
│   └── prometheus/
│
├── docs/                       # 문서
│   ├── ONBOARDING_GUIDE.md     # 이 문서
│   ├── data_quality_monitoring_setup.md
│   └── ...
│
├── tests/                      # 테스트
│   ├── backend/
│   └── frontend/
│
├── requirements.txt            # Python 의존성
├── .env                        # 환경변수 (로컬)
└── README.md                   # 프로젝트 README
```

### 주요 파일 위치 찾기

**예측 기능 수정 시**:
1. 백엔드 로직: `backend/api/services/prediction_service.py`
2. API 엔드포인트: `backend/api/routes/prediction.py`
3. 프론트엔드 UI: `frontend-prediction/src/components/routing/`

**학습 기능 수정 시**:
1. ML 로직: `backend/ml/trainer.py`
2. API 엔드포인트: `backend/api/routes/training.py`
3. 프론트엔드 UI: `frontend-training/src/components/training/`

**데이터 모델 수정 시**:
1. SQLAlchemy 모델: `backend/models/`
2. DB 스키마: `migration/schema.sql`

---

## 🔑 주요 기능 이해하기

### 1. 라우팅 예측 (Prediction)

**목적**: 품목 정보를 입력받아 최적의 공정 라우팅을 예측

**플로우**:
```
사용자 입력 → 프론트엔드 → API → ML 모델 → 예측 결과 → UI 표시
```

**핵심 파일**:
- `backend/ml/predictor.py`: 예측 로직
- `backend/api/services/prediction_service.py`: 예측 서비스
- `frontend-prediction/src/components/routing/RoutingPanel.tsx`: UI

**코드 예시** (`prediction_service.py`):
```python
def predict_routing(item_data: ItemInput) -> RoutingPrediction:
    # 1. 입력 데이터 검증
    validate_item_data(item_data)

    # 2. 특징 추출
    features = extract_features(item_data)

    # 3. ML 모델로 예측
    model = load_model("routing_model.joblib")
    prediction = model.predict([features])

    # 4. 결과 반환
    return RoutingPrediction(
        processes=prediction.processes,
        confidence=prediction.confidence
    )
```

### 2. 모델 학습 (Training)

**목적**: 과거 공정 데이터로 ML 모델을 학습

**플로우**:
```
학습 데이터 준비 → 특징 추출 → 모델 학습 → 평가 → 모델 저장
```

**핵심 파일**:
- `backend/ml/trainer.py`: 학습 로직
- `backend/api/routes/training.py`: 학습 API
- `frontend-training/src/components/training/TrainingPanel.tsx`: UI

**코드 예시** (`trainer.py`):
```python
def train_model(training_data: List[RoutingData]) -> ModelMetrics:
    # 1. 데이터 전처리
    X, y = preprocess_data(training_data)

    # 2. Train/Test 분할
    X_train, X_test, y_train, y_test = train_test_split(X, y)

    # 3. 모델 학습
    model = RandomForestClassifier(n_estimators=100)
    model.fit(X_train, y_train)

    # 4. 평가
    accuracy = model.score(X_test, y_test)

    # 5. 모델 저장
    joblib.dump(model, "routing_model.joblib")

    return ModelMetrics(accuracy=accuracy)
```

### 3. 데이터 품질 모니터링

**목적**: 데이터 완전성, 중복, 이상치를 실시간 모니터링

**플로우**:
```
DB 스캔 → 메트릭 수집 → Prometheus 전송 → Grafana 시각화
```

**핵심 파일**:
- `backend/api/services/data_quality_service.py`: 품질 측정
- `backend/api/routes/data_quality.py`: 품질 API
- `monitoring/grafana/data-quality-dashboard.json`: Grafana 대시보드

**주요 메트릭**:
- `data_quality_score`: 품질 점수 (0-100)
- `data_completeness_rate`: 완전성 비율
- `data_duplicate_items`: 중복 품목 수

### 4. 온프레미스 자연어 검색

**목적**: "스테인리스 파이프 내경 50mm" 같은 자연어로 품목 검색

**플로우**:
```
자연어 입력 → 정규식 파싱 → 필터 추출 → SQL 생성 → 검색 결과
```

**핵심 파일**:
- `backend/api/services/onprem_nlp_service.py`: NLP 파서
- `backend/api/routes/onprem_nlp.py`: NLP API
- `frontend-prediction/src/components/onprem-nlp/OnPremSearch.tsx`: UI

**패턴 예시**:
```python
MATERIAL_PATTERNS = {
    r"스테인리스|stainless|sts|sus": "STS",
    r"알루미늄|aluminum|al": "AL",
}

# "스테인리스 파이프" → {material_code: "STS", part_type: "PIPE"}
```

---

## 🚀 첫 번째 작업 시작하기

### 시나리오 1: 새로운 재질 코드 추가

**요구사항**: "티타늄(Titanium)" 재질 추가

**1단계: 자연어 검색 패턴 추가**

`backend/api/services/onprem_nlp_service.py`:
```python
MATERIAL_PATTERNS = {
    # ... 기존 패턴들
    r"티타늄|titanium|ti": "TI",  # 새로 추가
}
```

**2단계: 테스트**
```bash
# 백엔드 재시작
venv-linux/bin/python -m uvicorn backend.run_api:app --reload

# API 테스트
curl -X POST http://localhost:8000/api/onprem-nlp/query \
  -H "Content-Type: application/json" \
  -d '{"query": "티타늄 파이프 찾아줘"}'

# 예상 응답: {filters: {material_code: "TI", part_type: "PIPE"}}
```

**3단계: 프론트엔드 확인**
- http://localhost:5173 접속
- 자연어 검색 패널에서 "티타늄 파이프" 검색
- 필터가 올바르게 추출되는지 확인

### 시나리오 2: 데이터 품질 알림 추가

**요구사항**: 중복 품목이 10개 이상이면 알림

**1단계: 이슈 탐지 로직 수정**

`backend/api/services/data_quality_service.py`:
```python
def detect_issues(self, metrics: DataQualityMetrics) -> List[DataQualityIssue]:
    issues = []

    # 중복 품목 임계값 수정 (기존: >0, 신규: ≥10)
    if metrics.duplicate_items >= 10:  # 변경
        issues.append(
            DataQualityIssue(
                severity="high",  # critical → high로 변경
                category="duplicate",
                description=f"중복 품목이 {metrics.duplicate_items}개 발견되었습니다",
                # ...
            )
        )

    return issues
```

**2단계: 테스트**
```bash
# 품질 보고서 확인
curl http://localhost:8000/api/data-quality/report | jq '.issues'
```

### 시나리오 3: 예측 API 응답 시간 개선

**요구사항**: 예측 응답 시간 500ms → 200ms 단축

**1단계: 성능 프로파일링**

`backend/api/services/prediction_service.py`:
```python
import time

def predict_routing(item_data: ItemInput) -> RoutingPrediction:
    start = time.time()

    # 기존 로직
    features = extract_features(item_data)  # 시간 측정
    extract_time = time.time() - start

    prediction = model.predict([features])
    predict_time = time.time() - start - extract_time

    logger.info(f"Feature extraction: {extract_time*1000:.2f}ms")
    logger.info(f"Model prediction: {predict_time*1000:.2f}ms")

    return prediction
```

**2단계: 병목 지점 최적화**
- 특징 추출이 느리면 → 캐싱 추가
- 모델 로딩이 느리면 → 모델 사전 로딩

**3단계: 재측정**
```bash
# 로그 확인
tail -f logs/app.log | grep "prediction"
```

---

## 🛠️ 트러블슈팅

### 문제 1: 백엔드 서버가 시작되지 않음

**증상**:
```
ModuleNotFoundError: No module named 'fastapi'
```

**해결**:
```bash
# 가상환경이 활성화되었는지 확인
which python  # venv 경로가 나와야 함

# 의존성 재설치
pip install -r requirements.txt
```

### 문제 2: 프론트엔드 빌드 오류

**증상**:
```
Cannot find module 'react'
```

**해결**:
```bash
# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install
```

### 문제 3: DB 연결 실패

**증상**:
```
sqlalchemy.exc.OperationalError: (psycopg2.OperationalError) FATAL: password authentication failed
```

**해결**:
```bash
# .env 파일 확인
cat .env

# PostgreSQL 서비스 확인
systemctl status postgresql

# 비밀번호 재설정
sudo -u postgres psql
ALTER USER routing_user WITH PASSWORD 'new_password';
```

### 문제 4: Grafana 대시보드가 비어있음

**증상**: 패널에 "No data" 표시

**해결**:
```bash
# Prometheus가 메트릭을 수집하는지 확인
curl http://localhost:9090/api/v1/targets

# 백엔드 Prometheus 엔드포인트 확인
curl http://localhost:8000/api/data-quality/prometheus

# Grafana 데이터소스 테스트
# Configuration > Data Sources > Prometheus > "Test"
```

더 많은 트러블슈팅: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 📚 참고 자료

### 필수 읽을 문서

1. **[README.md](../README.md)**: 프로젝트 개요
2. **[data_quality_monitoring_setup.md](data_quality_monitoring_setup.md)**: 모니터링 설정
3. **[install_guide_ko.md](install_guide_ko.md)**: 설치 가이드

### API 문서

- **Swagger UI**: http://localhost:8000/docs (서버 실행 후)
- **ReDoc**: http://localhost:8000/redoc

### 외부 참고 자료

- **FastAPI 공식 문서**: https://fastapi.tiangolo.com/
- **React 공식 문서**: https://react.dev/
- **Scikit-learn 공식 문서**: https://scikit-learn.org/
- **PostgreSQL 공식 문서**: https://www.postgresql.org/docs/

### 코드 스타일 가이드

**Python**:
- PEP 8 준수
- Type hints 필수 (`def func(x: int) -> str:`)
- Docstrings (Google 스타일)

**TypeScript/React**:
- ESLint + Prettier 사용
- Functional Components + Hooks
- Props 타입 명시

### 커밋 메시지 규칙

```
<type>: <subject>

<body>

<footer>
```

**Type**:
- `feat`: 새 기능
- `fix`: 버그 수정
- `docs`: 문서 수정
- `refactor`: 리팩토링
- `test`: 테스트 추가

**예시**:
```
feat: Add titanium material support to NLP parser

- Added "TI" material code pattern
- Updated NLP service tests
- Added example queries for titanium

Closes #123
```

---

## 🎓 학습 경로 (첫 2주 권장)

### Week 1: 환경 설정 및 코드 탐색

**Day 1-2**: 개발 환경 설정
- [ ] 저장소 클론 및 의존성 설치
- [ ] 백엔드/프론트엔드 서버 실행
- [ ] API 문서 탐색 (Swagger UI)

**Day 3-4**: 코드베이스 이해
- [ ] `backend/api/routes/` 파일들 읽기
- [ ] `frontend-prediction/src/components/` 구조 파악
- [ ] 데이터 모델 (`backend/models/`) 이해

**Day 5**: 첫 번째 기능 수정
- [ ] 자연어 검색 패턴 1개 추가
- [ ] 테스트 및 PR 생성

### Week 2: 핵심 기능 깊이 이해

**Day 1-2**: 예측 기능
- [ ] `backend/ml/predictor.py` 분석
- [ ] 예측 API 호출 테스트
- [ ] 프론트엔드 예측 UI 수정 실습

**Day 3-4**: 학습 기능
- [ ] `backend/ml/trainer.py` 분석
- [ ] 샘플 데이터로 모델 학습 실행
- [ ] 학습 결과 평가 방법 이해

**Day 5**: 데이터 품질 모니터링
- [ ] Grafana 대시보드 설정
- [ ] 품질 메트릭 API 테스트
- [ ] 알림 설정 실습

---

## 💬 도움 요청 방법

### 내부 채널

- **Slack**: `#routing-ml-dev` 채널
- **이메일**: ml-team@company.com
- **담당자**: ML Team Lead

### 이슈 리포팅

GitHub Issues에 다음 템플릿으로 작성:

```markdown
## 문제 설명
간단한 요약

## 재현 방법
1. Step 1
2. Step 2
3. ...

## 예상 동작
무엇을 예상했는지

## 실제 동작
실제로 무엇이 일어났는지

## 환경
- OS: Ubuntu 22.04
- Python: 3.11.5
- Node.js: 18.17.0

## 로그
```
로그 붙여넣기
```
```

---

## ✅ 온보딩 체크리스트

- [ ] 저장소 클론 및 의존성 설치 완료
- [ ] 백엔드 서버 정상 실행 (http://localhost:8000/docs)
- [ ] 프론트엔드 Prediction UI 접속 (http://localhost:5173)
- [ ] 프론트엔드 Training UI 접속 (http://localhost:5174)
- [ ] API 문서 확인 및 테스트 API 호출 성공
- [ ] 코드베이스 주요 디렉토리 파악
- [ ] 예측 기능 플로우 이해
- [ ] 학습 기능 플로우 이해
- [ ] 데이터 품질 모니터링 대시보드 접속
- [ ] 첫 번째 코드 수정 및 테스트 완료
- [ ] 첫 번째 PR 생성

---

**환영합니다! 🎉**

궁금한 점이 있으면 언제든지 ML Team에 문의해주세요.

**작성자**: ML Team
**최종 업데이트**: 2025-10-06
**버전**: 1.0.0
