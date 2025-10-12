> PRD Ref: PRD.md (v2025-09-28.1) | Tasklist Ref: Tasklist.md (v2025-09-28.1) | Sprint Pending 36 | Completed 5 | Blockers 0

# Stage 2 학습 서비스(trainer) 개선 계획

## 게이트 리뷰 결과 요약
- Stage 1 데이터 파이프라인 산출물 검토: Access `dbo_BI_ITEM_INFO_VIEW`/`dbo_BI_ROUTING_VIEW`/`dbo_BI_WORK_ORDER_RESULTS` 조인 정의 및 피처 사전 이상 없음.
- Stage 2 범위(모델 파이프라인, 저장 규약, 0.8 유사도 임계, TensorBoard Projector) 전체 리뷰 완료.

## 1. 학습 파이프라인 설계
- 입력 데이터: Stage 1 피처 빌더 출력(`features.parquet`) + Access 컬럼 매핑(`schema_mappings.yaml`) + 실적 메타데이터(`item_metadata.json`).
- 전처리 구성
  1. `AccessFieldMapper`: Access 원본 컬럼명을 내부 표준 명칭으로 매핑, 명칭 변경 시 매핑 파일만 수정.
  2. `DataCleaner`: 이상치/결측 처리, 로그 변환, 외주 공정 플래그 분리.
  3. `FeatureAssembler`: 범주형 OneHot/TargetEncoder 조합, 수치형 표준화 및 치수 단위 통합.
  4. `WeightingModule`: 품목 가중치(생산량/판매량)와 도메인 가중치(씰 타입, 재질)를 조화평균으로 결합.
  5. `VectorExporter`: numpy float32 벡터 출력 + 유사도 0.8 임계 검증(0.8 미만 후보는 `similarity_tier='LOW'`).
- HNSW 매개변수: `M=32`, `ef_construction=200`, 거리 함수 `cosine`, 학습 시 `ef_search=256`.
- 증분 학습 전략: 신규 품목만 별도 벡터화 후 인덱스 업데이트, 0.8 미만 후보는 재학습 큐로 이동.
- TensorBoard Projector export: `metadata.tsv`, `vectors.tsv`, `projector_config.json` 생성 및 임베딩 이름 `routing_candidates`, Access ITEM_CD/PartNm 포함.

## 2. 코드 개선 항목(trainer_ml.py)
- 구성 파일: `config/trainer.yml` (Access 컬럼 매핑, 유사도 임계값, 가중치 설정 포함)
- 주요 함수 개선
  - `build_feature_matrix(df, config)` → `AccessFieldMapper` 결과를 기반으로 범주형/수치형 인코딩.
  - `apply_weights(matrix, sample_weights, domain_weights)` → ITEM_INFO 재질/그룹 기반 가중치 + 실적 기반 보정.
  - `train_hnsw_index(vectors, params)` → HNSW 빌드 및 인덱스 파일(`models/hnsw_index.bin`) 저장, 0.8 미만 벡터 로그 출력.
  - `export_tb_projector(vectors, metadata, output_dir)` → TensorBoard Projector용 벡터/메타 export, ITEM_CD/PartNm/SealType 포함.
- 로깅: 학습 시간, 벡터 차원, 메모리 사용량, 유사도 분포(0.8 이상/미만), 인덱스 빌드 파라미터 기록.

## 3. 메타데이터 및 산출물 저장 규약
| 항목 | 경로 | 설명 |
| --- | --- | --- |
| 학습 파라미터 | `models/training_metadata.json` | 파이프라인 구성, Access 컬럼 매핑 버전, 데이터 스냅샷 ID, similarity_threshold |
| HNSW 인덱스 | `models/hnsw_index.bin` | 메인 인덱스 파일 |
| TensorBoard | `models/tb_projector/{vectors.tsv, metadata.tsv, projector_config.json}` | 임베딩 시각화 자산 (ITEM_CD, PartNm, 유사도 티어 포함) |
| 로그 | `logs/trainer_YYYYMMDD.log` | 학습 실행 로그(0.8 미만 후보 경고, 자기지도 업데이트 결과) |

- 버전 관리: `training_metadata.json`에 `model_version`, `data_version`, `git_commit`, `schema_mapping_version`, `similarity_threshold` 포함.

## 4. 테스트 계획
- **기능 테스트**: Access 샘플 데이터 1k건으로 파이프라인 실행, 벡터 차원/분산 및 0.8 이상 유사도 비율 검증.
- **재현성 테스트**: 동일 seed(예: 42)로 3회 반복하여 코사인 유사도 평균 편차 0.02 이하 확인.
- **성능 테스트**: 학습 시간 30분 이내, 메모리 사용량 12GB 이내 목표.
- **에러 처리 테스트**: 입력 결측, 파라미터 누락, Access 연결 실패, 인덱스 저장 실패 시 예외 처리 확인.
- **TensorBoard 검증**: Projector에서 vectors/metadata 로드 및 ITEM_CD, PartNm 필드 표시 확인.

## 5. 컨테이너 이미지화 계획
- 베이스 이미지: `python:3.12-slim`
- 주요 의존성: `pandas`, `scikit-learn`, `hnswlib`, `pyyaml`, `tensorboard`, `pyodbc`(Access 연결)
- Dockerfile 구조
  1. 시스템 패키지 설치(`build-essential`, `libgomp1`)
  2. `requirements-trainer.txt` 복사 후 설치
  3. 애플리케이션 코드 및 `config/` 복사
  4. 엔트리포인트: `python backend/trainer_ml.py --config config/trainer.yml`
- 런타임 설정: CPU 8코어/메모리 16GB, 로그는 `/app/logs` 볼륨 마운트. Access ODBC 드라이버 설치 스텝 문서화.

## 6. Stage 종료 조건
- 학습 파이프라인 설계 문서 승인(Access 매핑, 0.8 임계, TensorBoard 요구 포함).
- 코드 개선 항목별 작업 티켓 생성 및 템플릿 기반 승인 준비.
- Dockerfile 초안 리뷰 및 보안 스캔 계획 수립(Access 드라이버 설치 검토 포함).
- Stage 3 착수 전 HNSW 인덱스 출력 포맷 및 7.1 SQL 매핑 키 합의.

