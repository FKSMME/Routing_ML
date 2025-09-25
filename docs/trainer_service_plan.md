# Stage 2 학습 서비스(trainer) 개선 계획

## 게이트 리뷰 결과 요약
- Stage 1 데이터 파이프라인 산출물 검토: 스키마/피처 정의 및 운영 계획 이상 없음.
- Stage 2 범위(모델 파이프라인, 저장 규약, 테스트/배포) 전체 리뷰 완료.

## 1. 학습 파이프라인 설계
- 입력 데이터: Stage 1 피처 빌더 출력(`features.parquet` 예상) + 메타데이터(`item_metadata.json`).
- 전처리 구성
  1. `DataCleaner`: 이상치/결측 처리, 로그 변환.
  2. `FeatureAssembler`: 범주형 OneHot/TargetEncoder 조합, 수치형 스케일링.
  3. `WeightingModule`: 품목 가중치(생산량 기반)와 도메인 가중치(업종 중요도) 조화평균.
  4. `VectorExporter`: numpy array/Annoy-compatible float32 벡터 출력.
- HNSW 매개변수: `M=32`, `ef_construction=200`, 거리 함수 `cosine`.
- 증분 학습 전략: 신규 품목만 별도 벡터화 후 인덱스 업데이트.
- TensorBoard Projector export: `metadata.tsv`, `vectors.tsv` 생성 및 임베딩 이름 `routing_candidates`.

## 2. 코드 개선 항목(trainer_ml.py)
- 구성 파일: `config/trainer.yml`
- 주요 함수 개선
  - `build_feature_matrix(df, config)` → 범주형/수치형 분리 후 인코딩 파이프라인 적용.
  - `apply_weights(matrix, sample_weights, domain_weights)` → 조화평균 가중치 계산.
  - `train_hnsw_index(vectors, params)` → HNSW 빌드 및 인덱스 파일(`models/hnsw_index.bin`) 저장.
  - `export_tb_projector(vectors, metadata, output_dir)` → 옵션 플래그로 실행 제어.
- 로깅: 학습 시간, 벡터 차원, 메모리 사용량, 인덱스 빌드 파라미터 기록.

## 3. 메타데이터 및 산출물 저장 규약
| 항목 | 경로 | 설명 |
| --- | --- | --- |
| 학습 파라미터 | `models/training_metadata.json` | 파이프라인 구성, 버전, 데이터 스냅샷 ID |
| HNSW 인덱스 | `models/hnsw_index.bin` | 메인 인덱스 파일 |
| TensorBoard | `models/tb_projector/{vectors.tsv, metadata.tsv, projector_config.json}` | 임베딩 시각화 자산 |
| 로그 | `logs/trainer_YYYYMMDD.log` | 학습 실행 로그 |

- 버전 관리: `training_metadata.json`에 `model_version`, `data_version`, `git_commit` 포함.

## 4. 테스트 계획
- **기능 테스트**: 샘플 데이터 1k건으로 파이프라인 실행, 벡터 차원/분산 검증.
- **재현성 테스트**: 동일 seed(예: 42)로 3회 반복하여 코사인 유사도 분포 비교.
- **성능 테스트**: 학습 시간 30분 이내, 메모리 사용량 12GB 이내 목표.
- **에러 처리 테스트**: 입력 결측, 파라미터 누락, 인덱스 저장 실패 시 예외 처리 확인.

## 5. 컨테이너 이미지화 계획
- 베이스 이미지: `python:3.12-slim`
- 주요 의존성: `pandas`, `scikit-learn`, `hnswlib`, `pyyaml`, `tensorboard`
- Dockerfile 구조
  1. 시스템 패키지 설치(`build-essential`, `libgomp1`)
  2. `requirements-trainer.txt` 복사 후 설치
  3. 애플리케이션 코드 및 `config/` 복사
  4. 엔트리포인트: `python backend/trainer_ml.py --config config/trainer.yml`
- 런타임 설정: CPU 8코어/메모리 16GB, 로그는 `/app/logs` 볼륨 마운트.

## 6. Stage 종료 조건
- 학습 파이프라인 설계 문서 승인.
- 코드 개선 항목별 작업 티켓 생성 및 템플릿 기반 승인 준비.
- Dockerfile 초안 리뷰 및 보안 스캔 계획 수립.
- Stage 3 착수 전 HNSW 인덱스 출력 포맷 합의.

