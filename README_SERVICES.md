# Routing-ML 서비스 분리 가이드

## 🎯 개요

Routing-ML 프로젝트는 두 개의 독립적인 웹 서비스로 분리되어 운영됩니다:

1. **Training Service (훈련 서비스)** - 모델 훈련 및 데이터 관리
2. **Prediction Service (예측 서비스)** - 라우팅 생성 및 예측

---

## 📊 서비스 구조

### 1️⃣ Training Service (Port 8001)
**모델 훈련 및 데이터 관리 서비스**

#### 주요 기능
- ✅ 모델 훈련 및 버전 관리
- ✅ 훈련 데이터 관리
- ✅ 데이터베이스 설정 및 연결
- ✅ 마스터 데이터 관리
- ✅ 훈련 메트릭 및 이력 조회

#### API 엔드포인트
```
GET  /docs                          # API 문서
GET  /api/trainer/status            # 훈련 상태
POST /api/trainer/run               # 훈련 실행
GET  /api/trainer/versions          # 모델 버전 목록
POST /api/trainer/versions/{version}/activate  # 모델 활성화
GET  /api/database/config           # DB 설정 조회
POST /api/database/config           # DB 설정 업데이트
GET  /api/master-data/tree          # 마스터 데이터 트리
```

#### 파일 위치
- **애플리케이션:** [backend/api/training_app.py](backend/api/training_app.py)
- **실행 스크립트:** [run_training_service.bat](run_training_service.bat)

---

### 2️⃣ Prediction Service (Port 8002)
**라우팅 생성 및 예측 서비스**

#### 주요 기능
- ✅ 라우팅 예측 및 생성
- ✅ 품목 정보 조회
- ✅ 유사 품목 검색
- ✅ 라우팅 그룹 관리
- ✅ ERP 연동

#### API 엔드포인트
```
GET  /docs                          # API 문서
POST /api/predict                   # 라우팅 예측
GET  /api/items/purchase-orders     # 발주 품목 목록
GET  /api/items/{item_cd}           # 품목 정보
GET  /api/items/{item_cd}/properties  # 품목 속성
POST /api/similarity/search         # 유사 품목 검색
GET  /api/routing/groups            # 라우팅 그룹 목록
POST /api/routing/groups            # 라우팅 그룹 생성
```

#### 파일 위치
- **애플리케이션:** [backend/api/prediction_app.py](backend/api/prediction_app.py)
- **실행 스크립트:** [run_prediction_service.bat](run_prediction_service.bat)

---

## 🚀 실행 방법

### 방법 1: 개별 실행

#### Training Service 실행
```bash
# Windows
run_training_service.bat

# 또는 Python 직접 실행
.venv\Scripts\python.exe -m uvicorn backend.api.training_app:app --host 0.0.0.0 --port 8001 --reload
```

#### Prediction Service 실행
```bash
# Windows
run_prediction_service.bat

# 또는 Python 직접 실행
.venv\Scripts\python.exe -m uvicorn backend.api.prediction_app:app --host 0.0.0.0 --port 8002 --reload
```

### 방법 2: 동시 실행

```bash
# Windows - 두 서비스를 별도 창에서 동시 실행
run_all_services.bat
```

---

## 📡 접속 정보

### Training Service
- **URL:** http://localhost:8001
- **API 문서:** http://localhost:8001/docs
- **OpenAPI:** http://localhost:8001/openapi.json

### Prediction Service
- **URL:** http://localhost:8002
- **API 문서:** http://localhost:8002/docs
- **OpenAPI:** http://localhost:8002/openapi.json

---

## 🔧 기술 스택

### 공통
- FastAPI 백엔드
- PyODBC 데이터베이스 연결
- JWT 인증
- CORS 미들웨어

### 데이터베이스
- Access Database (기본)
- Microsoft SQL Server (MSSQL)

---

## 📁 파일 구조

```
Routing_ML/
├── backend/
│   └── api/
│       ├── app.py                 # 통합 애플리케이션 (기존)
│       ├── training_app.py        # 훈련 서비스 (신규)
│       ├── prediction_app.py      # 예측 서비스 (신규)
│       └── routes/
│           ├── trainer.py         # 훈련 관련 라우터
│           ├── training.py        # 훈련 설정 라우터
│           ├── prediction.py      # 예측 라우터
│           ├── items.py           # 품목 조회 라우터 (신규)
│           └── database_config.py # DB 설정 라우터 (신규)
│
├── run_training_service.bat       # 훈련 서비스 실행 스크립트
├── run_prediction_service.bat     # 예측 서비스 실행 스크립트
├── run_all_services.bat           # 전체 서비스 실행 스크립트
└── README_SERVICES.md             # 본 문서
```

---

## 🔐 인증

두 서비스 모두 JWT 토큰 기반 인증을 사용합니다.

### 로그인
```bash
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'
```

### 인증된 요청
```bash
curl -X GET http://localhost:8001/api/trainer/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ⚙️ 환경 설정

### .env 파일
```bash
# 데이터베이스 설정
DB_TYPE=ACCESS                    # ACCESS or MSSQL
MSSQL_SERVER=K3-DB.ksm.co.kr,1433
MSSQL_DATABASE=KsmErp
MSSQL_USER=FKSM_BI
MSSQL_PASSWORD=your_password

# API 설정
API_HOST=0.0.0.0
API_PORT=8000

# 모델 경로
MODEL_PATH=deliverables/models/default
```

---

## 🎨 프론트엔드 통합

### Training Service 연동
```typescript
// 모델 훈련 상태 조회
const response = await fetch('http://localhost:8001/api/trainer/status', {
  credentials: 'include',
});
const status = await response.json();
```

### Prediction Service 연동
```typescript
// 품목 정보 조회
const response = await fetch('http://localhost:8002/api/items/PROD-A-001/properties', {
  credentials: 'include',
});
const properties = await response.json();
```

---

## 🛠️ 개발 가이드

### 새 라우터 추가

#### Training Service에 추가
```python
# backend/api/training_app.py
from backend.api.routes.your_router import router as your_router

app.include_router(your_router)
```

#### Prediction Service에 추가
```python
# backend/api/prediction_app.py
from backend.api.routes.your_router import router as your_router

app.include_router(your_router)
```

### 로그 확인
두 서비스의 로그는 각각의 터미널 창에 출력됩니다.

---

## 🐛 문제 해결

### 포트 충돌
```bash
# 포트 사용 중인 프로세스 확인 (Windows)
netstat -ano | findstr :8001
netstat -ano | findstr :8002

# 프로세스 종료
taskkill /PID <PID> /F
```

### 데이터베이스 연결 오류
```bash
# 연결 테스트
curl -X POST http://localhost:8001/api/database/test-connection \
  -H "Content-Type: application/json" \
  -d '{"db_type":"MSSQL","server":"...","database":"...","user":"...","password":"..."}'
```

---

## 📈 성능 모니터링

### Health Check
```bash
# Prediction Service
curl http://localhost:8002/api/health

# 응답 예시
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-10-02T12:00:00Z"
}
```

### Metrics
```bash
# Training Service
curl http://localhost:8001/api/trainer/metrics

# Prediction Service
curl http://localhost:8002/api/metrics
```

---

## 📝 변경 이력

### v1.0.0 (2025-10-02)
- ✅ Training Service와 Prediction Service 분리
- ✅ 독립 실행 스크립트 추가
- ✅ 품목 조회 API 추가 (items router)
- ✅ 데이터베이스 설정 API 추가 (database_config router)
- ✅ MSSQL 연결 지원 추가

---

## 🤝 기여

문제가 발생하거나 개선 사항이 있으면 이슈를 등록해주세요.

---

## 📞 지원

- **GitHub Issues:** https://github.com/FKSMME/Routing_ML/issues
- **문서:** http://localhost:8001/docs, http://localhost:8002/docs
