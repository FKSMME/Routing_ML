# Production Monitoring Setup Guide

**Project**: Routing ML System
**Date**: 2025-10-09
**Status**: 🚀 Production Ready Implementation Guide

---

## 📊 Overview

This guide provides step-by-step instructions for implementing the monitoring infrastructure documented in [MONITORING_DASHBOARD.md](./MONITORING_DASHBOARD.md) in a real production environment.

### Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Routing ML App │────▶│  Prometheus  │────▶│   Grafana   │
│  (Backend API)  │     │  (Metrics)   │     │ (Dashboard) │
└─────────────────┘     └──────────────┘     └─────────────┘
         │                      │                     │
         │                      │                     │
         ▼                      ▼                     ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   JSON Logs     │────▶│     Loki     │────▶│   Grafana   │
│  (Application)  │     │  (Log Agg)   │     │   (Logs)    │
└─────────────────┘     └──────────────┘     └─────────────┘
         │                                            │
         │                                            │
         ▼                                            ▼
┌─────────────────────────────────────────────────────────┐
│              Alertmanager (Alerts & Notifications)      │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Prerequisites

### Infrastructure Requirements
- **OS**: Ubuntu 22.04 LTS or RHEL 8+
- **RAM**: Minimum 8GB (16GB recommended)
- **Disk**: 100GB+ SSD
- **Network**: Ports 3000 (Grafana), 9090 (Prometheus), 8000 (Backend API)

### Software Requirements
- Docker 24.0+ & Docker Compose 2.20+
- (Optional) Kubernetes 1.28+ for K8s deployment

### Access Requirements
- SSH access to production server
- Sudo/root privileges for initial setup
- SMTP credentials for email alerts (optional)
- Slack webhook URL for Slack alerts (optional)

---

## 📦 Step 1: Deploy Prometheus

### 1.1 Create Prometheus Configuration

**File**: `/opt/monitoring/prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'routing-ml-production'
    environment: 'production'

# Alertmanager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

# Load rules once and periodically evaluate them
rule_files:
  - "/etc/prometheus/rules/*.yml"

# Scrape configurations
scrape_configs:
  # Routing ML Backend API
  - job_name: 'routing-ml-backend'
    static_configs:
      - targets:
          - 'backend:8000'
    metrics_path: '/metrics'
    scrape_interval: 10s
    scrape_timeout: 5s
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        replacement: 'routing-ml-backend'

  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets:
          - 'localhost:9090'

  # Node exporter (system metrics)
  - job_name: 'node-exporter'
    static_configs:
      - targets:
          - 'node-exporter:9100'

  # Docker container metrics (cAdvisor)
  - job_name: 'cadvisor'
    static_configs:
      - targets:
          - 'cadvisor:8080'
```

### 1.2 Create Alert Rules

**File**: `/opt/monitoring/prometheus/rules/routing-ml-alerts.yml`

```yaml
groups:
  - name: routing_ml_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          rate(routing_ml_http_requests_total{status=~"5.."}[5m])
          / rate(routing_ml_http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
          component: backend
        annotations:
          summary: "High error rate detected"
          description: "{{ $labels.instance }} has error rate above 5% (current: {{ $value | humanizePercentage }})"

      # High response time
      - alert: HighResponseTime
        expr: |
          histogram_quantile(0.95,
            rate(routing_ml_http_request_duration_seconds_bucket[5m])
          ) > 2
        for: 5m
        labels:
          severity: warning
          component: backend
        annotations:
          summary: "High API response time"
          description: "95th percentile response time is {{ $value }}s (threshold: 2s)"

      # High CPU usage
      - alert: HighCPUUsage
        expr: routing_ml_process_cpu_percent > 80
        for: 10m
        labels:
          severity: warning
          component: system
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is {{ $value }}% (threshold: 80%)"

      # High memory usage
      - alert: HighMemoryUsage
        expr: routing_ml_process_memory_mb > 2048
        for: 10m
        labels:
          severity: warning
          component: system
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}MB (threshold: 2048MB)"

      # Service down
      - alert: ServiceDown
        expr: up{job="routing-ml-backend"} == 0
        for: 1m
        labels:
          severity: critical
          component: backend
        annotations:
          summary: "Routing ML backend is down"
          description: "Backend service has been down for more than 1 minute"

      # High disk usage
      - alert: HighDiskUsage
        expr: routing_ml_system_disk_percent > 85
        for: 5m
        labels:
          severity: warning
          component: system
        annotations:
          summary: "High disk usage"
          description: "Disk usage is {{ $value }}% (threshold: 85%)"

      # Training job failures
      - alert: TrainingJobFailures
        expr: |
          rate(routing_ml_training_jobs_total{status="failed"}[1h]) > 0.1
        for: 5m
        labels:
          severity: warning
          component: training
        annotations:
          summary: "High training job failure rate"
          description: "Training jobs failing at {{ $value }} per second"

      # Prediction latency
      - alert: HighPredictionLatency
        expr: |
          histogram_quantile(0.95,
            rate(routing_ml_prediction_duration_seconds_bucket[5m])
          ) > 0.5
        for: 5m
        labels:
          severity: warning
          component: prediction
        annotations:
          summary: "High prediction latency"
          description: "95th percentile prediction time is {{ $value }}s (threshold: 0.5s)"
```

### 1.3 Deploy Prometheus with Docker Compose

**File**: `/opt/monitoring/docker-compose.prometheus.yml`

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:v2.48.0
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus/rules:/etc/prometheus/rules:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
      - '--web.enable-lifecycle'
    networks:
      - monitoring

  node-exporter:
    image: prom/node-exporter:v1.7.0
    container_name: node-exporter
    restart: unless-stopped
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - monitoring

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:v0.47.0
    container_name: cadvisor
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    networks:
      - monitoring

volumes:
  prometheus-data:

networks:
  monitoring:
    external: true
```

**Deploy**:
```bash
# Create network
docker network create monitoring

# Deploy Prometheus stack
cd /opt/monitoring
docker-compose -f docker-compose.prometheus.yml up -d

# Verify
docker-compose ps
curl http://localhost:9090/-/healthy
```

---

## 📊 Step 2: Deploy Grafana

### 2.1 Deploy Grafana with Docker Compose

**File**: `/opt/monitoring/docker-compose.grafana.yml`

```yaml
version: '3.8'

services:
  grafana:
    image: grafana/grafana-oss:10.2.0
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=${GRAFANA_ADMIN_USER:-admin}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-changeme}
      - GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource
      - GF_SERVER_ROOT_URL=https://monitoring.routing-ml.example.com
      - GF_SMTP_ENABLED=${SMTP_ENABLED:-false}
      - GF_SMTP_HOST=${SMTP_HOST:-smtp.gmail.com:587}
      - GF_SMTP_USER=${SMTP_USER}
      - GF_SMTP_PASSWORD=${SMTP_PASSWORD}
      - GF_SMTP_FROM_ADDRESS=${SMTP_FROM:-monitoring@routing-ml.com}
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - ./grafana/dashboards:/var/lib/grafana/dashboards:ro
    networks:
      - monitoring

volumes:
  grafana-data:

networks:
  monitoring:
    external: true
```

### 2.2 Provision Prometheus Data Source

**File**: `/opt/monitoring/grafana/provisioning/datasources/prometheus.yml`

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
    jsonData:
      timeInterval: "15s"
      httpMethod: POST
```

### 2.3 Provision Dashboard

**File**: `/opt/monitoring/grafana/provisioning/dashboards/dashboards.yml`

```yaml
apiVersion: 1

providers:
  - name: 'Routing ML Dashboards'
    orgId: 1
    folder: 'Routing ML'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```

### 2.4 Import Dashboard JSON

Copy the dashboard JSON from [MONITORING_DASHBOARD.md](./MONITORING_DASHBOARD.md) to:
**File**: `/opt/monitoring/grafana/dashboards/routing-ml-dashboard.json`

### 2.5 Deploy Grafana

**Environment File**: `/opt/monitoring/.env`

```bash
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=SecurePassword123!

# SMTP (optional - for email alerts)
SMTP_ENABLED=true
SMTP_HOST=smtp.gmail.com:587
SMTP_USER=monitoring@routing-ml.com
SMTP_PASSWORD=app-specific-password
SMTP_FROM=monitoring@routing-ml.com
```

**Deploy**:
```bash
cd /opt/monitoring
docker-compose -f docker-compose.grafana.yml up -d

# Verify
docker-compose ps
curl http://localhost:3000/api/health
```

**Access**: `http://your-server:3000`
- Username: `admin`
- Password: (from `.env` file)

---

## 🔔 Step 3: Deploy Alertmanager

### 3.1 Create Alertmanager Configuration

**File**: `/opt/monitoring/alertmanager/alertmanager.yml`

```yaml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@routing-ml.com'
  smtp_auth_username: 'alerts@routing-ml.com'
  smtp_auth_password: 'app-specific-password'

# Alert routing
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'team-routing-ml'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      continue: true
    - match:
        severity: warning
      receiver: 'warning-alerts'

# Alert receivers
receivers:
  - name: 'team-routing-ml'
    email_configs:
      - to: 'team@routing-ml.com'
        headers:
          Subject: '[Routing ML] {{ .GroupLabels.alertname }}'
        html: |
          <h3>Alert: {{ .GroupLabels.alertname }}</h3>
          <p><strong>Summary:</strong> {{ .CommonAnnotations.summary }}</p>
          <p><strong>Description:</strong> {{ .CommonAnnotations.description }}</p>
          <p><strong>Severity:</strong> {{ .CommonLabels.severity }}</p>

  - name: 'critical-alerts'
    slack_configs:
      - api_url: '{{ SLACK_WEBHOOK_URL }}'
        channel: '#routing-ml-critical'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        text: |
          *Summary:* {{ .CommonAnnotations.summary }}
          *Description:* {{ .CommonAnnotations.description }}
          *Severity:* {{ .CommonLabels.severity }}

    email_configs:
      - to: 'oncall@routing-ml.com'
        headers:
          Subject: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'

  - name: 'warning-alerts'
    slack_configs:
      - api_url: '{{ SLACK_WEBHOOK_URL }}'
        channel: '#routing-ml-alerts'
        title: '⚠️  WARNING: {{ .GroupLabels.alertname }}'
        text: |
          *Summary:* {{ .CommonAnnotations.summary }}
          *Description:* {{ .CommonAnnotations.description }}

# Inhibition rules (suppress certain alerts)
inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'cluster', 'service']
```

### 3.2 Deploy Alertmanager

**File**: `/opt/monitoring/docker-compose.alertmanager.yml`

```yaml
version: '3.8'

services:
  alertmanager:
    image: prom/alertmanager:v0.26.0
    container_name: alertmanager
    restart: unless-stopped
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
      - alertmanager-data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    networks:
      - monitoring

volumes:
  alertmanager-data:

networks:
  monitoring:
    external: true
```

**Deploy**:
```bash
# Replace placeholder with actual Slack webhook
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
envsubst < alertmanager/alertmanager.yml.template > alertmanager/alertmanager.yml

cd /opt/monitoring
docker-compose -f docker-compose.alertmanager.yml up -d

# Verify
curl http://localhost:9093/-/healthy
```

---

## 📝 Step 4: Configure Application Metrics

### 4.1 Update Backend Environment Variables

**File**: `/opt/routing-ml/.env` (production)

```bash
# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_TO_FILE=true

# Metrics endpoint (already implemented)
# Endpoint: http://backend:8000/metrics
# No additional config needed
```

### 4.2 Verify Metrics Endpoint

```bash
# Check metrics endpoint
curl http://localhost:8000/metrics

# Expected output (Prometheus format):
# routing_ml_process_cpu_percent 12.5
# routing_ml_process_memory_mb 256.3
# routing_ml_http_requests_total{method="GET",status="200"} 1234
# ...
```

### 4.3 Restart Application with Monitoring

```bash
cd /opt/routing-ml
docker-compose restart backend

# Verify backend is exposing metrics
docker-compose exec backend curl http://localhost:8000/metrics
```

---

## 🔍 Step 5: Set Up Log Aggregation (Optional - Loki)

### 5.1 Deploy Loki

**File**: `/opt/monitoring/docker-compose.loki.yml`

```yaml
version: '3.8'

services:
  loki:
    image: grafana/loki:2.9.0
    container_name: loki
    restart: unless-stopped
    ports:
      - "3100:3100"
    volumes:
      - ./loki/loki-config.yml:/etc/loki/local-config.yaml:ro
      - loki-data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    networks:
      - monitoring

  promtail:
    image: grafana/promtail:2.9.0
    container_name: promtail
    restart: unless-stopped
    volumes:
      - ./promtail/promtail-config.yml:/etc/promtail/config.yml:ro
      - /var/log:/var/log:ro
      - /opt/routing-ml/logs:/routing-ml-logs:ro
    command: -config.file=/etc/promtail/config.yml
    networks:
      - monitoring

volumes:
  loki-data:

networks:
  monitoring:
    external: true
```

**Loki Config**: `/opt/monitoring/loki/loki-config.yml`

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
  chunk_idle_period: 5m
  chunk_retain_period: 30s

schema_config:
  configs:
    - from: 2024-01-01
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: true
  retention_period: 720h  # 30 days
```

**Promtail Config**: `/opt/monitoring/promtail/promtail-config.yml`

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: routing-ml-logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: routing-ml
          __path__: /routing-ml-logs/*.log
    pipeline_stages:
      - json:
          expressions:
            timestamp: timestamp
            level: level
            message: message
            logger: logger
      - labels:
          level:
          logger:
      - timestamp:
          source: timestamp
          format: RFC3339Nano
```

**Deploy**:
```bash
cd /opt/monitoring
docker-compose -f docker-compose.loki.yml up -d

# Add Loki data source to Grafana (manual step in UI)
# URL: http://loki:3100
```

---

## ✅ Step 6: Verification & Testing

### 6.1 Check All Services

```bash
cd /opt/monitoring

# Check Prometheus
curl http://localhost:9090/-/healthy
curl http://localhost:9090/api/v1/query?query=up

# Check Grafana
curl http://localhost:3000/api/health

# Check Alertmanager
curl http://localhost:9093/-/healthy

# Check Loki (if deployed)
curl http://localhost:3100/ready
```

### 6.2 Test Alert Rules

```bash
# Trigger test alert (simulate high CPU)
curl -X POST http://localhost:8000/api/test/simulate-high-cpu

# Check Prometheus alerts
curl http://localhost:9090/api/v1/alerts

# Check Alertmanager
curl http://localhost:9093/api/v1/alerts
```

### 6.3 Verify Dashboard

1. Open Grafana: `http://your-server:3000`
2. Login with admin credentials
3. Navigate to "Dashboards" → "Routing ML"
4. Verify all panels show data
5. Check for any "No Data" errors

### 6.4 Test Alerting

**Trigger Critical Alert** (service down):
```bash
# Stop backend service
cd /opt/routing-ml
docker-compose stop backend

# Wait 2 minutes
# Check Slack/Email for alert notification

# Restart backend
docker-compose start backend
```

---

## 🔄 Step 7: Regular Maintenance

### 7.1 Backup Configuration

```bash
#!/bin/bash
# /opt/monitoring/scripts/backup-monitoring.sh

BACKUP_DIR="/opt/backups/monitoring"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

# Backup Prometheus data
docker run --rm -v prometheus-data:/data -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/prometheus-$DATE.tar.gz -C /data .

# Backup Grafana data
docker run --rm -v grafana-data:/data -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/grafana-$DATE.tar.gz -C /data .

# Backup configuration files
tar czf $BACKUP_DIR/config-$DATE.tar.gz /opt/monitoring/prometheus /opt/monitoring/grafana /opt/monitoring/alertmanager

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR"
```

**Cron Job**:
```bash
# Daily backup at 2 AM
0 2 * * * /opt/monitoring/scripts/backup-monitoring.sh >> /var/log/monitoring-backup.log 2>&1
```

### 7.2 Update Monitoring Stack

```bash
cd /opt/monitoring

# Pull latest images
docker-compose pull

# Restart with new images
docker-compose up -d

# Verify
docker-compose ps
```

### 7.3 Monitor Prometheus Storage

```bash
# Check Prometheus data size
docker exec prometheus du -sh /prometheus

# If storage > 80%, increase retention or add more disk
```

---

## 📞 Step 8: Alert Channels Setup

### 8.1 Slack Integration

**Create Slack App**:
1. Go to https://api.slack.com/apps
2. Create new app → "From scratch"
3. App name: "Routing ML Alerts"
4. Enable "Incoming Webhooks"
5. Create webhook for `#routing-ml-alerts` channel
6. Copy webhook URL

**Update Alertmanager**:
```yaml
# alertmanager/alertmanager.yml
receivers:
  - name: 'slack-alerts'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#routing-ml-alerts'
        title: '{{ .GroupLabels.alertname }}'
```

### 8.2 Email Integration (Gmail)

**Create App Password**:
1. Google Account → Security → 2-Step Verification
2. App passwords → Generate
3. Copy 16-character password

**Update Alertmanager**:
```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@routing-ml.com'
  smtp_auth_username: 'alerts@routing-ml.com'
  smtp_auth_password: 'your-app-specific-password'
```

### 8.3 PagerDuty Integration (Optional)

**Get Integration Key**:
1. PagerDuty → Services → New Service
2. Integration: Prometheus
3. Copy integration key

**Update Alertmanager**:
```yaml
receivers:
  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: 'your-integration-key'
        severity: 'critical'
```

---

## 🎯 Success Criteria

### Monitoring Checklist

- [ ] Prometheus collecting metrics from backend (verify `/metrics` endpoint)
- [ ] Grafana dashboard showing all panels with data
- [ ] Alert rules loaded in Prometheus (check `/alerts` page)
- [ ] Alertmanager receiving and routing alerts
- [ ] Slack/Email notifications working (test alert sent)
- [ ] Loki collecting logs (optional)
- [ ] Daily backups configured
- [ ] Monitoring documented in runbook

---

## 📚 Related Documents

- [MONITORING_DASHBOARD.md](./MONITORING_DASHBOARD.md) - Dashboard JSON and queries
- [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) - Application deployment
- [SECURITY_BEST_PRACTICES.md](./SECURITY_BEST_PRACTICES.md) - Security guidelines

---

**Status**: ✅ Ready for Production Deployment
**Estimated Setup Time**: 4-6 hours
**Maintenance**: Monthly updates, daily backups
