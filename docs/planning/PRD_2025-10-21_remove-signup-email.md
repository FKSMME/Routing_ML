# PRD: 회원 가입 이메일 발송 비활성화

## Executive Summary
회원 가입 시 Outlook를 호출하여 관리자/사용자에게 이메일을 발송하던 기능이 운영 환경에서 불필요하며, 자동 실행으로 인해 Outlook 접근 권한 오류가 반복 발생한다. 본 작업은 회원 가입 플로우에서 이메일 발송 로직을 제거해 안정성을 높이고, 다른 알림 채널로의 전환을 준비한다.

## Problem Statement
- 신규 사용자가 회원 가입을 시도할 때 Outlook COM 객체를 호출하면서 PC 환경에 따라 예외가 발생한다.
- 실무에서는 이메일 알림이 필요하지 않으며 Slack/전화 등 다른 수단을 사용하고 있다.
- 이메일 발송 실패가 가입 성공과 무관하지만 반복 실패 로그가 쌓여 운영 모니터링을 방해한다.

## Goals and Objectives
1. 회원 가입 시 이메일 알림 로직을 완전히 제거한다.
2. 기존 로깅(`notify_admin_new_registration` 등)은 불필요한 호출 없이 가입 흐름이 정상 진행되도록 유지한다.
3. 기타 승인/거절/비밀번호 초기화 같은 별도 기능의 이메일 로직은 유지한다.

## Requirements
- AuthService.register, AuthService.create_user 등 회원 가입 경로에서 이메일 서비스 호출 제거.
- 이메일 제거 후에도 가입 결과(대기/중복) 반환값과 감사 로그는 기존과 동일하게 유지.
- Outlook 예외 처리 구문 삭제로 인한 코드 변경이 다른 기능에 영향 주지 않도록 검토.
- 문서 및 체크리스트 업데이트.

## Phase Breakdown
- **Phase 1** — 이메일 발송 제거 및 코드 정리  
  - 관련 함수에서 `email_service.notify_admin_new_registration`, `notify_user_approved` 등 가입 직후 호출을 제거 혹은 조건 분기.
  - 로깅 또는 주석 업데이트.
- **Phase 2** — 테스트 및 문서 업데이트  
  - 수동 테스트(신규 회원 가입 시 Outlook 호출 없는지 확인).  
  - 체크리스트, 작업 히스토리 기록.

## Success Criteria
- 회원 가입 시 Outlook 또는 이메일 관련 호출이 발생하지 않는다.
- 가입 API 응답(성공/중복)과 로깅 메시지는 기존과 동일하게 유지.
- 기타 이메일 기능(승인/거절/비밀번호 재설정 등)은 영향받지 않는다.

## Timeline Estimates
| Phase | Task | Duration | Target |
| --- | --- | --- | --- |
| Phase 1 | 이메일 발송 로직 제거 | 2h | 2025-10-21 |
| Phase 2 | 수동 테스트 및 문서화 | 1h | 2025-10-21 |

총 예상 시간: 3시간
