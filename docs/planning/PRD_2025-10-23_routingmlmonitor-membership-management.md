# PRD: RoutingMLMonitor Membership Management Compliance

**Document ID**: PRD_2025-10-23_routingmlmonitor-membership-management  
**Created**: 2025-10-23  
**Priority**: 🚨 HIGH  
**Status**: Draft  
**Related Documents**:  
- Checklist: [docs/planning/CHECKLIST_2025-10-23_routingmlmonitor-membership-management.md](CHECKLIST_2025-10-23_routingmlmonitor-membership-management.md)  
- Workflow: [.claude/WORKFLOW_DIRECTIVES.md](../../.claude/WORKFLOW_DIRECTIVES.md)

---

## Executive Summary

### Problem Statement
- Desktop 모듈 `RoutingMLMonitor`의 **회원 관리 기능**이 최신 인증/권한 정책과 동기화되지 않아 운영팀이 승인/거절 결과를 즉시 반영하기 어렵다.  
- 관리자 승인 후 **백엔드 API, DB, 모니터 UI** 사이의 상태가 불일치하거나, 보류 중 사용자 수치가 갱신되지 않는 사례가 보고되었다.  
- 관리 콘솔과 모니터 애플리케이션 간의 상호 연동(승인/거절/검색)이 명확하게 검증되지 않아, 현장 배포 시 혼선이 발생할 위험이 있다.

### Goals & Objectives
1. `RoutingMLMonitor`의 회원 관리 탭에서 **대기/승인/거절** 플로우가 백엔드 및 사용자 DB와 완벽히 일치하도록 한다.  
2. 관리자 계정으로 UI 상호작용 시 **실시간 카운트/리스트** 갱신과 알림 로직이 정상 동작하는지 확인하고 필요한 패치를 적용한다.  
3. 사용자 계정(일반) 관점에서 승인 후 재로그인/권한 확인이 매끄럽게 이루어지는지 검증한다.  
4. 결과를 운영 문서, 체크리스트, 배포 안내에 반영해 Phase 3/4 이해관계자와 공유한다.

---

## Requirements

### Functional Requirements
1. **대기 중 회원 목록**  
   - 백엔드 `/api/admin/users/pending` (예시)와 모니터 UI가 동일한 데이터 소스를 사용해야 한다.  
   - 목록 새로 고침 버튼 및 자동 갱신 간격 확인.
2. **회원 승인/거절 처리**  
   - UI에서 승인 시: 백엔드 API 200 응답 + DB 상태 `approved` 변경 + 실시간 리스트 제거 및 승인 성공 알림.  
   - 거절 시: 거절 사유(optional) 전달 → 백엔드 저장 → 대상 사용자에게 이메일/알림 여부 확인.
3. **권한 매트릭스 연동**  
   - 승인된 사용자가 재로그인하면 관리자/일반 권한이 정확히 부여되는지 확인 (RBAC, JWT claims 등).  
   - 승인 전에는 로그인 불가 / 403 응답 유지.
4. **로깅 및 감사**  
   - 승인/거절 이벤트가 서버 로그 및 모니터 감사 로그 탭에 기록되는지 확인.  
   - 실패 시 재시도 전략 및 오류 메시지 UX 점검.

### Non-Functional Requirements
- **보안**: 관리자 API는 HTTPS + 토큰 인증 유지, 승인 요청 시 민감 정보 노출 금지.  
- **성능**: 목록 조회/변경 API 응답 시간 < 2s.  
- **사용성**: UI 내 버튼/라벨 한글 표기 일관성, 오류 시 명확한 안내.

---

## Solution Approach
1. **아키텍처 점검**  
   - PyInstaller 기반 데스크탑 앱(`scripts/monitor`)과 FastAPI 백엔드 간 통신 경로 확인.  
   - 현재 배포 중인 spec(`RoutingMLMonitor_v6.0.x.spec`)의 환경 변수 및 API 엔드포인트 설정 검증.
2. **코드 레벨 검토**  
   - `scripts/monitor/ui/dashboard.py`, `.../member_management.py` 등 회원 관련 모듈 확인.  
   - 백엔드 `backend/api/routes/auth.py`, `.../admin_users.py` 등 승인 로직 비교.
3. **수정 및 보강**  
   - 데이터 바인딩/상태 업데이트 로직 보완 (예: `Tkinter` label 텍스트, refresh timer).  
   - 필요한 경우 API 응답 스키마나 서비스 계층 수정.
4. **통합 테스트**  
   - 관리자/일반 계정 각각으로 시나리오 수행 (가입 → 승인 → 로그인 → 권한 확인).  
   - 주요 관리자 API (학습/워크플로/로그) 200/403 응답 확인.
5. **문서 및 전달**  
   - 체크리스트, 권한 매트릭스, QA 노트 업데이트.  
   - Phase 3/4 남은 항목 정리 및 이해관계자 보고.

---

## Phase Breakdown

| Phase | 내용 | 산출물 |
|-------|------|--------|
| Phase 1 | 환경/아키텍처 점검, 요구사항 명세 정리 | 시스템 다이어그램, API 목록 |
| Phase 2 | 구현 점검 및 수정 (UI+API), 단위 테스트 | 패치 코드, 테스트 로그 |
| Phase 3 | 통합 검증 & 문서화, 이해관계자 공유 | QA 리포트, 체크리스트 업데이트 |

---

## Success Criteria
1. 관리자 UI에서 승인/거절 시 **즉시 리스트 갱신** 및 성공 토스트 표시.  
2. 승인된 사용자가 재로그인하면 대시보드 접근 가능, 미승인 사용자는 403 유지.  
3. `npm run build` / `pyinstaller` 등 빌드 과정 오류 없음, 배포 패키지 최신 spec 반영.  
4. QA 체크리스트, 권한 매트릭스, Phase 3/4 플래너에 검증 결과 반영.  
5. Git 상태 정리 후 관련 브랜치에 변경사항 커밋 및 PR 준비(승인 대기 가능).

---

## Timeline Estimates

| Task | Owner | ETA |
|------|-------|-----|
| 요구사항 & 환경 점검 | DevOps + Backend | 0.5 day |
| UI/Backend 동기화 수정 | Frontend (Py/Tkinter) + Backend | 1.0 day |
| 통합 검증 (Admin/User, API) | QA | 0.5 day |
| 문서/보고 & Git 마감 | PM/Tech Writer | 0.5 day |

**총 예상 기간**: 2일 (여유 포함)  
**타임라인 목표**: 2025-10-24 EOD 완료

---

## Risks & Mitigations
- **API 스키마 변경 영향**: 기존 클라이언트와 호환성 문제가 발생할 수 있음 → 버전 체크 및 회귀 테스트 강화.  
- **자격 증명 관리**: 테스트 계정/토큰 만료 가능 → 사전 갱신, 시뮬레이션 계정 확보.  
- **배포 지연**: PyInstaller 재빌드 시간 소요 → 야간 빌드 예약, 실패 대비 롤백 스크립트 준비.

---

## Approvals
- **Product Owner**: _(TBD)_  
- **Engineering Lead**: _(TBD)_  
- **QA Lead**: _(TBD)_

**Next Review**: Phase 1 완료 직후 (2025-10-23 오후)

