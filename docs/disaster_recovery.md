# 재해 복구 절차 (Disaster Recovery Procedure)

**문서 버전**: 1.0
**최종 업데이트**: 2025-10-05
**담당자**: DevOps 팀
**승인자**: CTO

---

## 📋 목차

1. [개요](#개요)
2. [복구 목표](#복구-목표)
3. [장애 유형별 대응](#장애-유형별-대응)
4. [연락처](#연락처)
5. [복구 체크리스트](#복구-체크리스트)

---

## 개요

### 목적
Routing ML 시스템의 예상치 못한 장애 발생 시 신속한 복구를 위한 절차 문서

### 적용 범위
- Backend API 서버
- Frontend 웹 서버
- Access Database 연결
- Docker 컨테이너
- 사내망 인프라

---

## 복구 목표

### RTO (Recovery Time Objective)
- **목표**: 4시간 이내
- **허용 가능**: 8시간

### RPO (Recovery Point Objective)
- **목표**: 24시간 (일일 백업)
- **허용 가능**: 72시간

---

## 장애 유형별 대응

### 🔴 Type 1: Backend API 서버 다운

#### 증상
- `/api/health` 엔드포인트 응답 없음
- 프론트엔드에서 "서버 연결 실패" 에러
- Grafana 대시보드에서 API 응답 시간 급증

#### 원인 분석
```bash
# 1. 프로세스 확인
ps aux | grep uvicorn

# 2. 로그 확인
tail -100 /var/log/routing-ml/backend.log

# 3. 포트 상태 확인
ss -tlnp | grep 8000
```

#### 복구 절차

**단계 1: 서비스 재시작**
```bash
# Docker 환경
cd /workspaces/Routing_ML_4/deploy/docker
docker compose restart predictor

# 로컬 환경
cd /workspaces/Routing_ML_4
source .venv/bin/activate
pkill -f uvicorn
nohup uvicorn backend.run_api:app --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &
```

**단계 2: 헬스 체크**
```bash
curl http://localhost:8000/api/health
# 예상 출력: {"status":"ok","version":"..."}
```

**단계 3: 로그 모니터링**
```bash
tail -f /tmp/backend.log
# 에러 메시지 확인
```

#### 롤백 절차
```bash
# 최근 안정 버전으로 롤백
cd /workspaces/Routing_ML_4
git checkout <stable-commit-hash>
docker compose up -d --build predictor
```

---

### 🟠 Type 2: Access Database 접근 불가

#### 증상
- API 호출 시 "Database connection failed" 에러
- `/api/predict` 엔드포인트 500 에러
- 로그에 "Access Driver not found" 메시지

#### 원인 분석
```bash
# 1. Access DB 파일 존재 확인
ls -lh /mnt/data/routing_data/"ROUTING AUTO TEST.accdb"

# 2. 권한 확인
stat /mnt/data/routing_data/"ROUTING AUTO TEST.accdb"

# 3. 네트워크 공유 드라이브 확인 (Windows)
net use \\\\fileserver\\routing
```

#### 복구 절차

**단계 1: 로컬 백업 DB 사용**
```bash
# 최근 백업 확인
ls -lht /mnt/backup/ | head -5

# 백업 복사
cp /mnt/backup/routing_db_$(date -d "yesterday" +%Y%m%d).accdb /mnt/data/routing_data/"ROUTING AUTO TEST.accdb"
```

**단계 2: 환경 변수 확인**
```bash
# ACCESS_CONNECTION_STRING 확인
echo $ACCESS_CONNECTION_STRING

# 재설정 (필요 시)
export ACCESS_CONNECTION_STRING="Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq=/mnt/data/routing_data/ROUTING AUTO TEST.accdb"
```

**단계 3: 서비스 재시작**
```bash
docker compose restart predictor
```

#### 임시 조치
```bash
# 읽기 전용 모드로 전환 (예측만 가능, 저장 불가)
# config/predictor_config.yaml
read_only_mode: true
```

---

### 🟡 Type 3: 네트워크 장애

#### 증상
- 프론트엔드 접속 불가 (`http://10.204.2.28:5173`)
- 사내망 다른 서비스도 접속 불가
- ping 실패

#### 원인 분석
```bash
# 1. 로컬 네트워크 확인
ping 10.204.2.28

# 2. 라우팅 테이블 확인
ip route show

# 3. 방화벽 확인
sudo iptables -L -n
```

#### 복구 절차

**단계 1: IT 팀 연락**
- 담당자: [네트워크 관리자]
- 연락처: [IT 헬프데스크]
- 우선순위: 긴급

**단계 2: 로컬 접속으로 전환**
```bash
# localhost 접속
http://localhost:5173  # Frontend
http://localhost:8000  # Backend
```

**단계 3: 포트 포워딩 확인**
```bash
# 포트가 열려있는지 확인
sudo ufw status
sudo ufw allow 5173/tcp
sudo ufw allow 8000/tcp
```

---

### 🟢 Type 4: Docker 컨테이너 오류

#### 증상
- `docker ps` 출력에 컨테이너 없음
- `docker compose up` 실패
- "Port already in use" 에러

#### 원인 분석
```bash
# 1. 컨테이너 상태 확인
docker ps -a

# 2. 로그 확인
docker compose logs predictor
docker compose logs frontend

# 3. 포트 점유 확인
ss -tlnp | grep -E "5173|8000"
```

#### 복구 절차

**단계 1: 컨테이너 정리**
```bash
# 중지된 컨테이너 제거
docker compose down

# 모든 컨테이너 강제 제거
docker rm -f $(docker ps -aq)
```

**단계 2: 이미지 재빌드**
```bash
cd /workspaces/Routing_ML_4/deploy/docker
docker compose build --no-cache
docker compose up -d
```

**단계 3: 볼륨 확인**
```bash
# 볼륨 마운트 확인
docker volume ls
docker volume inspect routing-ml_models
```

#### 포트 충돌 해결
```bash
# 점유 프로세스 확인
lsof -i :8000
lsof -i :5173

# 프로세스 종료
kill -9 <PID>
```

---

### 🔵 Type 5: 모델 파일 손상

#### 증상
- `/api/predict` 호출 시 "Model not found" 에러
- 로그에 "Failed to load model" 메시지

#### 원인 분석
```bash
# 1. 모델 파일 확인
ls -lh /mnt/models/
ls -lh deliverables/models/

# 2. 파일 무결성 확인
md5sum deliverables/models/latest/model.pkl
```

#### 복구 절차

**단계 1: 백업 모델 사용**
```bash
# 이전 버전 확인
ls -lt deliverables/models/ | head -5

# 백업 복사
cp -r deliverables/models/v20250901/ deliverables/models/latest/
```

**단계 2: 모델 재학습**
```bash
cd /workspaces/Routing_ML_4
source .venv/bin/activate
python -m backend.cli.train_model data/training_dataset.csv --name emergency-retrain
```

**단계 3: 서비스 재시작**
```bash
docker compose restart predictor
```

---

## 연락처

### 긴급 연락망

| 역할 | 이름 | 연락처 | 비고 |
|------|------|--------|------|
| **1차 대응** | DevOps 엔지니어 | [전화번호] | 24/7 대기 |
| **2차 대응** | Backend 개발자 | [전화번호] | 평일 09-18시 |
| **IT 지원** | 네트워크 관리자 | [IT 헬프데스크] | 내선 [번호] |
| **최종 승인** | CTO | [전화번호] | 중대 장애 시 |

### 에스컬레이션 절차

1. **0-30분**: DevOps 엔지니어 자체 해결 시도
2. **30분-1시간**: Backend 개발자 협의
3. **1-2시간**: IT 팀 지원 요청
4. **2시간+**: CTO 보고 및 외부 지원 검토

---

## 복구 체크리스트

### ✅ 장애 발생 시 즉시 체크

- [ ] **현재 시각 기록**: ___________
- [ ] **장애 유형 확인**: Type 1 / 2 / 3 / 4 / 5
- [ ] **영향 범위 확인**: 전체 / 부분 / 특정 기능
- [ ] **사용자 알림**: Slack / Teams / 이메일
- [ ] **로그 스냅샷**: `/tmp/incident_$(date +%Y%m%d_%H%M).log`

### ✅ 복구 진행 중

- [ ] **원인 파악 완료**
- [ ] **복구 방법 선정**
- [ ] **백업 확인**
- [ ] **복구 명령 실행**
- [ ] **헬스 체크 통과**

### ✅ 복구 완료 후

- [ ] **서비스 정상 작동 확인**
- [ ] **사용자 알림 (복구 완료)**
- [ ] **사후 보고서 작성**: `docs/incident_reports/YYYY-MM-DD.md`
- [ ] **재발 방지 대책 수립**
- [ ] **문서 업데이트**

---

## 📊 사후 보고서 템플릿

```markdown
# Incident Report: [YYYY-MM-DD]

## 개요
- **발생 시각**: YYYY-MM-DD HH:MM
- **복구 시각**: YYYY-MM-DD HH:MM
- **다운타임**: X시간 Y분
- **영향 범위**: [전체 / 부분]

## 원인
[상세 원인 설명]

## 복구 과정
1. [단계 1]
2. [단계 2]
3. [단계 3]

## 재발 방지 대책
- [ ] [대책 1]
- [ ] [대책 2]

## 교훈
[배운 점]
```

---

## 🔄 정기 점검 항목

### 주간 점검 (매주 월요일 10:00)

- [ ] Health Check 엔드포인트 확인
- [ ] 디스크 사용량 확인 (80% 미만)
- [ ] 백업 파일 생성 확인
- [ ] 로그 파일 용량 확인 (10GB 미만)

### 월간 점검 (매월 1일)

- [ ] 재해 복구 테스트 수행
- [ ] 백업 복원 테스트
- [ ] 연락망 업데이트
- [ ] 문서 업데이트

---

## 📝 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0 | 2025-10-05 | Claude Code | 초안 작성 |

---

**문서 종료**

*긴급 상황 시 이 문서를 참조하여 신속히 대응하시기 바랍니다.*
*질문이나 개선 사항은 DevOps 팀에 문의해주세요.*
