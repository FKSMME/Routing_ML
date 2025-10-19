# Routing ML 회원 관리 개선 보고서 (2025-10-20 07:55 KST)

## 1. 현재 구성 요약
- **등록 흐름**: `/api/auth/register` 호출 시 사용자 상태는 `pending`으로 저장되고, 승인은 PyInstaller 모니터 프로그램에서만 처리 가능 (`backend/api/routes/auth.py:18`, `scripts/server_monitor_dashboard_v5_1.py:988`).
- **데이터 저장**: 사용자 레코드는 `logs/rsl_store.db`의 `users` 테이블에 Argon2 해시 형태로 저장된다 (`backend/database_rsl.py:145` 이하).
- **승인 UI**: 모니터 앱은 대기 사용자 조회(`GET /api/auth/admin/pending-users`)와 승인/거부(각각 `/admin/approve`, `/admin/reject`)만 지원하며, 전체 목록 및 비밀번호 관리 기능은 제공하지 않음 (`scripts/server_monitor_dashboard_v5_1.py:1002`, `scripts/server_monitor_dashboard_v5_1.py:1087`).
- **API 제약**: 전체 사용자 조회(`GET /api/auth/admin/users`)와 본인 비밀번호 변경(`POST /api/auth/change-password`)은 JWT 인증이 필요하므로 모니터 프로그램에서 직접 호출 불가 (`backend/api/routes/auth.py:139`).

## 2. 확인된 공백
1. **전체 사용자 가시성 부족**  
   - 승인 이후 사용자 현황(승인일, 마지막 로그인, 관리자 여부)을 UI에서 확인할 수 있는 경로가 없다.
2. **관리자 비밀번호 초기화 부재**  
   - `auth_service`는 본인 변경만 허용하고 관리자 주도의 초기화를 제공하지 않으며, 임시 비밀번호 발급 절차도 존재하지 않는다 (`backend/api/services/auth_service.py:341`).
3. **일괄 등록 도구 부재**  
   - CLI 유틸(`approve_user.py`)은 SQLite 직접 접근만 지원하며, 다수 사용자를 한 번에 등록·승인하는 공식 API/도구가 없다.
4. **감사 로그 한계**  
   - 모니터 프로그램은 User-Agent 기반으로 우회 승인하기 때문에, 추후 감사 시 실행 주체 식별이 어렵다.

## 3. 요구 사항 정리
| 요구 | 상세 |
| --- | --- |
| 회원 목록 열람 | 상태(대기/승인/거절) 필터, 정렬, 최근 로그인 확인 |
| 관리자 비밀번호 초기화 | 임시 비밀번호 발급 및 이메일/SMS 안내, 초기 로그인 시 강제 변경 |
| 일괄 등록 | CSV/Excel/JSON 등으로 입력하여 대량 생성과 동시에 승인/권한 부여 |
| 감사 및 추적 | 모든 관리 작업에 실행 주체, 시각, 대상 사용자, IP/클라이언트 정보 기록 |

## 4. 백엔드 확장 제안
### 4.1 API 추가/개선
1. `GET /api/auth/admin/users`  
   - 쿼리 파라미터: `status`, `search`, `limit`, `offset`, `sort`.  
   - 호출 경로를 PyInstaller 프로그램에서 사용하기 위해 서비스 계정용 API 키 또는 서명 토큰(예: HMAC 헤더)을 도입.
2. `POST /api/auth/admin/reset-password`  
   - 입력: `username`, `delivery`(email/sms/none), `force_change` 플래그.  
   - 처리: Argon2 새 해시 저장, 임시 비밀번호 무작위 생성, 이메일 서비스(`backend/api/services/email_service.py`)를 활용한 안내.
   - 감사 로그에 `admin_username`, `client_host`, `reason` 기록.
3. `POST /api/auth/admin/bulk-register`  
   - 입력: 사용자 배열(아이디, 표시명, 이메일, 임시 비밀번호/자동 생성 여부, 관리자 여부).  
   - 신규/기존 충돌 처리, 성공·실패 목록 반환.  
   - 필요 시 `UserAccount`에 `invited_by`, `initial_password_sent_at` 컬럼 추가.
4. `POST /api/auth/admin/invite` (선택)  
   - 이메일 기반 초대 워크플로우: OTP 또는 단일 사용 링크 제공.

### 4.2 서비스 레이어 보완
- `AuthService.reset_password()` 구현: Argon2 재해시, `must_change_password` 플래그 추가 → 로그인 시 강제 변경 로직 반영.
- `AuthService.bulk_register()` 구현: 중복 ID, 이메일 검증 및 트랜잭션 처리.
- 감사 로거(`common/logger.py`)에 `audit_routing_event` 활용하여 모든 관리 작업을 `routing.audit` 채널로 중앙 기록.
- SQLite → MSSQL 전환 계획이 있다면, 사용자 테이블을 공용 DB로 이관하고 SQLAlchemy 세션 공유 구조 재검토.

### 4.3 인증/보안
- User-Agent 우회 대신 **서비스 계정**(`monitor@internal`)을 미리 승인하고, 모니터 시작 시 JWT를 받아 API 호출에 사용하도록 변경.
- 관리자 초기화/일괄 등록 시 2단계 확인(예: GUI 재확인 다이얼로그 + OTP) 도입.
- 초기화된 비밀번호는 즉시 암호화된 저장소에만 기록하고 UI에는 일회성으로 표시.

## 5. 모니터 프로그램 개선안
1. **회원 관리 탭 추가**  
   - `ttk.Treeview`로 전체 목록을 보여주고 상태 필터/검색 바 제공.
   - 행 선택 후 `비밀번호 초기화`, `관리자 권한 토글`, `계정 비활성화` 버튼 배치.
2. **API 연동**  
   - 로그인/토큰 획득 루틴 추가 후 공통 HTTP 클라이언트에 토큰 헤더 주입.
   - SSL 검증 옵션은 유지하되 인증 실패 시 사용자에게 알림.
3. **작업 로그**  
   - UI에서 실행 결과를 `logs/monitor-actions.log` 등에 남겨 서버 감사와 대조 가능하도록 구성.
4. **예외 처리**  
   - 대량 작업 실패 시 실패 건 목록과 원인을 텍스트/CSV로 저장해 재시도 가능하도록 지원.

## 6. 일괄 등록 운영 방안
1. **입력 포맷 정의**  
   - CSV 헤더: `username,display_name,full_name,email,is_admin,temp_password(optional)`.
   - Excel 지원 필요 시 기존 `read_excel*.py` 유틸을 재사용하여 JSON 변환.
2. **사전 검증**  
   - 파일 업로드 시 중복 ID·이메일, 포맷 오류를 클라이언트에서 선검증 후 API 호출.
   - `bulk-register` API는 트랜잭션 단위(전체/행별) 옵션을 제공.
3. **초대 통지**  
   - 등록 완료 후 `email_service.notify_user_approved`를 확장하여 임시 비밀번호 포함 혹은 비밀번호 설정 링크 제공.
4. **배치 자동화**  
   - CI/CD 파이프라인에 관리용 CLI(`python -m scripts.manage_users import users.csv`)를 추가해 야간 배치 처리 가능.

## 7. 실행 우선순위 로드맵
1. Backend 인증 방식 전환(서비스 계정/토큰) 및 `list_users` 필터링 공개.
2. `reset_password` API + 강제 변경 플래그 + 이메일 통지 구현.
3. 모니터 UI에 회원 관리 탭 및 토큰 로그인 플로우 추가.
4. `bulk_register` API 및 CLI/GUI 입력 모듈 배포.
5. 감사 로그/모니터 로그 통합 대시보드 구축 (향후).

---
작성: 2025-10-20 07:55:42 KST

