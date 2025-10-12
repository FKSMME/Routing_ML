# Monitoring Dashboard Guide

## Overview

This guide explains how to set up comprehensive monitoring for the Routing ML system using Prometheus and Grafana. The monitoring stack provides real-time visibility into system health, performance, and user activity.

## Architecture

```
┌────────────────┐
│  Routing ML    │ ──metrics──> ┌────────────┐
│  Backend       │               │ Prometheus │
│  :8000         │               │ :9090      │
└────────────────┘               └────────────┘
                                        │
                                        │ scrape
                                        ▼
                                 ┌────────────┐
                                 │  Grafana   │
                                 │  :3000     │
                                 └────────────┘
```

## Quick Start

### 1. Start Prometheus

**docker-compose.monitoring.yml**:
```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: routing-ml-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: routing-ml-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources
    networks:
      - monitoring
    depends_on:
      - prometheus

networks:
  monitoring:
    driver: bridge

volumes:
  prometheus_data:
  grafana_data:
```

**prometheus.yml**:
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Routing ML Backend
  - job_name: 'routing_ml'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/metrics'

  # Data Quality Metrics
  - job_name: 'routing_ml_data_quality'
    scrape_interval: 5m
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/data-quality/prometheus'

  # Prometheus itself
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

### 2. Start Monitoring Stack

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

### 3. Access Dashboards

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)

## Available Metrics

### System Metrics (/metrics)

| Metric | Type | Description |
|--------|------|-------------|
| `routing_ml_process_cpu_percent` | Gauge | Process CPU usage (%) |
| `routing_ml_process_memory_mb` | Gauge | Process memory (MB) |
| `routing_ml_process_threads` | Gauge | Number of threads |
| `routing_ml_system_cpu_percent` | Gauge | System CPU (%) |
| `routing_ml_system_memory_percent` | Gauge | System memory (%) |
| `routing_ml_system_disk_percent` | Gauge | System disk (%) |
| `routing_ml_uptime_seconds` | Counter | Uptime (seconds) |
| `routing_ml_info` | Gauge | Version info |

### Data Quality Metrics (/data-quality/prometheus)

| Metric | Type | Description |
|--------|------|-------------|
| `data_quality_score` | Gauge | Overall quality score (0-100) |
| `data_quality_total_items` | Gauge | Total items in database |
| `data_quality_completeness_ratio` | Gauge | Completeness ratio (0-1) |
| `data_quality_duplicate_count` | Gauge | Number of duplicates |
| `data_quality_outlier_count` | Gauge | Number of outliers |

## Grafana Dashboard Configuration

### Dashboard JSON

Create `grafana/dashboards/routing-ml.json`:

```json
{
  "dashboard": {
    "title": "Routing ML System Dashboard",
    "panels": [
      {
        "title": "CPU Usage",
        "targets": [
          {
            "expr": "routing_ml_process_cpu_percent",
            "legendFormat": "Process CPU"
          },
          {
            "expr": "routing_ml_system_cpu_percent",
            "legendFormat": "System CPU"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Memory Usage",
        "targets": [
          {
            "expr": "routing_ml_process_memory_mb",
            "legendFormat": "Process Memory (MB)"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Data Quality Score",
        "targets": [
          {
            "expr": "data_quality_score",
            "legendFormat": "Quality Score"
          }
        ],
        "type": "gauge",
        "fieldConfig": {
          "defaults": {
            "min": 0,
            "max": 100,
            "thresholds": {
              "steps": [
                {"value": 0, "color": "red"},
                {"value": 50, "color": "yellow"},
                {"value": 80, "color": "green"}
              ]
            }
          }
        }
      },
      {
        "title": "System Uptime",
        "targets": [
          {
            "expr": "routing_ml_uptime_seconds / 3600",
            "legendFormat": "Uptime (hours)"
          }
        ],
        "type": "stat"
      }
    ],
    "refresh": "30s"
  }
}
```

### Datasource Configuration

Create `grafana/datasources/prometheus.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

## Alert Rules

### Prometheus Alert Rules

Create `prometheus-alerts.yml`:

```yaml
groups:
  - name: routing_ml_alerts
    interval: 30s
    rules:
      # High CPU usage
      - alert: HighCPUUsage
        expr: routing_ml_process_cpu_percent > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage detected"
          description: "Process CPU usage is {{ $value }}%"

      # High memory usage
      - alert: HighMemoryUsage
        expr: routing_ml_process_memory_mb > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Process memory is {{ $value }} MB"

      # Low data quality
      - alert: LowDataQuality
        expr: data_quality_score < 50
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "Data quality score below threshold"
          description: "Quality score is {{ $value }}"

      # Service down
      - alert: ServiceDown
        expr: up{job="routing_ml"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Routing ML service is down"
          description: "Service has been down for 1 minute"
```

Update `prometheus.yml`:
```yaml
rule_files:
  - 'prometheus-alerts.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

## Alertmanager Configuration

**alertmanager.yml**:
```yaml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@ksm.co.kr'
  smtp_auth_username: 'alerts@ksm.co.kr'
  smtp_auth_password: 'your-password'

route:
  group_by: ['alertname', 'cluster']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'email'

receivers:
  - name: 'email'
    email_configs:
      - to: 'devops@ksm.co.kr'
        headers:
          Subject: '[ALERT] {{ .GroupLabels.alertname }}'
```

## Custom Metrics

### Adding Application Metrics

```python
# backend/api/routes/prediction.py
from prometheus_client import Counter, Histogram, Gauge

# Request counter
prediction_requests = Counter(
    'routing_ml_prediction_requests_total',
    'Total prediction requests',
    ['status']
)

# Latency histogram
prediction_latency = Histogram(
    'routing_ml_prediction_latency_seconds',
    'Prediction latency',
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0]
)

# Active predictions gauge
active_predictions = Gauge(
    'routing_ml_active_predictions',
    'Number of active predictions'
)

@router.post("/predict")
async def predict_route(item_code: str):
    with prediction_latency.time():
        active_predictions.inc()
        try:
            result = await perform_prediction(item_code)
            prediction_requests.labels(status='success').inc()
            return result
        except Exception as e:
            prediction_requests.labels(status='error').inc()
            raise
        finally:
            active_predictions.dec()
```

## Querying Metrics

### Prometheus Query Examples

```promql
# Average CPU over 5 minutes
avg_over_time(routing_ml_process_cpu_percent[5m])

# Memory growth rate
rate(routing_ml_process_memory_mb[5m])

# Request rate
rate(routing_ml_prediction_requests_total[1m])

# 95th percentile latency
histogram_quantile(0.95, rate(routing_ml_prediction_latency_seconds_bucket[5m]))

# Error rate
rate(routing_ml_prediction_requests_total{status="error"}[5m])
  / rate(routing_ml_prediction_requests_total[5m])
```

## Grafana Dashboard Panels

### 1. System Health Panel

```json
{
  "title": "System Health",
  "targets": [
    {
      "expr": "up{job='routing_ml'}",
      "legendFormat": "Service Status"
    }
  ],
  "type": "stat",
  "options": {
    "colorMode": "background",
    "graphMode": "none",
    "textMode": "value_and_name"
  }
}
```

### 2. Request Rate Panel

```json
{
  "title": "Request Rate (req/s)",
  "targets": [
    {
      "expr": "rate(routing_ml_prediction_requests_total[1m])",
      "legendFormat": "Requests/sec"
    }
  ],
  "type": "graph"
}
```

### 3. Error Rate Panel

```json
{
  "title": "Error Rate (%)",
  "targets": [
    {
      "expr": "rate(routing_ml_prediction_requests_total{status='error'}[5m]) / rate(routing_ml_prediction_requests_total[5m]) * 100",
      "legendFormat": "Error %"
    }
  ],
  "type": "graph",
  "yaxes": [
    {"format": "percent", "max": 100}
  ]
}
```

## Production Deployment

### AWS CloudWatch Integration

```python
# backend/api/middleware/cloudwatch.py
import boto3
from datetime import datetime

cloudwatch = boto3.client('cloudwatch', region_name='us-east-1')

def send_metric(metric_name: str, value: float, unit: str = 'None'):
    """Send custom metric to CloudWatch."""
    cloudwatch.put_metric_data(
        Namespace='RoutingML',
        MetricData=[
            {
                'MetricName': metric_name,
                'Value': value,
                'Unit': unit,
                'Timestamp': datetime.utcnow()
            }
        ]
    )
```

### Datadog Integration

```python
# pip install datadog
from datadog import initialize, statsd

initialize(
    api_key='your-api-key',
    app_key='your-app-key'
)

# Send metrics
statsd.increment('routing_ml.predictions')
statsd.histogram('routing_ml.latency', 0.45)
statsd.gauge('routing_ml.memory', 245.8)
```

## Monitoring Checklist

- [ ] Prometheus scraping backend metrics every 15s
- [ ] Grafana dashboard configured with 6+ panels
- [ ] Alert rules configured (CPU, memory, quality, uptime)
- [ ] Alertmanager sending emails to devops team
- [ ] Custom application metrics implemented
- [ ] Dashboard accessible to operations team
- [ ] Historical data retention configured (30 days minimum)
- [ ] Backup Grafana dashboards to Git

## Troubleshooting

### Metrics Not Appearing

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Test metrics endpoint
curl http://localhost:8000/metrics

# Check Prometheus logs
docker logs routing-ml-prometheus
```

### High Cardinality Issues

Avoid labels with high cardinality (user IDs, request IDs):

```python
# ❌ Bad (high cardinality)
counter.labels(user_id=user.id).inc()

# ✅ Good (low cardinality)
counter.labels(user_type='premium').inc()
```

## Additional Resources

- **Prometheus Documentation**: https://prometheus.io/docs/
- **Grafana Dashboards**: https://grafana.com/grafana/dashboards/
- **PromQL Guide**: https://prometheus.io/docs/prometheus/latest/querying/basics/
