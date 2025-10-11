#!/bin/bash
# Test Environment Setup Script
# Fixes pandas/numpy import errors and validates test environment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Test Environment Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

echo -e "${CYAN}Project root: $PROJECT_ROOT${NC}"
echo ""

# Step 1: Activate virtual environment
echo -e "${BLUE}1. Activating virtual environment...${NC}"
if [ -d "venv-linux/bin" ]; then
    source venv-linux/bin/activate
    echo -e "${GREEN}✅ Virtual environment activated${NC}"
else
    echo -e "${RED}❌ Virtual environment not found: venv-linux${NC}"
    exit 1
fi

echo ""

# Step 2: Check Python version
echo -e "${BLUE}2. Checking Python version...${NC}"
PYTHON_VERSION=$(python --version)
echo -e "${GREEN}✅ $PYTHON_VERSION${NC}"

echo ""

# Step 3: Reinstall problematic packages
echo -e "${BLUE}3. Reinstalling numpy and pandas...${NC}"
echo -e "${YELLOW}   This fixes import errors from source directory${NC}"

pip uninstall -y numpy pandas 2>/dev/null || true
pip install numpy pandas --no-cache-dir --force-reinstall

echo -e "${GREEN}✅ numpy and pandas reinstalled${NC}"

echo ""

# Step 4: Verify imports
echo -e "${BLUE}4. Verifying imports...${NC}"

python -c "import numpy; print(f'   numpy {numpy.__version__}: OK')" || {
    echo -e "${RED}❌ numpy import failed${NC}"
    exit 1
}

python -c "import pandas; print(f'   pandas {pandas.__version__}: OK')" || {
    echo -e "${RED}❌ pandas import failed${NC}"
    exit 1
}

python -c "import polars; print(f'   polars {polars.__version__}: OK')" || {
    echo -e "${YELLOW}⚠️  polars not installed (optional)${NC}"
}

echo -e "${GREEN}✅ All imports working${NC}"

echo ""

# Step 5: Test environment variables
echo -e "${BLUE}5. Setting test environment variables...${NC}"

export JWT_SECRET_KEY="test-secret-key-for-ci-only-do-not-use-in-production-min-32-chars-long"
export LOG_LEVEL="WARNING"
export DB_TYPE="SQLITE"
export RSL_DATABASE_URL="sqlite:///:memory:"
export ROUTING_GROUPS_DATABASE_URL="sqlite:///:memory:"
export ENABLE_CANDIDATE_PERSISTENCE="false"

echo -e "${GREEN}✅ Test environment configured${NC}"

echo ""

# Step 6: Run quick test
echo -e "${BLUE}6. Running quick test suite...${NC}"

cd "$PROJECT_ROOT"

if python -m pytest tests/backend/test_json_logging.py -q --tb=line; then
    echo -e "${GREEN}✅ Quick test passed${NC}"
else
    echo -e "${RED}❌ Quick test failed${NC}"
    exit 1
fi

echo ""

# Step 7: Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Test Environment Ready${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo "Next steps:"
echo "  1. Run full test suite: pytest tests/backend -v"
echo "  2. Run with coverage: pytest tests/backend --cov=backend"
echo "  3. Run CI pipeline: bash scripts/run_ci_enhanced.sh"
echo ""

echo "Environment variables set:"
echo "  JWT_SECRET_KEY: (32+ chars, test only)"
echo "  DB_TYPE: SQLITE"
echo "  LOG_LEVEL: WARNING"
echo ""
