# MSSQL 동적 구성 UX/백엔드 연동 PRD

## 1. 배경
- 현재 백엔드(`backend/database.py` 및 다수의 서비스 모듈)가 MSSQL 접속 정보와 핵심 뷰 이름(`dbo.BI_ROUTING_HIS_VIEW` 등)을 하드코딩/환경 변수에 의존함.
- UI(UX)에서 연결 정보를 수정해도 실제 DB 접근 경로는 고정되어 유지보수가 어렵고, 환경마다 다른 구성을 반영하기 번거로움.
- 운영팀/사용자가 UI를 통해 안전하게 DB 연결·뷰 구성을 변경하고, 백엔드는 이를 실시간 반영할 수 있는 체계가 필요.

## 2. 목표
1. MSSQL 접속 정보(서버, DB, 사용자, 암호, TLS 옵션) 및 주요 뷰/테이블 이름을 UI에서 설정/저장하도록 한다.
2. 백엔드는 위 설정을 동적으로 읽어 DB 연결 및 쿼리에 반영한다.
3. 설정 변경 시 별도 배포 없이 즉시 반영되며, 실패 시 안전한 롤백/검증 수단을 제공한다.

## 3. 범위
### 포함
- Database Settings 화면 확장(UI/UX).
- 설정 저장 및 테스트용 API 확장.
- 백엔드 DB 접근 모듈 리팩터링(동적 getter).
- 설정 영속화 전략 수립(config store 확장 또는 대체 로직).
- 관련 문서/가이드/테스트 업데이트.

### 제외
- MSSQL 이외 DB 유형 지원.
- 암호화 비밀저장소 도입(추후 고려 대상, 본 작업은 현재 인프라 범위 내 처리).
- DB 스키마/뷰 생성 자동화(운영 절차 안내만 제공).

## 4. 이해관계자
| 역할 | 책임 |
|------|------|
| 제품/운영 | 요구사항 우선순위, UI 라벨, 보안 정책 확정 |
| 백엔드 팀 | 설정 저장 구조 및 런타임 반영, API 개발 |
| 프런트 팀 | UI 구현, UX 흐름 정의 |
| QA | 시나리오 테스트, 회귀 검증 |

## 5. 사용자 스토리 & 요구사항
1. **관리자**로서 UI에서 MSSQL 서버, DB, 사용자, 암호, Encrypt/Trust 옵션을 입력하고 연결 테스트 이후 저장할 수 있어야 한다.
2. **관리자**로서 UI에서 각 기능(품목, 라우팅, 작업결과, 발주)에서 사용하는 뷰/테이블 이름을 설정할 수 있어야 한다.
3. **시스템**은 설정 저장 전 연결/뷰 존재 여부를 검사하여 실패 시 원인을 명확히 안내해야 한다.
4. **시스템**은 설정 저장 시 현재 실행 중인 서비스에 즉시 반영하고, 이후 DB 호출에서 새 값이 사용되어야 한다.
5. **시스템**은 기 설정 값을 조회 API로 제공하고, 비밀번호는 마스킹/미반환 처리한다.
6. **시스템**은 여러 인스턴스에서 설정이 일관되게 공유되도록 파일/저장소를 사용하고, 동시 갱신 시 충돌을 방지한다.

### 기능 요구사항
- GET `/api/database/config`: 연결 정보 + 뷰 이름 반환 (비밀번호 필드 제외/마스킹).
- POST `/api/database/config`: 새 설정 저장 (검증, runtime 업데이트 포함).
- POST `/api/database/test-connection`: 임시 cred로 연결/뷰 확인.
- 백엔드 모든 쿼리 함수는 getter(`get_routing_view_name()` 등) 사용.
- 설정 저장 후 `refresh_view_names()` 등으로 캐시 갱신.

### 비기능 요구사항
- 100ms 이내 getter 호출(캐시 활용).
- 설정 저장 실패 시 원자적 롤백.
- 보안: 비밀번호는 API 응답 또는 로그에 노출 금지.

## 6. UX 요구사항
- Database Settings 화면에 다음 필드 추가: Routing View, Item View, Work Result View, Purchase Order View.
- 각 필드에 placeholder와 설명(예: `dbo.BI_ROUTING_HIS_VIEW`).
- 변경 시 “연결 테스트” 버튼 활성화 → 성공 후 저장 가능.
- 저장/오류 토스트 메시지 제공, 실패 시 상세 오류 텍스트.

## 7. 기술 전략
- 설정 영속화: `common/config_store.py` (`workflow_settings.json`)의 DataSourceConfig 확장.
- 백엔드 런타임: `update_mssql_runtime_config()` + `refresh_view_names()`로 `MSSQL_CONFIG` 및 getter 환경 변수 동기화.
- 프런트엔드: 기존 Database Settings fetch/save 로직 확장, React Query/Zustand 업데이트.
- 테스트: 단위 테스트 + Playwright/E2E 시나리오(설정 변경 후 라우팅 생성 등).

## 8. 일정(안)
| 주차/일자 | 작업 내용 |
|-----------|-----------|
| Week 1 | 요구사항 확정, 설계 문서 배포 |
| Week 1~2 | 백엔드 config_store 확장, getter 리팩터링 |
| Week 2 | API 확장, 테스트 추가 |
| Week 2~3 | 프런트 UI 구현, QA 시나리오 수립 |
| Week 3 | 통합 테스트/리그레션 |
| Week 3 | 문서/운영 가이드 업데이트, 배포 |

## 9. 리스크 및 완화책
| 리스크 | 완화책 |
|--------|--------|
| 설정 변경 시 기존 연결이 남아 stale data 사용 | `_connect()` 단계에서 최신 config 반영, 필요 시 connection pool 재생성 |
| config_store 파일 동시 수정 충돌 | `config_store` 내부 락 활용, 저장 전 사전 validation |
| 잘못된 뷰 이름 저장 | 저장 전 `INFORMATION_SCHEMA` 조회로 존재 여부 검증 |
| 비밀번호 노출 | API 응답/로그 마스킹, UI에서 재입력 정책 명시 |
| demo 모드 호환성 | fallback 로직 유지, demo flag 테스트 |

## 10. 성공 지표
- UI에서 뷰 이름 변경 후 재배포 없이 라우팅 생성/조회 성공.
- QA 테스트 시나리오 100% 통과.
- 운영팀 요청 대응 시간 단축(로그 추적 필요).

