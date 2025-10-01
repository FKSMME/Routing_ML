# Routing ML 설치 완료 요약

## 설치 완료 항목

### ✅ 1. Python 환경
- **가상환경**: `.venv` (Python 3.12)
- **패키지 설치**: `requirements.txt` 모든 패키지 설치 완료
  - FastAPI, Uvicorn, Pandas, NumPy, scikit-learn 등

### ✅ 2. 프론트엔드 환경
- **npm 패키지**: `frontend/node_modules` 설치 완료 (593 packages)
- **주의**: 4개의 moderate severity 취약점 존재 (필요시 `npm audit fix` 실행)

### ✅ 3. 설정 파일
- **Trainer 설정**: `trainer_config.yaml` 생성
- **Predictor 설정**: `predictor_config.yaml` 생성
- **환경 변수**: `.env` 파일 생성
  - Access DB 경로: `C:\Users\syyun\Documents\GitHub\Routing_ML\routing_data\ROUTING AUTO TEST.accdb`

### ✅ 4. 데이터베이스
- **Access DB 확인됨**: `routing_data/ROUTING AUTO TEST.accdb`
- **연결 문자열 설정**: `.env` 파일에 포함

## 다음 단계 (실행 방법)

### 1. 백엔드 API 실행
```powershell
# 가상환경 활성화
.\.venv\Scripts\Activate.ps1

# FastAPI 서버 실행
uvicorn backend.run_api:app --host 0.0.0.0 --port 8000

# 헬스체크
# http://localhost:8000/api/health
```

### 2. 프론트엔드 실행
```powershell
cd frontend
npm run dev -- --host 0.0.0.0

# 브라우저에서 접속
# http://localhost:5173
```

### 3. 모델 학습 (선택사항)
Access DB에서 데이터를 추출하여 학습하려면:

```powershell
# 가상환경에서 실행
python -m backend.cli.train_model <dataset.csv> --name my-model --export-projector
```

**참고**: 학습용 CSV 파일이 필요합니다. Access DB에서 데이터를 추출하거나 백엔드 API를 통해 데이터를 가져와야 합니다.

## 설정 파일 상세

### trainer_config.yaml
- similarity_threshold: 0.8
- max_neighbors: 15
- TensorBoard Projector 활성화

### predictor_config.yaml
- similarity_threshold: 0.8
- max_candidates: 4
- min_candidates: 3
- Trimmed STD aggregation (5% trim)

### .env
- ACCESS_CONNECTION_STRING: Access DB 드라이버 연결 문자열
- API_HOST: 0.0.0.0
- API_PORT: 8000

## 문제 해결

### npm install 실패 시
```powershell
cd frontend
npm config set strict-ssl false
npm install
```

### Access DB 연결 실패 시
- Microsoft Access Database Engine 2016 Redistributable 설치 필요
- 또는 `.env` 파일의 드라이버 경로 확인

### 포트 충돌 시
- 백엔드: `--port 8001` 등으로 변경
- 프론트엔드: `--port 5174` 등으로 변경

## 참고 문서
- [README.md](README.md) - 프로젝트 개요
- [docs/quickstart_guide.md](docs/quickstart_guide.md) - 상세 시작 가이드
- [docs/stage7_operations_report.md](docs/stage7_operations_report.md) - 운영 가이드

---
**설치 완료 시각**: 2025-10-01
**Python 버전**: 3.12
**Node 버전**: 22.18.0
**npm 버전**: 11.1.0
