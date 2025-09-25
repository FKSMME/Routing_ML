# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

# Routing-ML FastAPI 백엔드 개요

## 1. 서비스 구조
- `backend/api/app.py`: FastAPI 애플리케이션 팩토리 및 CORS 설정.
- `backend/api/routes/prediction.py`: `/api/predict`, `/api/candidates/save`, `/api/health`, `/api/metrics` 엔드포인트 제공.
- `backend/api/services/prediction_service.py`: 비즈니스 로직 계층. `predict_items_with_ml_optimized`를 호출하여 Pandas DataFrame 결과를 직렬화하고 후보 저장 기능을 제공.
- `backend/api/config.py`: Pydantic Settings 기반 환경 구성. 모델 경로 및 후보 저장 위치를 설정.

## 2. 실행 방법
```bash
pip install -r requirements.txt
python -m backend.run_api
```
- 기본 포트는 `8000`, API prefix는 `/api`.
- `ROUTING_ML_MODEL_DIRECTORY` 환경변수를 통해 모델 경로 지정.

## 3. 예측 흐름
1. API 요청(`item_codes`, `top_k`, `similarity_threshold`)을 Pydantic으로 검증.
2. 서비스 계층이 모델 디렉터리 존재 여부를 확인하고 `load_optimized_model` 호출로 Health check.
3. `predict_items_with_ml_optimized`로 라우팅/후보 DataFrame 획득.
4. DataFrame을 `RoutingSummary`, `CandidateRouting` 스키마로 변환.
5. 응답과 동시에 마지막 실행 메트릭을 캐시하여 `/api/metrics`에서 조회 가능.

## 4. 후보 저장
- `logs/candidates/ITEM-CANDIDATE-타임스탬프.json` 형식으로 저장.
- 설정에서 `enable_candidate_persistence=false`로 비활성화 가능.
- 저장 데이터는 공정 리스트 및 요약 정보를 포함.

## 5. 향후 할 일
- Access DB 연결이 불가능한 환경을 위한 모의 데이터 어댑터.
- `/api/candidates/save` 검증 로직 강화 및 SQL 연동.
- 배치 예측, 인증/인가 추가.
