# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

## 2단계 상세 태스크: 학습 서비스 (trainer)

### Gate Review Checklist
- [x] 절대 지령 1~7 준수 여부 재확인 — `logs/task_execution_20250925.log` 05:00Z 기록
- [x] 학습 파이프라인 요구 범위(HNSW, 메타데이터 등) 검토 — `docs/trainer_service_plan.md`
- [x] 선행 단계 데이터 파이프라인 산출물 품질 확인 — Stage 1 문서 재검토
- [x] 문서/코드 뷰어 접근 전 승인 상태 확인 — 모델 아티팩트 접근 승인 계획 기록
- [x] 백그라운드 학습 작업 스케줄 및 자원 계획 수립 — Docker/스케줄 전략 수립 완료

### 설계(Design)
1. HNSW 기반 학습 파이프라인 순서도 작성 (데이터 준비 → 인코딩 → 인덱스 빌드) → `docs/trainer_service_plan.md` §1
2. 가중치 전략(데이터/도메인 가중치 조화평균) 명세화 → §1 WeightingModule
3. 메타데이터 저장 구조 설계(`training_metadata.json`, 로그 디렉터리 구조) → §3 저장 규약
4. TensorBoard Projector export 플로우 및 파일 구조 정의 → §1 및 §3

### 구현(Implementation)
1. `trainer_ml.py` 개선 사항 정리 및 작업 우선순위 결정 → `docs/trainer_service_plan.md` §2
2. 혼합 인코딩/표준화/가중치 적용 로직 코드 스켈레톤 작성 → §2 함수 정의
3. HNSW 인덱스 빌드 및 저장 함수 인터페이스 정의 → §2 `train_hnsw_index`
4. `export_tb_projector` 옵션 플래그와 파라미터 처리 로직 설계 → §2 `export_tb_projector`
5. 메타데이터 기록(버전, 하이퍼파라미터, 피처 중요도) 코드 초안 작성 → §2 및 §3

### 테스트(Test)
1. 학습 시간/메모리 측정 계획 및 기준 수립 → `docs/trainer_service_plan.md` §4
2. 재현성 검증을 위한 seed 고정 전략 문서화 및 테스트 케이스 정의 → §4
3. HNSW 인덱스 로딩/검색 유닛 테스트 설계 → §4
4. TensorBoard Projector 출력 파일 검증 체크리스트 작성 → §4

### 배포(Deployment)
1. `routing-ml-trainer` Docker 이미지 구성요소 정의(Dockerfile 구조, 의존성 목록) → `docs/trainer_service_plan.md` §5
2. 컨테이너 실행 시 백그라운드 작업/로깅 전략 문서화 → §5 및 §2 로깅
3. 학습 파이프라인 배포 절차(스케줄링, 모니터링) 설계 → §5 런타임 설정
4. 단계 완료 보고서 및 다음 단계 승인 요청 자료 준비 → §6 Stage 종료 조건 및 로그 제출
