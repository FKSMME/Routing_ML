#!/bin/bash

echo "🔄 백엔드 서버 재시작 스크립트"
echo "================================"

# 1. 기존 프로세스 종료
echo "1. 기존 백엔드 프로세스 종료 중..."
pkill -9 -f "uvicorn backend.api.app" 2>/dev/null
lsof -ti:8000 | xargs -r kill -9 2>/dev/null
sleep 2
echo "   ✅ 기존 프로세스 종료 완료"

# 2. .env 파일 환경변수 로드
echo "2. .env 파일 로드 중..."
set -a
source /workspaces/Routing_ML_4/.env
set +a
export PYTHONPATH=/workspaces/Routing_ML_4
export JWT_SECRET_KEY="${ROUTING_ML_JWT_SECRET}"
echo "   ✅ 환경 변수 로드 완료"

# 3. MSSQL 설정 확인
echo "3. MSSQL 설정 확인:"
echo "   - 서버: ${MSSQL_SERVER}"
echo "   - DB: ${MSSQL_DATABASE}"
echo "   - 사용자: ${MSSQL_USER}"

# 4. 백엔드 시작
echo "4. 백엔드 서버 시작 중..."
/opt/conda/bin/python -m uvicorn backend.api.app:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload \
  > /tmp/backend-restart.log 2>&1 &

sleep 5

# 5. 상태 확인
echo "5. 서버 상태 확인 중..."
if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
  echo "   ✅ 백엔드 서버 정상 시작!"
  echo ""
  echo "📊 로그 확인: tail -f /tmp/backend-restart.log"
  echo "🔗 API 문서: http://localhost:8000/docs"
  echo "💚 Health Check: http://localhost:8000/api/health"
else
  echo "   ❌ 서버 시작 실패. 로그를 확인하세요:"
  echo "   tail -50 /tmp/backend-restart.log"
fi
