> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 36 | Completed 5 | Blockers 0

# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

## 7단계 운영·배포 보고서

### 1. 설계(Design)
- **네트워크 토폴로지**: 예측 서비스는 사내망 내 프런트/백엔드/DB가 위치한 `routing-ml-network` 서브넷(예: 10.30.12.0/24)에서 실행한다. FastAPI 컨테이너는 8000/TCP만 노출하며, 방화벽 ACL은 프런트엔드 게이트웨이 IP에 한정했다. 트레이너 컨테이너는 내부 `trainer` 호스트로만 접근 가능하고 외부 포트를 열지 않는다.
- **보안 정책**: Access ODBC 연결 문자열은 `ACCESS_CONNECTION_STRING` 환경 변수로만 주입하고, Compose/Helm 시크릿으로 관리한다. 모델/데이터 볼륨은 사내 NAS 계정으로 마운트하고, 모든 로그는 사내 Loki 수집기로 포워딩하도록 Fluent Bit DaemonSet에 라벨을 지정했다.
- **시크릿 & ODBC 관리**: `/mnt/config` 경로에 `trainer_config.yaml`, `predictor_config.yaml`을 배치하고, 시크릿은 Vault → CI → Compose Override로 단계적으로 전달한다. Access 파일은 전용 읽기 전용 공유 폴더(`/mnt/data/routing_data`)에서 마운트하며, 쓰기 권한은 모델 아티팩트 폴더(`/mnt/models`)에만 부여한다.
- **배포 파이프라인 비교**: 사내 Kubernetes 클러스터가 있으나 초기 배포는 빠른 검증을 위해 Docker Compose를 사용한다. Helm 차트는 2차 단계로 준비하며, Compose 스택은 동일한 네트워크 및 볼륨 정책을 재사용하도록 설계해 Helm 변환이 용이하다.
- **장애 대응/롤백**: 트레이너 실패 시 최신 안정 모델을 유지하기 위해 `/mnt/models` 볼륨에 버전 번호를 포함한 폴더 구조(`YYYYMMDDHHMM`)를 사용한다. Predictor는 Blue/Green 배포(Compose override로 `predictor_v2` 서비스 추가) 후 `/health` 프로브 성공 시 스위칭한다.

### 2. 구현(Implementation)
- `deploy/docker/Dockerfile.trainer`와 `deploy/docker/Dockerfile.predictor`에 공통 베이스 이미지를 정의하고, 모델·공통 라이브러리를 복사해 컨테이너화했다.
- `deploy/docker/docker-compose.yml`은 트레이너/프레딕터 서비스를 동일한 네트워크에 배치하고, 구성/데이터/모델 볼륨을 바인드하도록 했다. 개발자가 커스텀 설정을 작성할 수 있도록 예제 YAML (`deploy/docker/volumes/config/*.example.yaml`)을 제공했다.
- 구조화 로그는 FastAPI Uvicorn JSON 로그 포맷을 사용하고, Compose에서 `logging.driver`를 `json-file` 기본값으로 유지하면서 Fluent Bit가 호스트 로그를 수집하도록 매뉴얼에 명시했다.

### 3. 테스트(Test)
- **장애 주입 시나리오**: 모델 폴더를 비워둔 상태로 Predictor를 기동해 `/health`에서 503을 반환하는지 확인하고, Access 공유폴더를 언마운트해 DB 연결 실패 로그를 검증한다.
- **롤백 검증**: Compose에서 `predictor` 서비스를 이전 태그로 재기동하고 `/metrics` 응답이 복구되는지 확인한다. 트레이너 실패 시에는 마지막 성공 아티팩트 폴더로 심볼릭 링크를 되돌리는 절차를 검증한다.
- **보안 체크리스트**: 컨테이너 환경변수 덤프에 시크릿이 기록되지 않는지 확인하고, NAS 마운트 권한을 읽기/쓰기 최소 권한으로 제한한다.
- **자동화 Dry-run**: GitLab CI에서 `docker compose config`와 `docker compose --profile trainer up --no-start`를 실행해 구성 유효성 검사를 수행한다.

### 4. 배포(Deployment)
- **단계적 롤아웃**: 파일럿 공장 라인(라인 3)에서 Predictor를 1일간 운영하고 KPI(유사도 0.8 이상 비율, 작업시간 오차)를 모니터링한 후 전사 배포를 진행한다.
- **모니터링/알람**: Stage 6에서 정의한 KPI를 Prometheus 익스포터로 전송하고, Grafana 대시보드에 Compose 서비스별 상태 패널을 추가했다. 장애 시 Teams 웹훅으로 알람이 발송된다.
- **배포 후 검증**: `/api/health` 응답, 모델 버전 태그, SQL 라우팅 후보 저장 여부를 체크하는 15분 이내의 체크리스트를 운영문서에 포함했다.
- **보고/승인**: 배포 완료 후 `docs/stage7_operations_report.md`와 Tasklist Stage 7 항목을 업데이트하고, 로그(`logs/task_execution_20250925.log`)에 승인 요청을 기록했다.

### 5. 산출물 요약
| 범주 | 파일/위치 | 비고 |
| --- | --- | --- |
| 컨테이너 정의 | `deploy/docker/Dockerfile.trainer`, `deploy/docker/Dockerfile.predictor` | 트레이너/프레딕터 이미지화 |
| 오케스트레이션 | `deploy/docker/docker-compose.yml` | 로컬/파일럿 배포 스택 |
| 구성 샘플 | `deploy/docker/volumes/config/*.example.yaml` | 설정 템플릿 |
| 운영 문서 | `docs/stage7_operations_report.md` | 현재 문서 |

### 6. 로그
- 2025-02-15 18:40 — Stage 7 설계/구현/테스트/배포 문서 초안 작성 및 Compose 스택 추가.
- 2025-02-15 19:05 — 장애 주입 및 롤백 시나리오 점검 계획 문서화, Tasklist/세부 태스크 체크 완료.
