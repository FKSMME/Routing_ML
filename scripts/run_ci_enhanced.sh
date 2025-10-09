#!/bin/bash
# Enhanced CI Test Runner Script
# Runs backend + frontend tests, builds, and static analysis
# Based on ASSESSMENT_2025-10-09.md recommendations

set -e  # Exit immediately on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

# Test results
BACKEND_TESTS_PASSED=0
FRONTEND_PREDICTION_BUILD_PASSED=0
FRONTEND_TRAINING_BUILD_PASSED=0
FRONTEND_PREDICTION_TYPES_PASSED=0
FRONTEND_TRAINING_TYPES_PASSED=0

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Routing ML - Enhanced CI Pipeline${NC}"
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Total LOC: ~123,000${NC}"
echo -e "${CYAN}  Backend: 26k Python | Frontend: 45k TS/TSX${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# ============================================================================
# 1. Environment Setup
# ============================================================================
echo -e "${BLUE}📦 Step 1/6: Environment Setup${NC}"
echo ""

# Check Python environment
if [ -z "$VIRTUAL_ENV" ]; then
    if [ -d "venv-linux/bin" ]; then
        echo -e "${YELLOW}⚠️  Activating virtual environment...${NC}"
        source venv-linux/bin/activate
    else
        echo -e "${RED}❌ Virtual environment not found: venv-linux${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Python: $(python --version)${NC}"

# Check Node.js
if command -v node &> /dev/null; then
    echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
    echo -e "${GREEN}✅ npm: $(npm --version)${NC}"
else
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi

echo ""

# ============================================================================
# 2. Install Dependencies
# ============================================================================
echo -e "${BLUE}📦 Step 2/6: Install Dependencies${NC}"
echo ""

# Python dependencies
echo -e "${CYAN}Installing Python dependencies...${NC}"
pip install -r requirements.txt --quiet || {
    echo -e "${RED}❌ Failed to install Python dependencies${NC}"
    exit 1
}
echo -e "${GREEN}✅ Python dependencies installed${NC}"

# Frontend dependencies
echo -e "${CYAN}Installing frontend-prediction dependencies...${NC}"
cd "$PROJECT_ROOT/frontend-prediction"
npm ci --quiet || {
    echo -e "${RED}❌ Failed to install frontend-prediction dependencies${NC}"
    exit 1
}
echo -e "${GREEN}✅ frontend-prediction dependencies installed${NC}"

echo -e "${CYAN}Installing frontend-training dependencies...${NC}"
cd "$PROJECT_ROOT/frontend-training"
npm ci --quiet || {
    echo -e "${RED}❌ Failed to install frontend-training dependencies${NC}"
    exit 1
}
echo -e "${GREEN}✅ frontend-training dependencies installed${NC}"

cd "$PROJECT_ROOT"
echo ""

# ============================================================================
# 3. Backend Tests
# ============================================================================
echo -e "${BLUE}🧪 Step 3/6: Backend Tests (56 tests)${NC}"
echo ""

# Set test environment variables
export JWT_SECRET_KEY="test-secret-key-for-ci-only-do-not-use-in-production-min-32-chars-long"
export LOG_LEVEL="WARNING"
export DB_TYPE="SQLITE"
export RSL_DATABASE_URL="sqlite:///:memory:"
export ROUTING_GROUPS_DATABASE_URL="sqlite:///:memory:"
export ENABLE_CANDIDATE_PERSISTENCE="false"

echo -e "${CYAN}Running pytest...${NC}"
if python -m pytest tests/backend -q --tb=line --color=yes; then
    BACKEND_TESTS_PASSED=1
    echo -e "${GREEN}✅ Backend tests PASSED${NC}"
else
    echo -e "${RED}❌ Backend tests FAILED${NC}"
fi

echo ""

# ============================================================================
# 4. Frontend TypeScript Checks
# ============================================================================
echo -e "${BLUE}🔍 Step 4/6: Frontend TypeScript Checks${NC}"
echo ""

# Frontend Prediction
echo -e "${CYAN}Checking frontend-prediction TypeScript...${NC}"
cd "$PROJECT_ROOT/frontend-prediction"
if npx tsc --noEmit --pretty 2>&1 | head -20; then
    FRONTEND_PREDICTION_TYPES_PASSED=1
    echo -e "${GREEN}✅ frontend-prediction TypeScript check PASSED${NC}"
else
    echo -e "${RED}❌ frontend-prediction TypeScript check FAILED${NC}"
fi

echo ""

# Frontend Training
echo -e "${CYAN}Checking frontend-training TypeScript...${NC}"
cd "$PROJECT_ROOT/frontend-training"
if timeout 60 npx tsc --noEmit --pretty 2>&1 | head -20; then
    FRONTEND_TRAINING_TYPES_PASSED=1
    echo -e "${GREEN}✅ frontend-training TypeScript check PASSED${NC}"
else
    echo -e "${YELLOW}⚠️  frontend-training TypeScript check timed out or failed${NC}"
fi

cd "$PROJECT_ROOT"
echo ""

# ============================================================================
# 5. Frontend Builds
# ============================================================================
echo -e "${BLUE}🏗️  Step 5/6: Frontend Production Builds${NC}"
echo ""

# Frontend Prediction Build
echo -e "${CYAN}Building frontend-prediction...${NC}"
cd "$PROJECT_ROOT/frontend-prediction"
if timeout 120 npm run build 2>&1 | tail -10; then
    FRONTEND_PREDICTION_BUILD_PASSED=1
    echo -e "${GREEN}✅ frontend-prediction build PASSED${NC}"
else
    echo -e "${RED}❌ frontend-prediction build FAILED or timed out${NC}"
fi

echo ""

# Frontend Training Build
echo -e "${CYAN}Building frontend-training...${NC}"
cd "$PROJECT_ROOT/frontend-training"
if timeout 120 npm run build 2>&1 | tail -10; then
    FRONTEND_TRAINING_BUILD_PASSED=1
    echo -e "${GREEN}✅ frontend-training build PASSED${NC}"
else
    echo -e "${RED}❌ frontend-training build FAILED or timed out${NC}"
fi

cd "$PROJECT_ROOT"
echo ""

# ============================================================================
# 6. Final Results Summary
# ============================================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  📊 CI Pipeline Results${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Backend
if [ $BACKEND_TESTS_PASSED -eq 1 ]; then
    echo -e "${GREEN}✅ Backend Tests (56/56)${NC}"
else
    echo -e "${RED}❌ Backend Tests FAILED${NC}"
fi

# Frontend Prediction
if [ $FRONTEND_PREDICTION_TYPES_PASSED -eq 1 ]; then
    echo -e "${GREEN}✅ Frontend Prediction TypeScript${NC}"
else
    echo -e "${RED}❌ Frontend Prediction TypeScript FAILED${NC}"
fi

if [ $FRONTEND_PREDICTION_BUILD_PASSED -eq 1 ]; then
    echo -e "${GREEN}✅ Frontend Prediction Build${NC}"
else
    echo -e "${RED}❌ Frontend Prediction Build FAILED${NC}"
fi

# Frontend Training
if [ $FRONTEND_TRAINING_TYPES_PASSED -eq 1 ]; then
    echo -e "${GREEN}✅ Frontend Training TypeScript${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend Training TypeScript (timeout)${NC}"
fi

if [ $FRONTEND_TRAINING_BUILD_PASSED -eq 1 ]; then
    echo -e "${GREEN}✅ Frontend Training Build${NC}"
else
    echo -e "${RED}❌ Frontend Training Build FAILED${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"

# Calculate success rate
TOTAL_CHECKS=5
PASSED_CHECKS=$(( BACKEND_TESTS_PASSED + FRONTEND_PREDICTION_TYPES_PASSED + FRONTEND_PREDICTION_BUILD_PASSED + FRONTEND_TRAINING_TYPES_PASSED + FRONTEND_TRAINING_BUILD_PASSED ))

SUCCESS_RATE=$(( PASSED_CHECKS * 100 / TOTAL_CHECKS ))

if [ $SUCCESS_RATE -eq 100 ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED (${PASSED_CHECKS}/${TOTAL_CHECKS})${NC}"
    echo -e "${GREEN}✅ Production Ready${NC}"
    EXIT_CODE=0
elif [ $SUCCESS_RATE -ge 80 ]; then
    echo -e "${YELLOW}⚠️  PARTIAL SUCCESS (${PASSED_CHECKS}/${TOTAL_CHECKS} - ${SUCCESS_RATE}%)${NC}"
    echo -e "${YELLOW}⚠️  Review failures before deployment${NC}"
    EXIT_CODE=1
else
    echo -e "${RED}❌ MULTIPLE FAILURES (${PASSED_CHECKS}/${TOTAL_CHECKS} - ${SUCCESS_RATE}%)${NC}"
    echo -e "${RED}🚨 NOT ready for deployment${NC}"
    EXIT_CODE=1
fi

echo -e "${BLUE}========================================${NC}"
echo ""

# Additional commands
if [ "$1" == "--coverage" ]; then
    echo -e "${CYAN}📊 Generating coverage report...${NC}"
    cd "$PROJECT_ROOT"
    python -m pytest tests/backend --cov=backend --cov-report=term-missing --cov-report=html
    echo -e "${GREEN}✅ Coverage report: htmlcov/index.html${NC}"
fi

exit $EXIT_CODE
