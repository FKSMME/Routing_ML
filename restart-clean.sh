#!/bin/bash
# 완전 초기화 및 재시작 스크립트

LOG_FILE="/tmp/restart-session-$(date +%Y%m%d_%H%M%S).log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=========================================="
log "🔄 Routing ML Platform - 완전 재시작"
log "=========================================="
log "세션 로그: $LOG_FILE"
log ""

# 1. 모든 프로세스 강제 종료
log "1️⃣ 모든 관련 프로세스 종료 중..."
killall -9 uvicorn 2>/dev/null
killall -9 node 2>/dev/null
sleep 2

# vite 프로세스 찾아서 종료
VITE_PIDS=$(ps aux | grep -E 'vite|npm run dev' | grep -v grep | awk '{print $2}')
if [ ! -z "$VITE_PIDS" ]; then
    log "   Vite 프로세스 종료: $VITE_PIDS"
    echo "$VITE_PIDS" | xargs kill -9 2>/dev/null
fi

sleep 2
log "   ✅ 프로세스 정리 완료"

# 2. 포트 확인 및 정리
log ""
log "2️⃣ 포트 상태 확인..."
for port in 8000 5173 5174 5176 8080; do
    PID=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$PID" ]; then
        log "   Port $port 정리 중 (PID: $PID)..."
        kill -9 $PID 2>/dev/null
    fi
    log "   Port $port: ✅ 준비됨"
done

# 3. 환경 설정
log ""
log "3️⃣ 환경 변수 설정..."
export PYTHONPATH=/workspaces/Routing_ML_4:$PYTHONPATH
export JWT_SECRET_KEY="local-dev-secret-key-min-32-chars-long-do-not-use-in-production-12345"
export DATABASE_URL="sqlite:///./routing_ml.db"
export CORS_ALLOWED_ORIGINS="http://localhost:3000,https://localhost:3000,http://localhost:3001,https://localhost:3001,http://localhost:5173,https://localhost:5173,http://localhost:5174,https://localhost:5174,http://localhost:5176,https://localhost:5176,http://10.204.2.28:5176,https://10.204.2.28:5176,http://localhost:8080,https://localhost:8080"
export ENVIRONMENT="development"
export LOG_LEVEL="INFO"
log "   ✅ 환경 변수 설정 완료"

# 4. 백엔드 시작
log ""
log "4️⃣ Backend API 시작..."
cd /workspaces/Routing_ML_4
source venv-linux/bin/activate

python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000 --reload > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
log "   PID: $BACKEND_PID"
log "   URL: http://localhost:8000"
log "   Docs: http://localhost:8000/docs"
log "   Log: /tmp/backend.log"

# 백엔드 시작 대기
log "   대기 중 (10초)..."
sleep 10

# 백엔드 상태 확인
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    log "   ✅ Backend 실행 중"
else
    log "   ⚠️  Backend 시작 중... (로그 확인: tail -f /tmp/backend.log)"
    log ""
    log "   최근 로그:"
    tail -20 /tmp/backend.log | sed 's/^/      /' | tee -a "$LOG_FILE"
fi

# 5. Frontend Training 시작
log ""
log "5️⃣ Frontend Training 시작..."
cd /workspaces/Routing_ML_4/frontend-training

if [ ! -d "node_modules" ]; then
    log "   📦 npm install 실행 중..."
    npm install >> "$LOG_FILE" 2>&1
fi

npm run dev > /tmp/frontend-training.log 2>&1 &
TRAINING_PID=$!
log "   PID: $TRAINING_PID"
log "   URL: http://localhost:5173"
log "   Log: /tmp/frontend-training.log"
sleep 5

if curl -s http://localhost:5173 > /dev/null 2>&1; then
    log "   ✅ Frontend Training 실행 중"
else
    log "   ⏳ Frontend Training 시작 중..."
fi

# 6. Frontend Prediction 시작
log ""
log "6️⃣ Frontend Prediction 시작..."
cd /workspaces/Routing_ML_4/frontend-prediction

if [ ! -d "node_modules" ]; then
    log "   📦 npm install 실행 중..."
    npm install >> "$LOG_FILE" 2>&1
fi

npm run dev -- --port 5174 > /tmp/frontend-prediction.log 2>&1 &
PREDICTION_PID=$!
log "   PID: $PREDICTION_PID"
log "   URL: http://localhost:5174"
log "   Log: /tmp/frontend-prediction.log"
sleep 5

if curl -s http://localhost:5174 > /dev/null 2>&1; then
    log "   ✅ Frontend Prediction 실행 중"
else
    log "   ⏳ Frontend Prediction 시작 중..."
fi

# 7. 최종 상태 확인
log ""
log "=========================================="
log "📊 최종 서비스 상태"
log "=========================================="

check_service() {
    local name=$1
    local url=$2
    if curl -s "$url" > /dev/null 2>&1; then
        log "✅ $name: Running - $url"
        return 0
    else
        log "❌ $name: Not responding - $url"
        return 1
    fi
}

check_service "Backend API" "http://localhost:8000/health"
check_service "Frontend Training" "http://localhost:5173"
check_service "Frontend Prediction" "http://localhost:5174"

log ""
log "=========================================="
log "📝 테스트 정보"
log "=========================================="
log "로그인: admin / admin123"
log ""
log "주요 URL:"
log "  - Backend API Docs: http://localhost:8000/docs"
log "  - 학습 앱: http://localhost:5173"
log "  - 예측 앱: http://localhost:5174"
log ""

log "=========================================="
log "🎯 다음 단계"
log "=========================================="
log "1. 브라우저에서 http://localhost:5173 열기"
log "2. admin / admin123 로그인"
log "3. '모델 학습' 메뉴에서 P2 신규 UI 확인"
log ""

log "=========================================="
log "📋 PID 정보 (종료 시 필요)"
log "=========================================="
log "Backend: $BACKEND_PID"
log "Training: $TRAINING_PID"
log "Prediction: $PREDICTION_PID"
log ""

# PID 저장
echo $BACKEND_PID > /tmp/backend.pid
echo $TRAINING_PID > /tmp/training.pid
echo $PREDICTION_PID > /tmp/prediction.pid

log "=========================================="
log "✅ 재시작 완료!"
log "=========================================="
log "세션 로그: $LOG_FILE"
log ""

# 사용자에게 로그 파일 위치 표시
cat << EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 모든 서비스가 시작되었습니다!

📄 상세 로그: $LOG_FILE

실시간 로그 확인:
  tail -f $LOG_FILE

종료 방법:
  bash stop-all-services.sh
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF
