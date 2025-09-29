> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 0 | Completed 10 | Blockers 0

# 절대 지령 준수 안내
- 기존 절대 지령을 동일하게 적용하며 착수·완료 시 승인 절차를 따른다.
- 작업 로그와 산출물을 문서화하고 Tasklist와 연동한다.

# Step 5 Plan: 옵션 메뉴 고도화

## 단계 목표
- [x] 표준편차/유사 품목 옵션 충돌 관리, 컬럼 매핑 편집기, ERP 토글 연계를 구현한다. (`frontend/src/components/workspaces/OptionsWorkspace.tsx`, `frontend/src/store/routingStore.ts`, `backend/api/routes/workspace.py`)

## 세부 Task Checklist
- [x] 옵션 목록 정비: 상호 배타 규칙 명세, 기본값 재정의 — Options Workspace `STANDARD_OPTIONS`/`SIMILARITY_OPTIONS` 정의와 `routingStore` 상태 반영.
- [x] 상태 모델링: 옵션 저장 구조, Validation/Dependency graph 설계 — `frontend/src/components/workspaces/OptionsWorkspace.tsx` 저장 로직과 `backend/api/routes/workspace.py` 검증/감사 저장.
- [x] 컬럼 매핑 편집기 설계: Drag & Drop UI, 검색, 검증 흐름 문서화 — Options Workspace 컬럼 매핑 테이블 및 dedupe 로직으로 구현.
- [x] ERP 연계 로직: ERP 옵션 ON 시 필수 체크 규칙 작성 — `useRoutingStore`의 `setERPRequired`/`RoutingGroupControls` 연동으로 제약 반영.
- [x] 감사 로그 설계: `options.update`, 충돌 경고, 롤백 전략 정의 — `backend/api/routes/workspace.py` `save_workspace_settings` 감사 필드 기록.
- [x] 테스트 계획: 충돌 조합, 저장/적용, 라우팅·출력 메뉴 연동 테스트 정의 — `docs/sprint/routing_enhancement_qa.md` 옵션 섹션과 `docs/error_risk_review.md` 대응 리스크 기재.

## 계획 산출물
- [x] 옵션 상태/데이터 모델 설계 문서 — `docs/stage7_operations_report.md` 옵션 운영 섹션 업데이트.
- [x] UI/QA 플랜 및 승인 자료 — `docs/sprint/next_stage_checklist.md` Options 항목과 `docs/sprint/routing_enhancement_qa.md`에 근거 기록.

## 완료 증빙 및 승인 로그
- `docs/sprint/logbook.md` 2025-09-29 "Group 5" 기록과 `logs/audit/ui_actions.log`의 `ui.options.save` 이벤트로 승인 근거 확보.

