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
- `backend/api/app.py`: `create_app()`이 모든 라우터를 조합하고 CORS 정책을 설정한다.【F:backend/api/app.py†L25-L44】
- `backend/api/routes/auth.py`: `/api/auth/*` 사용자 등록·로그인·세션 조회·로그아웃과 관리자 승인/거절 엔드포인트를 제공한다.【F:backend/api/routes/auth.py†L21-L131】
- `backend/api/routes/prediction.py`: `/api/*` 하위에서 예측, 후보 저장, 유사도 검색, 그룹 추천, 공정 시간 요약, 규칙 검증, 메트릭 조회를 처리한다.【F:backend/api/routes/prediction.py†L35-L234】
- `backend/api/routes/workflow.py`: `/api/workflow/graph`에 대한 GET/PATCH로 그래프·런타임·SQL·데이터 소스·시각화 구성을 일괄 관리한다.【F:backend/api/routes/workflow.py†L45-L200】
- `backend/api/routes/workspace.py`: `/api/settings/workspace`, `/api/audit/ui`, `/api/access/connection/test`를 통해 UI 설정, UI 감사 로그, Access 연결 검증을 담당한다.【F:backend/api/routes/workspace.py†L19-L200】
- `backend/api/routes/master_data.py`: `/api/master-data/*`에서 트리, 품목, 감사 로그, 감사 로그 다운로드 API를 제공한다.【F:backend/api/routes/master_data.py†L18-L112】
- `backend/api/routes/access.py`: `/api/access/metadata`를 통해 Access 메타데이터를 반환한다.【F:backend/api/routes/access.py†L11-L31】
- `backend/api/routing_groups.py`: `/api/routing/groups` CRUD로 SQLite 기반 라우팅 그룹과 감사 로깅을 관리한다.【F:backend/api/routing_groups.py†L34-L437】
- `backend/api/routes/rsl.py`: `/api/rsl/groups` 계층에서 RSL 그룹/스텝/룰 CRUD, 검증, 배포, 가져오기/내보내기를 노출한다.【F:backend/api/routes/rsl.py†L31-L335】
- `backend/api/routes/trainer.py`: `/api/trainer/*`에서 학습 상태 조회, 실행 제한 안내, 모델 버전 열람/활성화를 지원한다.【F:backend/api/routes/trainer.py†L21-L124】

## 2. 실행 방법
```bash
pip install -r requirements.txt
python -m backend.run_api
```
- 기본 포트는 `8000`, API prefix는 `/api`.
- `ROUTING_ML_MODEL_DIRECTORY` 환경변수를 통해 모델 경로 지정.

## 3. API 카탈로그
| 영역 | 엔드포인트 | 메서드 | 설명 |
| --- | --- | --- | --- |
| 인증 | `/api/auth/register` | POST | 사용자 등록 및 감사 로그 기록.【F:backend/api/routes/auth.py†L26-L33】 |
| 인증 | `/api/auth/login` | POST | 토큰 발급·쿠키 설정 및 실패 감지.【F:backend/api/routes/auth.py†L36-L60】 |
| 인증 | `/api/auth/logout` | POST | 세션 쿠키 초기화 및 감사 로그 작성.【F:backend/api/routes/auth.py†L68-L89】 |
| 인증 | `/api/auth/me` | GET | 현재 인증 사용자 정보 조회.【F:backend/api/routes/auth.py†L63-L65】 |
| 인증 | `/api/auth/admin/approve` | POST | 관리자 승인 및 감사 로그.【F:backend/api/routes/auth.py†L92-L110】 |
| 인증 | `/api/auth/admin/reject` | POST | 관리자 거절 및 사유 기록.【F:backend/api/routes/auth.py†L113-L131】 |
| 헬스체크 | `/api/health` | GET | 서비스 상태 확인.【F:backend/api/routes/prediction.py†L35-L40】 |
| 예측 | `/api/predict` | POST | 라우팅 후보·메트릭 생성, 내보내기 옵션 지원.【F:backend/api/routes/prediction.py†L42-L93】 |
| 예측 | `/api/candidates/save` | POST | 후보 라우팅 영구 저장 및 감사 로그.【F:backend/api/routes/prediction.py†L197-L224】 |
| 예측 | `/api/metrics` | GET | 마지막 예측 메트릭 반환.【F:backend/api/routes/prediction.py†L226-L234】 |
| 유사도 | `/api/similarity/search` | POST | 품목 유사도 검색.【F:backend/api/routes/prediction.py†L95-L122】 |
| 그룹 추천 | `/api/groups/recommendations` | POST | 품목별 그룹 추천 목록 반환.【F:backend/api/routes/prediction.py†L124-L149】 |
| 공정 요약 | `/api/time/summary` | POST | 공정 리드타임 요약 및 감사 로그.【F:backend/api/routes/prediction.py†L152-L171】 |
| 규칙 검증 | `/api/rules/validate` | POST | 매니페스트 규칙 검증 및 위반 수 기록.【F:backend/api/routes/prediction.py†L174-L194】 |
| 워크플로우 | `/api/workflow/graph` | GET/PATCH | 그래프·런타임·SQL·데이터 소스 구성을 조회/갱신.【F:backend/api/routes/workflow.py†L102-L200】 |
| 워크스페이스 | `/api/settings/workspace` | GET/PUT | UI 설정 저장/조회, 컬럼 매핑 카운트 로깅.【F:backend/api/routes/workspace.py†L67-L127】 |
| 워크스페이스 | `/api/audit/ui` | POST | UI 상호작용 감사 로그 스트리밍.【F:backend/api/routes/workspace.py†L129-L151】 |
| Access | `/api/access/connection/test` | POST | Access 연결·테이블 검증 및 경과 시간 반환.【F:backend/api/routes/workspace.py†L154-L200】 |
| 마스터 데이터 | `/api/master-data/tree` | GET | Access 기준정보 트리 조회.【F:backend/api/routes/master_data.py†L24-L44】 |
| 마스터 데이터 | `/api/master-data/items/{item_code}` | GET | 품목 행렬 조회 및 감사 로그.【F:backend/api/routes/master_data.py†L47-L70】 |
| 마스터 데이터 | `/api/master-data/logs` | GET | 감사 로그/상태 요약 반환.【F:backend/api/routes/master_data.py†L73-L89】 |
| 마스터 데이터 | `/api/master-data/logs/download` | GET | 감사 로그 파일 다운로드.【F:backend/api/routes/master_data.py†L92-L111】 |
| Access | `/api/access/metadata` | GET | Access 테이블 메타데이터 조회.【F:backend/api/routes/access.py†L11-L31】 |
| 라우팅 그룹 | `/api/routing/groups` | GET/POST | SQLite 라우팅 그룹 목록 조회/생성.【F:backend/api/routing_groups.py†L95-L225】 |
| 라우팅 그룹 | `/api/routing/groups/{group_id}` | GET/PUT/DELETE | 상세 조회, 버전 검증 업데이트, 소프트 삭제.【F:backend/api/routing_groups.py†L248-L437】 |
| RSL | `/api/rsl/groups` | GET/POST | RSL 그룹 페이지네이션/생성.【F:backend/api/routes/rsl.py†L49-L90】 |
| RSL | `/api/rsl/groups/{group_id}` | GET/PATCH/DELETE | 그룹 조회, 부분 업데이트, 삭제.【F:backend/api/routes/rsl.py†L92-L190】 |
| RSL | `/api/rsl/groups/{group_id}/steps` | POST | 스텝 추가.【F:backend/api/routes/rsl.py†L141-L156】 |
| RSL | `/api/rsl/groups/{group_id}/steps/{step_id}` | PATCH/DELETE | 스텝 수정·삭제.【F:backend/api/routes/rsl.py†L158-L190】 |
| RSL | `/api/rsl/groups/{group_id}/steps/{step_id}/rules` | POST/DELETE | 룰 참조 추가/삭제.【F:backend/api/routes/rsl.py†L193-L240】 |
| RSL | `/api/rsl/groups/{group_id}/validate` | POST | 그룹 검증 상태 반환.【F:backend/api/routes/rsl.py†L243-L257】 |
| RSL | `/api/rsl/groups/{group_id}/release` | POST | 그룹 배포 상태 변경.【F:backend/api/routes/rsl.py†L259-L272】 |
| RSL | `/api/rsl/groups/{group_id}/retract` | POST | 그룹 회수 처리.【F:backend/api/routes/rsl.py†L275-L288】 |
| RSL | `/api/rsl/groups/export` | GET | JSON/CSV 내보내기.【F:backend/api/routes/rsl.py†L291-L315】 |
| RSL | `/api/rsl/groups/import` | POST | 그룹 일괄 가져오기.【F:backend/api/routes/rsl.py†L317-L335】 |
| 트레이너 | `/api/trainer/status` | GET | 학습 상태/메트릭 조회.【F:backend/api/routes/trainer.py†L61-L68】 |
| 트레이너 | `/api/trainer/run` | POST | 학습 실행 제한 및 가이드 메시지 반환.【F:backend/api/routes/trainer.py†L70-L85】 |
| 트레이너 | `/api/trainer/versions` | GET | 모델 버전 목록 조회 (limit 지원).【F:backend/api/routes/trainer.py†L88-L102】 |
| 트레이너 | `/api/trainer/versions/{version_name}/activate` | POST | 모델 버전 활성화 및 감사 로깅.【F:backend/api/routes/trainer.py†L105-L123】 |

## 4. 예측 & 라우팅 흐름
1. `/api/predict`는 가중치·프로파일·내보내기 옵션과 함께 품목 후보 및 메트릭을 반환하고 저장된 파일 목록을 메트릭에 포함시킨다.【F:backend/api/routes/prediction.py†L42-L93】
2. 유사도 검색(`/api/similarity/search`)과 그룹 추천(`/api/groups/recommendations`)은 예측 서비스 내 공통 모델 자원을 재사용하며 감사 로그로 요청 항목과 결과 수를 남긴다.【F:backend/api/routes/prediction.py†L95-L149】
3. 공정 요약(`/api/time/summary`)과 규칙 검증(`/api/rules/validate`)은 공정 데이터와 매니페스트를 검증하여 집계량, 평가된 규칙, 위반 수를 기록한다.【F:backend/api/routes/prediction.py†L152-L194】
4. 라우팅 그룹은 SQLite 기반 `/api/routing/groups` 계열 API에서 버전 잠금과 감사 이벤트를 통해 CRUD를 수행하고, ERP 연계 여부와 메타데이터를 유지한다.【F:backend/api/routing_groups.py†L95-L389】
5. Rule Set Library(`/api/rsl/groups/*`)는 GUI에서 정의한 단계·룰을 검증/배포/회수하며, JSON·CSV 내보내기 및 가져오기로 협업 워크플로우를 지원한다.【F:backend/api/routes/rsl.py†L49-L335】

## 5. 감사 로그 매핑
- `auth.audit`: 가입/로그인/로그아웃/승인/거절 시 사용자·클라이언트 정보를 JSON으로 기록.【F:backend/api/routes/auth.py†L32-L130】
- `api.audit`: 예측, 후보 저장, 유사도 검색, 그룹 추천, 공정 요약, 규칙 검증, 메트릭 조회 이벤트를 남긴다.【F:backend/api/routes/prediction.py†L76-L233】
- `workflow.audit`: 그래프 조회/패치 시 사용자와 변경 내역을 기록하고 런타임 설정 적용을 추적한다.【F:backend/api/routes/workflow.py†L102-L200】
- `api.audit.workspace`: UI 설정 저장 시 컬럼 매핑 수·범위와 IP를 기록하며 UI 액션 로그 파일을 생성한다.【F:backend/api/routes/workspace.py†L85-L151】
- `api.master_data`/`api.audit.master_data`: 기준정보 조회, 품목 행렬 요청, 로그 다운로드를 감사 로그로 남긴다.【F:backend/api/routes/master_data.py†L24-L111】
- `api.access`: Access 메타데이터 조회 및 연결 테스트에서 테이블 수, 경로, 경과 시간을 로깅한다.【F:backend/api/routes/access.py†L11-L31】【F:backend/api/routes/workspace.py†L154-L200】
- `routing.group.*`: 라우팅 그룹 저장/조회/업데이트/삭제 시 감사 이벤트와 수행 시간을 기록한다.【F:backend/api/routing_groups.py†L131-L436】
- `rsl.audit`: RSL 그룹·스텝·룰·배포/회수/검증/입출력 이벤트를 JSON 감사 로그로 수집한다.【F:backend/api/routes/rsl.py†L49-L335】
- `api.trainer`: 학습 상태 조회, 실행 제한 경고, 모델 버전 활성화 로그를 남긴다.【F:backend/api/routes/trainer.py†L61-L123】

## 6. 문서 & 자동화
- OpenAPI 스키마는 `python - <<'PY'` 방식으로 `ensure_forward_ref_compat()` 패치를 적용한 뒤 `app.openapi()` 결과를 `deliverables/openapi.json`에 기록한다.【F:backend/api/pydantic_compat.py†L8-L57】【F:deliverables/openapi.json†L1-L400】
- 동일 스키마를 프런트엔드에서 활용할 수 있도록 `frontend/src/lib/api/schema.ts`에 TypeScript 상수로 내보낸다.【F:frontend/src/lib/api/schema.ts†L1-L40】
- `scripts/run_quality_checks.sh`는 ruff/black/pytest/OpenAPI 검증을 순차 실행하는 기존 CI 파이프라인을 유지한다.

## 7. 승인 & 추적
- `docs/sprint/logbook.md` 2025-09-29 "Execution Report" 항목에 API/로그 명세 검토 완료 기록이 존재한다.
- `docs/absolute_directive_report.md` API 준수 절에 본 문서 개정 내역을 링크하였다.
