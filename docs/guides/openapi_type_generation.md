# OpenAPI TypeScript 타입 자동 생성 가이드

## 개요

FastAPI 백엔드의 OpenAPI 스키마로부터 TypeScript 타입을 자동 생성하여 프론트엔드와 백엔드 간 타입 안전성을 보장합니다.

## 장점

- ✅ **타입 안전성**: API 응답/요청 타입이 자동으로 동기화
- ✅ **개발 생산성**: 수동 타입 작성 불필요
- ✅ **리팩토링 안전**: API 변경 시 TypeScript 컴파일 에러로 즉시 감지
- ✅ **자동화**: API 변경 시 CI/CD에서 자동 타입 재생성

## 설치

### 1. openapi-typescript 설치

```bash
npm install -g openapi-typescript
# 또는 프로젝트별 설치
npm install --save-dev openapi-typescript
```

### 2. 의존성 확인

```bash
# Node.js 및 npm 버전 확인
node --version  # v18+ 권장
npm --version   # v9+ 권장
```

## 사용 방법

### 방법 1: 자동화 스크립트 사용 (권장)

```bash
# 스크립트 실행
bash scripts/generate_api_types.sh

# 출력 예시:
# ==========================================
# OpenAPI Schema & TypeScript 타입 생성
# ==========================================
# Step 1: FastAPI 앱에서 OpenAPI 스키마 생성 중...
# ✅ Paths: 45
# ✅ Schemas: 78
# Step 2: openapi-typescript로 TypeScript 타입 생성 중...
# Step 3: Helper 타입 추가 중...
# Step 4: TypeScript 컴파일 검증 중...
# ✅ 타입 생성 완료!
```

### 방법 2: 수동 단계별 실행

#### Step 1: OpenAPI 스키마 생성

```bash
# Python 스크립트로 OpenAPI JSON 생성
venv-linux/bin/python << 'EOF'
from fastapi.openapi.utils import get_openapi
from backend.api.app import app
import json

schema = get_openapi(
    title=app.title,
    version=app.version,
    openapi_version='3.1.0',
    routes=app.routes
)

with open('backend/openapi.json', 'w', encoding='utf-8') as f:
    json.dump(schema, f, indent=2, ensure_ascii=False)

print(f"✅ Generated {len(schema['paths'])} endpoints")
EOF
```

#### Step 2: TypeScript 타입 생성

```bash
# Prediction Frontend
npx openapi-typescript backend/openapi.json \
    --output frontend-prediction/src/types/api-generated.ts \
    --path-params-as-types

# Training Frontend
npx openapi-typescript backend/openapi.json \
    --output frontend-training/src/types/api-generated.ts \
    --path-params-as-types
```

#### Step 3: TypeScript 컴파일 검증

```bash
# Prediction Frontend
cd frontend-prediction
npx tsc --noEmit

# Training Frontend
cd frontend-training
npx tsc --noEmit
```

## 생성된 타입 사용하기

### 기본 사용법

```typescript
// frontend-prediction/src/types/api-generated.ts에서 import
import type { paths, components } from '@/types/api-generated';

// Helper 타입 사용
import type {
  ApiResponse,
  ApiRequestBody,
  HealthResponse,
  PredictionRequest,
  PredictionResponse
} from '@/types/api-generated';

// 예시 1: Health check
async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');
  return response.json();
}

// 예시 2: Prediction 요청
async function predict(
  request: PredictionRequest
): Promise<PredictionResponse> {
  const response = await fetch('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  return response.json();
}

// 예시 3: Drift status 조회
type DriftStatus = ApiResponse<'/api/drift/status', 'get'>;

async function getDriftStatus(): Promise<DriftStatus> {
  const response = await fetch('/api/drift/status');
  return response.json();
}
```

### Axios와 함께 사용

```typescript
import axios from 'axios';
import type { PredictionRequest, PredictionResponse } from '@/types/api-generated';

const api = axios.create({ baseURL: '/api' });

async function predict(data: PredictionRequest) {
  const response = await api.post<PredictionResponse>('/predict', data);
  return response.data;
}
```

### React Query와 함께 사용

```typescript
import { useQuery } from '@tanstack/react-query';
import type { HealthResponse } from '@/types/api-generated';

function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async (): Promise<HealthResponse> => {
      const response = await fetch('/api/health');
      return response.json();
    }
  });
}

// 컴포넌트에서 사용
function HealthIndicator() {
  const { data, isLoading } = useHealth();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      Status: {data?.status}
      Uptime: {data?.uptime_seconds}s
    </div>
  );
}
```

## Helper 타입

자동 생성된 파일에 포함되는 유틸리티 타입들:

### ApiResponse<Path, Method>

특정 엔드포인트의 응답 타입 추출

```typescript
// /api/health GET의 응답 타입
type Health = ApiResponse<'/api/health', 'get'>;
// { status: string, version?: string, uptime_seconds?: number, ... }
```

### ApiRequestBody<Path, Method>

특정 엔드포인트의 요청 body 타입 추출

```typescript
// /api/predict POST의 요청 body 타입
type PredictBody = ApiRequestBody<'/api/predict', 'post'>;
```

### ApiPathParams<Path, Method>

Path parameter 타입 추출

```typescript
// /api/items/{id} GET의 path params
type ItemParams = ApiPathParams<'/api/items/{id}', 'get'>;
// { id: string }
```

### ApiQueryParams<Path, Method>

Query parameter 타입 추출

```typescript
// /api/drift/summary?days=7 GET의 query params
type DriftQuery = ApiQueryParams<'/api/drift/summary', 'get'>;
// { days?: number }
```

## CI/CD 통합

### GitHub Actions 워크플로우

`.github/workflows/api-types-check.yml`:

```yaml
name: API Types Check

on:
  push:
    paths:
      - 'backend/api/**/*.py'
      - 'backend/api/schemas.py'
  pull_request:
    paths:
      - 'backend/api/**/*.py'

jobs:
  generate-types:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          python -m venv venv
          source venv/bin/activate
          pip install -r requirements.txt
          npm install -g openapi-typescript

      - name: Generate API types
        run: bash scripts/generate_api_types.sh

      - name: Check for changes
        run: |
          if git diff --exit-code frontend-*/src/types/api-generated.ts; then
            echo "✅ API types are up-to-date"
          else
            echo "❌ API types are out of sync. Run: bash scripts/generate_api_types.sh"
            exit 1
          fi
```

### Pre-commit Hook

`.husky/pre-commit-api-types`:

```bash
#!/bin/bash

# API 스키마가 변경되었는지 확인
if git diff --cached --name-only | grep -qE '^backend/api/(routes|schemas)'; then
    echo "🔍 API 변경 감지 - 타입 재생성 중..."

    # 타입 재생성
    bash scripts/generate_api_types.sh

    # 생성된 파일을 스테이징에 추가
    git add frontend-*/src/types/api-generated.ts backend/openapi.json

    echo "✅ API 타입 업데이트 완료"
fi
```

## 트러블슈팅

### 문제 1: openapi-typescript not found

```bash
# 해결방법 1: 전역 설치
npm install -g openapi-typescript

# 해결방법 2: npx 사용 (설치 없이)
npx openapi-typescript backend/openapi.json --output types.ts
```

### 문제 2: FastAPI 앱 로딩 실패

```bash
# Python 의존성 확인
venv-linux/bin/python -c "from backend.api.app import app; print('OK')"

# 에러 발생 시 의존성 재설치
venv-linux/bin/pip install -r requirements.txt
```

### 문제 3: TypeScript 컴파일 에러

```bash
# 생성된 타입 파일 확인
head -50 frontend-prediction/src/types/api-generated.ts

# TypeScript 버전 확인 (5.0+ 권장)
npx tsc --version

# tsconfig.json 확인
cat frontend-prediction/tsconfig.json | grep -A 5 compilerOptions
```

### 문제 4: 타입이 undefined로 추론됨

```typescript
// ❌ 잘못된 사용
type Wrong = paths['/api/health']['get']['responses']['200'];

// ✅ 올바른 사용 - Helper 타입 사용
type Correct = ApiResponse<'/api/health', 'get'>;
```

## 모범 사례

### 1. 타입 파일은 직접 수정하지 않기

```typescript
// ❌ 나쁜 예: api-generated.ts 직접 수정
// 다음 생성 시 덮어씌워짐

// ✅ 좋은 예: 별도 파일에서 확장
// frontend-prediction/src/types/api-extended.ts
import type { PredictionResponse } from './api-generated';

export interface ExtendedPredictionResponse extends PredictionResponse {
  // 프론트엔드 전용 필드 추가
  cachedAt?: Date;
  isFromCache?: boolean;
}
```

### 2. API 변경 시 타입 먼저 재생성

```bash
# 1. 백엔드 API 수정
# 2. 타입 재생성
bash scripts/generate_api_types.sh

# 3. 프론트엔드 코드 수정 (TypeScript 에러 참고)
# 4. 커밋
git add backend/ frontend-*/src/types/api-generated.ts
git commit -m "feat: Add drift detection API"
```

### 3. 재사용 가능한 타입 Export

```typescript
// frontend-prediction/src/types/index.ts
export type {
  HealthResponse,
  PredictionRequest,
  PredictionResponse,
  DriftStatusResponse
} from './api-generated';

// 다른 파일에서 사용
import type { PredictionRequest } from '@/types';
```

## 참고 자료

- [openapi-typescript 공식 문서](https://github.com/drwpow/openapi-typescript)
- [FastAPI OpenAPI 생성](https://fastapi.tiangolo.com/advanced/extending-openapi/)
- [TypeScript Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)

## Changelog

- **2025-10-05**: 초기 구축 with Helper 타입
- **Future**: Zod 스키마 생성, Runtime validation 추가
