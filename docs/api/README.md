# Routing ML API 문서

**버전**: 0.1.0
**Base URL**: `http://localhost:8000`
**문서 자동 생성**: FastAPI + OpenAPI 3.1.0

---

## 📚 자동 생성 문서

### Swagger UI
브라우저에서 interactive API 문서 확인:
```
http://localhost:8000/docs
```

### ReDoc
깔끔한 읽기 전용 문서:
```
http://localhost:8000/redoc
```

### OpenAPI JSON Schema
```
http://localhost:8000/openapi.json
```

---

## 🚀 빠른 시작

### 1. 서버 실행
```bash
venv-linux/bin/python -m uvicorn backend.run_api:app --reload
```

### 2. Health Check
```bash
curl http://localhost:8000/api/health
```

**응답**:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime_seconds": 123.45,
  "timestamp": "2025-10-06T00:00:00.000Z"
}
```

---

## 🔑 인증 (Authentication)

### JWT Bearer Token
대부분의 엔드포인트는 인증이 필요합니다.

#### 1. 로그인
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "password123"
  }'
```

**응답**:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "123",
    "username": "user@example.com",
    "role": "engineer"
  }
}
```

#### 2. 인증 헤더 사용
```bash
curl http://localhost:8000/api/predict \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

## 📋 주요 엔드포인트

### Health & Monitoring

#### GET /api/health
서비스 상태 확인

**Response**: `HealthResponse`

#### GET /api/metrics
Prometheus 메트릭 (텍스트 형식)

#### GET /api/metrics/json
Grafana용 JSON 메트릭

#### GET /api/drift/status
Concept drift 현재 상태

**Response**: `DriftStatusResponse`

#### GET /api/drift/summary?days=7
Drift 요약 (최근 N일)

### Prediction

#### POST /api/predict
라우팅 추천

**Request**: `PredictionRequest`
```json
{
  "item_code": "ITEM-001",
  "item_name": "스테인리스 스틸 파이프",
  "material": "SUS304",
  "dimensions": {
    "diameter": 50.0,
    "thickness": 2.0,
    "length": 1000.0
  }
}
```

**Response**: `PredictionResponse`
```json
{
  "recommendations": [
    {
      "routing_code": "RT-001",
      "routing_name": "스틸 절단 라우팅",
      "similarity": 0.95,
      "operations": [
        {"op_no": "10", "op_name": "절단", "work_center": "WC-01"},
        {"op_no": "20", "op_name": "연마", "work_center": "WC-02"}
      ]
    }
  ],
  "prediction_time_ms": 45.2
}
```

### Training

#### POST /api/training/start
모델 재학습 시작

**Request**: `TrainingRequest`
```json
{
  "dataset_path": "/data/training_20251006.parquet",
  "model_name": "model_20251006_010203"
}
```

### Master Data

#### GET /api/master-data/items
품목 마스터 조회

**Query Params**:
- `search`: 검색어
- `limit`: 최대 결과 수 (기본: 100)
- `offset`: 페이징 offset

#### GET /api/master-data/routings
라우팅 마스터 조회

---

## 🔍 TypeScript 타입 생성

### 자동 생성
```bash
bash scripts/generate_api_types.sh
```

### 생성된 파일
- `frontend-prediction/src/types/api-generated.ts`
- `frontend-training/src/types/api-generated.ts`

### 사용 예시
```typescript
import type { PredictionRequest, PredictionResponse } from '@/types/api-generated';

async function predict(data: PredictionRequest): Promise<PredictionResponse> {
  const response = await fetch('/api/predict', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  return response.json();
}
```

---

## 📊 응답 코드

| 코드 | 의미 | 설명 |
|------|------|------|
| 200 | OK | 성공 |
| 201 | Created | 리소스 생성 성공 |
| 400 | Bad Request | 잘못된 요청 |
| 401 | Unauthorized | 인증 필요 |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스 없음 |
| 422 | Unprocessable Entity | 유효성 검증 실패 |
| 500 | Internal Server Error | 서버 오류 |

### 에러 응답 형식
```json
{
  "detail": "에러 메시지",
  "error_code": "VALIDATION_ERROR",
  "timestamp": "2025-10-06T00:00:00.000Z"
}
```

---

## 🧪 테스트

### cURL 예제
```bash
# Health check
curl http://localhost:8000/api/health

# Prediction (인증 필요)
curl -X POST http://localhost:8000/api/predict \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @prediction_request.json
```

### Python 예제
```python
import requests

# Login
response = requests.post(
    'http://localhost:8000/api/auth/login',
    json={'username': 'user@example.com', 'password': 'password123'}
)
token = response.json()['access_token']

# Prediction
response = requests.post(
    'http://localhost:8000/api/predict',
    headers={'Authorization': f'Bearer {token}'},
    json={
        'item_code': 'ITEM-001',
        'item_name': '스테인리스 스틸 파이프'
    }
)
print(response.json())
```

### JavaScript/TypeScript 예제
```typescript
// Using fetch API
const response = await fetch('/api/predict', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    item_code: 'ITEM-001',
    item_name: '스테인리스 스틸 파이프'
  })
});
const data = await response.json();
```

---

## 📄 스키마 (Schemas)

### PredictionRequest
```typescript
{
  item_code: string;
  item_name: string;
  material?: string;
  dimensions?: {
    diameter?: number;
    thickness?: number;
    length?: number;
  };
  additional_info?: Record<string, any>;
}
```

### PredictionResponse
```typescript
{
  recommendations: Array<{
    routing_code: string;
    routing_name: string;
    similarity: number;
    operations: Array<{
      op_no: string;
      op_name: string;
      work_center: string;
      description?: string;
    }>;
  }>;
  prediction_time_ms: number;
  model_version: string;
}
```

### HealthResponse
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy';
  version?: string;
  uptime_seconds?: number;
  timestamp?: string;
}
```

---

## 🔄 버전 관리

### API 버전
현재 버전: **v0.1.0**

향후 버전 변경 시:
- **Major**: 호환성 깨지는 변경 (v2.0.0)
- **Minor**: 새 기능 추가 (v0.2.0)
- **Patch**: 버그 수정 (v0.1.1)

### 폐기 정책 (Deprecation)
1. 폐기 예정 3개월 전 공지
2. 응답 헤더에 `Deprecated: true` 추가
3. 문서에 대체 엔드포인트 명시

---

## 📚 추가 문서

- [OpenAPI 스키마](../../backend/openapi.json)
- [TypeScript 타입 생성 가이드](../openapi_type_generation.md)
- [인증 및 권한 가이드](./authentication.md)
- [에러 처리 가이드](./error_handling.md)

---

**최종 업데이트**: 2025-10-06
**문의**: ML Team <ml-team@company.com>
