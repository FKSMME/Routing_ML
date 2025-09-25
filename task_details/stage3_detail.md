# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

## 3단계 상세 태스크: 예측 서비스 (predictor)

### Gate Review Checklist
- [x] 절대 지령 1~7 준수 여부 재확인 — `logs/task_execution_20250925.log` 06:00Z 기록
- [x] API 범위 및 성능 요구 리뷰 — `docs/predictor_service_plan.md`
- [x] 선행 단계(학습 서비스) 결과물 검증 완료 확인 — Stage 2 문서 검토
- [x] 문서/코드/모델 로더 접근 전 승인 상태 확인 — 인덱스 자산 접근 승인 기록
- [x] 백그라운드 예측 작업 처리 전략 수립 — 컨테이너/비동기 정책 수립 완료
- [x] Access 원본 기반 0.8 유사도 임계, 3~4개 라우팅 조합, 7.1 SQL 구조 준수 여부 선제 점검 — `docs/predictor_service_plan.md`

### 설계(Design)
1. FastAPI 엔드포인트 명세서 작성(`/predict`, `/candidates/save`, `/health`, `/metrics`) → `docs/predictor_service_plan.md` §1
2. 요청/응답 스키마 정의 시 7.1 SQL 구조(Access 컬럼 명칭) 및 3~4개 라우팅 조합 응답을 반영 → §1 테이블
3. HNSW 로딩 전략 및 캐싱/갱신 정책 설계(코사인 유사도 0.8 기본값, Access 명칭 매핑) → §2
4. 메타-앙상블 후보 생성 로직 설계(가중치, 외주 제외 규칙, Top-K 조합, 다중 라우팅 추천) → §3
5. SQL 출력 매퍼 요구 정의(필수 컬럼, 형 변환, 트랜잭션 정책, 명칭 변경 대응) → §4
6. 워크플로우 그래프 API 요구 수집(모듈/함수 의존성, 설정 메타데이터, 노드-에지 속성) 및 데이터 스키마 초안 작성 → `docs/graph_workflow_ui_plan.md#백엔드-데이터-모델`

### 구현(Implementation)
1. 예측 서비스 초기 프로젝트 구조 설정(app, routers, services 모듈) → `docs/predictor_service_plan.md` §6
2. HNSW 인덱스 로더와 파라미터 처리 함수 스켈레톤 작성(유사도 0.8 기본 임계 적용) → §2
3. 메타-앙상블 후보 생성기 의사코드 작성 및 입력/출력 정의(3~4개 라우팅 조합 생성) → §3
4. SQL 매퍼 모듈 인터페이스 정의 및 샘플 직렬화 로직 작성(7.1 구조 매핑) → §4
5. 로깅/모니터링 훅 설계(요청 ID, 유사도, 후보 요약, 0.8 미만 후보 로그) → §6 로깅
6. FastAPI 라우터(`/api/predict`, `/api/health`, `/api/candidates/save`) 실구현 — `backend/api/routes/prediction.py`
7. PredictionService 계층 작성(DataFrame 직렬화, 후보 저장, 7.1 컬럼 직렬화) — `backend/api/services/prediction_service.py`
8. `/api/workflow/graph` 엔드포인트 설계안 초안 작성(더블클릭 팝업용 설정 데이터 포함) — `docs/graph_workflow_ui_plan.md#백엔드-엔드포인트-설계`
9. 워크플로우 설정 저장소(`common/config_store.py`) 구현 및 SAVE 버튼 즉시 적용(Trainer/Predictor 런타임 갱신) — `backend/api/routes/workflow.py`, `backend/predictor_ml.py`, `backend/trainer_ml.py`

### 테스트(Test)
1. 단건/배치 벤치마크 시나리오 정의 및 목표 시간표 기록(3~4개 라우팅 조합 생성 포함) → `docs/predictor_service_plan.md` §5
2. API 단위 테스트 계획 수립(성공/에러 응답, 파라미터 검증, 0.8 임계값 검증) → §5
3. 통합 테스트 플로우 설계: HNSW 로딩 → 예측 → 후보 저장(7.1 스키마 매핑) → §5
4. 성능 모니터링 지표(응답시간, 메모리, 후보 수, 유사도 분포) 수집 방법 정의 → §5
5. 워크플로우 그래프 API 계약 검증 시나리오 정의(노드/에지 개수, 설정 팝업 데이터 무결성, SAVE 후 trainer/predictor 런타임 반영 여부) → `docs/graph_workflow_ui_plan.md#테스트-전략`

### 배포(Deployment)
1. `routing-ml-predictor` Docker 이미지 설계(기반 이미지, 의존성, 진입점) → `docs/predictor_service_plan.md` §6
2. 헬스체크/메트릭 엔드포인트 프로브 구성 초안 → §6 프로브
3. 백그라운드 작업(비동기 예측, 저장) 실행 정책 수립 — 0.8 미만 후보 후순위 큐 관리 포함 → §6
4. 단계 종료 보고 및 다음 단계 승인 요청 문서 작성(Access/사내망 준수 로그 첨부) → §7 Stage 종료 조건 및 로그 제출
5. 그래프 API 배포 파이프라인 및 권한 제어 전략 초안 작성(백엔드 캐시/설정 업데이트 포함, `config/workflow_settings.json` 권한/백업 관리) → `docs/graph_workflow_ui_plan.md#배포-전략`
