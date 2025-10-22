# Metrics Dashboard Spec (401 & Prediction Telemetry)

**작성자**: Codex  
**작성일**: 2025-10-22  
**범위**: Prometheus/Grafana 기반 Routing-ML 운영 대시보드 업데이트

---

## 1. 지표 소스
- FastAPI middleware → `record_request_metrics` 호출로 수집된 메트릭  
  - `routing_ml_auth_401_total` (counter)  
  - `routing_ml_prediction_401_total` (counter)  
  - `routing_ml_auth_401_endpoint_total{endpoint=""}` (counter)  
  - `routing_ml_request_duration_ms_average{endpoint=""}` (gauge)
- 시스템 지표(기존): `routing_ml_process_cpu_percent`, `routing_ml_process_memory_mb`, 등

---

## 2. Grafana 패널 설계

### Panel A – 인증 401 누적 카운트
- **PromQL**: `increase(routing_ml_auth_401_total[5m])`
- **시각화**: Bar gauge (5분 증가량)
- **알람**: 동일 쿼리 5분 평균 > 15 시 Slack `#routing-alert`

### Panel B – 예측 API 401 비중
- **PromQL**:  
  ```
  sum(increase(routing_ml_prediction_401_total[5m]))
    /
  sum(increase(routing_ml_auth_401_total[5m]))
  ```
- **시각화**: Stat (percentage)
- **Threshold**: > 0.6 시 주황, > 0.8 시 빨강

### Panel C – 엔드포인트별 401 Hotspot
- **PromQL**: `topk(5, increase(routing_ml_auth_401_endpoint_total[15m]))`
- **시각화**: Table (endpoint, count)
- **용도**: 특정 API에 집중된 인증 실패 추적

### Panel D – 평균 응답 시간 (예측)
- **PromQL**: `routing_ml_request_duration_ms_average{endpoint="/api/predict"}`
- **시각화**: Time series (line)
- **알람**: 95th percentile > 2500ms (15분 연속) 시 Slack

### Panel E – 전체 요청 평균 응답 시간 Top5
- **PromQL**:
  ```
  topk(5,
    routing_ml_request_duration_ms_average
  )
  ```
- **시각화**: Bar chart

---

## 3. Grafana 템플릿 변수
- `env`: `{prod,staging,dev}` – Prometheus label `environment`
- `job`: 기본값 `routing_ml`
- `endpoint`: Regex 변환 → 패널 C/E에서 사용자 선택 가능

---

## 4. Alert Rules (Prometheus)

| Rule | Expr | For | Severity | Action |
| --- | --- | --- | --- | --- |
| `RoutingMLAuth401Spike` | `increase(routing_ml_auth_401_total[5m]) > 15` | 5m | warning | Slack 알림 + Runbook 링크 |
| `RoutingMLPredictLatencyHigh` | `routing_ml_request_duration_ms_average{endpoint="/api/predict"} > 2500` | 15m | critical | Slack & Pager |
| `RoutingMLPredict401Dominance` | `sum(increase(routing_ml_prediction_401_total[10m])) / sum(increase(routing_ml_auth_401_total[10m])) > 0.7` | 10m | warning | Slack 요약 |

Runbook: `/docs/runbooks/routing_ml_auth.md` (업데이트 예정)

---

## 5. 배포 절차
1. Prometheus 대상: `backend/api/routes/metrics.py` 변경 배포 후 5분 내 신규 메트릭 노출 확인.  
2. Grafana: 위 패널/알람을 포함한 대시보드 JSON export → `monitoring/dashboards/routing_ml.json` 저장.  
3. 알람 룰: Prometheus rules 파일 `prometheus/rules/routing_ml_rules.yaml` 에 추가 후 재로드.

---


## 6. MSSQL 지연·실패 추이 템플릿

### 6.1 수집 지표 (새 Exporter)
- `routing_ml_mssql_query_duration_seconds{view="item"}` (histogram/bucket)
- `routing_ml_mssql_query_failures_total{view="item"}` (counter)
- 구현: MSSQL 헬스체크(예: `backend/database.get_database_info`) 호출부에 계측 래퍼 추가 → Prometheus exporter 등록

### 6.2 Panel F – MSSQL 조회 지연
- **PromQL**: `avg_over_time(routing_ml_mssql_query_duration_seconds_sum{view="$view"}[1h]) / avg_over_time(routing_ml_mssql_query_duration_seconds_count{view="$view"}[1h])`
- **시각화**: Time series (view별)
- **Threshold**: 5초 경고, 8초 심각

### 6.3 Panel G – MSSQL 실패율
- **PromQL**:
```
increase(routing_ml_mssql_query_failures_total{view="$view"}[1h])
  /
(increase(routing_ml_mssql_query_duration_seconds_count{view="$view"}[1h]) + 1e-6)
```
- **시각화**: Stat (percentage)
- **Alert**: 1시간 실패율 >2% (warning), >5% (critical)

### 6.4 템플릿 작업 지침
- Grafana: `monitoring/dashboards/routing_ml.json` 에 새 row 추가, `$view` 템플릿(`item`,`routing`,`work_result`,`purchase_order`) 제공
- Placeholder 데이터: Prometheus `prometheus/testdata/mssql_latency.prom` 작성 후 로컬에서 패널 검증

---

## 6. 체크리스트 매핑
- Metrics & Instrumentation 항목 중 “401 응답 카운트/응답시간 템플릿” 완료 증빙.
- 알람 기준·대시보드 정의와 함께 운영팀 인수인계 필요.
