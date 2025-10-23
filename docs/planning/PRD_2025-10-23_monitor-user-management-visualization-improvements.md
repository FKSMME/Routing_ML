# PRD: Server Monitor User Management & Frontend-Home Visualization Improvements

**Date**: 2025-10-23
**Version**: 1.0
**Status**: Draft
**Author**: Routing ML Team

---

## Executive Summary

이 문서는 Routing ML 시스템의 사용자 관리 및 시각화 개선에 대한 요구사항을 정의합니다. 주요 목표는:

1. **서버 모니터 프로그램에 사용자 관리 기능 통합**: 관리자가 서버 모니터 프로그램(RoutingMLMonitor)에서 직접 사용자 승인/거부 및 권한 관리를 수행할 수 있도록 함
2. **Frontend-Home 시각화 개선**: MSSQL 대시보드와 시각화 데이터의 1:1 매핑을 직관적으로 표시하여 사용자가 데이터 흐름을 쉽게 이해할 수 있도록 개선

---

## Problem Statement

### Current Issues

1. **분산된 사용자 관리**
   - 현재 사용자 승인/관리 기능이 frontend-prediction의 `UserApprovalPanel`에만 존재
   - 서버 모니터 프로그램에서는 사용자 관리 불가능
   - 관리자가 별도로 웹 브라우저를 열어 frontend-prediction에 접속해야 함
   - 워크플로우가 분산되어 비효율적

2. **복잡한 시각화 데이터 매핑**
   - frontend-home에 표시되는 시각화 차트와 MSSQL 뷰 데이터의 연결 관계가 명확하지 않음
   - view-explorer.html에서 뷰를 선택하지만, 각 컬럼이 어떤 차트에 어떻게 매핑되는지 직관적이지 않음
   - 데이터 소스 추적이 어려워 디버깅 및 유지보수 곤란

3. **사용자 경험 저하**
   - 관리자는 모니터 프로그램과 웹 인터페이스를 번갈아 사용해야 함
   - 데이터 분석가는 시각화와 원본 데이터의 관계를 파악하기 어려움

---

## Goals and Objectives

### Primary Goals

1. **통합 사용자 관리 (Integrated User Management)**
   - 서버 모니터 프로그램에 사용자 승인/거부 기능 추가
   - 관리자/일반사용자 권한 부여 기능 통합
   - 대기 중인 사용자 목록 표시 및 실시간 업데이트

2. **직관적 시각화 매핑 (Intuitive Visualization Mapping)**
   - 각 시각화 차트와 MSSQL 뷰 컬럼의 1:1 매핑 관계 시각화
   - 데이터 흐름을 직관적으로 보여주는 UI 개선
   - 컬럼별 매핑 정보를 tooltip 또는 별도 패널로 표시

### Success Criteria

1. **User Management Integration**
   - ✅ 서버 모니터에서 대기 중인 사용자 목록 조회 가능
   - ✅ 서버 모니터에서 사용자 승인/거부 실행 가능
   - ✅ 관리자/일반사용자 권한 선택 가능
   - ✅ 실시간 사용자 상태 업데이트

2. **Visualization Improvements**
   - ✅ 각 차트 옆에 데이터 소스(뷰 이름, 컬럼 이름) 표시
   - ✅ 컬럼 → 차트 매핑 관계를 시각적으로 표현
   - ✅ view-explorer.html에서 설정한 컬럼과 index.html 차트의 연결 표시
   - ✅ 사용자가 매핑을 3초 이내에 이해 가능

3. **Build & Deployment**
   - ✅ RoutingMLMonitor 재빌드 성공
   - ✅ 버전 번호 적절히 증가 (v5.6.1 → v5.7.0 or v6.0.0)
   - ✅ 모든 기능 정상 작동 확인

---

## Requirements

### Functional Requirements

#### FR-1: Server Monitor User Management Panel

**FR-1.1**: User List Display
- 서버 모니터에 "사용자 관리" 탭/패널 추가
- 대기 중인 사용자 목록 표시 (username, full_name, email, created_at)
- 사용자 상태 배지 표시 (pending/approved/rejected)

**FR-1.2**: User Approval Actions
- "관리자로 승인" 버튼 제공
- "일반 사용자로 승인" 버튼 제공
- "가입 거부" 버튼 제공
- 각 액션 실행 시 확인 다이얼로그 표시

**FR-1.3**: Real-time Updates
- "새로고침" 버튼으로 사용자 목록 업데이트
- API 응답에 따른 성공/실패 메시지 표시

**FR-1.4**: Error Handling
- API 연결 실패 시 에러 메시지 표시
- 재시도 버튼 제공

#### FR-2: Frontend-Home Visualization Mapping

**FR-2.1**: Chart Data Source Labels
- 각 차트 제목 옆에 데이터 소스 표시
- 형식: "Chart Title (뷰: schema.view_name, 컬럼: COLUMN_NAME1, COLUMN_NAME2)"
- Tooltip으로 상세 매핑 정보 제공

**FR-2.2**: Visual Mapping Diagram
- view-explorer.html에 매핑 다이어그램 섹션 추가
- 선택한 뷰의 각 컬럼이 어떤 차트에 사용되는지 표시
- 컬럼 → 차트 연결선 시각화

**FR-2.3**: Column Usage Indicator
- 컬럼 에디터에서 각 컬럼이 사용되는 차트 목록 표시
- 사용되지 않는 컬럼은 회색으로 표시

**FR-2.4**: Configuration Sync
- view-explorer.html 설정과 index.html 차트 자동 동기화
- 설정 변경 시 매핑 관계 즉시 업데이트

### Non-Functional Requirements

**NFR-1**: Performance
- 사용자 목록 조회 API 응답 시간 < 2초
- 차트 렌더링 시간 < 1초
- 매핑 정보 표시 지연 없음

**NFR-2**: Usability
- 관리자가 서버 모니터에서 사용자 관리 3분 이내 학습 가능
- 시각화 매핑 관계를 3초 이내에 파악 가능

**NFR-3**: Compatibility
- Windows 10/11에서 RoutingMLMonitor.exe 정상 실행
- 모든 브라우저(Chrome, Edge, Firefox)에서 시각화 정상 표시

**NFR-4**: Security
- 사용자 관리 기능은 관리자 권한 필요
- 일반 사용자는 사용자 관리 패널 접근 불가

---

## Phase Breakdown

### Phase 1: Server Monitor User Management Integration (3-4 hours)

**Tasks**:
1. `scripts/server_monitor_dashboard_v5_1.py`에 사용자 관리 탭 추가
2. API 클라이언트에 사용자 관리 엔드포인트 추가
   - GET `/api/auth/admin/pending-users`
   - POST `/api/auth/admin/approve`
   - POST `/api/auth/admin/reject`
3. Tkinter UI 구현:
   - 사용자 목록 Treeview 추가
   - 승인/거부 버튼 추가
   - 상태 표시 레이블 추가
4. 에러 핸들링 및 메시지 다이얼로그 구현
5. 스크립트 테스트 (로컬 실행 확인)

**Deliverables**:
- 업데이트된 `server_monitor_dashboard_v5_1.py`
- 테스트 결과 문서

### Phase 2: Frontend-Home Visualization Mapping Improvements (2-3 hours)

**Tasks**:
1. `frontend-home/index.html` 차트에 데이터 소스 레이블 추가
2. `frontend-home/view-explorer.html`에 매핑 다이어그램 섹션 추가
3. 컬럼 → 차트 매핑 관계 시각화 구현
4. Tooltip으로 상세 매핑 정보 표시
5. 설정 저장 시 매핑 정보도 함께 저장

**Deliverables**:
- 업데이트된 `index.html`
- 업데이트된 `view-explorer.html`
- 매핑 설정 JSON 스키마

### Phase 3: Build & Testing (1-2 hours)

**Tasks**:
1. 버전 번호 결정 (Major/Minor/Patch)
2. 구버전 백업 (old/ 디렉토리로 이동)
3. 새 spec 파일 생성 및 버전 업데이트
4. PyInstaller로 재빌드
5. 빌드 후 실행 테스트:
   - 서버 모니터 실행 확인
   - 사용자 관리 기능 테스트
   - frontend-home 시각화 테스트
6. 모든 기능 정상 작동 확인

**Deliverables**:
- `RoutingMLMonitor_v{NEW}.exe`
- `RoutingMLMonitor_v{NEW}.spec`
- 테스트 결과 보고서

### Phase 4: Documentation & Git Workflow (30 min)

**Tasks**:
1. 작업 히스토리 문서 작성
2. Git commit & push (251014 브랜치)
3. Main 브랜치로 merge
4. 251014 브랜치로 복귀

**Deliverables**:
- 작업 히스토리 문서
- Git commit log

---

## Timeline Estimates

| Phase | Estimated Time | Cumulative |
|-------|---------------|------------|
| Phase 1: Server Monitor User Management | 3-4 hours | 3-4 hours |
| Phase 2: Visualization Mapping | 2-3 hours | 5-7 hours |
| Phase 3: Build & Testing | 1-2 hours | 6-9 hours |
| Phase 4: Documentation & Git | 30 min | 6.5-9.5 hours |

**Total Estimated Time**: 6.5 - 9.5 hours

---

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  RoutingMLMonitor.exe                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Dashboard    │  │ User Mgmt    │  │ Settings     │      │
│  │ Tab          │  │ Tab (NEW)    │  │ Tab          │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                                 │
│         └──────────────────┴────────────────────────────┐   │
│                            │                             │   │
│                     ApiClient (urllib)                   │   │
└─────────────────────────────┼───────────────────────────┘   │
                              │                                │
                              ▼                                │
                  ┌────────────────────────┐                   │
                  │  FastAPI Backend       │                   │
                  │  /api/auth/admin/*     │                   │
                  └────────────────────────┘                   │
                              │                                │
                              ▼                                │
                  ┌────────────────────────┐                   │
                  │  PostgreSQL Database   │                   │
                  │  user_accounts table   │                   │
                  └────────────────────────┘                   │
```

```
┌─────────────────────────────────────────────────────────────┐
│                  frontend-home/index.html                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Chart 1: Routing Trend                              │   │
│  │  📊 Data: demo.ROUTING_SUMMARY (ITEM_CD, STEPS)     │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Chart 2: Item Distribution                          │   │
│  │  📊 Data: demo.ROUTING_SUMMARY (ITEM_CD, COUNT)     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ mapping config
                              │
┌─────────────────────────────┴───────────────────────────────┐
│              frontend-home/view-explorer.html                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Mapping Diagram:                                    │   │
│  │  [ITEM_CD] ────────► Chart 1, Chart 2               │   │
│  │  [ROUTING_STEPS] ──► Chart 1                        │   │
│  │  [LAST_REVIEWED] ──► (unused)                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Management Flow**:
   ```
   Monitor UI → ApiClient → POST /api/auth/admin/approve
                          ↓
                   Backend validates admin session
                          ↓
                   Update user_accounts.status
                          ↓
                   Return success/error
                          ↓
                   Monitor refreshes user list
   ```

2. **Visualization Mapping Flow**:
   ```
   view-explorer.html → Select View → Fetch Sample Data
                          ↓
                   Display Column Editor
                          ↓
                   User configures mapping
                          ↓
                   Save config to localStorage/API
                          ↓
                   index.html reads config
                          ↓
                   Render charts with mapping labels
   ```

---

## API Endpoints

### Existing Endpoints (to be used)

- **GET /api/auth/admin/pending-users**
  - Response: `{ users: [{ username, full_name, email, created_at, status }] }`

- **POST /api/auth/admin/approve**
  - Request: `{ username: string, make_admin: boolean }`
  - Response: `{ message: string }`

- **POST /api/auth/admin/reject**
  - Request: `{ username: string }`
  - Response: `{ message: string }`

### New Endpoints (if needed)

- **GET /api/view-explorer/mapping/{view_name}**
  - Response: `{ view_name, columns: [{ name, charts: [chart_id] }] }`
  - Purpose: Return which charts use which columns

---

## UI/UX Design

### Server Monitor - User Management Tab

```
┌──────────────────────────────────────────────────────────────┐
│  Routing ML Monitor v5.7.0                          [_][□][×] │
├──────────────────────────────────────────────────────────────┤
│ [ Dashboard ] [ User Management ] [ Settings ]                │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  👥 대기 중인 사용자 (3명)                  [새로고침]        │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Username   │ Full Name │ Email          │ Created At  │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ user01     │ 홍길동    │ user01@k.co    │ 2025-10-23  │  │
│  │ [관리자로 승인] [일반 사용자로 승인] [거부]            │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ user02     │ 김철수    │ user02@k.co    │ 2025-10-23  │  │
│  │ [관리자로 승인] [일반 사용자로 승인] [거부]            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  💡 관리자는 모든 시스템 권한을, 일반 사용자는 기본 기능만   │
│     사용할 수 있습니다.                                        │
└──────────────────────────────────────────────────────────────┘
```

### Frontend-Home - Chart with Mapping

```html
┌──────────────────────────────────────────────────────────────┐
│  📊 라우팅 생성 추세                                  [ℹ️]    │
│  Data Source: demo.ROUTING_SUMMARY                            │
│  Columns: ITEM_CD → X-axis, ROUTING_STEPS → Y-axis          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   Chart Visualization                   │  │
│  │                        [Graph]                          │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Dependencies

- **Backend**: FastAPI backend with existing auth endpoints
- **Frontend**: frontend-home HTML/JS, Chart.js
- **Monitor**: Tkinter GUI, urllib for API calls
- **Build**: PyInstaller for executable creation

---

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| PyInstaller 빌드 실패 | Medium | High | 빌드 전 스크립트 실행 테스트, old/ 백업 유지 |
| API 연결 실패 | Low | Medium | 에러 핸들링 강화, 재시도 로직 구현 |
| 매핑 정보 복잡도 증가 | Medium | Low | 단순하고 직관적인 UI 설계, Tooltip 활용 |
| 사용자 혼란 | Low | Medium | 명확한 레이블 및 도움말 제공 |

---

## Open Questions

1. **버전 번호**: v5.6.1 → v5.7.0 (Minor) or v6.0.0 (Major)?
   - 추천: v5.7.0 (새로운 기능 추가이지만 Breaking Change 없음)

2. **회원가입 시 역할 선택**: 회원가입 페이지에서 사용자가 "관리자/일반사용자" 선택?
   - 보안상 권장하지 않음. 관리자는 승인 시에만 부여하는 것이 안전함.
   - 대안: 회원가입 시 "관리자 권한 요청" 메모 필드 추가 (선택사항)

3. **Mapping 저장 위치**: localStorage vs Backend API?
   - 추천: 기존처럼 Backend API 사용 (데이터 영속성 보장)

---

## Acceptance Criteria

### Phase 1 Acceptance

- [ ] 서버 모니터에 "사용자 관리" 탭 표시됨
- [ ] 대기 중인 사용자 목록 정상 조회
- [ ] "관리자로 승인" 버튼 클릭 시 사용자가 관리자로 승인됨
- [ ] "일반 사용자로 승인" 버튼 클릭 시 일반 사용자로 승인됨
- [ ] "거부" 버튼 클릭 시 가입 거부됨
- [ ] API 오류 시 에러 메시지 표시
- [ ] 스크립트 단독 실행 시 오류 없음

### Phase 2 Acceptance

- [ ] 각 차트에 데이터 소스 레이블 표시
- [ ] view-explorer에 매핑 다이어그램 표시
- [ ] 컬럼 → 차트 연결선 시각화
- [ ] 사용자가 3초 이내에 매핑 파악 가능
- [ ] 설정 저장 시 매핑 정보도 저장

### Phase 3 Acceptance

- [ ] RoutingMLMonitor_v5.7.0.exe 빌드 성공
- [ ] 실행 파일 크기 ~12MB
- [ ] 실행 시 오류 없이 UI 로딩
- [ ] 사용자 관리 기능 정상 작동
- [ ] 30초 이상 실행해도 크래시 없음
- [ ] old/ 디렉토리에 이전 버전 백업 완료

### Phase 4 Acceptance

- [ ] Git commit 메시지에 변경 내용 명시
- [ ] Main 브랜치 merge 완료
- [ ] 251014 브랜치 복귀 완료
- [ ] 작업 히스토리 문서 작성 완료

---

## References

- WORKFLOW_DIRECTIVES.md
- frontend-prediction/src/components/UserApprovalPanel.tsx (기존 구현 참고)
- scripts/server_monitor_dashboard_v5_1.py (기존 모니터 스크립트)
- frontend-home/view-explorer.html (시각화 설정 페이지)
- frontend-home/index.html (시각화 대시보드)

---

**END OF PRD**
