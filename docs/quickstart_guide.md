> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 3 | Completed 4 | Blockers 0

# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

## 빠른 시작 가이드 (주니어 엔지니어용)

### 1. 환경 준비
- `python 3.12`와 `node 20` 이상을 설치한다.
- `requirements.txt`를 사용해 백엔드 의존성을 설치한다.
- 사내 공유폴더(예: `\\fileserver\routing\ROUTING AUTO TEST.accdb`)에서 Access DB를 `deploy/docker/volumes/data/ROUTING AUTO TEST.accdb`로 복사하고, 필요 시 `/mnt/data/routing_data`로 마운트한다.
- `ACCESS_CONNECTION_STRING` 환경 변수를 `.env` 또는 Compose 시크릿에 설정한다.
- Windows 배포 노트북은 `C:\Users\(PCname)\Documents\GitHub\Routing_ML`(또는 `D:\Routing_ML`) 경로에 클론하는 것을 권장한다.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

```powershell
# PowerShell에서 경로만 사용자 환경에 맞게 조정
Set-Location C:\Users\$env:USERNAME\Documents\GitHub\Routing_ML
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item deploy/docker/volumes/config/trainer_config.example.yaml -Destination trainer_config.yaml -Force
```

### 2. 학습 파이프라인 실행
1. `backend/trainer_ml.py`의 구성 파일을 복사한다.
   ```bash
   cp deploy/docker/volumes/config/trainer_config.example.yaml trainer_config.yaml
   ```
2. 구성 값을 검토 후 학습을 실행한다. `backend/trainer_ml.py`는 직접 실행 시에도 프로젝트 루트를 자동으로 `sys.path`에 추가하므로, PowerShell이나 IDE에서 동일한 명령을 그대로 사용할 수 있다.
   ```bash
   python backend/trainer_ml.py --config trainer_config.yaml --data-path /mnt/data/routing_data
   ```
   ```powershell
   python .\backend\trainer_ml.py --config .\trainer_config.yaml --data-path D:\routing_data
   ```
3. 실행 후 `models/default/`에 `similarity_engine.joblib`(HNSW 인덱스)와 `encoder.joblib`, `scaler.joblib` 등이 생성되고,
   `models/default/tb_projector/` 폴더에 `vectors.tsv`, `metadata.tsv`, `projector_config.json`이 준비되었는지 확인한다. TensorFlow가
   설치되어 있지 않은 환경에서는 트레이너가 자동으로 TSV 기반 폴백 자산을 생성하므로 위 세 파일이 모두 존재하면 Projector
   검증을 완료한 것이다.
   ```bash
   ls models/default
   ls models/default/tb_projector
   ```

### 3. 예측 서비스 준비
1. Predictor 구성 템플릿을 복사한다.
   ```bash
   cp deploy/docker/volumes/config/predictor_config.example.yaml predictor_config.yaml
   ```
2. FastAPI 서버를 실행한다.
   ```bash
   ACCESS_CONNECTION_STRING="Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq=/mnt/data/routing_data/ROUTING AUTO TEST.accdb" \
   uvicorn backend.run_api:app --host 0.0.0.0 --port 8000
   ```
3. 건강 상태 점검:
  ```bash
  curl http://10.204.2.28:8000/api/health
  curl http://10.204.2.28:8000/api/workflow/graph
  ```
4. 워크플로우 설정 초기화: `config/workflow_settings.json` 파일이 생성되었는지 확인하고, 필요한 경우 `/api/workflow/graph` PATCH로 임계값/컬럼 매핑을 조정한다.
   ```bash
   curl http://10.204.2.28:8000/api/health
   ```


### 4. UI 테스트
1. 프런트엔드 의존성을 설치한다.
   ```bash
   cd frontend
   npm install
   npm run dev -- --host 0.0.0.0
   ```
   ```powershell
   Set-Location C:\Users\$env:USERNAME\Documents\GitHub\Routing_ML\frontend
   npm install
   npm run dev -- --host 0.0.0.0
   npm run build   # Vite 경로 alias(@components 등) 확인용 배포 빌드
   ```
2. 브라우저에서 `http://10.204.2.28:5173`에 접속해 다음 항목을 확인한다.
   - 유사도 슬라이더 기본값이 0.8인지 확인.
   - 후보 라우팅 카드에서 3~4개의 라우팅 조합이 노출되는지 확인.
   - TensorBoard Projector 안내 링크가 정상 동작하는지 확인.
   - 워크플로우 그래프 탭에서 `main/1.jpg`~`main/4.jpg` 레이아웃과 동일한 블루스크린 UI가 표시되는지, SAVE 버튼 클릭 후 `/api/workflow/graph` 응답에 변경 사항이 반영되는지 확인.

### 5. SQL 저장 검증
- `/api/candidates/save` 엔드포인트에 POST 요청을 보내고, 샘플 DB에 `routing_candidates`, `routing_candidate_operations` 테이블이 생성되었는지 확인한다.
- Stage 5 SQL 보고서의 스키마와 컬럼 순서를 교차 검증한다.
- 사내망(`10.204.2.28`)에 접근할 수 없는 환경이라면 `uvicorn backend.run_api:app --host 0.0.0.0 --port 8000`으로 로컬 백엔드를 실행하고 `http://127.0.0.1:8000` 기준으로 동일한 검증 절차를 수행한다.

### 6. Docker Compose 배포 (파일럿)
1. Compose 템플릿 디렉터리로 이동한다.
   ```bash
   cd deploy/docker
   cp volumes/config/trainer_config.example.yaml volumes/config/trainer_config.yaml
   cp volumes/config/predictor_config.example.yaml volumes/config/predictor_config.yaml
   ```
2. `volumes/data` 폴더에 Access DB(`ROUTING AUTO TEST.accdb`)를 복사하거나 공유 폴더 경로를 마운트한다.
   - 기본 예시: `deploy/docker/volumes/data/ROUTING AUTO TEST.accdb`
3. 구성 파일을 편집 후 다음 명령을 실행한다.
   ```bash
   docker compose build
   ACCESS_CONNECTION_STRING="..." docker compose up -d
   ```
4. 상태 점검:
  ```bash
  docker compose ps
  curl http://10.204.2.28:8000/api/health
  curl http://10.204.2.28:8000/api/workflow/graph
  ```

5. 종료:
   ```bash
   docker compose down
   ```

### 7. 설치형 패키지 준비(Windows) — Stage 9 연계
- 파이썬/Node 미설치 Windows PC용 설치 파일은 Stage 9 패키징 플랜(`docs/stage9_packaging_plan.md`)과 `deploy/installer/build_windows_installer.py`를 사용해 생성한다. 사내 테스트 빌드는 `dist/RoutingMLInstaller.exe`(PyInstaller + Inno Setup 기반)로 배포한다.
- 빌드 절차 요약
  1. Windows 빌드 노드에서 **Python 3.12.x**로 `pip install -r requirements.txt`를 실행한다. 오프라인 환경이라면 `pip install pyinstaller`로 선행 설치하고, `npm install --prefix frontend`로 프런트엔드 의존성을 준비한다.
  2. `python deploy/installer/build_windows_installer.py --clean`을 실행하면 `build/windows/installer` 페이로드와 `build/windows/RoutingMLInstaller.iss`가 생성된다.
  3. Inno Setup Compiler로 `RoutingMLInstaller.iss`를 빌드해 `RoutingMLInstaller_<버전>.exe` 또는 사내 테스트용 `dist/RoutingMLInstaller.exe`를 획득한다.
- 설치 검증 포인트
  1. 설치 완료 후 PowerShell 스크립트가 `RoutingMLPredictor` 서비스를 자동 등록·기동하는지 확인한다(`install_service.ps1`).
  2. `%APPDATA%\RoutingML\config\workflow_settings.json`이 템플릿을 기준으로 생성되고, 설치 마법사에서 선택한 Trimmed-STD 파라미터와 SQL 컬럼 매핑이 UI SAVE 즉시 반영되는지 확인한다.
  3. `scripts/post_install_test.ps1` 실행 결과 `/api/health` 200 응답과 TensorBoard Projector 경로 확인 등 스모크 테스트가 성공하는지 검증한다.
- 정식 배포 전 Stage 9 QA 체크리스트(설치/업데이트/제거 시나리오)와 사내 Change Management 승인 절차를 완료한다.


### 8. 온보딩 체크리스트
- [x] 절대 지령 준수 여부 확인 — 2025-10-28 검증자: 김보안(Security Officer)
- [ ] 학습 모델 산출물 검증(HNSW, Projector)
- [x] 예측 API Health OK
- [x] UI에서 후보 라우팅 3건 이상 확인 (증빙: `deliverables/onboarding_evidence/frontend_console.log`, `deliverables/onboarding_evidence/backend_runtime.log`, 스크린샷은 보안 스토리지 보관)
- [x] 워크플로우 그래프 SAVE → `/api/workflow/graph`에 런타임/컬럼 매핑 반영 확인 (실행: 2025-09-29)

- [x] SQL 저장 성공 및 Stage 5 스키마 일치 — 증빙: `deliverables/onboarding_evidence/sql_save_test.log`; 2025-09-30 로컬 uvicorn 환경에서 `/api/candidates/save` 재검증(검증자: ChatGPT)
- [ ] 로그/모니터링 연동 확인(Grafana/Teams 알람) — 증빙: `deliverables/onboarding_evidence/monitoring_test.log`, 내부 공유 드라이브 QA/Lab3/monitoring/teams_alert_save_event.png; 테스트 환경 알람 발송 확인, 운영 연동 재검증 필요

> **검증 진행 현황**: 최신 실행 결과와 증빙은 `docs/onboarding_validation_report.md` 및 `deliverables/onboarding_evidence/`를 확인한다. 2025-09-30 재검증 기준 완료 항목 5건의 증빙 로그/파일을 모두 확인했고 미완료 2건(모델 산출물, 모니터링)은 증빙 대기 상태다.
> - 완료 항목 증빙 재확인: 절대 지령 감사 로그(`deliverables/onboarding_evidence/absolute_rules_audit.log`), API Health 로그(`deliverables/onboarding_evidence/api_health_ok.log`), 프런트엔드/백엔드 동시 실행 로그(`deliverables/onboarding_evidence/frontend_console.log`, `deliverables/onboarding_evidence/backend_runtime.log`), 워크플로우 저장 테스트 로그(`deliverables/onboarding_evidence/workflow_config_test.log`).
> - 미완료 항목 현황: 모델 산출물 재생성 대기, 모니터링 연동 재확인.

### 9. 문제 보고 절차
1. Stage 0 요구 추적표를 참고해 이슈를 기록한다.
2. Tasklist 단계 상태를 업데이트하고 승인 요청을 한다.
3. 해결 후 문서/로그에 반영했는지 체크리스트를 다시 확인한다.
