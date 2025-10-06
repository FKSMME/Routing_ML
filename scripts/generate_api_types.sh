#!/bin/bash
# OpenAPI Schema 생성 및 TypeScript 타입 자동 생성
# API 스키마 변경 시 자동으로 프론트엔드 타입 동기화

set -euo pipefail

# Configuration
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_PATH="${REPO_ROOT}/venv-linux"
PYTHON="${VENV_PATH}/bin/python"
OPENAPI_SCHEMA="${REPO_ROOT}/backend/openapi.json"
PREDICTION_TYPES="${REPO_ROOT}/frontend-prediction/src/types/api-generated.ts"
TRAINING_TYPES="${REPO_ROOT}/frontend-training/src/types/api-generated.ts"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $*"
}

error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log "=========================================="
log "OpenAPI Schema & TypeScript 타입 생성"
log "=========================================="

# Step 1: Generate OpenAPI schema from FastAPI app
log "Step 1: FastAPI 앱에서 OpenAPI 스키마 생성 중..."
"$PYTHON" -c "
from fastapi.openapi.utils import get_openapi
from backend.api.app import app
import json

schema = get_openapi(
    title=app.title,
    version=app.version,
    openapi_version='3.1.0',
    routes=app.routes
)

with open('${OPENAPI_SCHEMA}', 'w', encoding='utf-8') as f:
    json.dump(schema, f, indent=2, ensure_ascii=False)

print(f'✅ OpenAPI schema saved: ${OPENAPI_SCHEMA}')
print(f'   Paths: {len(schema[\"paths\"])}')
print(f'   Schemas: {len(schema.get(\"components\", {}).get(\"schemas\", {}))}')
" 2>&1 || {
    error "OpenAPI 스키마 생성 실패"
    exit 1
}

# Check if openapi-typescript is installed
if ! command -v npx &> /dev/null; then
    error "npx not found. Please install Node.js and npm."
    exit 1
fi

# Step 2: Generate TypeScript types using openapi-typescript
log "Step 2: openapi-typescript로 TypeScript 타입 생성 중..."

# Check if openapi-typescript is available
if ! npx openapi-typescript --version &> /dev/null; then
    warn "openapi-typescript가 설치되지 않았습니다. 설치 중..."
    npm install -g openapi-typescript
fi

# Generate types for prediction frontend
log "  - Prediction Frontend 타입 생성..."
npx openapi-typescript "${OPENAPI_SCHEMA}" \
    --output "${PREDICTION_TYPES}" \
    --path-params-as-types \
    2>&1 || {
    error "Prediction Frontend 타입 생성 실패"
    exit 1
}

# Generate types for training frontend
log "  - Training Frontend 타입 생성..."
npx openapi-typescript "${OPENAPI_SCHEMA}" \
    --output "${TRAINING_TYPES}" \
    --path-params-as-types \
    2>&1 || {
    error "Training Frontend 타입 생성 실패"
    exit 1
}

# Step 3: Add helper types and utilities
log "Step 3: Helper 타입 추가 중..."

cat >> "${PREDICTION_TYPES}" << 'EOF'

// ============================================
// Helper Types (Auto-generated)
// ============================================

/**
 * Extract response type from OpenAPI paths
 * Usage: ApiResponse<'/api/health', 'get'>
 */
export type ApiResponse<
  Path extends keyof paths,
  Method extends keyof paths[Path]
> = paths[Path][Method] extends { responses: { 200: { content: { 'application/json': infer R } } } }
  ? R
  : never;

/**
 * Extract request body type from OpenAPI paths
 * Usage: ApiRequestBody<'/api/predict', 'post'>
 */
export type ApiRequestBody<
  Path extends keyof paths,
  Method extends keyof paths[Path]
> = paths[Path][Method] extends { requestBody: { content: { 'application/json': infer R } } }
  ? R
  : never;

/**
 * Extract path parameters type
 * Usage: ApiPathParams<'/api/items/{id}', 'get'>
 */
export type ApiPathParams<
  Path extends keyof paths,
  Method extends keyof paths[Path]
> = paths[Path][Method] extends { parameters: { path: infer P } }
  ? P
  : never;

/**
 * Extract query parameters type
 * Usage: ApiQueryParams<'/api/drift/summary', 'get'>
 */
export type ApiQueryParams<
  Path extends keyof paths,
  Method extends keyof paths[Path]
> = paths[Path][Method] extends { parameters: { query: infer Q } }
  ? Q
  : never;

// ============================================
// Commonly Used Types (Shortcuts)
// ============================================

export type HealthResponse = ApiResponse<'/api/health', 'get'>;
export type DriftStatusResponse = ApiResponse<'/api/drift/status', 'get'>;
export type DriftSummaryResponse = ApiResponse<'/api/drift/summary', 'get'>;
export type PredictionRequest = ApiRequestBody<'/api/predict', 'post'>;
export type PredictionResponse = ApiResponse<'/api/predict', 'post'>;

EOF

# Copy helper types to training frontend
cat >> "${TRAINING_TYPES}" << 'EOF'

// ============================================
// Helper Types (Auto-generated)
// ============================================

export type ApiResponse<
  Path extends keyof paths,
  Method extends keyof paths[Path]
> = paths[Path][Method] extends { responses: { 200: { content: { 'application/json': infer R } } } }
  ? R
  : never;

export type ApiRequestBody<
  Path extends keyof paths,
  Method extends keyof paths[Path]
> = paths[Path][Method] extends { requestBody: { content: { 'application/json': infer R } } }
  ? R
  : never;

export type ApiPathParams<
  Path extends keyof paths,
  Method extends keyof paths[Path]
> = paths[Path][Method] extends { parameters: { path: infer P } }
  ? P
  : never;

export type ApiQueryParams<
  Path extends keyof paths,
  Method extends keyof paths[Path]
> = paths[Path][Method] extends { parameters: { query: infer Q } }
  ? Q
  : never;

// ============================================
// Commonly Used Types (Shortcuts)
// ============================================

export type HealthResponse = ApiResponse<'/api/health', 'get'>;
export type TrainingRequest = ApiRequestBody<'/api/training/start', 'post'>;
export type TrainingResponse = ApiResponse<'/api/training/start', 'post'>;

EOF

log "✅ Helper 타입 추가 완료"

# Step 4: Verify TypeScript compilation
log "Step 4: TypeScript 컴파일 검증 중..."

cd "${REPO_ROOT}/frontend-prediction"
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
    error "Prediction Frontend TypeScript 에러 발견!"
    npx tsc --noEmit
    exit 1
fi
log "  ✅ Prediction Frontend 타입 체크 통과"

cd "${REPO_ROOT}/frontend-training"
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
    error "Training Frontend TypeScript 에러 발견!"
    npx tsc --noEmit
    exit 1
fi
log "  ✅ Training Frontend 타입 체크 통과"

cd "${REPO_ROOT}"

# Summary
log "=========================================="
log "✅ 타입 생성 완료!"
log "  - OpenAPI Schema: backend/openapi.json"
log "  - Prediction Types: frontend-prediction/src/types/api-generated.ts"
log "  - Training Types: frontend-training/src/types/api-generated.ts"
log "=========================================="

# Show stats
PREDICTION_LINES=$(wc -l < "${PREDICTION_TYPES}")
TRAINING_LINES=$(wc -l < "${TRAINING_TYPES}")
SCHEMA_SIZE=$(du -h "${OPENAPI_SCHEMA}" | cut -f1)

log "통계:"
log "  - OpenAPI Schema: ${SCHEMA_SIZE}"
log "  - Prediction Types: ${PREDICTION_LINES} lines"
log "  - Training Types: ${TRAINING_LINES} lines"

exit 0
