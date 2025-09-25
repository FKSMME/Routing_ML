# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

## 7단계 상세 태스크: 운영/배포

### Gate Review Checklist
- [x] 절대 지령 1~7 준수 여부 재확인
- [x] 네트워크/보안/배포 범위 전체 리뷰
- [x] 선행 단계 산출물(트레이너/프레딕터, 평가) 안정성 확인
- [x] 인프라 문서/도구 접근 전 승인 상태 확인
- [x] 백그라운드 배포/롤아웃 계획 수립

### 설계(Design)
1. ✅ 네트워크 토폴로지 및 접근 제어 설계(방화벽, 서브넷, 포트) — `docs/stage7_operations_report.md#1-설계-design`
2. ✅ 보안 정책 문서화(비밀관리, 인증/인가, 감사 로그)
3. ✅ ODBC/시크릿 배포 구조 설계(환경변수, 시크릿 매니저)
4. ✅ 배포 파이프라인 선택(Compose, Helm) 및 비교 분석
5. ✅ 장애 대응/롤백 전략 및 책임자 매트릭스 작성

### 구현(Implementation)
1. ✅ Dockerfile(트레이너/프레딕터) 초안 작성 및 의존성 명세 — `deploy/docker/Dockerfile.trainer`, `deploy/docker/Dockerfile.predictor`
2. ✅ Compose 스택 생성 및 환경 변수 정의 — `deploy/docker/docker-compose.yml`
3. ✅ 프로브(liveness/readiness) 및 구조화 로그 설정 계획 — `docs/stage7_operations_report.md#2-구현-implementation`
4. ✅ 알람/모니터링 통합 계획 수립(로그 수집, 알람 채널)

### 테스트(Test)
1. ✅ 장애 주입 테스트 시나리오 정의(모델 미존재, DB 연결 실패 등)
2. ✅ 롤백 절차 검증 계획 수립
3. ✅ 보안 점검 체크리스트 작성(비밀 노출 여부, 권한 검토)
4. ✅ 배포 자동화 스크립트 Dry-run 계획 수립

### 배포(Deployment)
1. ✅ 단계적 롤아웃 실행 계획(파일럿 → 전체) 및 승인 일정 수립
2. ✅ 운영 모니터링 대시보드/알람 채널 구성안 문서화
3. ✅ 배포 후 검증 및 보고 절차 정의
4. ✅ 단계 완료 보고서 및 다음 단계 승인 요청 자료 준비

=======

### 진행 로그 (2025-02-15)
- FastAPI 백엔드 스캐폴드 생성 및 `/api` 라우터 구현 완료 — `backend/api/*`
- `backend/run_api.py` 실행 스크립트 추가로 운영 배포 파이프라인 대비
- 백엔드 운영 개요 문서 초안 작성 — `docs/backend_api_overview.md`
- Dockerfile/Compose 스택 및 구성 템플릿 추가 — `deploy/docker/*`
- Stage 7 운영 보고서 작성 및 Tasklist 업데이트 — `docs/stage7_operations_report.md`, `Tasklist.md`
- Dockerfile/Compose 스택 및 구성 템플릿 추가 — `deploy/docker/*`
- Stage 7 운영 보고서 작성 및 Tasklist 업데이트 — `docs/stage7_operations_report.md`, `Tasklist.md`

