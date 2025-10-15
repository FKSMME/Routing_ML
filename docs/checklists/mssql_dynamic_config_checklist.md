# MSSQL 동적 구성 작업 체크리스트

## 1. 사전 준비
- [ ] PRD/요구사항 승인 및 범위 Freeze (비밀번호 저장 정책 포함)
- [ ] 데이터 소스 구성 저장 위치 결정(config_store vs .env)
- [ ] 접근 권한/경로 확인 (`config/workflow_settings.json`, `.env`)
- [ ] demo/테스트 환경 영향 분석

## 2. 백엔드 구성
### 2.1 config_store 확장
- [ ] `DataSourceConfig`에 view/connection 필드 추가
- [ ] `update_data_source_config`, `get_data_source_config` 테스트 통과
- [ ] `workflow_settings.json` 템플릿/마이그레이션 준비

### 2.2 database 모듈 리팩터링
- [ ] `DEFAULT_*_VIEW`, `get_*_view_name()` 구현
- [ ] `update_mssql_runtime_config`, `refresh_view_names` 구현
- [ ] 모든 쿼리 함수에서 getter 사용 (`_load_*`, fetch 계열 등)
- [ ] `_connect`/캐시 함수가 최신 config 사용 확인
- [ ] demo 모드 fallback 검증

### 2.3 API 확장
- [ ] `/api/database/config` GET/POST 스키마 수정 (뷰 이름 포함)
- [ ] 저장 시 validation & runtime 업데이트 호출
- [ ] `/api/database/test-connection` 수정 (새 파라미터)
- [ ] `/api/database/info` 응답 필드 업데이트
- [ ] 관련 테스트 추가 및 통과

## 3. 프런트엔드 구성
- [ ] Database Settings UI에 뷰 이름 입력 필드 추가
- [ ] 저장/테스트 API 호출 로직 업데이트
- [ ] 상태 관리(store/query) 반영
- [ ] UX: validation, 오류/성공 토스트, 안내 문구
- [ ] 기존 workflow 옵션 화면과 데이터 중복 확인/조정
- [ ] 단위/통합(E2E) 테스트 수정

## 4. QA
- [ ] 정상 플로우: 새 뷰 이름 저장 → 라우팅 조회/생성 성공
- [ ] 실패 플로우: 존재하지 않는 뷰 저장 시 오류 메시지
- [ ] 연결 테스트 실패 시 에러 핸들링
- [ ] 스테이징/운영 환경에서 동작 확인
- [ ] demo 모드/기존 스크립트 회귀 테스트

## 5. 문서/운영
- [ ] README/API 문서 업데이트
- [ ] 운영 적용 가이드(설정 변경 절차, 롤백 방법)
- [ ] 보안 정책/비밀번호 취급 지침 명시
- [ ] 배포 스크립트/CI 설정 수정 여부 확인

## 6. 릴리즈 체크
- [ ] 코드 리뷰 완료
- [ ] QA 승인
- [ ] 배포 계획 수립 및 일정 공유
- [ ] 모니터링/로그 경보 설정(변경 실패 감지)
*** End Patch
