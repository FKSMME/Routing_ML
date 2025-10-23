# PRD - Role-Based Navigation & Access Control (2025-10-22)

## Executive Summary
- 관리자와 일반 사용자 계정의 접근 권한을 명확히 분리하고, 비허용 페이지는 사용자 메뉴에서 완전히 제거한다.
- 프론트엔드 네비게이션 및 워크스페이스 전환 로직에 역할 기반 제어를 도입하고, 백엔드 API 권한 검증을 일치시킨다.
- 서버 관리 매니저(운영 스크립트 실행자)는 추가 권한 절차 없이 기존처럼 서버 기동 및 가입 승인 프로세스를 유지한다.

## Problem Statement
현재 시스템은 `isAdmin` 플래그를 이용해 일부 메뉴를 숨기지만, 다음과 같은 공백이 있다.
1. **메뉴/명령 비노출 불완전**: 사용자 계정이 URL 직접 호출 또는 상태 조작으로 관리자 전용 화면에 접근할 수 있음.
2. **백엔드 권한 미비**: 다수의 관리자 전용 API가 `require_auth`만 사용하여 인증만 되면 사용자도 호출 가능.
3. **역할/네비게이션 불일치**: 프론트엔드 스토어와 라우팅 훅이 역할 변화를 즉시 반영하지 못해 메뉴 잔존 또는 탭 활성화가 유지됨.
4. **권한 정책 문서화 부족**: 페이지와 API의 권한 매트릭스가 정의되지 않아 운영/QA 검증이 어렵다.

## Goals and Objectives
1. **역할 기반 페이지 매핑 완성** - 관리자/사용자/공용 페이지 정의 및 코드 반영.
2. **메뉴/탭 필터링 강화** - 사용자 계정에서 관리자 전용 메뉴·워크스페이스 항목이 노출되지 않도록 ZUstand 스토어와 컴포넌트 구조 개선.
3. **백엔드 RBAC 적용** - 관리자 전용 API에 `require_admin` 또는 역할 검증 도입, 서버 관리자 역할은 기존 흐름 유지.
4. **권한 정책 문서화** - 페이지·API·역할 매트릭스와 테스트 플랜을 작성하여 QA 기준 마련.

## Requirements

### Functional Requirements
1. **FR-1 역할 정의 및 매핑**
   - 시스템 역할: `admin`, `user`, `server_manager`(스크립트 기반 운영) 식별.
   - 페이지/워크스페이스 별 권한 표 작성 및 코드 주석/문서 반영.
   - 서버 매니저는 CLI/스크립트 권한만 유지하며 UI 권한 제한 없음.
2. **FR-2 프론트엔드 메뉴 필터링**
   - `NavigationKey`별 접근 가능한 역할 목록을 정의.
   - 로그인/역할 변경 시 메뉴 구성을 재생성하고 비허용 항목은 Zustand 상태에서 제거.
   - 현재 열린 탭이 권한 외일 경우 기본 허용 탭으로 자동 리다이렉트.
3. **FR-3 백엔드 권한 검증**
   - 관리자 전용 도메인(`workflow`, `training`, `logs`, `data_mapping`, `database_config` 등)에 `require_admin` 또는 역할 검사 추가.
   - 사용자 전용/공용 API는 영향 없이 유지.
   - 서버 매니저가 사용하는 배포/시스템 스크립트는 인증 절차 변경 없이 작동해야 함.
4. **FR-4 테스트 및 검증**
   - 관리자/사용자 계정으로 UI 탐색 자동화 테스트 또는 수동 체크리스트 작성.
   - 관리자 API 200/403 응답 케이스, 사용자 API 403 케이스 검증.
   - 회귀 테스트: 예측 실행, 승인 흐름, 서버 부트 스크립트가 기존대로 작동하는지 확인.

### Non-Functional Requirements
- **NFR-1 보안**: 비관리자 계정이 관리자 자원에 접근할 수 없어야 하며, 직접 API 호출 시 403을 반환.
- **NFR-2 사용성**: 메뉴 제거 시 레이아웃 깨짐 없이 자연스럽게 재배치, 기본 탭 리디렉션은 200ms 이하.
- **NFR-3 문서화**: 권한 매트릭스와 테스트 결과는 `docs/`와 `deliverables/`에 저장.
- **NFR-4 확장성**: 향후 역할 추가 시(예: QA) 재사용 가능한 구조 유지.

## Phase Breakdown

### Phase 1 - 역할 매트릭스 및 범위 정리 (Est. 4h)
**Objective**: 페이지, 컴포넌트, API 전반에 대한 역할-접근 매트릭스 확정.

**Tasks**:
1. 네비게이션 키 및 워크플로 탭 목록 수집.
2. 각 항목을 관리자/사용자/공용으로 분류하고 표 작성.
3. 관리자 전용 API 라우트 목록화 (`require_auth` 사용 중인 대상 포함).
4. 서버 매니저 운영 시나리오 확인 (서버 기동 스크립트, 가입 승인 플로우).
5. 문서화 초안 작성(`docs/requirements/` 또는 `docs/reports/`).

**Acceptance Criteria**:
- 역할 매트릭스 문서 초안 존재.
- 백엔드 라우트 권한 변경 대상 목록 확정.
- 서버 운영 플로우 영향 없음 확인.

### Phase 2 - 프론트엔드 역할 기반 네비게이션 구현 (Est. 6h)
**Objective**: 메뉴, 탭, 상태 스토어에 역할 기반 필터링 로직 적용.

**Tasks**:
1. 네비게이션 항목에 `allowedRoles` 메타데이터 추가.
2. `useWorkspaceStore` 및 관련 훅에서 역할 기반 필터링 로직 구현.
3. 현재 메뉴/탭이 권한 외일 경우 리디렉션 처리.
4. 관리자 전용 컴포넌트 Lazy 로딩 경로 보호(필요 시 가드 추가).
5. UI 테스트/스토리 확인 및 수동 검증.

**Acceptance Criteria**:
- 사용자 계정으로 로그인 시 관리자 메뉴/탭 미노출.
- 권한 외 탭 접근 시 자동으로 기본 탭으로 이동.
- 관리자 경험은 기존과 동일.

### Phase 3 - 백엔드 RBAC 강화 (Est. 5h)
**Objective**: 관리자 전용 API에 `require_admin` 적용 및 회귀 검증.

**Tasks**:
1. 대상 라우트에 `require_admin` 또는 역할 체크 데코레이터 추가.
2. 필요 시 서버 매니저를 위한 bypass 명시(스크립트 기반 권한 유지).
3. FastAPI 스키마/테스트 업데이트.
4. 관리자/사용자 API 응답 회귀 테스트 수행.

**Acceptance Criteria**:
- 사용자 계정으로 관리자 API 호출 시 403 반환.
- 관리자 계정은 정상 동작.
- 서버 운영 스크립트와 승인 흐름 영향 없음.

### Phase 4 - 테스트, 문서화, 전달물 (Est. 3h)
**Objective**: QA 체크리스트, 테스트 결과, 최종 문서화.

**Tasks**:
1. 테스트 결과 기록(수동 또는 자동 스크린샷/로그).
2. 권한 매트릭스 업데이트 후 `docs`/`deliverables` 저장.
3. 릴리즈 노트/보고서 업데이트.
4. 최종 검토 및 승인 준비.

**Acceptance Criteria**:
- 테스트 로그/체크리스트 작성 완료.
- 문서화 전달물 검증 및 팀 공유.
- Git 작업(Commit, Push, Merge) 준비.

## Success Criteria
- ? 사용자 계정에 관리자 전용 메뉴·탭 미노출.
- ? 관리자 전용 API 호출은 관리자가 아니면 403 반환.
- ? 서버 운영 스크립트(매니저)와 가입 승인 플로우는 기존 그대로 동작.
- ? 권한 매트릭스 및 테스트 문서 전달.
- ? QA 검증에서 역할 기반 동작 이상 없음.

## Timeline Estimates
- Phase 1: 2025-10-22 (오전) - 4h
- Phase 2: 2025-10-22 (오후) ~ 2025-10-23 (오전) - 6h
- Phase 3: 2025-10-23 (오후) - 5h
- Phase 4: 2025-10-24 - 3h

**Total**: 18h (약 2.5 작업일)

- 킥오프: 2025-10-22 10:30 KST
- 중간 점검: 2025-10-23 15:00 KST
- 최종 전달: 2025-10-24 17:00 KST

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| 권한 변경으로 기존 자동화/스크립트 실패 | High | 서버 매니저 흐름 영향 영역 사전 식별 및 예외 처리 |
| 메뉴 필터링 누락으로 UX 혼란 | Medium | 근거 데이터 기반 역할 매핑, QA 검증 |
| 테스트 범위 부족 | Medium | 체크리스트/자동화 시나리오 작성 |
| 새 역할 요구 발생 | Low | 구성 가능한 역할 매핑 구조 도입 |

## Dependencies
- 프론트엔드 Zustand 스토어(`frontend-prediction/src/store`)
- FastAPI 보안 모듈(`backend/api/security.py`)
- 관리자/사용자 계정 데이터 및 토큰 구조
- 서버 운영 스크립트 (`run_*`, `START_ALL_WINDOWS.bat` 등)

## Stakeholders
- **Admin Users**: 기능 관리, 모델 학습, 시스템 설정
- **Standard Users**: 예측·조회 중심 사용
- **Server Manager**: 서버 기동/운영 담당(추가 권한 필요 없음)
- **QA/보안 팀**: 역할 정책 검증

## Related Documents
- [.claude/WORKFLOW_DIRECTIVES.md](../../.claude/WORKFLOW_DIRECTIVES.md)
- [Existing RBAC Audit Report](../../docs/reports/root/ROUTING_ML_STATUS_REPORT_2025-10-15.md)
- [CHECKLIST_2025-10-22_non-admin-multi-user-concurrency-audit.md](CHECKLIST_2025-10-22_non-admin-multi-user-concurrency-audit.md)

