> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 36 | Completed 5 | Blockers 0

# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

## 6단계 상세 태스크: 평가/모니터링

### Gate Review Checklist
- [x] 절대 지령 1~7 준수 여부 재확인 및 승인 근거 기록 — `docs/stage6_monitoring_report.md#gate-review-summary`
- [x] KPI/평가 범위 및 데이터 소스 리뷰
- [x] 선행 단계 산출물 안정성 확인 (Stage 5 출력 규격 재검토)
- [x] 분석 도구/대시보드 접근 전 승인 상태 확인
- [x] 백그라운드 리포트/잡 실행 계획 수립

### 실행 산출물 요약
- [x] `docs/stage6_monitoring_report.md`에 KPI·평가 파이프라인·모니터링 전략 기록
- [x] `Tasklist.md` Stage 6 구간 체크 및 산출물 링크 반영
- [x] `logs/task_execution_20250925.log` Stage 6 진행 로그 추가

### 설계(Design)
- [x] KPI 정의서 작성 및 계산 공식 명시 — `docs/stage6_monitoring_report.md#kpi-정의`
- [x] 룰 기반 베이스라인 로직 문서화 — `docs/stage6_monitoring_report.md#kpi-정의`
- [x] 평가 파이프라인 플로우 설계 — `docs/stage6_monitoring_report.md#평가-파이프라인-설계`
- [x] 대시보드 요구사항 정리 — `docs/stage6_monitoring_report.md#대시보드-요구사항`
- [x] 주간 리포트 템플릿 및 채널 정의 — `docs/stage6_monitoring_report.md#대시보드-요구사항`

### 구현(Implementation)
- [x] 시퀀스 매칭 알고리즘 스펙 및 의사코드 작성 — `docs/stage6_monitoring_report.md#구현-계획`
- [x] MAE/MAPE 계산 모듈 설계 — `docs/stage6_monitoring_report.md#구현-계획`
- [x] 대시보드 데이터 수집 파이프라인 스켈레톤 정의 — `docs/stage6_monitoring_report.md#구현-계획`
- [x] 리포트 생성 스크립트 구조 및 자동화 계획 수립 — `docs/stage6_monitoring_report.md#구현-계획`

### 테스트(Test)
- [x] 샘플 데이터셋 기반 평가 검증 시나리오 작성 — `docs/stage6_monitoring_report.md#테스트-전략`
- [x] 지표 계산 모듈 단위 테스트 케이스 정의 — `docs/stage6_monitoring_report.md#테스트-전략`
- [x] 대시보드 데이터 검증 체크리스트 작성 — `docs/stage6_monitoring_report.md#테스트-전략`
- [x] 주간 리포트 Dry-run 계획 수립 — `docs/stage6_monitoring_report.md#테스트-전략`

### 배포(Deployment)
- [x] 평가 잡 스케줄링 및 백그라운드 실행 전략 문서화 — `docs/stage6_monitoring_report.md#배포-준비`
- [x] 모니터링 알람/로그 정책 정의 — `docs/stage6_monitoring_report.md#배포-준비`
- [x] 대시보드 배포 경로 및 권한 설정 계획 — `docs/stage6_monitoring_report.md#배포-준비`
- [x] 단계 완료 보고 및 다음 단계 승인 요청 준비 — `docs/stage6_monitoring_report.md#배포-준비`

### 로그 참고
- [x] `logs/task_execution_20250925.log` 2025-09-25T08:25Z~09:00Z 구간에 Stage 6 진행 기록 저장
