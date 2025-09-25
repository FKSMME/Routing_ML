# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

## 학습·예측 절대 조건 (Access 원본 및 사내망 전제)
- 2025-09-30 전수 점검 보고: `docs/audit_20250930.md` (로그: `logs/audit_20250930.log`)
- [x] 학습 임베딩은 `routing_data/ROUTING AUTO TEST.accdb`의 `dbo_BI_ITEM_INFO_VIEW` 전체 컬럼(ITEM_CD 기준)을 기준으로 생성한다.
- [x] `dbo_BI_ITEM_INFO_VIEW` ⇄ `dbo_BI_ROUTING_VIEW` ⇄ `dbo_BI_WORK_ORDER_RESULTS` 간에는 ITEM_CD 조인으로 관계를 구성하고, 학습/예측 파이프라인 설계서와 코드에 모두 반영한다.
- [x] 유사 품목 탐색은 Access 원본의 임베딩 공간에서 수행하며, 예측 시 `dbo_BI_ROUTING_VIEW`와 `dbo_BI_WORK_ORDER_RESULTS`의 공정/실적 데이터를 함께 사용해 자체 학습 루프(자기지도 업데이트)를 구성한다.
- [x] 코사인 유사도 0.8(80%) 이상을 기본 임계값으로 유지하고, 0.8 미만 후보는 로그에 남기고 후순위로 분류한다.
- [x] TensorBoard Projector에서 임베딩을 시각화할 수 있도록 벡터/메타데이터 export 경로와 포맷을 학습 단계마다 검증한다.
- [x] 예측 응답은 품목별로 3~4개의 가능한 라우팅 조합(예: "CNC선반3차+MCT", "MTM 3차")을 제안하고, 각 조합의 공정 목록을 7.1 SQL 구조에 맞춰 반환·저장한다.
- [x] 사내망/온프레미스 환경만 사용하며, 외부 클라우드·Explorer·DB는 참조하지 않는다.
- [x] 테이블/컬럼 명칭이 바뀌더라도 유지보수 가능한 구성(중앙 매핑, 설정화)을 문서와 코드에 모두 반영한다.

상세 Task List (설계 → 구현 → 테스트 → 배포)

* 모든 섹션마다 상단 게이트 체크리스트(승인/리뷰/오류 재요청/재점검/뷰어 승인/백그라운드 수행)를 적용합니다.
* 진행은 한 번에 하나의 태스크만 실행하고, 완료 시 보고 후 사용자 승인 대기합니다.

0. 레포/요건 동기화 (준비) — 상세 문서: `task_details/stage0_detail.md`

- [x] (설계) 현재 레포 구조 점검 및 아키텍처 스냅샷 정리 — `docs/stage0_report.md`
- [x] (설계) 요구사항 승인 워크플로우 도표 작성(게이트 포함) — `docs/approval_workflow.puml`
- [x] (구현) 이슈/PR 템플릿에 게이트 체크리스트 자동 포함 — `.github/ISSUE_TEMPLATE.md`, `.github/PULL_REQUEST_TEMPLATE.md`
- [x] (테스트) 요구 추적표(PRD ↔ 태스크 ↔ 커밋) 초안 — `docs/requirements_traceability_matrix.md`
- [x] (배포) 브랜치 보호 규칙/코드 오너 지정 — `docs/code_governance_plan.md`

1. 데이터 파이프라인 — 상세 문서: `task_details/stage1_detail.md`

- [x] (설계) ITEM_INFO ↔ ROUTING_VIEW ↔ WORK_ORDER_RESULTS 스키마/조인 정의서(ITEM_CD 기준) — `docs/data_pipeline_spec.md`
- [x] (설계) Feature 사전(범주/수치, 결측 규칙, 스케일링) 문서화 — `docs/data_pipeline_spec.md`
- [x] (구현) ODBC 커넥터/쿼리 모듈, 안전 형 변환·결측 처리 — `docs/data_pipeline_spec.md`
- [x] (구현) 피처 빌더: 인코딩(Label/Ordinal), 표준화, VarianceThreshold, (옵션) PCA — `docs/data_pipeline_spec.md`
- [x] (구현) “외주 공정 제외” 필터 파이프라인(후보 라우팅 집계 시 적용) — `docs/data_pipeline_spec.md`
- [x] (테스트) 샘플 데이터(비식별)로 스냅샷 테스트 — `docs/data_pipeline_spec.md`
- [x] (배포) 데이터 소스/시크릿 주입(.env/Key Vault) — `docs/data_pipeline_spec.md`

2. 학습 서비스(trainer) — 상세 문서: `task_details/stage2_detail.md`

- [x] (설계) 학습 파이프라인 설계서(HNSW, 가중치, 차원균형, 메타데이터, TB Projector export 플로우) — `docs/trainer_service_plan.md`
- [x] (구현) trainer_ml.py 개선 항목(혼합 인코딩, 가중치, HNSW 저장, TB Projector 옵션) 정리 — `docs/trainer_service_plan.md`
- [x] (구현) 모델/메타 저장 규약: training_metadata.json, tb_projector/ 구조 — `docs/trainer_service_plan.md`
- [x] (테스트) 학습 시간/메모리, 재현성(seed) 검증 계획 — `docs/trainer_service_plan.md`
- [x] (배포) 컨테이너 routing-ml-trainer 이미지화 계획 — `docs/trainer_service_plan.md`

3. 예측 서비스(predictor) — 상세 문서: `task_details/stage3_detail.md`

- [x] (설계) API I/F: /predict, /candidates/save, /health, /metrics — `docs/predictor_service_plan.md`
- [x] (구현) HNSW 로더 + Top-K(기본 10) + 임계값(기본 0.3) 파라미터 처리 — `docs/predictor_service_plan.md`
- [x] (구현) 메타-앙상블 후보 생성기: 상위 K 라우팅들을 공정별로 정렬·집계하여 후보 합성 — `docs/predictor_service_plan.md`
- [x] (구현) SQL 출력 매퍼: 사용자가 준 필수 컬럼 양식으로 후보를 직렬화/저장 — `docs/predictor_service_plan.md`
- [x] (설계) 모듈/함수 상호의존 그래프 API 요구사항 정의 및 데이터 스키마 초안 작성 — `docs/graph_workflow_ui_plan.md`
- [x] (구현) 그래프 노드 메타데이터/설정값 제공용 `/api/workflow/graph` 설계 반영 — `backend/api/routes/workflow.py`, `docs/graph_workflow_ui_plan.md`
- [x] (구현) `common/config_store.py` 런타임 저장소와 SAVE 즉시 적용 로직 작성 — trainer/predictor 설정 동기화 (`backend/trainer_ml.py`, `backend/predictor_ml.py`)
- [x] (테스트) 단건 ≤ 60초 / 10건 ≤ 10분 벤치마크(샘플 기준) 계획 — `docs/predictor_service_plan.md`
- [x] (배포) 컨테이너 routing-ml-predictor 이미지화, 프로브/로깅 — `docs/predictor_service_plan.md`
- [x] (구현) FastAPI 기반 예측 API(`/api/predict`, `/api/health` 등) 구현 — `backend/api/*`
- [x] (구현) 후보 저장 및 메트릭 응답 로직 구현 — `backend/api/services/prediction_service.py`

4. 프런트엔드(React, B안) — 상세 문서: `task_details/stage4_detail.md`

- [x] (설계) 3열 레이아웃/카드 디자인 시스템 확정 — `docs/stage4_frontend_report.md#설계`
- [x] (구현) 유사도 슬라이더 & Top-K 드롭다운 UX/상태 관리 설계 — `docs/stage4_frontend_report.md#구현-계획`
- [x] (구현) 후보 라우팅 테이블 및 정렬/필터 전략 정의 — `docs/stage4_frontend_report.md#구현-계획`
- [x] (구현) TensorBoard Projector 링크/뷰 안내 설계 — `docs/stage4_frontend_report.md#구현-계획`
- [x] (테스트) 주니어 사용자 사용성/접근성/성능 테스트 계획 수립 — `docs/stage4_frontend_report.md#테스트-전략`
- [x] (배포) CI/호스팅/문서 업데이트 계획 수립 — `docs/stage4_frontend_report.md#배포-준비`
- [x] (구현) React + Vite 프런트엔드 스캐폴드 및 3열 레이아웃 구현 — `frontend/src/App.tsx`
- [x] (구현) 후보/타임라인/메트릭 컴포넌트와 React Query 연동 — `frontend/src/components/*`
- [x] (설계) 블루스크린형 워크플로우 그래프 UI 시나리오, 노드 상호작용 플로우, 더블클릭 설정 팝업 UX 정의(디자인 레퍼런스 `main/1.jpg`~`main/4.jpg` 준수) — `docs/graph_workflow_ui_plan.md`
- [x] (구현) 그래프 렌더링 라이브러리 선택(Dagre/Cytoscape 등) 및 컴포넌트 구조 설계 업데이트 — `docs/graph_workflow_ui_plan.md`
- [x] (구현) 더블클릭 설정 패널 상태관리 및 설정 편집 UX 설계, SAVE 버튼이 `/api/workflow/graph` PATCH를 호출하도록 정의 — `docs/graph_workflow_ui_plan.md`
- [x] (테스트) 그래프 상호작용(드래그, 확대/축소, 팝업) 테스트 시나리오 수립 및 SAVE 후 trainer/predictor 즉시 반영 확인 항목 포함 — `docs/graph_workflow_ui_plan.md`


5. 출력/SQL 규격 — 상세 문서: `task_details/stage5_detail.md`

- [x] (설계) 대상 스키마 확정(routing_candidates, routing_candidate_operations) — `docs/stage5_sql_report.md#스키마-정의`
- [x] (구현) DDL/마이그레이션 스크립트 구조 정의 — `docs/stage5_sql_report.md#ddl-구성`
- [x] (구현) 저장/내보내기(INSERT/CSV) 플로우 설계 — `docs/stage5_sql_report.md#저장-및-내보내기-플로우`
- [x] (테스트) 샘플 표 대비 컬럼/타입/널 제약 정합성 테스트 계획 — `docs/stage5_sql_report.md#테스트-계획`
- [x] (배포) 승인/백업/버전 정책 수립 — `docs/stage5_sql_report.md#배포-준비`
- [x] (구현) 리스트/파워쿼리 방식 SQL 컬럼 매핑 관리(프로파일, active_profile) — `common/config_store.py`, `backend/api/routes/workflow.py`, `docs/stage5_sql_report.md`

6. 평가/모니터링 — 상세 문서: `task_details/stage6_detail.md`

- [x] (설계) KPI 정의서 및 베이스라인 확정 — `docs/stage6_monitoring_report.md#kpi-정의`
- [x] (구현) 평가 파이프라인 및 대시보드 지표 수집 설계 — `docs/stage6_monitoring_report.md#평가-파이프라인-설계`
- [x] (구현) 시퀀스 매칭/지표 계산/리포트 자동화 계획 수립 — `docs/stage6_monitoring_report.md#구현-계획`
- [x] (테스트) 샘플 데이터 및 단위 테스트 계획 수립 — `docs/stage6_monitoring_report.md#테스트-전략`
- [x] (배포) 주간 리포트 잡/모니터링/권한 계획 수립 — `docs/stage6_monitoring_report.md#배포-준비`

7. 운영/배포 — 상세 문서: `task_details/stage7_detail.md`

- [x] (설계) 네트워크/보안/ODBC/시크릿 설계 — `docs/stage7_operations_report.md#1-설계-design`
- [x] (구현) Dockerfile 2종(trainer/predictor), Compose 스택 — `deploy/docker/`
- [x] (구현) 프로브, 구조화 로그, 에러 알람 계획 — `docs/stage7_operations_report.md#2-구현-implementation`


5. 출력/SQL 규격 — 상세 문서: `task_details/stage5_detail.md`

- [x] (설계) 대상 스키마 확정(routing_candidates, routing_candidate_operations) — `docs/stage5_sql_report.md#스키마-정의`
- [x] (구현) DDL/마이그레이션 스크립트 구조 정의 — `docs/stage5_sql_report.md#ddl-구성`
- [x] (구현) 저장/내보내기(INSERT/CSV) 플로우 설계 — `docs/stage5_sql_report.md#저장-및-내보내기-플로우`
- [x] (테스트) 샘플 표 대비 컬럼/타입/널 제약 정합성 테스트 계획 — `docs/stage5_sql_report.md#테스트-계획`
- [x] (배포) 승인/백업/버전 정책 수립 — `docs/stage5_sql_report.md#배포-준비`
- [x] (구현) 리스트/파워쿼리 방식 SQL 컬럼 매핑 관리(프로파일, active_profile) — `common/config_store.py`, `backend/api/routes/workflow.py`, `docs/stage5_sql_report.md`

6. 평가/모니터링 — 상세 문서: `task_details/stage6_detail.md`

- [x] (설계) KPI 정의서 및 베이스라인 확정 — `docs/stage6_monitoring_report.md#kpi-정의`
- [x] (구현) 평가 파이프라인 및 대시보드 지표 수집 설계 — `docs/stage6_monitoring_report.md#평가-파이프라인-설계`
- [x] (구현) 시퀀스 매칭/지표 계산/리포트 자동화 계획 수립 — `docs/stage6_monitoring_report.md#구현-계획`
- [x] (테스트) 샘플 데이터 및 단위 테스트 계획 수립 — `docs/stage6_monitoring_report.md#테스트-전략`
- [x] (배포) 주간 리포트 잡/모니터링/권한 계획 수립 — `docs/stage6_monitoring_report.md#배포-준비`

7. 운영/배포 — 상세 문서: `task_details/stage7_detail.md`

- [x] (설계) 네트워크/보안/ODBC/시크릿 설계 — `docs/stage7_operations_report.md#1-설계-design`
- [x] (구현) Dockerfile 2종(trainer/predictor), Compose 스택 — `deploy/docker/`
- [x] (구현) 프로브, 구조화 로그, 에러 알람 계획 — `docs/stage7_operations_report.md#2-구현-implementation`
- [x] (테스트) 장애 주입 테스트(모델 미존재/DB 연결 끊김) — `docs/stage7_operations_report.md#3-테스트-test`
- [x] (배포) 단계적 롤아웃/롤백 전략 — `docs/stage7_operations_report.md#4-배포-deployment`

8. 문서화/전달물 — 상세 문서: `task_details/stage8_detail.md`

- [x] (설계) 아키텍처 다이어그램/문서 구조/온보딩/릴리스 설계 — `docs/stage8_documentation_report.md#1-설계-design`

- [x] (설계) 네트워크/보안/ODBC/시크릿 설계 — `docs/stage7_operations_report.md#1-설계-design`

- [x] (구현) Dockerfile 2종(trainer/predictor), Compose/Helm(선택) — `deploy/docker/`

- [x] (구현) 프로브, 구조화 로그, 에러 알람 — `docs/stage7_operations_report.md#2-구현-implementation`


- [x] (테스트) 장애 주입 테스트(모델 미존재/DB 연결 끊김) — `docs/stage7_operations_report.md#3-테스트-test`
- [x] (배포) 단계적 롤아웃/롤백 전략 — `docs/stage7_operations_report.md#4-배포-deployment`

- [x] (구현) FastAPI 백엔드 런타임 스캐폴드 및 실행 스크립트 — `backend/run_api.py`
- [x] (문서) 백엔드 운영 개요 및 실행 가이드 — `docs/backend_api_overview.md`

8. 문서화/전달물 — 상세 문서: `task_details/stage8_detail.md`

- [x] (설계) 아키텍처 다이어그램/문서 구조/온보딩/릴리스 설계 — `docs/stage8_documentation_report.md#1-설계-design`
- [x] (구현) README/Quickstart/Release Notes/Deliverables 정비 — `README.md`, `docs/quickstart_guide.md`, `docs/release_notes.md`, `deliverables/README.md`
- [x] (테스트) 온보딩 워크스루 점검 — `docs/stage8_documentation_report.md#3-테스트-test`
- [x] (배포) 릴리스 노트, 버전 정책, 전달물 공유 — `docs/stage8_documentation_report.md#4-배포-deployment`

9. 설치형 배포 연구/준비 — 상세 문서: `task_details/stage9_detail.md`

- [x] (설계) 파이썬 미설치 Windows 환경 대상 설치 프로그램 요구 정의 및 사용자 시나리오 수립 — `docs/stage9_packaging_plan.md#요구-정의`
- [x] (연구) PyInstaller+Inno Setup, MSIX/WiX, SCCM/Chocolatey 스크립트 등 패키징 대안 비교 및 의존성/보안 검토 — `docs/stage9_packaging_plan.md#기술-대안`
- [x] (구현) 설치 번들 구조 설계: 백엔드/프런트엔드 빌드, 모델, 설정, ODBC 검증 스크립트 포함 패키지 레이아웃 — `docs/stage9_packaging_plan.md#번들-구성`
- [x] (테스트) 설치 후 학습·예측·워크플로우 SAVE 검증 체크리스트와 QA 자동화 계획 수립 — `docs/stage9_packaging_plan.md#테스트-전략`
- [x] (문서) Quickstart/운영 매뉴얼 업데이트 계획 및 사내 배포 정책 정리 — `docs/stage9_packaging_plan.md#문서화`
- [x] (구현) Windows 설치 빌드 스크립트 및 Inno Setup 템플릿 작성 — `deploy/installer/build_windows_installer.py`, `deploy/installer/templates/installer.iss.tpl`
- [x] (구현) 서비스 등록/검증 PowerShell 스크립트 4종 작성 — `deploy/installer/scripts/*.ps1`
- [x] (구현) 설치 기본 설정/버전 템플릿 구성 — `config/workflow_settings.template.json`, `config/sql_profiles/access_7_1.json`, `config/version.json`
- [x] (문서) 설치 가이드 및 문제 해결 문서 추가 — `docs/install_guide_ko.md`, `docs/TROUBLESHOOTING.md`


- [x] (설계) 파이썬 미설치 Windows 환경 대상 설치 프로그램 요구 정의 및 사용자 시나리오 수립 — `docs/stage9_packaging_plan.md#요구-정의`
- [x] (연구) PyInstaller+Inno Setup, MSIX/WiX, SCCM/Chocolatey 스크립트 등 패키징 대안 비교 및 의존성/보안 검토 — `docs/stage9_packaging_plan.md#기술-대안`
- [x] (구현) 설치 번들 구조 설계: 백엔드/프런트엔드 빌드, 모델, 설정, ODBC 검증 스크립트 포함 패키지 레이아웃 — `docs/stage9_packaging_plan.md#번들-구성`
- [x] (테스트) 설치 후 학습·예측·워크플로우 SAVE 검증 체크리스트와 QA 자동화 계획 수립 — `docs/stage9_packaging_plan.md#테스트-전략`
- [x] (문서) Quickstart/운영 매뉴얼 업데이트 계획 및 사내 배포 정책 정리 — `docs/stage9_packaging_plan.md#문서화`


