# TimeAggregator 성능 비교

새로운 Polars 기반 `TimeAggregator` 구현의 성능을 기존 Pandas/파이썬 루프 기반 버전과 비교하기 위해 `scripts/benchmark_time_aggregator.py` 스크립트를 실행했습니다. 벤치마크는 6만 건의 공정 레코드를 생성한 뒤, 동일 입력에 대해 기존 구현(`LegacyTimeAggregator`)과 신규 구현을 각각 두 번씩 측정하여 평균 값을 계산합니다. 【F:scripts/benchmark_time_aggregator.py†L1-L190】

## 결과 요약

| 구현 | 평균 실행 시간 (초) |
| --- | --- |
| LegacyTimeAggregator | 2.248 |
| TimeAggregator (Polars) | 0.963 |

- 처리 속도는 약 **2.33배** 향상되었습니다. 【4071e0†L1-L4】
- 신규 구현은 Polars의 벡터화 집계와 NumExpr 기반 NumPy 벡터화를 결합해 CPU 코어 병렬성을 활용합니다.

## 재현 방법

```bash
python scripts/benchmark_time_aggregator.py
```

위 명령을 실행하면 동일한 데이터셋과 설정으로 벤치마크가 수행되며 결과가 콘솔에 출력됩니다. 【F:scripts/benchmark_time_aggregator.py†L143-L190】
