#!/bin/bash

###############################################################################
# Frontend 시각적 검증 자동화 스크립트
#
# 사용법:
#   ./scripts/verify-frontends.sh
#   ./scripts/verify-frontends.sh --headed  # 브라우저 보이게
#   ./scripts/verify-frontends.sh --quick   # 빠른 검증만
###############################################################################

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 타임스탬프 함수
timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

log_info() {
  echo -e "${BLUE}[$(timestamp)] ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}[$(timestamp)] ✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}[$(timestamp)] ⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}[$(timestamp)] ❌ $1${NC}"
}

# 파라미터 파싱
HEADED=""
QUICK=""

for arg in "$@"; do
  case $arg in
    --headed)
      HEADED="--headed"
      shift
      ;;
    --quick)
      QUICK="true"
      shift
      ;;
  esac
done

# 작업 디렉토리 확인
if [ ! -d "/workspaces/Routing_ML_4" ]; then
  log_error "Project directory not found"
  exit 1
fi

cd /workspaces/Routing_ML_4

log_info "Starting Frontend Visual Verification"
echo ""

###############################################################################
# 1. 서버 상태 확인
###############################################################################

log_info "Checking development servers..."

check_server() {
  local port=$1
  local name=$2

  if lsof -i :$port -t > /dev/null 2>&1; then
    log_success "$name server is running on port $port"
    return 0
  else
    log_warning "$name server is NOT running on port $port"
    return 1
  fi
}

PREDICTION_RUNNING=$(check_server 5173 "Frontend-prediction" && echo "yes" || echo "no")
TRAINING_RUNNING=$(check_server 5174 "Frontend-training" && echo "yes" || echo "no")

if [ "$PREDICTION_RUNNING" = "no" ] && [ "$TRAINING_RUNNING" = "no" ]; then
  log_error "No frontend servers are running. Start them first:"
  echo "  cd frontend-prediction && npm run dev"
  echo "  cd frontend-training && npm run dev"
  exit 1
fi

echo ""

###############################################################################
# 2. 스크린샷 디렉토리 준비
###############################################################################

log_info "Preparing screenshot directory..."

SCREENSHOT_DIR="/tmp/screenshots"
mkdir -p "$SCREENSHOT_DIR"

# 오래된 스크린샷 정리 (24시간 이상)
find "$SCREENSHOT_DIR" -name "*.png" -mtime +1 -delete 2>/dev/null || true

log_success "Screenshot directory ready: $SCREENSHOT_DIR"
echo ""

###############################################################################
# 3. Playwright 테스트 실행
###############################################################################

log_info "Running Playwright visual regression tests..."

TEST_COMMAND="npx playwright test tests/visual-regression.spec.ts"

if [ -n "$HEADED" ]; then
  TEST_COMMAND="$TEST_COMMAND --headed"
fi

if [ -n "$QUICK" ]; then
  # 빠른 검증: 주요 테스트만
  TEST_COMMAND="$TEST_COMMAND -g 'should load main page|should display header'"
fi

TEST_COMMAND="$TEST_COMMAND --reporter=list"

echo ""
log_info "Executing: $TEST_COMMAND"
echo ""

if $TEST_COMMAND; then
  log_success "All visual tests passed!"
else
  log_error "Some tests failed. Check the output above."
  exit 1
fi

echo ""

###############################################################################
# 4. 스크린샷 리포트
###############################################################################

log_info "Screenshot Summary:"
echo ""

SCREENSHOT_COUNT=$(find "$SCREENSHOT_DIR" -name "*.png" -mtime -1 | wc -l)

if [ "$SCREENSHOT_COUNT" -gt 0 ]; then
  log_success "Captured $SCREENSHOT_COUNT screenshots"
  echo ""
  echo "Recent screenshots:"
  find "$SCREENSHOT_DIR" -name "*.png" -mtime -1 -exec ls -lh {} \; | tail -10
else
  log_warning "No screenshots were captured"
fi

echo ""

###############################################################################
# 5. 콘솔 에러 체크 (선택사항)
###############################################################################

if [ -z "$QUICK" ]; then
  log_info "Checking for console errors..."

  # Playwright 리포트에서 에러 추출
  ERROR_LOG="/tmp/playwright-errors.log"

  if [ -f "$ERROR_LOG" ]; then
    ERROR_COUNT=$(wc -l < "$ERROR_LOG")
    if [ "$ERROR_COUNT" -gt 0 ]; then
      log_warning "Found $ERROR_COUNT console errors"
      cat "$ERROR_LOG"
    else
      log_success "No console errors detected"
    fi
  fi

  echo ""
fi

###############################################################################
# 마무리
###############################################################################

log_success "Frontend verification completed!"
echo ""
echo "📊 Summary:"
echo "  - Prediction Frontend: $([ "$PREDICTION_RUNNING" = "yes" ] && echo "✅" || echo "❌")"
echo "  - Training Frontend: $([ "$TRAINING_RUNNING" = "yes" ] && echo "✅" || echo "❌")"
echo "  - Screenshots: $SCREENSHOT_COUNT"
echo ""
echo "View screenshots: ls -lh $SCREENSHOT_DIR"
echo ""

exit 0
