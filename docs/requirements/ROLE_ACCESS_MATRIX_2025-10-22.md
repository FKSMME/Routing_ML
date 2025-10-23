# Role-Based Access Matrix (2025-10-22)

## 역할 정의
| 역할 | 설명 | 인증 방식 |
|------|------|-----------|
| `admin` | 시스템 설정, 모델 학습/배포, 데이터 매핑, 로깅 등 전체 권한 | JWT + `AuthenticatedUser.is_admin = True` |
| `user` | 예측 실행, 마스터 데이터 조회 등 운영 사용자 | JWT + `AuthenticatedUser.is_admin = False` |
| `server_manager` | 배치/스크립트로 서버 기동 및 계정 승인 담당. API 변경 없이 기존 스크립트 권한 유지 | OS 계정/스크립트, 별도 RBAC 없음 (UI는 admin과 동일 계정 사용) |

## 네비게이션/워크스페이스 권한 매트릭스
| NavigationKey | 화면 설명 | 주요 컴포넌트 | 허용 역할 | 연동 API/모듈 |
|---------------|-----------|---------------|-----------|----------------|
| `routing` | 라우팅 예측 및 후보 비교 | `RoutingProductTabs`, `RoutingTabbedWorkspace` | admin, user | `/api/predict`, `/api/routing/*`, `/api/similarity/*` |
| `master-data` | 품목/공정 마스터 조회 | `MasterDataSimpleWorkspace` | admin, user | `/api/master-data/*` |
| `routing-config` | 라우팅 설정(요약) | `RoutingConfigWorkspace` | admin only | `/api/routing/*`, `/api/workspace/settings` |
| `routing-matrix` | 라우팅 매트릭스 (config) | `RoutingConfigWorkspace` | admin only | `/api/routing/*` |
| `process-groups` | 공정 그룹 관리 | `RoutingConfigWorkspace` | admin only | `/api/workflow/*`, `/api/process-groups/*` |
| `data-output` | 출력 프로필, 내보내기 관리 | `DataOutputWorkspace` | admin only | `/api/routing/output-profiles*`, `workflow_config_store` |
| `data-mapping` | 데이터 매핑 프리뷰/적용 | `DataRelationshipManager` | admin only | `/api/data-mapping/*` |
| `data-relationship` | 관계 맵 관리(Neo4j 등) | `DataRelationshipManager` | admin only | `/api/algorithm-viz/*`, `/api/data-mapping/*` |
| `profile-management` | 사용자/프로필 관리 | `ProfileManagementWorkspace` | admin only | `/api/auth/admin/*` |
| `data-quality` | 품질 리포트 & 이슈 | `DataQualityWorkspace` | admin only | `/api/data-quality/*`, `/api/logs/*` |
| `quality-monitor` | 품질 대시보드 | `QualityDashboard` | admin only | `/api/dashboard/*`, `/api/metrics` |
| `training-monitor` | 모델 학습 모니터링 | `TrainingMonitor` | admin only | `/api/training/jobs/*`, `/api/trainer/*` |
| `training-settings` | 학습 설정 | `IterTrainingSettings` | admin only | `/api/training/*`, `/api/trainer/*` |
| `log-viewer` | 시스템 로그 뷰어 | `LogViewer` | admin only | `/api/logs/*` |

> Note: `server_manager`는 UI 권한 자체를 별도로 갖지 않으며, 통상 admin 계정을 사용한다. 서버 스크립트(`run_*`, `deploy/*`)는 HTTP 인증을 우회하지 않으므로 기존 동작 유지.

## 관리자 전용 API 후보 목록
- `/api/workflow/*` (구성 저장/코드 동기화)
- `/api/training/*` (학습 시작/상태/설정)
- `/api/trainer/*` (모델 관리)
- `/api/database/config*` (DB 접속 정보)
- `/api/logs/*` (감사 로그) *(이미 `require_admin` 적용)*
- `/api/data-mapping/*` (목록/생성/삭제 포함)
- `/api/dashboard/*`, `/api/data-quality/*`, `/api/anomaly/*`, `/api/drift/*`
- `/api/bulk-upload/*`, `/api/routing/output-profiles*`
- `/api/auth/admin/*` (기존 유지, 관리자 승인/계정 관리)
- `/api/algorithm-viz/*`, `/api/view_explorer/*`의 구조 변경 API

## 사용자 허용 API 범위
- 예측/조회: `/api/predict`, `/api/similarity/*`, `/api/routing/*` 중 조회 계열
- 마스터 데이터 조회: `/api/master-data/*`, `/api/items/*`
- 상태 조회 공용 API: `/api/health`, `/api/auth/me`, `/api/workspace/settings` (읽기)

## 서버 매니저 영향 검토
- 서버 기동 스크립트는 FastAPI RBAC와 직접 연동되지 않음.
- 가입 승인/거절 흐름은 `/api/auth/admin/*` 유지 → 관리자 계정으로 작업.
- 배포/모니터링 스크립트(`deploy/*`, `monitoring/*`)는 CLI 차원의 권한이므로 변경 없음.

## 다음 단계 참고
- Phase 2에서 Navigation 데이터 구조에 `allowedRoles` 추가.
- Phase 3에서 위 관리자 전용 API 목록을 기준으로 `require_admin` 적용 및 테스트.
- 테스트 시나리오: `admin`/`user` 계정 각각 메뉴 가시성, 직접 URL 접근, API 403 응답 검증.



