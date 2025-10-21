# Phase 1: WORK_ORDER_RESULTS 통합 완료 보고서

**작성일**: 2025-10-21
**작업자**: Claude (AI Assistant)
**Phase**: ML System Improvements Phase 1

## 요약

Routing ML Algorithm Audit 보고서의 핵심 지적사항인 "WORK_ORDER_RESULTS 미활용" 문제를 해결했습니다. 이제 예측 파이프라인이 실제 작업 실적 데이터를 조회하여 예측 시간을 계산합니다.

## 배경

### Audit 지적사항
**원본 텍스트** (2025-10-21-routing-ml-algorithm-audit.md):
> "현재 예측 파이프라인은 `ITEM_INFO` 임베딩 → HNSW 유사 품목 → `BI_ROUTING_VIEW`만 조회 → 첫 번째 라우팅 복제 방식으로 동작합니다. `dbo.BI_WORK_ORDER_RESULTS` 뷰가 존재하고 `fetch_work_results_for_item()` 함수도 구현되어 있으나, **predictor_ml.py:756, 1095 어디에서도 이 함수를 호출하지 않습니다**."

### 문제점
1. `fetch_work_results_for_item()` 함수 미사용
2. 실제 작업 실적 데이터(ACT_SETUP_TIME, ACT_RUN_TIME) 활용 안 함
3. 라우팅 마스터의 이론 시간만 사용 → 실제와 괴리 가능

## 구현 내용

### 1. fetch_and_calculate_work_order_times() 함수 생성

**파일**: [backend/predictor_ml.py:1096-1178](../../backend/predictor_ml.py#L1096-L1178)

**기능**:
- `fetch_work_results_for_item(item_cd)` 호출하여 작업 실적 조회
- PROC_SEQ + OPERATION_CD(JOB_CD)로 필터링
- IQR 방식 이상치 제거 (1.5 * IQR)
- ACT_SETUP_TIME, ACT_RUN_TIME 평균 계산

**코드 스니펫**:
```python
def fetch_and_calculate_work_order_times(
    item_cd: str,
    proc_seq: int,
    job_cd: str
) -> Dict[str, Any]:
    """
    품목의 작업 실적 데이터 조회 및 평균 시간 계산

    Returns:
        {
            'predicted_setup_time': float,
            'predicted_run_time': float,
            'work_order_count': int,
            'has_work_data': bool
        }
    """
    try:
        work_results = fetch_work_results_for_item(item_cd)

        if work_results.empty:
            return {
                'predicted_setup_time': None,
                'predicted_run_time': None,
                'work_order_count': 0,
                'has_work_data': False
            }

        # PROC_SEQ와 OPERATION_CD로 필터링
        filtered = work_results[
            (work_results['PROC_SEQ'] == proc_seq) &
            (work_results['OPERATION_CD'] == job_cd)
        ]

        # IQR 이상치 제거
        def remove_outliers_iqr(series):
            if len(series) < 3:
                return series
            Q1 = series.quantile(0.25)
            Q3 = series.quantile(0.75)
            IQR = Q3 - Q1
            return series[(series >= Q1-1.5*IQR) & (series <= Q3+1.5*IQR)]

        setup_times = remove_outliers_iqr(
            pd.to_numeric(filtered['ACT_SETUP_TIME'], errors='coerce').dropna()
        )
        run_times = remove_outliers_iqr(
            pd.to_numeric(filtered['ACT_RUN_TIME'], errors='coerce').dropna()
        )

        return {
            'predicted_setup_time': float(setup_times.mean()) if len(setup_times) > 0 else None,
            'predicted_run_time': float(run_times.mean()) if len(run_times) > 0 else None,
            'work_order_count': len(filtered),
            'has_work_data': True
        }
    except Exception as e:
        logger.warning(f"작업 실적 조회 실패: {e}")
        return {'predicted_setup_time': None, 'predicted_run_time': None,
                'work_order_count': 0, 'has_work_data': False}
```

### 2. 예측 파이프라인 통합

**파일**: [backend/predictor_ml.py:1384-1427](../../backend/predictor_ml.py#L1384-L1427)

**통합 위치**: `predict_routing_from_similar_items()` 함수의 detailed 모드, confidence 계산 직후

**코드 스니펫**:
```python
# ⭐ WORK_ORDER_RESULTS 데이터 통합
work_order_data = fetch_and_calculate_work_order_times(
    input_item_cd, proc_seq, job_cd
)

prediction = {
    'ROUT_NO': 'PREDICTED',
    'ITEM_CD': input_item_cd,
    'PROC_SEQ': proc_seq,
    # ... 기존 필드들 ...
    'SETUP_TIME': round(setup_stats['mean'], 3),
    'RUN_TIME': round(run_stats['mean'], 3),
    # ⭐ WORK_ORDER 실적 기반 예측 시간 추가
    'PREDICTED_SETUP_TIME': round(work_order_data['predicted_setup_time'], 3)
                            if work_order_data['predicted_setup_time'] else None,
    'PREDICTED_RUN_TIME': round(work_order_data['predicted_run_time'], 3)
                          if work_order_data['predicted_run_time'] else None,
    'WORK_ORDER_COUNT': work_order_data['work_order_count'],
    'HAS_WORK_DATA': work_order_data['has_work_data'],
    # ...
}
```

### 3. 새로운 예측 필드

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `PREDICTED_SETUP_TIME` | float / None | 작업 실적 기반 평균 셋업 시간 |
| `PREDICTED_RUN_TIME` | float / None | 작업 실적 기반 평균 가공 시간 |
| `WORK_ORDER_COUNT` | int | 해당 공정의 작업 실적 건수 |
| `HAS_WORK_DATA` | bool | 작업 실적 데이터 존재 여부 |

## 데이터 흐름

### Before (Phase 0)
```
품목 입력 → ITEM_INFO 임베딩 → HNSW 유사 품목 검색 → BI_ROUTING_VIEW 조회 → 예측 완료
                                                             ↓
                                                   SETUP_TIME, RUN_TIME 사용
                                                   (라우팅 마스터 기준값)
```

### After (Phase 1)
```
품목 입력 → ITEM_INFO 임베딩 → HNSW 유사 품목 검색 → BI_ROUTING_VIEW 조회
                                                             ↓
                                                   SETUP_TIME, RUN_TIME (마스터)
                                                             +
                                                   BI_WORK_ORDER_RESULTS 조회
                                                             ↓
                                        ACT_SETUP_TIME, ACT_RUN_TIME 평균 (실적)
                                                             ↓
                                        PREDICTED_SETUP_TIME, PREDICTED_RUN_TIME
```

## 이상치 제거 로직

### IQR (Interquartile Range) 방식
```python
Q1 = data.quantile(0.25)  # 1사분위수
Q3 = data.quantile(0.75)  # 3사분위수
IQR = Q3 - Q1

lower_bound = Q1 - 1.5 * IQR
upper_bound = Q3 + 1.5 * IQR

# lower_bound ≤ data ≤ upper_bound 범위만 사용
```

**장점**:
- 정규분포 가정 불필요 (Z-score 대비)
- 극단값에 강건(robust)
- 표준적인 통계 방법

**적용 기준**:
- 데이터 수 < 3: 이상치 제거 안 함 (모두 사용)
- 데이터 수 ≥ 3: IQR 방식 적용

## Fallback 로직

### 실적 데이터 없을 때
1. `work_results.empty` → None 반환
2. `filtered.empty` (공정 매칭 실패) → None 반환
3. `len(setup_times_clean) == 0` → None 반환
4. Exception 발생 → Warning 로그 + None 반환

### 프론트엔드 처리 권장사항
```javascript
if (operation.HAS_WORK_DATA && operation.PREDICTED_RUN_TIME !== null) {
    // 실적 기반 시간 우선 표시
    displayTime = operation.PREDICTED_RUN_TIME;
    displayLabel = "실적 기반 예측 시간";
} else {
    // 라우팅 마스터 시간 사용
    displayTime = operation.RUN_TIME;
    displayLabel = "라우팅 마스터 시간";
}
```

## 성능 고려사항

### 추가 쿼리 부하
- 공정 1개당 `fetch_work_results_for_item()` 1회 호출
- 공정 10개 품목 → 10회 DB 쿼리 추가

### 최적화 방안 (향후)
1. **배치 조회**: `fetch_work_results_batch(item_codes)` 구현
2. **캐싱**: 품목별 작업 실적 캐시 (TTL: 1시간)
3. **인덱싱**: `BI_WORK_ORDER_RESULTS(ITEM_CD, PROC_SEQ, OPERATION_CD)` 인덱스 확인

## 테스트 시나리오

### 시나리오 1: 작업 실적 풍부
**조건**: 품목 A의 공정 10에 작업 실적 50건
**기대 결과**:
- `WORK_ORDER_COUNT`: 50
- `HAS_WORK_DATA`: true
- `PREDICTED_RUN_TIME`: 120.5 (예시)
- 이상치 제거 후 평균 계산

### 시나리오 2: 작업 실적 부족
**조건**: 품목 B의 공정 20에 작업 실적 2건
**기대 결과**:
- `WORK_ORDER_COUNT`: 2
- `HAS_WORK_DATA`: true
- `PREDICTED_RUN_TIME`: 평균값 (이상치 제거 안 함)

### 시나리오 3: 작업 실적 없음
**조건**: 품목 C의 공정 30에 작업 실적 0건
**기대 결과**:
- `WORK_ORDER_COUNT`: 0
- `HAS_WORK_DATA`: false
- `PREDICTED_RUN_TIME`: null
- 라우팅 마스터 시간(RUN_TIME) 사용

## 비교 분석 가능

이제 프론트엔드에서 다음과 같은 비교 분석이 가능합니다:

### 시간 차이 계산
```javascript
const timeDiff = operation.PREDICTED_RUN_TIME - operation.RUN_TIME;
const diffPercent = (timeDiff / operation.RUN_TIME) * 100;

if (diffPercent > 20) {
    // 실적이 라우팅 마스터보다 20% 초과 → 라우팅 마스터 업데이트 필요
    showWarning("라우팅 마스터 시간 재검토 권장");
}
```

### 신뢰도 표시
```javascript
const reliability = operation.WORK_ORDER_COUNT > 10 ? "high" :
                    operation.WORK_ORDER_COUNT > 3 ? "medium" : "low";
```

## 영향 및 효과

### 1. Audit 지적사항 해결 ✅
- WORK_ORDER_RESULTS 활용 완료
- `fetch_work_results_for_item()` 함수 사용
- 실적 기반 예측 시간 제공

### 2. 예측 정확도 향상 예상
- **Before**: 라우팅 마스터의 이론 시간만 사용
- **After**: 실제 작업 실적 평균 제공
- **효과**: 현장 실제 시간과의 괴리 감소

### 3. 데이터 품질 피드백
- 라우팅 마스터 vs 실적 시간 비교 가능
- 큰 차이 발생 시 → 라우팅 마스터 업데이트 필요 신호
- 데이터 품질 지속 개선 가능

### 4. 투명성 향상
- `HAS_WORK_DATA` 플래그로 데이터 출처 명확화
- 사용자가 예측의 신뢰도 판단 가능

## 다음 단계

### 즉시 테스트 가능
1. 백엔드 서버 재시작 (변경사항 적용)
2. 품목 예측 실행 (detailed 모드)
3. 응답 데이터에서 `PREDICTED_RUN_TIME` 필드 확인
4. `WORK_ORDER_COUNT` > 0인 공정 확인

### Phase 2 준비 (다음 작업)
1. Feature recommendations JSON 인코딩 수정
2. 프론트엔드 가중치 추천 UI 구현

### Phase 3 준비
1. 유사 품목 노드 리스트 시각화
2. 노드 클릭 인터랙션

## 변경 파일 목록

### Modified
- `backend/predictor_ml.py`
  - Import 추가: `fetch_work_results_for_item`
  - 함수 추가: `fetch_and_calculate_work_order_times()`
  - 수정: `predict_routing_from_similar_items()` - 1384-1427 줄

### Git Commit
```
b40ef758 - feat: Integrate WORK_ORDER_RESULTS for predicted time calculation
```

## 결론

Phase 1에서 Audit 보고서의 가장 중요한 지적사항인 **WORK_ORDER_RESULTS 미활용** 문제를 해결했습니다.

### 달성한 목표
1. ✅ `fetch_work_results_for_item()` 함수 활용
2. ✅ 실제 작업 실적 데이터 통합
3. ✅ IQR 방식 이상치 제거
4. ✅ 예측 시간 계산 및 반환
5. ✅ Fallback 로직 구현

### 제공하는 가치
1. **정확도**: 실제 작업 시간 기반 예측
2. **투명성**: 데이터 출처 명확화
3. **개선성**: 라우팅 마스터 품질 피드백
4. **유연성**: 실적 없을 때 라우팅 마스터 사용

---

**Phase 1 Status**: ✅ **COMPLETED**
**Next Phase**: Phase 2 - Feature Recommendations 수정
