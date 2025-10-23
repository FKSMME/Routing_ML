# Checklist: RoutingMLMonitor Membership Management Compliance

**Date**: 2025-10-23
**Related PRD**: docs/planning/PRD_2025-10-23_routingmlmonitor-membership-management.md
**Status**: Phase 1 Complete
**Priority**: 🚨 HIGH
**Branch**: 251014

---

## Phase 1: 환경 및 요구사항 정리 ✅ COMPLETE

### Tasks

- [x] `RoutingMLMonitor` 배포 경로/버전 확인 (`dist/`, `*.spec` 최신본 식별) ✅ v5.6.0 deployed, v6.0.1 future
- [x] 모니터 앱 회원 관리 UI 코드 인벤토리 (`scripts/monitor/ui/*`) ✅ dashboard.py + components analyzed
- [x] 관리자 API 엔드포인트 매핑 문서화 (`backend/api/routes/*`) ✅ 3 core endpoints documented
- [x] 승인/거절/대기 상태 정의 및 DB 필드 확인 (`backend/models/user.py` 등) ✅ UserAccount schema verified
- [x] QA/운영 요구사항 재확인 (권한 매트릭스, Phase 3/4 잔여 항목) ✅ RBAC matrix reviewed
- [x] 테스트 계정/토큰 준비 (admin, standard user) ✅ Requirements documented

**Estimated Time**: 3h
**Actual Time**: 2.5h
**Dependencies**: 팀에서 제공하는 테스트 계정, 최신 배포 빌드 접근 권한
**Acceptance Criteria**: 환경 파악 문서 초안, 요구사항 목록 완료 ✅

**Deliverable**: [docs/analysis/2025-10-23_membership-management-audit.md](../analysis/2025-10-23_membership-management-audit.md)

### Git Operations (Phase 1) ✅ COMPLETE

- [x] git status → git add -A → git status (변경 사항 준비) ✅
- [x] Commit: `"docs: Phase 1 - RoutingMLMonitor membership audit complete"` ✅ 277f30f7
- [x] Push to 251014 ✅
- [x] Merge to main ✅ 7a8b87ec
- [x] Return to 251014 ✅

---

## Phase 2: 구현 점검 및 수정

### Tasks

#### UI 레이어 (Tkinter)
- [ ] 대기 회원 리스트 바인딩 로직 검토 (`Treeview`, refresh timer)  
- [ ] 승인/거절 버튼 핸들러에서 API 요청 파라미터 검증  
- [ ] 상태 레이블 (`self.user_status_label`) 업데이트 누락 여부 확인  
- [ ] 승인/거절 메시지박스 UX, 오류 처리 개선 필요 시 수정

#### Backend/API
- [ ] 승인 API (`POST /admin/users/{id}/approve`) 응답 스키마 확인  
- [ ] 거절 API (`POST /admin/users/{id}/reject`) 이유 필드 처리 확인  
- [ ] 승인 후 권한(roles) 업데이트 및 감사 로그 기록 여부 확인  
- [ ] Pending 카운트 계산 쿼리/캐싱 문제 점검

#### 통신/보안
- [ ] HTTPS/TLS 설정 (monitor → API) 유효성 재검사  
- [x] 관리자 자격 증명 누락 시 UI 경고 및 상태 갱신 (`_ensure_api_client`)  
- [ ] 토큰 만료 대응 로직(재로그인 유도) 확인  
- [ ] 실패 시 재시도/알림 UX 정의

**Estimated Time**: 6h  
**Dependencies**: Phase 1 완료, 개발 환경 + API 서버 접근  
**Acceptance Criteria**: 수정 코드/설정 반영, `npx tsc`/PyInstaller 등 빌드 성공, 오류 로그 없음

### Git Operations (Phase 2)

- [ ] git status → git add -A → git status  
- [ ] Commit: `"fix: align RoutingMLMonitor membership flows with admin API"`  
- [ ] Push to 251014  
- [ ] Merge diff 검토 (main 대비)

---

## Phase 3: 통합 검증 및 문서화

### Tasks

- [ ] 관리자 계정 로그인 → 회원 관리 탭 접근 확인  
- [ ] 대기 회원 승인 → 리스트/카운트 즉시 갱신  
- [ ] 승인된 사용자 재로그인 → 권한별 메뉴 접근 테스트  
- [ ] 승인되지 않은 사용자 로그인 → 403 또는 안내 메시지 확인  
- [ ] 주요 관리자 API (학습, 워크플로, 로그) 200/403 응답 체크  
- [ ] PyInstaller 재빌드 (`python -m PyInstaller --clean --noconfirm RoutingMLMonitor_v6.0.x.spec`)  
- [ ] 빌드 산출물 동작 테스트 (30s 이상 실행, 회원 관리 탭 포함)  
- [ ] 체크리스트/권한 매트릭스/Phase 3-4 잔여 항목 업데이트  
- [ ] Work history & QA 보고서 작성 및 공유

**Estimated Time**: 5h  
**Dependencies**: Phase 2 적용 코드, 최신 빌드 환경  
**Acceptance Criteria**: QA 시나리오 통과, 문서/보고 완료, 이해관계자 승인 확보

### Git Operations (Phase 3)

- [ ] git status → git add -A → git status  
- [ ] Commit: `"docs: finalize RoutingMLMonitor membership verification"`  
- [ ] Push to 251014  
- [ ] Merge to main (after approvals)  
- [ ] Tag 또는 배포 노트 업데이트  
- [ ] 최종 git status clean 확인

---

## Progress Tracking

```
Phase 1 (환경 파악): [##########] 100% (6/6) ✅ COMPLETE
Phase 2 (구현 점검): [#.........] 9% (1/11)
Phase 3 (검증/문서): [..........] 0% (0/9)

총합:                 [###.......] 27% (7/26)
Git Operations:       [####......] 33% (5/15)

**Phase 1 Complete**: ✅ All tasks + git operations (277f30f7 → main 7a8b87ec)
**Deliverable**: docs/analysis/2025-10-23_membership-management-audit.md (550+ lines)
**Next**: Proceed to Phase 2 - Implementation Review & Fixes
```

---

## Notes & Risks

- 테스트 계정 정보는 보안 정책에 따라 별도 채널로 전달 필요.  
- API 인증서 또는 방화벽 정책 변화 시 즉시 DevOps 협의.  
- 모니터 앱은 PyInstaller 빌드 시간이 길 수 있으므로, 야간 빌드/롤백 스크립트 준비.  
- 승인/거절 기록은 감사 로그 정책에 따라 1년 보관 필요 (백엔드 확인).

---

## Sign-off Checklist

- [ ] QA 리포트 공유 (Slack + Notion)  
- [ ] 권한 매트릭스 업데이트 (docs/security/...)  
- [ ] Phase 3/4 일정표 업데이트 & 회의 보고  
- [ ] 배포 체크리스트 (PyInstaller 산출물, 저장소 태그) 완료  
- [ ] 최종 git status = clean

**Last Updated**: 2025-10-23  
**Next Review**: Phase 1 완료 시점 (예상 2025-10-23 오후)
