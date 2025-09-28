> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 31 | Completed 11 | Blockers 0

# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.
8. Codex는 PoC 시나리오를 직접 수립·시행하고 모든 테스트 결과/측정값/스크린샷·다이어그램을 기록·보고한다.

PRD: 머신러닝 기반 라우팅 자동화 (Routing_ML)
A. 프로젝트 목표

목표: 신규 품목에 대해 여러 가지 가능한 라우팅을 ML로 예측·제안하고, 사용자가 선택/수정하여 SQL 규격으로 내리는 시스템 구현.

포지셔닝: 완전 자동 생성이 아니라 **“ML 기반 라우팅 예측/참고 + 다중 후보 제안”**에 초점. (현 시스템의 강·약점 정리에 부합) 

manufacturing_routing_reality

운영/환경: Python 3.12, 16GB/i7, 사내망 ODBC, 별도 서버/컨테이너로 학습 서비스와 예측 서비스 분리. 프런트/백 분리는 B안(React + FastAPI).

단계 공통 게이트(승인 체크리스트) — 사용자 절대 조건 반영

모든 단계 작업은 백그라운드 방식으로 수행

각 단계는 승인 후 진행

단계 착수 전 범위 리뷰 & 오류 식별

오류 발견 시 수정 전에 승인 재요청

이전 단계 오류 없음 재확인 후 다음 단계 승인 요청

문서/웹뷰어 점검은 승인 확인 후 진행

다음 단계 착수 전에 전반 재점검(미해결 오류 없음 확인)

안내: 비동기 실행에 대한 기술적 제약이 있는 경우에도, 계획·보고·승인 절차를 백그라운드 워크플로우로 간주하여 요구 조건을 충족하도록 처리합니다.

B. 입력 데이터 & 피처
1) 원천 테이블

dbo_BI_ITEM_INFO_VIEW: 임베딩/유사도 탐색의 기준 피처. (ITEM_CD, MATERIAL, 치수 등 범·수치 혼합)

dbo_BI_ROUTING_VIEW: 라우팅 이력(공정 순서·시간 등)

dbo_BI_WORK_ORDER_RESULTS: 실제 작업 실적(세팅/가공/대기 시간 등)

2) 피처 구분

DB에서 바로 획득: 재질(ITEM_MATERIAL), 치수(OUT/IN DIAMETER, THICKNESS), 품목유형(PART_TYPE/ITEM_TYPE), 그룹/계정, 단위 등

CAD 필요(이번 스코프 제외): 형상피처, 공차/조도, 조립관계 등 (레포 백업 문서의 현실 데이터 요구 표 참고) 

manufacturing_routing_reality

3) 관계 & 학습 기준

ITEM_CD를 키로 ITEM_INFO ↔ ROUTING_VIEW ↔ WORK_ORDER_RESULTS를 매핑, **라벨(타깃)**은 “하나의 품목에 대해 가능한 라우팅 시퀀스들”(ProcSeq, Job, Time 등 컬럼 집합).

“외주 공정 제외” 옵션: 상위 K 메타-앙상블 생성 시 INSIDE_FLAG ≠ ‘사내’ 후보를 제외하여 앙상블.

워크플로우 그래프 UI의 SAVE 버튼은 `config/workflow_settings.json`에 저장된 설정을 즉시 trainer/predictor 런타임에 반영한다. 저장 시 `backend/api/routes/workflow.py`에서 `apply_trainer_runtime_config`, `apply_runtime_config`를 호출해 유사도 임계값(0.8 고정 기본), 5% 트림 표준편차 범위, 후보 최대 4개 제한 등이 즉시 적용된다. 노드 설정은 `main/1.jpg`~`main/4.jpg` 디자인 레퍼런스를 기반으로 팝업 UI를 설계한다.

C. 기능 요구
1) 유사 품목 검색 & 후보 라우팅 생성

임베딩/유사도: dbo_BI_ITEM_INFO_VIEW 전/후처리 → 차원 정규화 → HNSW 인덱스 구성(Cosine) → Top-K 후보 조회(기본 K=10, UI에서 가변 / 임계값 기본 30%). GUI 로그 기반으로 임계값 조절 가능 UI 이미 존재 확인. 

gui_20250912

정책 스위치(기본): “기존 이력 무시 + 유사품 라우팅 제안” 모드.

메타-앙상블: Top-K의 라우팅 시퀀스를 가중 집계하여 3~4개의 가능한 라우팅 구조를 생성(예: CNC 선반 3차 + MCT, MTM 3차 등). 외주 공정 제외 규칙을 반영.

유사도 80%+ 달성 전략:

카테고리/수치 혼합 인코딩 후 표준화 + 가중치 적용 → 코사인 유사도 ↑ (trainer 파이프라인에 가중치/스케일링/HNSW 이미 구조 존재) 

trainer_ml

 

trainer_ml

VarianceThreshold & (옵션) PCA로 노이즈 축소, 도메인×데이터 가중치 조화(조화평균) 방식 채택. 

trainer_ml

2) 결과 시각화 (주니어 친화)

타임라인 카드: 공정 순서/소요시간 막대

후보 비교 카드: 공정 수/예상시간/성공률 뱃지

설명 패널: “왜 이 공정이 붙었는가?” — 기여 피처 Top-N

TensorBoard Projector 내보내기로 벡터 공간 시각화(이미 export 코드 훅이 존재)

trainer_ml

3) 출력(필수 SQL 규격)

사용자 제공 칼럼 양식으로 저장/내보내기(샘플 표 준수).

스키마 제안(예):

routing_candidates(item_cd, candidate_id, rank, similarity, created_at)

routing_candidate_operations(item_cd, candidate_id, PROC_SEQ, …, MTMG_NUMB)

FK: (item_cd, candidate_id)

워크플로우 그래프 UI에서 제공하는 “리스트 / 파워 쿼리” 설정 패널을 통해 7.1 SQL 구조 컬럼명과 Access VIEW 명칭 매핑을 수정할 수 있다. 설정은 `SQLColumnConfig`(profiles, active_profile)로 저장되어 `/api/workflow/graph` 응답에 노출되며, 사용자가 정의한 프로파일은 Power Query 스타일로 여러 매핑 조합을 유지한다.
- SQL 컬럼 검증: `/api/workflow/graph` PATCH는 학습 완료된 컬럼 집합(`DEFAULT_SQL_OUTPUT_COLUMNS`)에서만 `output_columns`/`available_columns` 변경을 허용하며, 잘못된 컬럼이 전달되면 400 오류와 감사 로그를 남긴다.
- SQL 저장 출력: `/api/candidates/save`는 `routing_candidates`/`routing_candidate_operations`에 대응하는 INSERT SQL 미리보기와 경고 목록을 JSON 응답에 포함하고, 허용되지 않은 컬럼은 제거 후 경고로 통지한다.

4) 서비스/배포

분리: trainer(학습) ↔ predictor(예측) 별도 컨테이너/서버, 레포는 공유.

API: FastAPI로 예측/저장/로그/상태 점검 엔드포인트.

추가 API: `/api/workflow/graph` GET/PATCH — 그래프 노드·에지 정보, 런타임 설정, SQL 매핑 프로파일을 주고받으며 SAVE 버튼을 통해 학습/예측 서비스에 즉시 반영한다.

프런트: React(시각 카드, 테이블, 슬라이더/드롭다운).

패키징: Docker 권장(이미지 태그: routing-ml-trainer, routing-ml-predictor).

모델 버전/메타: training_metadata.json 유지, TB Projector 로그 디렉터리 표준화. 

trainer_ml

5) 설치형 배포 전략

- 요구 요약: 최종 사용자는 파이썬 환경이 없으므로 Windows 기반 사내망 환경에서 실행 가능한 설치 파일(Setup.exe/MSI 등)을 제공해야 한다. Docker 미사용 환경을 위한 대체 배포 옵션을 병행한다.
- 구성 요소: 백엔드(FastAPI), 프런트엔드(React/Vite 빌드 산출물), 모델/설정 파일, Access ODBC 드라이버 검증 스크립트, SQL 컬럼 매핑 프로파일을 포함한 번들.
- 기술 대안:
  1. PyInstaller로 FastAPI 실행 바이너리를 만들고, Node 빌드 산출물을 함께 포함한 Inno Setup 기반 설치 파일.
  2. MSIX 혹은 WiX Toolset을 활용한 MSI 패키지(서비스 등록, 바탕화면/시작 메뉴 바로가기 생성 포함).
  3. 사내 배포 도구(SCCM/Chocolatey)용 패키지 스크립트 제공으로 중앙 배포 자동화.
- 설정 관리: 설치 마법사에서 `config/workflow_settings.json`, SQL 컬럼 매핑 프로파일, Trimmed-STD 파라미터 초기값을 선택 적용할 수 있도록 마이그레이션 스텝을 제공.
- 문서화 요구: Quickstart 및 운영 매뉴얼에 설치형 옵션, 사내망 배포 정책, 무중단 업데이트 절차, 롤백 방법을 명시한다.
- 테스트 요구: 설치 후 학습/예측 서비스 기동, 워크플로우 SAVE 즉시 반영, Access ODBC 연결, SQL export, TensorBoard Projector 접근이 정상 동작하는지 로컬 QA 체크리스트에 포함한다.
- 빌드 산출물: `deploy/installer/build_windows_installer.py`에서 PyInstaller 빌드·프런트엔드 번들·모델/설정 템플릿·PowerShell 스크립트를 `build/windows/installer`에 모으고, `deploy/installer/templates/installer.iss.tpl` 기반 Inno Setup 스크립트를 생성한다. 설치형 패키지 운영 스크립트는 `deploy/installer/scripts/*.ps1`에 포함한다.


D. 비기능 요구

성능 목표: 단건 예측 ≤ 1분, 배치 10건 ≤ 10분.

호환성: 사내망/ODBC, Windows 클라이언트에서도 웹 UI 접근 가능(내부 호스트).

신뢰성: 예측 실패 시 룰기반 베이스라인으로 폴백.

감사/로깅: 입력 피처 스냅샷, 유사도/가중치, 후보 라우팅 요약, 저장 결과 로그.

E. 평가/KPI

KPI-1: 정답 라우팅 단계 일치율(Seq-level Accuracy)

KPI-2: 예측시간/실적시간 일치율(MAE 또는 MAPE 역지표)

베이스라인: 룰 기반 (실패 시 폴백/비교)

---

## 2025-02-15 추가 지시 (Windows 인증 및 로그 개편)
- ~~API 무인증 운영~~
- Windows 도메인 ID/비밀번호 기반 사용자 인증을 FastAPI 전 구간에 적용한다.
- 로그인/로그아웃 이벤트와 주요 API 호출 이력을 `logs/audit/` 경로에 JSON 로그로 축적한다.
- 불필요한 백업 스크립트 및 캐시 디렉터리는 분석 후 제거하여 보안 노출을 최소화한다.


## 2025-02-16 추가 지시 (데스크톱 GUI 폐기 및 웹 아키텍처 집중)
- ~~Tkinter 기반 데스크톱 진입점(`main.py`, `gui/*`) 유지~~
- FastAPI + React 기반 웹 아키텍처만을 공식 진입점으로 사용하고, Windows 인증/세션 로깅 체계가 모든 경로에 일관되게 적용되도록 한다.
- 루트 및 하위 디렉터리의 숨은 파일을 포함해 잔존 데스크톱 자산·로그를 정리하고, 삭제/보존 근거를 산출물(로그/리포트)에 기록한다.
- 삭제/정리 결과와 감사 로그 구조를 PRD·Tasklist·PoC 보고서에 반영하고, 차기 워크플로우 시각화 산출물로 업데이트한다.


## 추가 GUI & 유지보수 전략 (2025-10 업데이트)
- **데이터 소스 관리 패널**: Access 파일 경로, 기본 테이블, 컬럼 블루프린트를 GUI에서 수정할 수 있도록 `DataSourceConfigurator`를 추가했습니다. 블루프린트 가능/불가 영역은 Oklch 파스텔 블루 음영으로 표시하여 사용자가 실수로 비허용 영역을 선택할 때 시각적으로 구분됩니다. 설정은 `/api/workflow/graph` `data_source` 패치로 즉시 저장됩니다.
- **모델 학습 콘솔**: 예측 서비스와 분리된 `TrainingConsole` GUI는 `/api/trainer/run`, `/api/trainer/status`와 연동되어 드라이런 여부, 버전 라벨, TensorBoard 메타데이터 컬럼을 지정하고, 학습 완료 시 `/models/version_*` 디렉터리에 버전별로 저장합니다. 모든 진행률과 성능 값은 `logs/performance/training.performance.log`에 기록합니다.
- **TensorBoard/Neo4j 게시 솔루션**: 예측 시 `with_visualization` 옵션을 사용하면 TensorBoard Projector용 `metadata.tsv`/`vectors.tsv`와 Neo4j 그래프 JSON이 자동으로 생성됩니다. `VisualizationSummary` 컴포넌트는 경로를 안내하고, `ExportOptionsPanel`에서 시각화 포함 여부를 제어합니다.
- **Feature 가중치 제어**: 프런트엔드 `FeatureWeightPanel`은 `FeatureWeightManager` 프로파일(`default`, `geometry-focus`, `operation-history`, `custom`)을 선택하거나 주요 피처(OUTDIAMETER, SETUP_TIME, MACH_WORKED_HOURS)를 슬라이더로 조정할 수 있게 했으며, `/api/predict` 요청에 `feature_weights` 및 `weight_profile`을 포함합니다.
- **다중 포맷 출력**: `/api/predict`는 `export_formats` 파라미터를 받아 CSV, TXT(UTF-8), Excel, JSON, Parquet, Cache, ERP 스텁 파일을 `deliverables/exports`에 저장합니다. ERP 연동은 기본 비활성화되어 있으나 향후 인터페이스를 위한 설정 필드를 포함합니다.
- **Neo4j/TensorBoard 통합**: `visualization` 설정으로 Neo4j 워크스페이스 URL과 Projector 메타데이터 컬럼을 관리하며, UI에서 관련 경로와 브라우저 주소를 즉시 확인할 수 있습니다.
- **Oklch 파스텔 블루 UI**: 전체 레이아웃에 Oklch 기반 파스텔 블루 그라데이션과 하이라이트/선택 음영을 적용하고, 모든 마우스 오버 시 카드가 부드럽게 부각되도록 인터랙션을 재정비했습니다.
