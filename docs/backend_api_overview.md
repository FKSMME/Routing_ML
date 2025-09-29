> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 0 | Completed 18 | Blockers 0

# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

# Routing-ML FastAPI 백엔드 개요

## 1. 서비스 구조
- `backend/api/app.py`: FastAPI 애플리케이션 팩토리 및 CORS 설정, OpenAPI 스키마 노출.
- `backend/api/routes/prediction.py`: `/api/predict`, `/api/candidates/save`, `/api/health`, `/api/metrics` 엔드포인트 제공.
- `backend/api/routes/access.py`: Access 메타데이터 조회(`/api/access/metadata`). 【F:backend/api/routes/access.py†L1-L33】
- `backend/api/routes/workflow.py`: 워크플로우 그래프/런타임 구성 PATCH(`/api/workflow/graph`). 【F:backend/api/routes/workflow.py†L35-L152】
- `backend/api/routes/workspace.py`: UI 설정 저장/감사(`/api/settings/workspace`, `/api/access/connection/test`, `/api/audit/ui`). 【F:backend/api/routes/workspace.py†L52-L139】
- `backend/api/routes/rsl.py`: 라우팅 그룹 CRUD(`/api/routing/groups`) 및 감사 로깅.
- `backend/api/routes/trainer.py`: 학습 상태/메트릭/피처 토글 API.
- `backend/api/services/*`: 마스터 데이터/워크플로우/예측/학습 등 비즈니스 로직 계층.
- `common/config_store.py`: Manifest/Registry, SQL 출력, 옵션, 시각화 설정 저장소.

## 2. 실행 방법
```bash
pip install -r requirements.txt
python -m backend.run_api
```
- 기본 포트는 `8000`, API prefix는 `/api`.
- `ROUTING_ML_MODEL_DIRECTORY` 환경변수를 통해 모델 경로 지정.

## 3. API 카탈로그
| 영역 | 엔드포인트 | 메서드 | 주요 스키마 | 감사 로그 |
| --- | --- | --- | --- | --- |
| 예측 | `/api/predict` | POST | `PredictionRequest` → `PredictionResponse` | `prediction.request`, `prediction.response` |
| 예측 | `/api/candidates/save` | POST | `CandidateSaveRequest` | `prediction.candidate.save` |
| 헬스체크 | `/api/health` | GET | - | - |
| 마스터 데이터 | `/api/access/metadata` | GET | `AccessMetadataResponse` | `access.metadata` 【F:backend/api/routes/access.py†L14-L30】 |
| 마스터 데이터 | `/api/access/connection/test` | POST | `AccessConnectionResponse` | `workspace.access.test` 【F:backend/api/routes/workspace.py†L88-L139】 |
| 워크플로우 | `/api/workflow/graph` | GET/PATCH | `WorkflowConfigResponse`/`WorkflowConfigPatch` | `workflow.graph.read`/`workflow.graph.patch` 【F:backend/api/routes/workflow.py†L96-L152】 |
| UI 설정 | `/api/settings/workspace` | GET/PUT | `WorkspaceSettingsResponse`/`WorkspaceSettingsPayload` | `workspace.settings.save` 【F:backend/api/routes/workspace.py†L52-L111】 |
| UI 감사 | `/api/audit/ui` | POST | `AuditEvent` | `workspace.audit` 【F:backend/api/routes/workspace.py†L113-L133】 |
| 라우팅 그룹 | `/api/routing/groups` | GET/POST | `RoutingGroupListResponse`/`RoutingGroupCreateRequest` | `rsl.group.save`, `rsl.group.list` |
| 학습 현황 | `/api/trainer/status` | GET | `TrainingStatus` | `trainer.status.read` |
| 학습 현황 | `/api/trainer/metrics` | GET | `TrainingMetricsResponse` | `trainer.metrics.read` |
| 학습 현황 | `/api/trainer/features` | GET/PATCH | `TrainingFeatureWeight` | `trainer.features.save` |

## 4. 예측 & 라우팅 흐름
1. `/api/predict` 호출 시 요청 파라미터를 검증하고 manifest/registry 메타정보 기반으로 모델과 HNSW 인덱스를 로드한다.
2. 추천 결과는 타임라인/후보 리스트로 직렬화되며, `RoutingGroupControls`가 그룹 저장 시 `/api/routing/groups`에 `erp_required`·`steps` 정보를 전달한다.
3. `/api/workflow/graph` PATCH는 그래프/런타임/SQL/데이터소스/시각화 설정을 atomic하게 갱신하고, `workflow_config_store`가 JSON 스냅샷을 유지한다. 【F:backend/api/routes/workflow.py†L70-L152】
4. `/api/settings/workspace` PUT은 UI 탭/레이아웃/옵션 상태를 JSON 파일로 저장하면서 mapping scope/개수를 감사 로그에 기록한다. 【F:backend/api/routes/workspace.py†L52-L111】

## 5. 감사 로그 매핑
- `access.metadata`: Access 테이블/컬럼 조회 시 사용자, 테이블명, 경로, 컬럼 수를 기록. 【F:backend/api/routes/access.py†L14-L30】
- `workspace.access.test`: Access 연결 테스트, 경로 hash와 검증 테이블, 소요 시간(ms) 기록. 【F:backend/api/routes/workspace.py†L88-L139】
- `workflow.graph.read` / `workflow.graph.patch`: 워크플로우 그래프 조회/갱신 시 사용자·노드/엣지 개수 등 메타데이터 기록. 【F:backend/api/routes/workflow.py†L96-L152】
- `workspace.settings.save`: UI 옵션 저장 시 mapping 개수/스코프, 사용자 IP를 JSON으로 로그. 【F:backend/api/routes/workspace.py†L66-L111】
- `workspace.audit`: 모든 UI 이벤트(`ui.*`)에 대해 타임스탬프, 사용자, IP, payload 기록. 【F:backend/api/routes/workspace.py†L113-L133】
- `rsl.group.save`/`rsl.group.load`: 라우팅 그룹 저장/불러오기 감사 로그(경로: `backend/api/routes/rsl.py`).
- `trainer.features.save`: 피처 가중치 토글 감사 로그(경로: `backend/api/routes/trainer.py`).

## 6. 문서 & 자동화
- OpenAPI 문서는 FastAPI `/docs` 또는 향후 `python -m backend.run_api --export-openapi` 스크립트로 추출한다.
- `docs/requirements_traceability_matrix.md`는 상기 엔드포인트를 요구사항 ID에 매핑하여 업데이트 완료.
- `scripts/run_quality_checks.sh`는 ruff/black/pytest/OpenAPI 검증을 순차 수행하도록 구성되어 있으며, CI 파이프라인과 동일 단계로 통합한다.

## 7. 승인 & 추적
- `docs/sprint/logbook.md` 2025-09-29 "Execution Report" 항목에 API/로그 명세 검토 완료 기록이 존재한다.
- `docs/absolute_directive_report.md` API 준수 절에 본 문서 개정 내역을 링크하였다.
