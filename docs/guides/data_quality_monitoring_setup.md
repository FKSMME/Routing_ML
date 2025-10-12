# 데이터 품질 모니터링 설치 가이드

## 📋 개요

이 문서는 Routing ML v4 프로젝트의 데이터 품질 모니터링 시스템 설치 및 설정 방법을 설명합니다.

**목적**: 데이터 완전성, 중복, 이상치, 형식 오류를 실시간으로 모니터링하여 데이터 품질을 유지합니다.

**구성 요소**:
- 데이터 품질 메트릭 수집 서비스 (Python)
- Prometheus (메트릭 저장)
- Grafana (대시보드 시각화)
- FastAPI 엔드포인트 (JSON/Prometheus 형식)

---

## 🎯 주요 기능

### 측정 메트릭

1. **완전성 (Completeness)**
   - 필수 필드가 모두 입력된 품목 비율
   - 필드별 결측치 수 (재질, 품목유형, 치수, 도면번호)

2. **중복 (Duplicates)**
   - 동일한 속성을 가진 중복 품목 수
   - 중복 도면번호 수

3. **이상치 (Outliers)**
   - 비정상적인 치수 값 (평균 ± 3σ 벗어난 값)
   - 치수 이상치 품목 수

4. **형식 오류 (Invalid Formats)**
   - 표준 형식을 따르지 않는 데이터
   - 특수문자만으로 구성된 필드 등

5. **변경 추적**
   - 최근 24시간 추가/수정/삭제된 품목 수

6. **품질 점수**
   - 전체 데이터 품질을 0-100 점수로 표현
   - 가중 평균: 완전성 40% + 중복없음 20% + 이상치없음 20% + 형식정확성 20%

---

## 🚀 설치 및 설정

### 1. 백엔드 구성 요소 확인

이미 구현된 파일들:
```
backend/api/services/data_quality_service.py  # 메트릭 수집 서비스
backend/api/routes/data_quality.py            # FastAPI 엔드포인트
backend/api/app.py                            # 라우터 등록 완료
```

### 2. Prometheus 설치 (온프레미스)

**Ubuntu/Debian**:
```bash
# Prometheus 다운로드
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz

# 압축 해제
tar xvfz prometheus-2.45.0.linux-amd64.tar.gz
cd prometheus-2.45.0.linux-amd64

# 설정 파일 수정
cat > prometheus.yml <<EOF
global:
  scrape_interval: 5m
  evaluation_interval: 5m

scrape_configs:
  - job_name: 'routing_ml_data_quality'
    scrape_interval: 5m
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/api/data-quality/prometheus'
EOF

# Prometheus 실행
./prometheus --config.file=prometheus.yml
```

**Docker (권장)**:
```bash
# prometheus.yml 파일 생성 (위와 동일)

# Docker로 실행
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

**확인**:
- http://localhost:9090 접속
- Status > Targets 메뉴에서 `routing_ml_data_quality` 상태 확인
- 초록색 "UP" 표시되면 정상

### 3. Grafana 설치 (온프레미스)

**Ubuntu/Debian**:
```bash
# GPG 키 추가
sudo apt-get install -y software-properties-common
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -

# 저장소 추가
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"

# 설치
sudo apt-get update
sudo apt-get install grafana

# 서비스 시작
sudo systemctl start grafana-server
sudo systemctl enable grafana-server
```

**Docker (권장)**:
```bash
docker run -d \
  --name grafana \
  -p 3000:3000 \
  grafana/grafana
```

**초기 설정**:
1. http://localhost:3000 접속
2. 기본 로그인: `admin` / `admin`
3. 비밀번호 변경 요청 시 새 비밀번호 설정

### 4. Grafana 데이터소스 설정

1. 좌측 메뉴 > Configuration > Data Sources
2. "Add data source" 클릭
3. "Prometheus" 선택
4. URL: `http://localhost:9090` (Docker인 경우 `http://prometheus:9090`)
5. "Save & Test" 클릭 → "Data source is working" 확인

### 5. Grafana 대시보드 임포트

**방법 1: JSON 파일 직접 임포트**:
```bash
# 대시보드 JSON 파일 위치
/workspaces/Routing_ML_4/monitoring/grafana/data-quality-dashboard.json
```

1. 좌측 메뉴 > Dashboards > Import
2. "Upload JSON file" 클릭
3. `data-quality-dashboard.json` 선택
4. Prometheus 데이터소스 선택
5. "Import" 클릭

**방법 2: curl로 API 사용**:
```bash
curl -X POST \
  http://localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d @monitoring/grafana/data-quality-dashboard.json
```

---

## 📊 대시보드 구성

### 패널 설명

1. **데이터 품질 점수 (Gauge)**
   - 전체 품질 점수 (0-100)
   - 임계값: 🔴 <50, 🟠 50-70, 🟡 70-85, 🟢 ≥85

2. **완전성 비율 (Gauge)**
   - 필수 필드가 모두 입력된 품목 비율
   - 임계값: 🔴 <60%, 🟠 60-80%, 🟡 80-90%, 🟢 ≥90%

3. **품목 수 추이 (Time Series)**
   - 총 품목 수 vs 불완전 품목 수
   - 시간별 변화 추이

4. **데이터 이슈 추이 (Stacked Bars)**
   - 중복 품목 수
   - 치수 이상치 수

5. **최근 변경 사항 (Line Chart)**
   - 최근 24시간 추가된 품목 수
   - 실시간 변경 추적

6. **통계 카드 (Stat Panels)**
   - 총 품목 수
   - 불완전 품목
   - 중복 품목
   - 치수 이상치

---

## 🔌 API 엔드포인트

### 1. 품질 메트릭 조회 (JSON)

```bash
curl http://localhost:8000/api/data-quality/metrics
```

**응답 예시**:
```json
{
  "timestamp": "2025-10-06T05:45:00",
  "total_items": 1250,
  "complete_items": 1100,
  "incomplete_items": 150,
  "completeness_rate": 0.88,
  "missing_material_code": 50,
  "missing_part_type": 30,
  "missing_dimensions": 70,
  "quality_score": 84.5,
  "duplicate_items": 5,
  "outlier_dimensions": 3,
  "items_added_24h": 12
}
```

### 2. 품질 보고서 조회 (상세)

```bash
curl http://localhost:8000/api/data-quality/report
```

**응답 예시**:
```json
{
  "report_id": "DQR_20251006_054500",
  "generated_at": "2025-10-06T05:45:00",
  "metrics": { /* ... 메트릭 데이터 ... */ },
  "issues": [
    {
      "issue_id": "MISSING_MATERIAL_20251006054500",
      "severity": "high",
      "category": "missing",
      "description": "재질 코드가 누락된 품목이 50개 있습니다",
      "affected_items": 50,
      "sample_item_ids": [123, 456, 789, 101, 202],
      "detected_at": "2025-10-06T05:45:00",
      "recommendation": "재질 코드를 표준 코드로 입력해주세요 (STS, AL, SM 등)"
    }
  ],
  "recommendations": [
    "📝 필수 필드(재질, 품목유형, 치수) 입력을 완료해주세요.",
    "✅ 데이터 품질이 양호합니다. 현재 상태를 유지해주세요."
  ]
}
```

### 3. Prometheus 메트릭 (텍스트)

```bash
curl http://localhost:8000/api/data-quality/prometheus
```

**응답 예시**:
```
# HELP data_quality_score Data quality score (0-100)
# TYPE data_quality_score gauge
data_quality_score 84.5

# HELP data_completeness_rate Data completeness rate (0-1)
# TYPE data_completeness_rate gauge
data_completeness_rate 0.88

# HELP data_total_items Total number of items
# TYPE data_total_items gauge
data_total_items 1250
```

---

## ⚙️ 알림 설정 (Grafana Alerts)

### 품질 점수 하락 알림

1. Grafana 대시보드 > 품질 점수 패널 > Edit
2. Alert 탭 선택
3. "Create Alert" 클릭

**알림 조건**:
```
WHEN avg() OF query(A, 5m, now) IS BELOW 70
```

**알림 채널**:
- 이메일
- Slack (온프레미스 Slack 인스턴스)
- 웹훅

**예시 (Slack)**:
```bash
# Grafana > Alerting > Notification channels
Name: Slack - Data Quality
Type: Slack
Webhook URL: https://your-onprem-slack.com/services/hooks/...
Username: Grafana Bot
```

---

## 📈 사용 시나리오

### 시나리오 1: 일일 품질 체크

**목표**: 매일 아침 데이터 품질 상태 확인

1. Grafana 대시보드 접속 (http://localhost:3000)
2. "Routing ML - 데이터 품질 대시보드" 선택
3. 품질 점수가 70점 미만이면 조치 필요

**조치 방법**:
```bash
# 품질 보고서 조회
curl http://localhost:8000/api/data-quality/report | jq .

# 이슈 목록 확인
# severity가 "critical" 또는 "high"인 항목 우선 처리
```

### 시나리오 2: 주간 품질 보고서 생성

**목표**: 매주 월요일 경영진에게 보고

```bash
# 품질 보고서 JSON 다운로드
curl http://localhost:8000/api/data-quality/report > weekly_report_$(date +%Y%m%d).json

# 주요 지표 추출
jq '.metrics | {quality_score, completeness_rate, total_items, incomplete_items}' weekly_report_*.json
```

### 시나리오 3: 데이터 정제 작업 계획

**목표**: 품질 이슈를 우선순위별로 해결

1. 보고서에서 이슈 추출:
```bash
curl http://localhost:8000/api/data-quality/report | jq '.issues | sort_by(.severity) | reverse'
```

2. 샘플 품목 ID로 문제 확인:
```bash
# 예: sample_item_ids = [123, 456, 789]
curl http://localhost:8000/api/items/123
```

3. 수정 후 재측정:
```bash
# 수정 완료 후 메트릭 재확인
curl http://localhost:8000/api/data-quality/metrics
```

---

## 🔍 문제 해결

### Prometheus가 메트릭을 수집하지 않음

**증상**: Grafana에 데이터가 표시되지 않음

**해결**:
1. Prometheus targets 확인:
   ```bash
   curl http://localhost:9090/api/v1/targets
   ```

2. FastAPI 서버 확인:
   ```bash
   curl http://localhost:8000/api/data-quality/prometheus
   ```

3. 네트워크 연결 확인:
   ```bash
   telnet localhost 8000
   ```

### Grafana 대시보드가 비어있음

**증상**: 패널에 "No data" 표시

**해결**:
1. 데이터소스 연결 확인:
   - Configuration > Data Sources > Prometheus > "Test" 클릭

2. 쿼리 수동 실행:
   - Explore 메뉴 > Prometheus 선택
   - 쿼리: `data_quality_score` 입력 > "Run query"

3. 시간 범위 확인:
   - 대시보드 우측 상단 시간 범위를 "Last 6 hours"로 설정

### 메트릭 수집이 느림

**증상**: 대시보드 업데이트가 지연됨

**해결**:
1. Prometheus scrape 간격 조정:
   ```yaml
   scrape_configs:
     - job_name: 'routing_ml_data_quality'
       scrape_interval: 1m  # 5m → 1m로 단축
   ```

2. 데이터베이스 인덱스 확인:
   - `Item` 테이블의 인덱스 상태 확인
   - 필요 시 인덱스 추가

---

## 📝 유지보수

### 정기 작업

**매일**:
- 품질 점수 확인 (목표: ≥80)
- critical/high severity 이슈 처리

**매주**:
- 주간 품질 보고서 생성
- 추세 분석 (개선/악화 여부)

**매월**:
- 메트릭 수집 성능 점검
- Prometheus 디스크 사용량 확인 (retention 정책 조정)

### 백업

**Grafana 대시보드**:
```bash
# 대시보드 JSON 백업
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/dashboards/uid/routing_ml_data_quality \
  > backup_dashboard_$(date +%Y%m%d).json
```

**Prometheus 데이터**:
```bash
# 데이터 디렉토리 백업
tar czf prometheus_data_$(date +%Y%m%d).tar.gz /path/to/prometheus/data
```

---

## 🎓 참고 자료

- **Prometheus 공식 문서**: https://prometheus.io/docs/
- **Grafana 공식 문서**: https://grafana.com/docs/
- **FastAPI 공식 문서**: https://fastapi.tiangolo.com/

---

**작성자**: ML Team
**최종 업데이트**: 2025-10-06
**버전**: 1.0.0
