> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 36 | Completed 5 | Blockers 0

# Routing ML 시스템

> 절대 지령 준수: 모든 단계는 승인 후 순차적으로 진행하며, 오류 발견 시 재승인을 요청하고, 문서 작업은 승인 하에 백그라운드 방식으로 수행한다.

## 개요
사내 Access DB(`routing_data/ROUTING AUTO TEST.accdb`) 기반으로 품목 임베딩을 생성하고, 코사인 유사도 0.8 이상을 만족하는 품목을 기준으로 3~4개의 라우팅 후보를 추천하는 ML 시스템입니다. TensorBoard Projector 연동, SQL 결과 저장, 사내망 전용 배포를 지원합니다.

## 시스템 구성
- **Trainer**: `backend/trainer_ml.py` — ITEM_INFO_VIEW 전 컬럼을 임베딩하고 HNSW 인덱스를 구축합니다. 5% 상·하위 트림 표준편차로 SETUP_TIME/MACH_WORKED_HOURS를 보정합니다. CLI 진입점은 `backend/cli/train_model.py`이며, 학습 결과물은 기본적으로 `deliverables/models/` 아래에 버전별 디렉터리로 저장됩니다.

- **Predictor**: `backend/run_api.py` — FastAPI 기반으로 `/api/predict`, `/api/candidates/save`, `/api/health`, `/api/metrics`, `/api/workflow/graph`를 제공합니다. SAVE 버튼으로 trainer/predictor 런타임과 SQL 컬럼 매핑(`config/workflow_settings.json`)을 즉시 갱신합니다.
- **Frontend**: `frontend/` — React + Vite UI, 유사도 슬라이더/Top-K 선택, 후보 라우팅 테이블, TensorBoard Projector 안내 패널, 블루스크린형 워크플로우 그래프 뷰(`main/1.jpg`~`main/4.jpg` 레퍼런스)를 제공합니다.

- **Predictor**: `backend/run_api.py` — FastAPI 기반으로 `/api/predict`, `/api/candidates/save`, `/api/health`, `/api/metrics`, `/api/workflow/graph`를 제공합니다. SAVE 버튼으로 trainer/predictor 런타임과 SQL 컬럼 매핑(`config/workflow_settings.json`)을 즉시 갱신합니다.
- **Frontend**: `frontend/` — React + Vite UI, 유사도 슬라이더/Top-K 선택, 후보 라우팅 테이블, TensorBoard Projector 안내 패널, 블루스크린형 워크플로우 그래프 뷰(`main/1.jpg`~`main/4.jpg` 레퍼런스)를 제공합니다.

- **Predictor**: `backend/run_api.py` — FastAPI 기반으로 `/api/predict`, `/api/candidates/save`, `/api/health`, `/api/metrics`를 제공합니다. 후보 라우팅을 7.1 SQL 스키마에 맞춰 직렬화합니다.
- **Frontend**: `frontend/` — React + Vite UI, 유사도 슬라이더/Top-K 선택, 후보 라우팅 테이블, TensorBoard Projector 안내 패널을 제공합니다.

- **Deploy**: `deploy/docker/` — 트레이너/프레딕터 Dockerfile, Docker Compose 스택, 구성 템플릿, 볼륨 구조를 정의합니다.
- **Docs**: `docs/` — Stage별 보고서, 빠른 시작, 릴리스 노트, 아키텍처 다이어그램을 포함합니다.

## 빠른 시작
자세한 온보딩 절차는 [`docs/quickstart_guide.md`](docs/quickstart_guide.md)를 확인하세요. 개발/운영 환경은 Python 3.12와 Node 20 이상을 기준으로 합니다. 사내 공유 드라이브(예: `\\fileserver\routing\ROUTING AUTO TEST.accdb`)에서 Access DB를 가져와 `deploy/docker/volumes/data/ROUTING AUTO TEST.accdb`에 복사한 뒤, 필요하면 `/mnt/data/routing_data`로 마운트하세요.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m backend.cli.train_model data/training_dataset.csv --name dev-local
ACCESS_CONNECTION_STRING="..." uvicorn backend.run_api:app --host 0.0.0.0 --port 8000
```

> **참고:** `backend/cli/train_model.py`는 `python -m backend.cli.train_model` 명령으로 실행하며, 기본 출력 경로는 `deliverables/models/`입니다. IDE나 PowerShell에서 모듈 경로 오류가 발생해도 동일한 명령을 사용하면 됩니다.

### Windows PowerShell 예시

사내 표준 노트북에서는 레포지토리를 `C:\Users\(PCname)\Documents\GitHub\Routing_ML` 또는 데이터 전용 SSD(`D:\Routing_ML`)에 클론합니다. 다음 명령은 PowerShell 기준이며, 필요한 경우 경로만 수정하면 됩니다.

```powershell
Set-Location C:\Users\$env:USERNAME\Documents\GitHub\Routing_ML
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item deploy/docker/volumes/config/trainer_config.example.yaml -Destination trainer_config.yaml -Force
python -m backend.cli.train_model .\data\training_dataset.csv --name windows-dev
$env:ACCESS_CONNECTION_STRING = "Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq=D:\routing_data\ROUTING AUTO TEST.accdb"
uvicorn backend.run_api:app --host 0.0.0.0 --port 8000
```

프런트엔드는 동일한 루트에서 다음과 같이 실행하거나, 배포 빌드를 검증하려면 `npm run build`를 수행합니다.

```powershell
Set-Location C:\Users\$env:USERNAME\Documents\GitHub\Routing_ML\frontend
npm install
npm run dev -- --host 0.0.0.0
# 배포 빌드 검증
npm run build
```

- 사내망 사용자들은 `http://10.204.2.28:5173`(프런트엔드)와 `http://10.204.2.28:8000/api/health`(백엔드)로 접근해 상태를 확인합니다.

## Docker Compose 배포
`deploy/docker` 디렉터리에서 Compose 스택을 구성합니다. 이때 Access DB(`ROUTING AUTO TEST.accdb`)를 `deploy/docker/volumes/data`에 복사하거나 공유 경로를 볼륨으로 연결해야 합니다.

```bash
cd deploy/docker
cp volumes/config/trainer_config.example.yaml volumes/config/trainer_config.yaml
cp volumes/config/predictor_config.example.yaml volumes/config/predictor_config.yaml
ACCESS_CONNECTION_STRING="..." docker compose up -d --build
```

- 네트워크: `routing-ml-network` (내부 전용)
- 볼륨: `/mnt/data`(Access), `/mnt/models`(모델), `/mnt/config`(설정)
- 헬스체크: `curl http://10.204.2.28:8000/api/health`

- 설정 파일: `config/workflow_settings.json`을 `/mnt/config`에 바인드해 SAVE 버튼 변경 사항을 보존합니다.
=======

- 설정 파일: `config/workflow_settings.json`을 `/mnt/config`에 바인드해 SAVE 버튼 변경 사항을 보존합니다.
=======



## 데이터 & SQL 출력
- Access `dbo_BI_ITEM_INFO_VIEW`를 기준으로 임베딩을 생성하고, `dbo_BI_ROUTING_VIEW`, `dbo_BI_WORK_ORDER_RESULTS`와 ITEM_CD로 조인합니다.
- 유사도 임계값은 기본 0.8이며, 후보 라우팅은 `routing_candidates`, `routing_candidate_operations` 테이블 스키마에 맞춰 저장됩니다.

- `/api/workflow/graph`와 워크플로우 그래프 UI에서 Power Query 스타일 프로파일을 선택하면 SQL 컬럼/별칭이 즉시 업데이트됩니다.


- `/api/workflow/graph`와 워크플로우 그래프 UI에서 Power Query 스타일 프로파일을 선택하면 SQL 컬럼/별칭이 즉시 업데이트됩니다.



## 모니터링 & KPI
- KPI(단계 일치율, 시간 오차)는 Stage 6 보고서를 참조합니다.
- `/api/metrics`를 Prometheus가 수집하며, Grafana/Teams 알람 구성을 Stage 7 보고서에 정의했습니다.

## 릴리스 & 전달물
- 릴리스 노트 및 승인 기록: [`docs/release_notes.md`](docs/release_notes.md)
- 전달물 패키지 구조: [`deliverables/README.md`](deliverables/README.md)
- 배포/운영 보고서: [`docs/stage7_operations_report.md`](docs/stage7_operations_report.md)
- 문서화 보고서: [`docs/stage8_documentation_report.md`](docs/stage8_documentation_report.md)

## 테스트 가이드
- Python 모듈 컴파일: `python -m compileall backend/api backend/run_api.py backend/trainer_ml.py`
- Docker Compose 검증: `docker compose config`
- 프런트엔드 타입 검사: `npm run typecheck` (옵션)

## 문의/지원
- 문제 발생 시 Stage 0 요구 추적표와 Tasklist를 업데이트하고 승인 절차에 따라 보고합니다.
- 로그/문서 기록 여부는 `docs/documentation_record_checklist.md`와 `logs/` 디렉터리를 참조합니다.
