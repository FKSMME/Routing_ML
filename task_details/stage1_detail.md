# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

## 1단계 상세 태스크: 데이터 파이프라인

### Gate Review Checklist
- [x] 절대 지령 1~7 준수 여부 재확인 — `logs/task_execution_20250925.log` 04:00Z 기록
- [x] 데이터 원천 테이블 및 스키마 범위 리뷰 — `docs/data_pipeline_spec.md`
- [x] 선행 단계(0단계) 산출물에 미해결 오류 없음 확인 — Stage 0 보고서 재검토
- [x] 외부 문서/DB 뷰어 접근 시 승인 상태 재확인 — 데이터 소유자 승인 경로 기록
- [x] 백그라운드 배치/스크립트 실행 시나리오 수립 — 배치 운영 계획 수립 완료

### 설계(Design)
1. ITEM_INFO, ROUTING_VIEW, WORK_ORDER_RESULTS 컬럼 목록과 키 관계 표 작성 → `docs/data_pipeline_spec.md` §1
2. 조인 조건/필수 필터 정의서 작성(ITEM_CD 기준, 활성/폐기 품목 구분 포함) → `docs/data_pipeline_spec.md` 조인 정의
3. Feature 사전 초안: 범주/수치/날짜 컬럼 분류, 결측 처리 정책, 스케일링 전략 → `docs/data_pipeline_spec.md` §2
4. 데이터 품질 리스크 식별 및 데이터 확보 계획 문서화 → 결측 처리/모니터링 항목에 포함

### 구현(Implementation)
1. ODBC 커넥터 설정 스크립트 초안 작성 (환경변수, DSN, 에러 핸들링) → `docs/data_pipeline_spec.md` §3.1
2. 쿼리 모듈 구현 계획 수립: 파라미터화, 재시도 정책, 로깅 항목 정의 → `docs/data_pipeline_spec.md` §3.2
3. 피처 빌더 설계대로 인코딩(Label/Ordinal) 모듈 구조 초안 작성 → `docs/data_pipeline_spec.md` §3.3
4. 표준화, VarianceThreshold, PCA 단계별 파이프라인 설계 및 코드 스켈레톤 준비 → `docs/data_pipeline_spec.md` §3.3
5. 외주 공정 제외 필터 로직 정의(INSIDE_FLAG, 공정 타입 기준) → `docs/data_pipeline_spec.md` §3.4

### 테스트(Test)
1. 비식별 샘플 데이터 확보 및 스냅샷 테스트 케이스 설계 → `docs/data_pipeline_spec.md` §4
2. 파이프라인 단위 테스트 계획: 인코더/스케일러/필터 각각 성공·에러 케이스 정의 → `docs/data_pipeline_spec.md` §4
3. 성능 예비 측정 계획(쿼리 시간, 메모리 사용) 수립 → `docs/data_pipeline_spec.md` §4

### 배포(Deployment)
1. 데이터 소스 접근 시크릿(.env, Key Vault) 관리 정책 문서화 → `docs/data_pipeline_spec.md` §5
2. 배치/파이프라인 실행 스케줄(백그라운드) 및 모니터링 요구 정의 → `docs/data_pipeline_spec.md` §5
3. 단계 완료 보고 및 다음 단계 승인 요청 자료 준비 → Stage 1 로그 및 보고서 공유
4. 장기 유지보수 시 데이터 사전 업데이트 프로세스 정의 → Feature 사전 관리 전략 포함
