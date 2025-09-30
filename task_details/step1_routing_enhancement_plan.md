> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 4 | Completed 28 | Blockers 0

> Step 1 plan checklist status (doc scope): Pending 3 | Completed 8 — unchanged; aligns with Tasklist Step 1 follow-up section.

# 절대 지령 준수 안내
- 기존 절대 지령(단계별 승인, 오류 재확인, 백그라운드 수행, 로그 유지)을 이 단계에도 동일하게 적용한다.
- 착수 전 범위 재검토/문서화, 승인 후 구현, 오류 발견 시 즉시 보고·재승인 절차를 따른다.
- Tasklist와 본 문서에 진행 로그를 남기고, 결과 제출 시 승인 요청서를 함께 준비한다.

# Step 1 Plan: 라우팅 생성 고도화

## 단계 목표
- [x] 드래그·드롭 추천 워크플로우를 Access/추천 API와 실시간 연동한다. (`frontend/src/App.tsx`, `frontend/src/components/TimelinePanel.tsx`, `frontend/src/hooks/usePredictRoutings.ts`)
- [x] 라우팅 그룹 저장/불러오기 및 ERP 인터페이스 옵션 제어를 완성한다. (`frontend/src/components/RoutingGroupControls.tsx`, `frontend/src/hooks/useRoutingGroups.ts`, `backend/api/routes/rsl.py`)

## 세부 Task Checklist
- [x] 현황 점검: `task_details/menu2_routing_builder_detail.md` 요구사항, Access/추천 API 스키마 재검토 — 2025-09-30 리뷰 메모를 `docs/sprint/logbook.md` 2025-09-29 항목에 기록 완료.
- [x] API 연계 설계: 그룹 저장/불러오기, ERP 옵션 연계에 필요한 백엔드 엔드포인트/스키마 정의 — `backend/api/routes/rsl.py`, `backend/api/routes/workspace.py` 최종 명세 반영.
- [x] 프런트 상태 모델링: drag-drop 상태, 멀티 탭, 그룹 Persistence, 에러 처리 흐름 설계 — `frontend/src/components/routing/RoutingProductTabs.tsx`, `frontend/src/components/TimelinePanel.tsx`, `frontend/src/store/routingStore.ts` 구조로 정리.
- [x] 데이터 영속성 설계: 로컬/서버 저장, 감사 로그(`action=routing.group.*`) 정의 및 보안 검토 — `frontend/src/hooks/useRoutingGroups.ts`의 감사 로그 전송과 `backend/api/routes/workspace.py` 감사 로그 저장으로 구현 확인.
- [x] ERP 옵션 통합 계획: Options 메뉴와의 의존성 매트릭스, 토글 시 Validation 로직 문서화 — `frontend/src/components/RoutingGroupControls.tsx`와 `frontend/src/components/workspaces/OptionsWorkspace.tsx`간 스토어 연동 완료.
- [x] QA & 리스크 플랜: DnD 충돌, 동시 편집, 롤백/회복 시나리오 정리 — `docs/sprint/routing_enhancement_qa.md` DnD/Undo/ERP 테스트 케이스에 반영.

## 완료 증빙 및 승인 로그
- `docs/sprint/logbook.md` 2025-09-29 "Tasklist (1)"/"Tasklist (2)" 항목에 Step 1 구현 완료·승인 기록을 남김.
- `docs/sprint/group1_contract_alignment_review.md`의 Manifest/Registry 연결 검증 항목을 Step 1 완료 근거로 교차 참조.
- ERP 연계 옵션 토글과 그룹 저장 감사 로그는 `logs/audit/ui_actions.log`에 `ui.routing.save`/`ui.routing.load` 이벤트로 기록됨.


## 계획 산출물
- [x] 라우팅 고도화 기술 설계 초안 (신규 문서) — Step 2 기능 범위 확정(2025-10-01) 후 `docs/Design/routing_enhancement_detailed_design.md` 작성 및 2025-10-01 11:30 KST 승인.
- [ ] API 명세 추가안 (`docs/backend_api_overview.md` 갱신 초안) — 신규 엔드포인트 검증을 2025-10-01 백엔드 리뷰 이후로 연기.
- [ ] Tasklist/로그 업데이트 및 승인 요청서 초안 — 스폰서 서명 일정(2025-10-02) 확정 후 제출 예정.
