# Routing ML 보조 스코어 설계안 (Phase 2) — 2025-10-21

## 1. 배경 및 목표
- **현 상태**: ITEM_INFO 임베딩 기반 유사 품목 검색은 정상 동작하나, 회수된 라우팅/실적 데이터는 응답에 반영되지 않음.
- **목표**: 기존 모델을 유지하면서 ROUTING_VIEW, WORK_ORDER_RESULTS 데이터를 “후처리/보조 스코어”로 통합해 추천 정확도를 높이고, 외주 공정 대체 규칙 및 통계 옵션을 체계화한다.

## 2. 요구사항 정리
1. 신규 ITEM에 대해 기존 모델로 유사 품목 후보 탐색.
2. 후보 품목의 라우팅/실적을 즉시 조회하여 대표 라우팅 결정.
3. 외주(특히 외주8/외주2) 공정이 포함된 경우 사내 공정 세트를 우선 추천.
4. SETUP/RUN 시간은 실적 통계를 기반으로 표준편차를 반영한 값 사용(단순 평균 금지), 보류시간은 작업시간에서 차감.
5. 각 공정의 샘플 수/신뢰도, 통계치(평균·표준편차·Trim Mean 등)를 노출.
6. 캐시 및 성능을 고려한 실시간 응답 제공.

## 3. 전체 아키텍처
```
입력 ITEM → ITEM_INFO 임베딩 → HNSW 후보 K개
                     │
                     └─▶ 후보 후처리 파이프라인
                           1) ROUTING 조회
                           2) WORK_ORDER 실적 조회
                           3) 외주→사내 매핑 적용
                           4) 통계 계산 및 스코어링
                           5) 추천 라우팅/캔버스 데이터 생성
```

## 4. 모듈별 설계
### 4.1 Candidate Retrieval (기존 유지)
- `predict_items_with_ml_optimized` 호출 → K 후보 ITEM 리스트.
- 반환: `[(item_cd, similarity), ...]`.

### 4.2 Data Fetch Layer
| 모듈 | 설명 | 캐시 전략 |
| --- | --- | --- |
| `routing_repository.get_routes(item_cd)` | ROUTING_VIEW에서 최신 N개의 라우팅 세트 조회 | 품목 단위 TTL(예: 1시간) |
| `work_results_repository.get_stats(item_cd, proc_cd)` | WORK_ORDER_RESULTS 통계 조회 | 품목+공정 키 기반 캐시 |
| `outsourcing_policy.resolve(route)` | 외주 공정 규칙 적용 | Static in-memory 매핑 |

- 캐시 구현 방식: Redis/SQLite. 초기에는 Python LRU + 파일 백업.
- Null 데이터 대비: 품질 수준(QUALITY_SCORE) 계산 후 스코어링에 가중치로 사용.

### 4.3 Routing Selection & Re-ranking
1. **라우팅 후보 선정 룰**
   - 최근 사용 우선 (INSRT_DT DESC)
   - 사용량 보조 지표 (USE_CNT DESC)
   - 품질 지표 (필요시 SCORE = α·recent + β·usage)
2. **외주 공정 처리**
   - 라우팅 내 작업 공정 목록 검사 → 외주 코드(예: OUTSOURCING_8, OUTSOURCING_2) 발견 시 `outsourcing_policy` 적용.
   - 대체 가능한 사내 공정이 존재하면 변환 라우팅을 생성해 우선 추천.
3. **보류시간/실적 통계 계산**
   - `work_stats = compute_stats(work_results)`  
     - Trim Mean(기본), 표준편차, 샘플 수, 최근성 가중치 계산.
     - 보류시간(HOLD_TIME 등) 존재 시 `adj_run_time = run_time - hold_time`.
   - 신뢰도 계산: `confidence = min(1, samples/(samples+2)) * recency_factor`.
4. **최종 스코어**
   - `final_score = w_sim * similarity + w_time * time_score + w_quality * quality_score`
   - `time_score` 예시: `1 / (1 + std_dev)` (변동성 낮을수록 우수).

### 4.4 데이터 구조 (응답용)
```jsonc
{
  "item_cd": "ITEM-001",
  "routing": {
    "route_id": "ITEM-001_R1",
    "source": "PROD",
    "score": 0.87,
    "operations": [
      {
        "proc_seq": 10,
        "proc_cd": "MILL",
        "similarity": 0.92,
        "setup_time": 4.5,
        "run_time": 12.3,
        "std_dev": 1.1,
        "samples": 16,
        "confidence": 0.78,
        "outsourcing_flag": false,
        "notes": ["Converted from OUTSOURCE_8"]
      }
    ]
  }
}
```

## 5. 외주 → 사내 매핑 정책 초안
| 외주 코드 | 대체 사내 코드 | 기타 조건 |
| --- | --- | --- |
| OUTSOURCE_8 | INTERNAL_801 | 동일 공정 그룹, 장비 가능 여부 사전 검증 |
| OUTSOURCE_2 | INTERNAL_205 | 품목 규격 대응 시 |
| 기타 | 그대로 유지 또는 ‘주의’ 경고 | 향후 정책 추가 |

- 정책 파일: `config/outsourcing_policy.yaml` (Phase 3 구현 시).

## 6. 통계 옵션
| 옵션 키 | 설명 | 기본값 |
| --- | --- | --- |
| `statistics.method` | `trim_mean` / `weighted_trim_mean` | `trim_mean` |
| `statistics.trim_ratio` | 하·상위 분포 제거 비율 | 10% |
| `statistics.weight.recency` | 최근 작업 가중치 | 0.7 |
| `statistics.weight.volume` | 샘플 수 가중치 | 0.3 |
| `statistics.low_sample_threshold` | 샘플 부족 경고 기준 | 3 |

## 7. API & 프런트엔드 변경
1. **API**  
   - `/api/predict` 응답 확장: operations 배열에 통계 필드, outsourcing notes 추가.  
   - 새로운 필드 문서화(OpenAPI 업데이트).
2. **프런트엔드**  
   - 캔버스 노드: 표준/안전 시간, 표준편차, 샘플 수, 신뢰도 호버 표시.  
   - 외주 대체된 공정은 배지(예: “외주→사내”) 표시.  
   - 후보 패널: 추천 라우팅 세트별 점수 비교, 통계 요약 추가.

## 8. 품질 및 모니터링 지표
| 지표 | 설명 |
| --- | --- |
| Precision@K (공정 일치율) | 추천 라우팅 공정이 실제 적용 사례와 얼마나 일치하는지 |
| 시간 예측 오차 | RUN/SETUP 실제 vs 추천 값 MAE/RMSE |
| 외주→사내 대체율 | 외주 공정이 사내 공정으로 전환된 비율 |
| 데이터 품질 알림 | ROUTING/WORK 데이터 결측·샘플 부족 감지 |

## 9. 구현 일정 (Phase 2 기준)
1. 설계 승인 (당일)  
2. 캐시/데이터 페치 모듈 프로토타입 (1~2일)  
3. 통계 계산 모듈 및 정책 적용 코드 (1일)  
4. API 응답 확장 및 단위테스트 (1일)  
5. 프런트엔드 시각화 설계 리뷰 (병행)  
6. Phase 3에서 본 구현 및 QA 진행

---
- 작성자: Codex ML  
- 작성일: 2025-10-21  
- 비고: `.claude/WORKFLOW_DIRECTIVES.md`에 따라 Phase 2 완료 후 체크리스트 및 Monitor 빌드 시퀀스 업데이트 예정.
