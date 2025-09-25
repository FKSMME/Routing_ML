PRD: 머신러닝 기반 라우팅 자동화 (Routing_ML)
A. 프로젝트 목표

목표: 신규 품목에 대해 여러 가지 가능한 라우팅을 ML로 예측·제안하고, 사용자가 선택/수정하여 SQL 규격으로 내리는 시스템 구현.

포지셔닝: 완전 자동 생성이 아니라 **“ML 기반 라우팅 예측/참고 + 다중 후보 제안”**에 초점. (현 시스템의 강·약점 정리에 부합) 

manufacturing_routing_reality

운영/환경: Python 3.12, 16GB/i7, 사내망 ODBC, 별도 서버/컨테이너로 학습 서비스와 예측 서비스 분리. 프런트/백 분리는 B안(React + FastAPI).

* 단계 공통 게이트(승인 체크리스트) — 사용자 절대 조건 반영

각 단계는 승인 후 진행

단계 착수 전 범위 리뷰 & 오류 식별

오류 발견 시 수정 전에 승인 재요청

이전 단계 오류 없음 재확인 후 다음 단계 승인 요청

문서/웹뷰어 점검은 승인 확인 후 진행

다음 단계 착수 전에 전반 재점검(미해결 오류 없음 확인)

안내: “모든 단계 작업을 백그라운드로 수행” 요구는 저희 시스템 특성상 비동기/백그라운드 작업 약속을 할 수 없습니다. 대신, 각 단계를 순차적으로 실행 후 중간 결과를 즉시 보고하고, 사용자의 승인 신호 후 다음 단계로 진행하겠습니다.

B. 입력 데이터 & 피처
1) 원천 테이블

dbo_BI_ITEM_INFO_VIEW: 임베딩/유사도 탐색의 기준 피처. (ITEM_CD, MATERIAL, 치수 등 범·수치 혼합)

dbo_BI_ROUTING_VIEW: 라우팅 이력(공정 순서·시간 등)

dbo_BI_WORK_ORDER_RESULTS: 실제 작업 실적(세팅/가공/대기 시간 등)

2) 피처 구분

DB에서 바로 획득: 재질(ITEM_MATERIAL), 치수(OUT/IN DIAMETER, THICKNESS), 품목유형(PART_TYPE/ITEM_TYPE), 그룹/계정, 단위 등

CAD 필요(이번 스코프 제외): 형상피처, 공차/조도, 조립관계 등 (레포 백업 문서의 현실 데이터 요구 표 참고) 

manufacturing_routing_reality

3) 관계 & 학습 기준

ITEM_CD를 키로 ITEM_INFO ↔ ROUTING_VIEW ↔ WORK_ORDER_RESULTS를 매핑, **라벨(타깃)**은 “하나의 품목에 대해 가능한 라우팅 시퀀스들”(ProcSeq, Job, Time 등 컬럼 집합).

“외주 공정 제외” 옵션: 상위 K 메타-앙상블 생성 시 INSIDE_FLAG ≠ ‘사내’ 후보를 제외하여 앙상블.

C. 기능 요구
1) 유사 품목 검색 & 후보 라우팅 생성

임베딩/유사도: dbo_BI_ITEM_INFO_VIEW 전/후처리 → 차원 정규화 → HNSW 인덱스 구성(Cosine) → Top-K 후보 조회(기본 K=10, UI에서 가변 / 임계값 기본 30%). GUI 로그 기반으로 임계값 조절 가능 UI 이미 존재 확인. 

gui_20250912

정책 스위치(기본): “기존 이력 무시 + 유사품 라우팅 제안” 모드.

메타-앙상블: Top-K의 라우팅 시퀀스를 가중 집계하여 3~4개의 가능한 라우팅 구조를 생성(예: CNC 선반 3차 + MCT, MTM 3차 등). 외주 공정 제외 규칙을 반영.

유사도 80%+ 달성 전략:

카테고리/수치 혼합 인코딩 후 표준화 + 가중치 적용 → 코사인 유사도 ↑ (trainer 파이프라인에 가중치/스케일링/HNSW 이미 구조 존재) 

trainer_ml

 

trainer_ml

VarianceThreshold & (옵션) PCA로 노이즈 축소, 도메인×데이터 가중치 조화(조화평균) 방식 채택. 

trainer_ml

2) 결과 시각화 (주니어 친화)

타임라인 카드: 공정 순서/소요시간 막대

후보 비교 카드: 공정 수/예상시간/성공률 뱃지

설명 패널: “왜 이 공정이 붙었는가?” — 기여 피처 Top-N

TensorBoard Projector 내보내기로 벡터 공간 시각화(이미 export 코드 훅이 존재) 

trainer_ml

3) 출력(필수 SQL 규격)

사용자 제공 칼럼 양식으로 저장/내보내기(샘플 표 준수).

스키마 제안(예):

routing_candidates(item_cd, candidate_id, rank, similarity, created_at)

routing_candidate_operations(item_cd, candidate_id, PROC_SEQ, …, MTMG_NUMB)

FK: (item_cd, candidate_id)

4) 서비스/배포

분리: trainer(학습) ↔ predictor(예측) 별도 컨테이너/서버, 레포는 공유.

API: FastAPI로 예측/저장/로그/상태 점검 엔드포인트.

프런트: React(시각 카드, 테이블, 슬라이더/드롭다운).

패키징: Docker 권장(이미지 태그: routing-ml-trainer, routing-ml-predictor).

모델 버전/메타: training_metadata.json 유지, TB Projector 로그 디렉터리 표준화. 

trainer_ml

D. 비기능 요구

성능 목표: 단건 예측 ≤ 1분, 배치 10건 ≤ 10분.

호환성: 사내망/ODBC, Windows 클라이언트에서도 웹 UI 접근 가능(내부 호스트).

신뢰성: 예측 실패 시 룰기반 베이스라인으로 폴백.

감사/로깅: 입력 피처 스냅샷, 유사도/가중치, 후보 라우팅 요약, 저장 결과 로그.

E. 평가/KPI

KPI-1: 정답 라우팅 단계 일치율(Seq-level Accuracy)

KPI-2: 예측시간/실적시간 일치율(MAE 또는 MAPE 역지표)

베이스라인: 룰 기반 (실패 시 폴백/비교)