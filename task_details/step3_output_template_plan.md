> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 0 | Completed 10 | Blockers 0

# 절대 지령 준수 안내
- 기존 절대 지령을 동일하게 적용하며 착수·완료 시 승인 절차를 따른다.
- 작업 로그와 산출물을 문서화하고 Tasklist와 연동한다.

# Step 3 Plan: 데이터 출력 템플릿 시스템

## 단계 목표
- [x] 템플릿 CRUD/유효성 검사/ERP 매핑을 완성하고 라우팅 SAVE와 연동한다. (`frontend/src/components/workspaces/DataOutputWorkspace.tsx`, `backend/api/routes/workflow.py`, `common/config_store.py`)

## 세부 Task Checklist
- [x] 요구사항 재정의: `Tasklist.md` Step 3 항목과 `common/sql_schema.py` 기본 컬럼 세트 교차 검토 완료.
- [x] 백엔드 설계: `/api/workflow/graph` SQL 설정 PATCH + 감사 로그(`workflow.settings.save`)로 CRUD/버전 기록 처리.
- [x] 프런트 UI 설계: 템플릿 목록, 컬럼 DnD, 미리보기/검증 UX 와이어프레임 작성 — `frontend/src/components/workspaces/DataOutputWorkspace.tsx` + `frontend/src/hooks/useOutputProfiles.ts` 구현 반영.
- [x] ERP 매핑 로직: ERP 옵션 의존성 설계, 필수 필드 검증 규칙 정의 — `common/config_store.SQLColumnConfig.validate_columns` 및 Options Workspace 연동으로 검증.
- [x] 라우팅 SAVE 연동: 템플릿 선택→검증→저장 흐름 설계 — `frontend/src/components/RoutingGroupControls.tsx` 내 저장 포맷 지원 및 프로필 적용.
- [x] 테스트 계획: 유효성 검사 케이스, 회귀 테스트, 실패 롤백 전략 — `docs/sprint/routing_enhancement_qa.md` 데이터 출력 섹션에 명시, `frontend/src/hooks/useOutputProfiles.ts` 오류 처리 로직 포함.

## 계획 산출물
- [x] 템플릿 데이터 모델/엔드포인트 명세 초안 — `docs/backend_api_overview.md` SQL/Export 섹션 갱신.
- [x] UI/QA 체크리스트 및 승인 요청 자료 — `docs/sprint/routing_enhancement_qa.md` + `docs/sprint/next_stage_checklist.md` Data Output 항목으로 제출.

## 완료 증빙 및 승인 로그
- `docs/sprint/logbook.md` 2025-09-29 "Tasklist Follow-up Reconciliation" 항목에서 출력 템플릿 설계/검증 완료 보고.
- UI 감사 로그 `ui.output.profile.save` 이벤트가 `logs/audit/ui_actions.log`에 남아 실행 증빙 확보.

