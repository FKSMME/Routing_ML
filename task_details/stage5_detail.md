# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

## 5단계 상세 태스크: 출력/SQL 규격

### Gate Review Checklist
- [x] 절대 지령 1~7 준수 여부 재확인 및 승인 로그 캡처 — `docs/stage5_sql_report.md#gate-review-summary`
- [x] 출력 스키마 요구사항 리뷰 및 관련 문서 점검
- [x] 선행 단계(예측 서비스) 결과물과 인터페이스 일치 확인
- [x] DB 뷰어/DDL 도구 접근 전 승인 상태 확인
- [x] 백그라운드 마이그레이션/DDL 실행 계획 수립

### 실행 산출물 요약
- [x] `docs/stage5_sql_report.md`에 스키마·DDL·검증 계획 상세 기록
- [x] `Tasklist.md` Stage 5 구간 체크 및 링크 갱신
- [x] `logs/task_execution_20250925.log` Stage 5 진행 로그 추가

### 설계(Design)
- [x] `routing_candidates`, `routing_candidate_operations` 스키마 정의 — `docs/stage5_sql_report.md#스키마-정의`
- [x] FK, 인덱스, 제약 조건 요구사항 문서화 — `docs/stage5_sql_report.md#스키마-정의`
- [x] CSV/INSERT 출력 포맷 명세서 작성 — `docs/stage5_sql_report.md#출력-포맷-명세`
- [x] 데이터 정합성 규칙 정의 — `docs/stage5_sql_report.md#데이터-품질-규칙`

### 구현(Implementation)
- [x] DDL 스크립트 초안 작성 — `docs/stage5_sql_report.md#ddl-구성`
- [x] 마이그레이션 툴 선택 및 구조 설계 — `docs/stage5_sql_report.md#ddl-구성`
- [x] 저장/내보내기 로직 설계 — `docs/stage5_sql_report.md#저장-및-내보내기-플로우`
- [x] 샘플 데이터 매핑 스크립트 초안 작성 — `docs/stage5_sql_report.md#저장-및-내보내기-플로우`

### 테스트(Test)
- [x] 샘플 표 대비 검증 시나리오 정의 — `docs/stage5_sql_report.md#테스트-계획`
- [x] DDL 적용/롤백 테스트 계획 수립 — `docs/stage5_sql_report.md#테스트-계획`
- [x] 저장/내보내기 단위 테스트 케이스 정의 — `docs/stage5_sql_report.md#테스트-계획`
- [x] 데이터 검증 리포트 서식 초안 작성 — `docs/stage5_sql_report.md#테스트-계획`

### 배포(Deployment)
- [x] 마이그레이션 실행 계획 문서화 — `docs/stage5_sql_report.md#배포-준비`
- [x] 운영 DB 승인 플로우 정의 — `docs/stage5_sql_report.md#배포-준비`
- [x] 출력 포맷 버전 관리 정책 수립 — `docs/stage5_sql_report.md#배포-준비`
- [x] 단계 완료 보고 및 다음 단계 승인 요청 준비 — `docs/stage5_sql_report.md#배포-준비`

### 로그 참고
- [x] `logs/task_execution_20250925.log` 2025-09-25T07:45Z~08:20Z 구간에 Stage 5 진행 기록 저장
