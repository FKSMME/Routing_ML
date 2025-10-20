#!/bin/bash
# Routing ML Platform - 전체 서비스 시작 스크립트

echo "=========================================="
echo "🚀 Routing ML Platform 시작"
echo "=========================================="
echo ""

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 환경 변수 설정
export JWT_SECRET_KEY="local-dev-secret-key-min-32-chars-long-do-not-use-in-production-12345"
export DATABASE_URL="sqlite:///./routing_ml.db"
export CORS_ALLOWED_ORIGINS="http://localhost:3000,https://localhost:3000,http://localhost:3001,https://localhost:3001,http://localhost:5173,https://localhost:5173,http://localhost:5174,https://localhost:5174,http://localhost:5176,https://localhost:5176,http://10.204.2.28:5176,https://10.204.2.28:5176,http://localhost:8080,https://localhost:8080"
export ENVIRONMENT="development"
export LOG_LEVEL="INFO"
export PYTHONPATH=/workspaces/Routing_ML_4:$PYTHONPATH

cd /workspaces/Routing_ML_4

# 2. Python 가상환경 활성화
echo -e "${YELLOW}📦 Python 가상환경 활성화...${NC}"
source venv-linux/bin/activate

# 3. 백엔드 시작
echo -e "${YELLOW}🔧 Backend API 시작...${NC}"
cd /workspaces/Routing_ML_4
nohup python -m uvicorn backend.api.app:app --host 0.0.0.0 --port 8000 --reload > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}   ✅ Backend started (PID: $BACKEND_PID)${NC}"
echo "      URL: http://localhost:8000"
echo "      API Docs: http://localhost:8000/docs"
echo "      Log: /tmp/backend.log"
echo ""

# 백엔드 시작 대기
sleep 5

# 4. Frontend Training 시작
echo -e "${YELLOW}🎨 Frontend Training 시작...${NC}"
cd /workspaces/Routing_ML_4/frontend-training

# 의존성 확인
if [ ! -d "node_modules" ]; then
  echo "   📦 npm install 실행 중..."
  npm install
fi

nohup npm run dev > /tmp/frontend-training.log 2>&1 &
TRAINING_PID=$!
echo -e "${GREEN}   ✅ Frontend Training started (PID: $TRAINING_PID)${NC}"
echo "      URL: http://localhost:5173"
echo "      Log: /tmp/frontend-training.log"
echo ""

sleep 3

# 5. Frontend Prediction 시작
echo -e "${YELLOW}🔮 Frontend Prediction 시작...${NC}"
cd /workspaces/Routing_ML_4/frontend-prediction

# 의존성 확인
if [ ! -d "node_modules" ]; then
  echo "   📦 npm install 실행 중..."
  npm install
fi

nohup npm run dev -- --port 5174 > /tmp/frontend-prediction.log 2>&1 &
PREDICTION_PID=$!
echo -e "${GREEN}   ✅ Frontend Prediction started (PID: $PREDICTION_PID)${NC}"
echo "      URL: http://localhost:5174"
echo "      Log: /tmp/frontend-prediction.log"
echo ""

sleep 3

# 6. Frontend Home 시작
echo -e "${YELLOW}🏠 Frontend Home 시작...${NC}"
cd /workspaces/Routing_ML_4/frontend-home

nohup node server.js > /tmp/frontend-home.log 2>&1 &
HOME_PID=$!
echo -e "${GREEN}   ✅ Frontend Home started (PID: $HOME_PID)${NC}"
echo "      URL: http://localhost:8080"
echo "      Log: /tmp/frontend-home.log"
echo ""

# 7. 서비스 상태 확인
sleep 5

echo "=========================================="
echo "📊 서비스 상태 확인"
echo "=========================================="

# Backend 확인
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
  echo -e "1️⃣  Backend API: ${GREEN}✅ Running${NC} - http://localhost:8000"
else
  echo -e "1️⃣  Backend API: ${YELLOW}⏳ Starting...${NC} (check /tmp/backend.log)"
fi

# Frontend Training 확인
if curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo -e "2️⃣  Frontend Training: ${GREEN}✅ Running${NC} - http://localhost:5173"
else
  echo -e "2️⃣  Frontend Training: ${YELLOW}⏳ Starting...${NC} (check /tmp/frontend-training.log)"
fi

# Frontend Prediction 확인
if curl -s http://localhost:5174 > /dev/null 2>&1; then
  echo -e "3️⃣  Frontend Prediction: ${GREEN}✅ Running${NC} - http://localhost:5174"
else
  echo -e "3️⃣  Frontend Prediction: ${YELLOW}⏳ Starting...${NC} (check /tmp/frontend-prediction.log)"
fi

# Frontend Home 확인
if curl -s http://localhost:8080 > /dev/null 2>&1; then
  echo -e "4️⃣  Frontend Home: ${GREEN}✅ Running${NC} - http://localhost:8080"
else
  echo -e "4️⃣  Frontend Home: ${YELLOW}⏳ Starting...${NC} (check /tmp/frontend-home.log)"
fi

echo ""
echo "=========================================="
echo "📝 테스트 계정"
echo "=========================================="
echo "Username: admin"
echo "Password: admin123"
echo ""

echo "=========================================="
echo "🎯 다음 단계"
echo "=========================================="
echo "1. 브라우저에서 http://localhost:5173 열기 (학습 앱)"
echo "   - 로그인: admin / admin123"
echo "   - '모델 학습' 메뉴 → P2 신규 UI 확인"
echo ""
echo "2. 브라우저에서 http://localhost:5174 열기 (예측 앱)"
echo "   - 품목 코드 입력하여 ML 예측 테스트"
echo ""
echo "3. API 문서: http://localhost:8000/docs"
echo ""

echo "=========================================="
echo "🛑 서비스 종료 방법"
echo "=========================================="
echo "   bash stop-all-services.sh"
echo ""
echo "또는 개별 종료:"
echo "   pkill -f 'uvicorn backend.api.main'"
echo "   pkill -f 'vite'"
echo "   pkill -f 'node server.js'"
echo ""

# PID 파일 저장 (종료 시 사용)
echo $BACKEND_PID > /tmp/backend.pid
echo $TRAINING_PID > /tmp/training.pid
echo $PREDICTION_PID > /tmp/prediction.pid
echo $HOME_PID > /tmp/home.pid

echo "✅ 모든 서비스가 시작되었습니다!"
echo ""
