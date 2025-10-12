# API 버전 관리 시스템

**문서 ID**: AVM-2025-10-06
**버전**: 1.0.0
**작성일**: 2025-10-06
**작성자**: ML Team

---

## 개요

Routing ML v4 프로젝트의 API 버전 관리 정책 및 구현 가이드입니다.

### 목적
- **하위 호환성 보장**: 기존 클라이언트가 업데이트 없이 계속 작동
- **안정적인 마이그레이션**: 점진적인 API 변경
- **명확한 버전 정책**: 개발자 친화적인 버전 관리

---

## 버전 관리 정책

### Semantic Versioning

API 버전은 `v{MAJOR}` 형식을 사용합니다:

- **v1**: 초기 안정 버전
- **v2**: Breaking changes 포함 (하위 호환 불가)
- **v3**: 차기 메이저 버전

### 버전 변경 기준

| 변경 유형 | 버전 증가 | 예시 |
|----------|----------|------|
| **Breaking Changes** | Major (v1 → v2) | 응답 스키마 변경, 필수 파라미터 추가 |
| **New Features** | Minor (동일 버전 유지) | 새 엔드포인트 추가, 선택 파라미터 추가 |
| **Bug Fixes** | Patch (동일 버전 유지) | 버그 수정, 성능 개선 |

---

## FastAPI 버전 라우팅 구조

### 디렉토리 구조

```
backend/api/
├── app.py                    # 메인 애플리케이션
├── versions/
│   ├── __init__.py
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── prediction.py
│   │   │   ├── training.py
│   │   │   ├── routing.py
│   │   │   └── anomaly.py
│   │   └── schemas/
│   │       ├── __init__.py
│   │       ├── prediction.py
│   │       ├── training.py
│   │       └── anomaly.py
│   └── v2/
│       ├── __init__.py
│       ├── routes/
│       └── schemas/
└── routes/                   # 레거시 (현재 구조)
    ├── prediction.py
    ├── training.py
    └── ...
```

### 버전 라우터 설정

#### 1. `backend/api/versions/v1/__init__.py`

```python
"""API v1 - 초기 안정 버전."""
from fastapi import APIRouter

from .routes import prediction, training, routing, anomaly

router = APIRouter(prefix="/v1")

# v1 라우터 등록
router.include_router(prediction.router, prefix="/prediction", tags=["v1-prediction"])
router.include_router(training.router, prefix="/training", tags=["v1-training"])
router.include_router(routing.router, prefix="/routing", tags=["v1-routing"])
router.include_router(anomaly.router, prefix="/anomaly", tags=["v1-anomaly"])
```

#### 2. `backend/api/app.py` 수정

```python
from fastapi import FastAPI
from backend.api.versions import v1, v2
from backend.api.routes import health  # 버전 독립적

app = FastAPI(
    title="Routing ML API",
    version="4.0.0",
    description="공정 라우팅 예측 및 학습 API (버전 관리 지원)",
)

# 버전별 라우터
app.include_router(v1.router, prefix="/api")  # /api/v1/prediction/...
app.include_router(v2.router, prefix="/api")  # /api/v2/prediction/... (미래)

# 버전 독립적 엔드포인트
app.include_router(health.router, prefix="/api", tags=["health"])

# 레거시 지원 (v1으로 리다이렉트)
app.include_router(v1.router, prefix="/api/legacy", deprecated=True)
```

---

## 버전별 스키마 정의

### v1 스키마 예시

#### `backend/api/versions/v1/schemas/prediction.py`

```python
"""API v1 - Prediction 스키마."""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    """예측 요청 (v1)."""

    item_code: str = Field(..., description="품목 코드")
    quantity: int = Field(..., ge=1, description="수량")
    priority: Optional[str] = Field("NORMAL", description="우선순위")


class RouteStep(BaseModel):
    """공정 단계 (v1)."""

    sequence: int = Field(..., description="순서")
    process_code: str = Field(..., description="공정 코드")
    process_name: str = Field(..., description="공정명")
    work_center: str = Field(..., description="작업장")
    estimated_time: float = Field(..., description="예상 시간 (분)")


class PredictionResponse(BaseModel):
    """예측 응답 (v1)."""

    item_code: str = Field(..., description="품목 코드")
    route: List[RouteStep] = Field(..., description="예측된 라우팅")
    confidence: float = Field(..., ge=0.0, le=1.0, description="신뢰도")
    model_version: str = Field(..., description="모델 버전")
    predicted_at: datetime = Field(..., description="예측 시각")
```

### v2 스키마 예시 (Breaking Changes)

#### `backend/api/versions/v2/schemas/prediction.py`

```python
"""API v2 - Prediction 스키마 (Breaking Changes)."""
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    """예측 요청 (v2) - 배치 지원 추가."""

    items: List[Dict[str, Any]] = Field(..., description="품목 리스트 (배치)")
    # Breaking Change: item_code → items (배치 처리)

    options: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="예측 옵션"
    )


class RouteStep(BaseModel):
    """공정 단계 (v2) - 비용 정보 추가."""

    sequence: int = Field(..., description="순서")
    process_code: str = Field(..., description="공정 코드")
    process_name: str = Field(..., description="공정명")
    work_center: str = Field(..., description="작업장")
    estimated_time: float = Field(..., description="예상 시간 (분)")

    # v2 신규 필드
    cost: float = Field(..., description="예상 비용")
    resource_utilization: float = Field(..., description="자원 활용률")


class PredictionResponse(BaseModel):
    """예측 응답 (v2) - 배치 결과."""

    predictions: List[Dict[str, Any]] = Field(..., description="예측 결과 리스트")
    # Breaking Change: 단일 결과 → 배치 결과

    total_items: int = Field(..., description="처리된 품목 수")
    succeeded: int = Field(..., description="성공 수")
    failed: int = Field(..., description="실패 수")
    predicted_at: datetime = Field(..., description="예측 시각")
```

---

## 버전별 엔드포인트 구현

### v1 엔드포인트

#### `backend/api/versions/v1/routes/prediction.py`

```python
"""API v1 - Prediction 엔드포인트."""
from fastapi import APIRouter, Depends, HTTPException
import pyodbc
from backend.database import get_db_connection
from ..schemas.prediction import PredictionRequest, PredictionResponse
from backend.api.services.predictor_service import PredictorService

router = APIRouter()


@router.post("/predict", response_model=PredictionResponse)
async def predict_routing(
    request: PredictionRequest,
    conn: pyodbc.Connection = Depends(get_db_connection),
):
    """
    공정 라우팅 예측 (v1).

    - **item_code**: 품목 코드
    - **quantity**: 수량
    - **priority**: 우선순위 (NORMAL, HIGH, URGENT)
    """
    service = PredictorService(conn)
    result = service.predict(
        item_code=request.item_code,
        quantity=request.quantity,
        priority=request.priority,
    )
    return result
```

### v2 엔드포인트 (미래)

#### `backend/api/versions/v2/routes/prediction.py`

```python
"""API v2 - Prediction 엔드포인트 (배치 지원)."""
from fastapi import APIRouter, Depends, HTTPException
import pyodbc
from backend.database import get_db_connection
from ..schemas.prediction import PredictionRequest, PredictionResponse
from backend.api.services.predictor_service_v2 import PredictorServiceV2

router = APIRouter()


@router.post("/predict", response_model=PredictionResponse)
async def predict_routing_batch(
    request: PredictionRequest,
    conn: pyodbc.Connection = Depends(get_db_connection),
):
    """
    공정 라우팅 배치 예측 (v2).

    **Breaking Changes from v1**:
    - 단일 품목 → 배치 처리
    - 응답 스키마 변경 (predictions 리스트)
    - 비용 및 자원 활용률 정보 추가
    """
    service = PredictorServiceV2(conn)
    result = service.predict_batch(
        items=request.items,
        options=request.options,
    )
    return result
```

---

## Deprecation 정책

### 단계별 프로세스

1. **예고 (3개월 전)**
   - 문서에 Deprecation 공지
   - 응답 헤더에 경고 추가: `Deprecation: true`, `Sunset: 2025-12-31`

2. **경고 (1개월 전)**
   - API 응답에 deprecation 메시지 포함
   - 로그에 사용 추적

3. **제거**
   - 예정된 날짜에 제거
   - HTTP 410 Gone 반환

### 구현 예시

```python
from fastapi import APIRouter, Response
from datetime import datetime

router = APIRouter()


@router.post("/old-endpoint", deprecated=True)
async def old_endpoint(response: Response):
    """
    **DEPRECATED**: 이 엔드포인트는 2025-12-31에 제거됩니다.

    대신 `/api/v2/new-endpoint`를 사용하세요.
    """
    # Deprecation 헤더 추가
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"] = "2025-12-31"
    response.headers["Link"] = '</api/v2/new-endpoint>; rel="successor-version"'

    return {
        "warning": "This endpoint is deprecated and will be removed on 2025-12-31",
        "migration_guide": "https://docs.example.com/migration/v1-to-v2",
        "data": {}  # 레거시 응답
    }
```

---

## 클라이언트 마이그레이션 가이드

### v1 → v2 마이그레이션

#### 변경 사항 요약

| 엔드포인트 | v1 | v2 | 변경 내용 |
|----------|----|----|----------|
| `/prediction/predict` | 단일 품목 | 배치 처리 | 요청/응답 스키마 변경 |
| `/anomaly/detect` | 동기 처리 | 비동기 작업 | 작업 ID 반환 후 폴링 |
| `/training/train` | JSON 응답 | SSE 스트리밍 | 실시간 진행률 제공 |

#### 코드 마이그레이션 예시

**v1 클라이언트 (기존)**

```typescript
// v1 API 호출
const response = await fetch('/api/v1/prediction/predict', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    item_code: 'ITEM001',
    quantity: 100,
    priority: 'NORMAL'
  })
});

const result = await response.json();
console.log(result.route);  // 단일 라우팅 결과
```

**v2 클라이언트 (신규)**

```typescript
// v2 API 호출 (배치)
const response = await fetch('/api/v2/prediction/predict', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [
      { item_code: 'ITEM001', quantity: 100, priority: 'NORMAL' },
      { item_code: 'ITEM002', quantity: 200, priority: 'HIGH' }
    ],
    options: {
      include_cost: true,
      include_resource_utilization: true
    }
  })
});

const result = await response.json();
console.log(result.predictions);  // 배치 결과 리스트
console.log(`성공: ${result.succeeded}, 실패: ${result.failed}`);
```

### 점진적 마이그레이션 전략

#### 1. 병렬 실행 (2-3개월)

```typescript
// v1과 v2 동시 지원
const apiVersion = config.useV2 ? 'v2' : 'v1';

async function predict(items: Item[]) {
  if (apiVersion === 'v1') {
    // v1 로직 (단일 품목만)
    return await predictV1(items[0]);
  } else {
    // v2 로직 (배치)
    return await predictV2(items);
  }
}
```

#### 2. Feature Flag 사용

```typescript
import { useFeatureFlag } from '@/lib/featureFlags';

function usePredictionAPI() {
  const useV2API = useFeatureFlag('api-v2-prediction');

  return useV2API ? predictV2 : predictV1;
}
```

#### 3. 단계별 전환

1. **Week 1-2**: v2 API 개발 및 내부 테스트
2. **Week 3-4**: 베타 사용자 대상 v2 API 공개 (Feature Flag)
3. **Week 5-8**: 점진적 v2 전환 (10% → 50% → 100%)
4. **Week 9-12**: v1 Deprecation 공지
5. **Week 13+**: v1 제거

---

## 버전 관리 모니터링

### 메트릭 수집

```python
from fastapi import Request
from prometheus_client import Counter

# API 버전 사용량 추적
api_version_requests = Counter(
    'api_version_requests_total',
    'API 버전별 요청 수',
    ['version', 'endpoint']
)


@router.middleware("http")
async def track_api_version(request: Request, call_next):
    """API 버전 사용량 추적."""
    version = request.url.path.split('/')[2]  # /api/v1/... → v1
    endpoint = request.url.path.split('/')[-1]

    api_version_requests.labels(version=version, endpoint=endpoint).inc()

    response = await call_next(request)
    return response
```

### Grafana 대시보드

```yaml
# Prometheus 쿼리
- name: "v1 API 사용률"
  query: |
    sum(rate(api_version_requests_total{version="v1"}[5m]))
    /
    sum(rate(api_version_requests_total[5m]))
    * 100

- name: "v2 API 채택률"
  query: |
    sum(rate(api_version_requests_total{version="v2"}[5m]))
    /
    sum(rate(api_version_requests_total[5m]))
    * 100
```

---

## 문서화

### OpenAPI 스펙

FastAPI는 자동으로 버전별 OpenAPI 문서를 생성합니다:

- **v1 문서**: `http://localhost:8000/api/v1/docs`
- **v2 문서**: `http://localhost:8000/api/v2/docs`
- **통합 문서**: `http://localhost:8000/docs` (모든 버전)

### 버전 히스토리

| 버전 | 릴리스 날짜 | 주요 변경 사항 | 문서 |
|------|------------|---------------|------|
| v1.0.0 | 2024-01-15 | 초기 릴리스 | [v1 문서](./v1) |
| v1.1.0 | 2024-06-01 | Anomaly Detection 추가 | [v1.1 변경사항](./v1.1) |
| v2.0.0 | 2025-01-15 (예정) | 배치 처리, 비동기 작업 | [v2 마이그레이션](./v2) |

---

## 체크리스트

### 신규 버전 릴리스 시

- [ ] 버전 디렉토리 생성 (`backend/api/versions/v{N}`)
- [ ] 스키마 정의 (`schemas/`)
- [ ] 라우터 구현 (`routes/`)
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 작성
- [ ] OpenAPI 문서 확인
- [ ] 마이그레이션 가이드 작성
- [ ] Breaking Changes 문서화
- [ ] 이전 버전 Deprecation 공지
- [ ] 모니터링 설정
- [ ] 릴리스 노트 작성

### 버전 제거 시

- [ ] Deprecation 3개월 전 공지
- [ ] 사용량 메트릭 확인
- [ ] 클라이언트 마이그레이션 확인
- [ ] 최종 경고 (1개월 전)
- [ ] 제거 및 HTTP 410 반환
- [ ] 문서 아카이브

---

## 참고 자료

- [FastAPI Versioning Best Practices](https://fastapi.tiangolo.com/advanced/path-operation-advanced-configuration/)
- [Semantic Versioning](https://semver.org/)
- [API Deprecation RFC](https://tools.ietf.org/id/draft-dalal-deprecation-header-01.html)
- [REST API Versioning Strategies](https://www.freecodecamp.org/news/how-to-version-a-rest-api/)

---

**문서 종료**
