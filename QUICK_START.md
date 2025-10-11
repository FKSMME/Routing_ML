# 빠른 시작 가이드 (Quick Start)

## 🚀 한 번에 모든 서비스 시작하기

```bash
bash start-all-services.sh
```

약 10-15초 후 모든 서비스가 실행됩니다.

---

## 📱 접속 URL

| 서비스 | URL | 설명 |
|--------|-----|------|
| **Backend API** | http://localhost:8000 | FastAPI 백엔드 서버 |
| **API 문서** | http://localhost:8000/docs | Swagger UI (API 테스트) |
| **학습 앱** | http://localhost:5173 | 모델 학습 & 관리 (Training) |
| **예측 앱** | http://localhost:5174 | 공정 예측 & 라우팅 생성 (Prediction) |
| **홈페이지** | http://localhost:8080 | 랜딩 페이지 |

---

## 🔑 로그인 정보

- **Username**: `admin`
- **Password**: `admin123`

---

## ✅ 확인 사항

### 1. Backend API 동작 확인
```bash
curl http://localhost:8000/health
```
**예상 응답**: `{"status":"ok","timestamp":"..."}`

### 2. 로그인 테스트
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 3. 브라우저 접속
- http://localhost:5173 → 학습 앱 (모델 학습 UI 확인)
- http://localhost:5174 → 예측 앱 (ML 예측 테스트)

---

## 🎯 주요 기능 테스트

### P2 신규 기능: 모델 학습 UI

1. **학습 앱 접속**: http://localhost:5173
2. **로그인**: admin / admin123
3. **네비게이션** → "**모델 학습**" 클릭
4. **테스트**:
   - Version Label: `test-v1`
   - "Dry Run" 체크박스 선택
   - "학습 시작" 버튼 클릭
   - 실시간 상태 업데이트 확인 (Scheduled → Running → Completed)

### 예측 기능 테스트

1. **예측 앱 접속**: http://localhost:5174
2. **로그인**: admin / admin123
3. **품목 코드 입력**: `TEST_ITEM`
4. **예측 버튼 클릭**
5. **결과 확인**: 후보 공정 목록 표시

---

## 📊 로그 확인

서비스별 로그 파일 위치:

```bash
# 백엔드 로그
tail -f /tmp/backend.log

# 학습 앱 로그
tail -f /tmp/frontend-training.log

# 예측 앱 로그
tail -f /tmp/frontend-prediction.log

# 홈페이지 로그
tail -f /tmp/frontend-home.log
```

---

## 🛑 서비스 종료

```bash
bash stop-all-services.sh
```

또는 개별 종료:
```bash
pkill -f 'uvicorn backend.api.main'  # 백엔드
pkill -f 'vite'                       # 프론트엔드
pkill -f 'node server.js'             # 홈페이지
```

---

## 🔧 문제 해결

### 포트 충돌
```bash
# 포트 사용 확인
lsof -i :8000   # 백엔드
lsof -i :5173   # 학습 앱
lsof -i :5174   # 예측 앱
lsof -i :8080   # 홈페이지

# 프로세스 종료
kill -9 <PID>
```

### 백엔드 시작 실패
```bash
# 로그 확인
cat /tmp/backend.log

# 가상환경 활성화 확인
source venv-linux/bin/activate
which python  # /workspaces/Routing_ML_4/venv-linux/bin/python 이어야 함
```

### 프론트엔드 빌드 오류
```bash
cd frontend-training  # 또는 frontend-prediction
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 추가 문서

- **로컬 테스트 가이드**: [LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md)
- **배포 가이드**: [docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md](docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md)
- **운영 매뉴얼**: [docs/OPERATIONAL_RUNBOOK.md](docs/OPERATIONAL_RUNBOOK.md)
- **완성도 보고서**: [FINAL_COMPLETION_STATUS.md](FINAL_COMPLETION_STATUS.md)

---

## 🎉 준비 완료!

모든 서비스가 정상 작동하면 배포 준비가 완료된 것입니다.

**다음 단계**:
1. ✅ 로컬 테스트 (이 문서)
2. ⏸️ 스테이징 테스트
3. ⏸️ 프로덕션 배포

---

**작성일**: 2025-10-09
**버전**: 1.0
**프로덕션 준비도**: 93% (67/72 tasks)
