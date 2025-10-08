#!/bin/bash
# CI 테스트 러너 스크립트
# 모든 테스트를 실행하고 결과를 리포트합니다.

set -e  # 에러 발생 시 즉시 종료

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 프로젝트 루트 디렉토리로 이동
cd "$(dirname "$0")/.."

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Routing ML - CI Test Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 가상환경 활성화 확인
if [ -z "$VIRTUAL_ENV" ]; then
    if [ -d "venv-linux/bin" ]; then
        echo -e "${YELLOW}⚠️  가상환경 활성화 중...${NC}"
        source venv-linux/bin/activate
    else
        echo -e "${RED}❌ 가상환경을 찾을 수 없습니다: venv-linux${NC}"
        exit 1
    fi
fi

# Python 버전 확인
echo -e "${BLUE}🐍 Python 버전:${NC}"
python --version
echo ""

# 필수 패키지 확인
echo -e "${BLUE}📦 pytest 버전:${NC}"
python -m pytest --version
echo ""

# 환경 변수 설정
export JWT_SECRET_KEY="test-secret-key-for-ci-only-do-not-use-in-production-min-32-chars-long"
export LOG_LEVEL="WARNING"
export DB_TYPE="SQLITE"
export RSL_DATABASE_URL="sqlite:///:memory:"
export ROUTING_GROUPS_DATABASE_URL="sqlite:///:memory:"
export ENABLE_CANDIDATE_PERSISTENCE="false"

echo -e "${BLUE}🔧 테스트 환경 변수 설정 완료${NC}"
echo ""

# 테스트 실행
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  백엔드 테스트 실행${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 전체 테스트 실행 (상세 출력)
python -m pytest tests/backend -v --tb=short --color=yes

# 테스트 결과 저장
TEST_EXIT_CODE=$?

echo ""
echo -e "${BLUE}========================================${NC}"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ 모든 테스트 통과!${NC}"
else
    echo -e "${RED}❌ 테스트 실패 (exit code: $TEST_EXIT_CODE)${NC}"
fi
echo -e "${BLUE}========================================${NC}"
echo ""

# 커버리지 리포트 (선택 사항)
if [ "$1" == "--coverage" ] || [ "$1" == "-c" ]; then
    echo -e "${BLUE}📊 커버리지 리포트 생성 중...${NC}"
    python -m pytest tests/backend --cov=backend --cov-report=term-missing --cov-report=html
    echo -e "${GREEN}✅ 커버리지 리포트: htmlcov/index.html${NC}"
fi

exit $TEST_EXIT_CODE
