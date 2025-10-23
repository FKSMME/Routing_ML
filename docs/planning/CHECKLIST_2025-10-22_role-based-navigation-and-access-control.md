# CHECKLIST: Role-Based Navigation & Access Control

**Document ID**: CHECKLIST_2025-10-22_role-based-navigation-and-access-control  
**Created**: 2025-10-22  
**Status**: Active  
**Related Documents**:
- PRD: [docs/planning/PRD_2025-10-22_role-based-navigation-and-access-control.md](PRD_2025-10-22_role-based-navigation-and-access-control.md)
- Workflow: [.claude/WORKFLOW_DIRECTIVES.md](../../.claude/WORKFLOW_DIRECTIVES.md)
- Audit Reference: [docs/planning/CHECKLIST_2025-10-22_non-admin-multi-user-concurrency-audit.md](CHECKLIST_2025-10-22_non-admin-multi-user-concurrency-audit.md)

---

## Progress Tracking

**Phase 0**: [?????] 100% (3/3 tasks) - 1.0h  
**Phase 1**: [?????] 0% (0/5 tasks) - 0/4h  
**Phase 2**: [?????] 0% (0/6 tasks) - 0/6h  
**Phase 3**: [?????] 0% (0/5 tasks) - 0/5h  
**Phase 4**: [?????] 0% (0/4 tasks) - 0/3h  

**Total**: [??????????] 7% (3/23 tasks, 1/19h)

---

## Phase 0: Kickoff & Governance (1h)

**Status**: ✅ Completed

**Tasks**:
- [x] WORKFLOW_DIRECTIVES 검토 및 이번 작업 적용 범위 확인 (0.3h)
- [x] PRD 작성 및 저장 (0.4h)
- [x] 체크리스트 생성 및 Progress Tracking 초기화 (0.3h)

**Dependencies**: 기존 감사 결과, 팀 보안 정책  
**Acceptance Criteria**:
- [x] PRD 필수 섹션 충족
- [x] 체크리스트 템플릿 준수
- [x] Phase별 작업 시간/의존성 명시

**Git Operations**:
- [ ] Phase 0 변경사항 staging
- [ ] Phase 0 commit
- [ ] 251014 push
- [ ] main merge & 복귀

---

## Phase 1: 역할 매트릭스 및 범위 정리 (4h)

**Status**: ☐ Pending

**Tasks**:
- [ ] NavigationKey 전체 수집 및 역할 매핑 초안 작성
- [ ] 관리자 전용 API 라우트 목록화 (`require_auth` → `require_admin` 대상)
- [ ] 서버 매니저 운영 시나리오 영향 분석
- [ ] 권한 매트릭스 문서 초안 (`docs/requirements/` 등) 작성
- [ ] 이해관계자 검토 요청/피드백 반영

**Acceptance Criteria**:
- [ ] 페이지/탭/라우트별 역할 표 완성
- [ ] 서버 운영 흐름 영향 없음 확인
- [ ] 차후 단계 구현 범위 확정

---

## Phase 2: 프론트엔드 역할 기반 네비게이션 구현 (6h)

**Status**: ☐ Pending

**Tasks**:
- [ ] Navigation 데이터 구조에 `allowedRoles` 추가 (App.tsx 등)
- [ ] Zustand `workspaceStore` / `routingStore` 역할 필터 로직 반영
- [ ] 현재 탭이 접근 불가일 때 기본 탭으로 리다이렉션
- [ ] 관리자 전용 Lazy 컴포넌트 보호(조건부 렌더링/가드)
- [ ] 사용자/관리자 시나리오 UI 수동 검증
- [ ] 회귀 위험 식별 및 메모

**Acceptance Criteria**:
- [ ] 사용자 계정에서 관리자 메뉴 미노출
- [ ] 권한 외 탭 강제 폐쇄/재배치 확인
- [ ] 관리자 UX 유지

---

## Phase 3: 백엔드 RBAC 강화 (5h)

**Status**: ☐ Pending

**Tasks**:
- [ ] 권한 대상 라우트에 `require_admin` 적용 (`workflow`, `training`, `logs`, `data_mapping`, `database_config`, 필요 시 `prediction` 일부)
- [ ] 서버 매니저 흐름 영향 없는지 검증 (CLI/스크립트)
- [ ] FastAPI 스키마/response 문구 업데이트 (403 메시지 등)
- [ ] 단위 테스트 혹은 수동 API 테스트 (admin/user 토큰)
- [ ] 로그/감사 기록 확인 (403 발생 시 기록)

**Acceptance Criteria**:
- [ ] 사용자로 관리자 API 호출 시 403
- [ ] 관리자 계정 정상 동작
- [ ] 서버 스크립트 기동/가입 승인 흐름 유지

---

## Phase 4: 테스트, 문서화, 최종 전달 (3h)

**Status**: ☐ Pending

**Tasks**:
- [ ] QA 체크리스트/테스트 결과 기록 (스크린샷 또는 로그)
- [ ] 권한 매트릭스 문서 최종 업데이트 및 공유
- [ ] 릴리즈 노트/보고서 업데이트
- [ ] Git 커밋/푸시/머지, 산출물 정리

**Acceptance Criteria**:
- [ ] QA 승인 혹은 잔여 이슈 기록
- [ ] 문서 전달 및 저장소 반영
- [ ] Git 플로우 완료 (251014 → main)

---

## Acceptance Criteria Summary

- [x] Phase 0 문서 준비 완료
- [ ] 역할 매트릭스 확정 (Phase 1)
- [ ] 프론트 역할 기반 네비게이션 구현 (Phase 2)
- [ ] 백엔드 RBAC 강화 및 회귀 통과 (Phase 3)
- [ ] 테스트/문서 산출물 전달 (Phase 4)
- [ ] Git 플로우 및 배포 준비

---

## Risk Tracking

| Risk | 상태 | Mitigation |
|------|------|------------|
| 권한 변경으로 기존 자동화 실패 | Open | 서버 매니저 시나리오 사전 검증, 필요 시 예외 허용 |
| 메뉴 필터 누락으로 UX 혼란 | Open | 역할 매핑 문서화, QA 체크 |
| 권한 테스트 범위 부족 | Open | 수동+스크립트 병행 계획 |
| 일정 지연 | Open | Phase별 점검 및 우선순위 조정 |

---

## Notes

- 작업 마다 Git status → add -A → status → commit → push → merge → 복귀 절차 준수.
- 역할 매트릭스 문서는 Phase 1 완료 시 `docs/requirements/ROLE_ACCESS_MATRIX.md` (가칭)으로 저장 예정.
- 서버 매니저 권한 유지 관련 스크립트(`run_*`, `deploy/*`)는 권한 변경 영향 범위에서 제외할 것.
- QA 테스트: 관리자(Admin), 표준 사용자(User) 계정 최소 1쌍 필요.

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-22  
**Next Update**: Phase 1 완료 시

