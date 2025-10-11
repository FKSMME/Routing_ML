#!/bin/bash
# Routing ML Platform - 전체 서비스 종료 스크립트

echo "=========================================="
echo "🛑 Routing ML Platform 종료"
echo "=========================================="
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# 1. Backend 종료
echo -e "${RED}🔧 Backend API 종료 중...${NC}"
pkill -f 'uvicorn backend.api.main'
if [ $? -eq 0 ]; then
  echo -e "${GREEN}   ✅ Backend stopped${NC}"
else
  echo "   ⚠️  Backend not running or already stopped"
fi

# 2. Frontend Training 종료
echo -e "${RED}🎨 Frontend Training 종료 중...${NC}"
pkill -f 'vite.*frontend-training'
if [ $? -eq 0 ]; then
  echo -e "${GREEN}   ✅ Frontend Training stopped${NC}"
else
  echo "   ⚠️  Frontend Training not running or already stopped"
fi

# 3. Frontend Prediction 종료
echo -e "${RED}🔮 Frontend Prediction 종료 중...${NC}"
pkill -f 'vite.*frontend-prediction'
if [ $? -eq 0 ]; then
  echo -e "${GREEN}   ✅ Frontend Prediction stopped${NC}"
else
  echo "   ⚠️  Frontend Prediction not running or already stopped"
fi

# 4. Frontend Home 종료
echo -e "${RED}🏠 Frontend Home 종료 중...${NC}"
pkill -f 'node server.js'
if [ $? -eq 0 ]; then
  echo -e "${GREEN}   ✅ Frontend Home stopped${NC}"
else
  echo "   ⚠️  Frontend Home not running or already stopped"
fi

# 5. 남은 vite 프로세스 정리
pkill -f 'vite' 2>/dev/null

# 6. PID 파일 정리
rm -f /tmp/backend.pid /tmp/training.pid /tmp/prediction.pid /tmp/home.pid 2>/dev/null

echo ""
echo "✅ 모든 서비스가 종료되었습니다!"
echo ""

# 7. 프로세스 확인
RUNNING=$(ps aux | grep -E 'uvicorn|vite|node server.js' | grep -v grep | wc -l)
if [ $RUNNING -gt 0 ]; then
  echo "⚠️  일부 프로세스가 여전히 실행 중입니다:"
  ps aux | grep -E 'uvicorn|vite|node server.js' | grep -v grep
  echo ""
  echo "강제 종료하려면:"
  echo "   pkill -9 -f uvicorn"
  echo "   pkill -9 -f vite"
  echo "   pkill -9 -f 'node server.js'"
else
  echo "✅ 모든 프로세스가 정상적으로 종료되었습니다."
fi
echo ""
