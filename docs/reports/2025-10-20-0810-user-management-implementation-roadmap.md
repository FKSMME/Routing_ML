# Routing ML 회원 관리 구현 로드맵 (2025-10-20 08:10 KST)

## 1. 백엔드 작업 분해
- **API 인증 전환 (D1~D2)**  
  - 모니터 프로그램용 서비스 계정 발급, JWT 발급 엔드포인트 확장.  
  - `list_users`/`reset_password_admin`/`bulk_register` 엔드포인트를 관리자 토큰 기반으로 보호.
- **비밀번호 초기화 서비스 (D2~D3)**  
  - `AuthService.reset_password_admin` 구현, Argon2 재해시 + `must_change_password` 플래그 반영.  
  - 이메일 전송 실패 시 감사 로그 기록, 임시 비밀번호 반환 포맷 확정.
- **대량 등록 API (D3~D4)**  
  - `bulk_register` 트랜잭션 처리, 중복/오류 행 응답 구조 정의.  
  - `UserAccount` 컬럼(`invited_by`, `initial_password_sent_at`) 마이그레이션 스크립트 추가.
- **감사 로깅 (D4)**  
  - 모든 관리자 액션에 `routing.audit` 로그 확장 (target, actor, result, correlation_id).

## 2. 모니터 프로그램 개선
- **인증 및 토큰 관리 (D5)**  
  - 실행 시 관리자 자격증명 입력 → 백엔드 로그인 → JWT 저장/갱신.  
  - API 호출 공통 모듈 개발 (`requests` + SSL 구성).
- **회원 관리 탭 구현 (D5~D6)**  
  - `ttk.Treeview` 기반 목록, 상태 필터, 검색, 페이징 버튼.  
  - 행 선택 후 `비밀번호 초기화`, `관리자 권한 토글`, `계정 비활성화` 버튼 배치.
- **일괄 등록 UI (D6)**  
  - CSV/Excel 선택 → 클라이언트 검증 → 백엔드 업로드.  
  - 성공/실패 결과를 데이터 그리드 및 CSV 내보내기로 표시.
- **작업 로그 보관 (D6)**  
  - 모든 관리자 조작을 `%USERPROFILE%/Documents/RoutingML/logs/monitor-actions.log`에 JSONL로 저장.

## 3. 데이터/운영 준비
- **CSV 스키마 공지 (D2)**  
  - 템플릿(`username,display_name,full_name,email,is_admin,password`)을 `docs/templates/`에 배포.  
  - 허용 문자·길이·필수 컬럼 명세 포함.
- **MSSQL 이관 여부 점검 (병행)**  
  - PoC 기간 SQLite 유지, 후속에 MSSQL 사용자 테이블 통합 여부 결정.  
  - 결정 전까지 백업 스크립트(일일 `sqlite3 .dump`) 자동화.

## 4. 품질 및 테스트
- **단위 테스트 (D4~D5)**  
  - `pytest`에서 서비스 계정, 비밀번호 초기화, 대량 등록 성공/실패 케이스 작성.  
  - 이메일 서비스는 `OutlookNotAvailableError` 목킹으로 검증.
- **E2E 시나리오 (D7)**  
  - 관리자 계정 로그인 → 신규 사용자 등록 → 승인 → 비밀번호 초기화 → 최초 로그인 플로우.  
  - CSV 일괄 등록 → 이메일 통지 → 강제 비밀번호 변경 확인.
- **보안 점검 (D7)**  
  - 임시 비밀번호 최소 길이/복잡도 정책 재확인.  
  - 로그에 평문 비밀번호 저장 여부 검사(반드시 제외).

## 5. 배포 체크리스트
1. 데이터베이스 마이그레이션 스크립트 실행 (`must_change_password`, `invited_by`, `initial_password_sent_at`).  
2. 백엔드 재배포 (`uvicorn` 재시작), 환경변수: `ADMIN_SERVICE_ACCOUNT`, `ADMIN_SERVICE_SECRET`.  
3. 모니터 EXE 재빌드(Python → PyInstaller) 후 내부망 배포.  
4. 서비스 계정 자격증명 배포 및 운영 매뉴얼 `docs/guides/user_admin_operations.md` 업데이트.  
5. 초기 사용자 CSV 업로드 리허설 및 이메일 발송 정상 여부 확인.

---
작성: 2025-10-20 08:10:13 KST

