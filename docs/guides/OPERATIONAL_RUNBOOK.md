# Operational Runbook - Routing ML Platform
**Version**: 1.0
**Date**: 2025-10-09
**Scope**: Day-to-day operations, monitoring, and troubleshooting

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Daily Operations](#daily-operations)
3. [Monitoring & Alerts](#monitoring--alerts)
4. [Common Tasks](#common-tasks)
5. [Troubleshooting](#troubleshooting)
6. [Incident Response](#incident-response)
7. [Maintenance Procedures](#maintenance-procedures)
8. [Escalation Procedures](#escalation-procedures)

---

## System Overview

### Architecture

```
┌─────────────┐
│   Users     │
└──────┬──────┘
       │
┌──────▼──────┐
│   Nginx     │  (Reverse Proxy, SSL Termination)
│  Load LB    │
└──────┬──────┘
       │
   ┌───┴───┬────────────┬──────────┐
   │       │            │          │
┌──▼──┐ ┌──▼──┐    ┌────▼───┐  ┌──▼──────┐
│Front│ │Front│    │Backend │  │Prometheus│
│ end │ │ end │    │  API   │  │ Grafana  │
│  1  │ │  2  │    └────┬───┘  └──────────┘
└─────┘ └─────┘         │
                    ┌───▼────┐
                    │Database│
                    │  + DB  │
                    └────────┘
```

### Components

| Component | Port | Purpose | Health Check |
|-----------|------|---------|--------------|
| Nginx | 80, 443 | Reverse proxy, SSL | `curl https://routing.example.com` |
| Backend API | 8000 | FastAPI application | `curl http://localhost:8000/health` |
| Frontend (Home) | 3000 | Integrated dashboard (HTTPS) | `curl -k https://localhost:3000 --head` |
| Frontend (Prediction) | 3001 | React app (prediction UI) | `curl http://localhost:3001` |
| Prometheus | 9090 | Metrics collection | `curl http://localhost:9090/-/healthy` |
| Grafana | 3003 | Metrics visualization | `curl http://localhost:3003/api/health` |
| Database | 5432 | PostgreSQL/MSSQL/Access | Check via backend API |

### Key Directories

```
/opt/routing-ml/
├── models/               # Trained models
│   ├── default/         # Active production model
│   ├── registry.db      # Model registry database
│   └── <versions>/      # Versioned models
├── logs/                # Application logs
├── backups/             # Database & model backups
├── .env                 # Environment configuration
└── docker-compose.prod.yml
```

---

## Daily Operations

### Morning Health Check (9:00 AM)

```bash
#!/bin/bash
# daily-health-check.sh

echo "=== Routing ML Daily Health Check ===" echo "Date: $(date)"
echo

# 1. Check service status
echo "1. Service Status:"
docker-compose -f /opt/routing-ml/docker-compose.prod.yml ps

# 2. Check disk space
echo -e "\n2. Disk Usage:"
df -h | grep -E "(Filesystem|/opt)"

# 3. Check memory
echo -e "\n3. Memory Usage:"
free -h

# 4. Check API health
echo -e "\n4. API Health:"
curl -s http://localhost:8000/health | jq

# 5. Check recent errors
echo -e "\n5. Recent Errors (last hour):"
docker-compose -f /opt/routing-ml/docker-compose.prod.yml logs --since 1h \
  | grep -i "error\|critical\|exception" | wc -l

echo -e "\n6. Database Connections:"
docker exec routing-ml-backend python -c "
from backend.database import get_connection_pool_stats
print(get_connection_pool_stats())
"

echo -e "\n=== Health Check Complete ==="
```

**Run**: `bash /opt/routing-ml/daily-health-check.sh`

**Expected**: All services "Up", disk <80%, no critical errors

---

### Review Metrics Dashboard (Daily)

1. Open Grafana: `https://routing.example.com:3003`
2. Login: admin / `<grafana-password>`
3. Review dashboards:
   - **Routing ML Overview**: Overall system health
   - **Model Training Metrics**: Training job status
   - **API Performance**: Response times, error rates

**Key Metrics to Check**:
- API response time: <200ms (95th percentile)
- Error rate: <1%
- Prediction accuracy: >90%
- Active database connections: <80% of pool
- Disk usage: <80%
- CPU usage: <70% average

**Action if abnormal**: Investigate logs, check alerts, escalate if needed

---

### Check Backup Status (Daily)

```bash
# Verify last backup
ls -lht /backups/routing-ml/ | head -5

# Expected: Backups from last 24 hours

# Check backup size (should be consistent)
du -sh /backups/routing-ml/db_*.sql | tail -5
du -sh /backups/routing-ml/models_*.tar.gz | tail -5

# Test backup integrity (weekly)
pg_restore --list /backups/routing-ml/db_$(date +%Y%m%d)_*.sql | head -10
```

**Action if missing**: Check cron job, disk space, backup script logs

---

## Monitoring & Alerts

### Alert Levels

| Level | Response Time | Examples |
|-------|--------------|----------|
| **P1 (Critical)** | <15 min | API down, database unavailable, authentication failing |
| **P2 (High)** | <1 hour | High error rate (>5%), slow response times (>500ms), model training failures |
| **P3 (Medium)** | <4 hours | Cache issues, non-critical API errors, disk space warning (>70%) |
| **P4 (Low)** | <1 day | Deprecation warnings, minor performance degradation |

### Alert Channels

- **Slack**: `#routing-ml-alerts` (all levels)
- **Email**: `ops-team@example.com` (P1, P2)
- **PagerDuty**: On-call engineer (P1 only)

### Key Alerts

#### 1. Backend API Down

**Alert**: "Routing ML Backend API Down"
**Trigger**: Health check fails for >2 minutes
**Severity**: P1 (Critical)

**Response**:
```bash
# Check service status
docker-compose -f /opt/routing-ml/docker-compose.prod.yml ps

# Check logs
docker-compose logs routing-ml-backend --tail=100

# Restart if needed
docker-compose restart routing-ml-backend

# Verify
curl http://localhost:8000/health
```

---

#### 2. High Error Rate

**Alert**: "Routing ML High Error Rate (>5%)"
**Trigger**: Error rate >5% for >5 minutes
**Severity**: P2 (High)

**Response**:
```bash
# Check error logs
docker-compose logs routing-ml-backend --since 10m | grep -i "error\|exception"

# Check specific endpoint errors
curl http://localhost:9090/api/v1/query?query='rate(http_requests_total{status=~"5.."}[5m])'

# Common causes:
# - Database connection issues
# - Model loading failures
# - Authentication problems

# Mitigation:
# - Restart backend if memory leak
# - Scale up if resource exhaustion
# - Check database connectivity
```

---

#### 3. Model Training Failure

**Alert**: "Model Training Job Failed"
**Trigger**: Training status = "failed"
**Severity**: P2 (High)

**Response**:
```bash
# Get training status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/trainer/status | jq

# Check training logs
docker-compose logs routing-ml-backend | grep -i "training\|trainer"

# Check model directory
ls -la /opt/routing-ml/models/<version>/

# Common causes:
# - Insufficient disk space
# - Invalid training data
# - Permission issues
# - Database query timeout

# Mitigation:
# - Check disk space: df -h
# - Verify data quality: SELECT COUNT(*) FROM routing_data
# - Check permissions: ls -la /opt/routing-ml/models/
# - Increase timeout if needed
```

---

#### 4. Database Connection Pool Exhausted

**Alert**: "Database Connection Pool >90%"
**Trigger**: Active connections >90% of pool for >5 minutes
**Severity**: P2 (High)

**Response**:
```bash
# Check connection stats
docker exec routing-ml-backend python -c "
from backend.database import get_connection_pool_stats
print(get_connection_pool_stats())
"

# Check slow queries
docker exec database psql -U routing_ml -c "
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '30 seconds'
ORDER BY duration DESC;
"

# Mitigation:
# - Restart backend to release connections
# - Increase pool size (update DATABASE_POOL_SIZE env var)
# - Kill long-running queries if safe
# - Scale out backend instances
```

---

#### 5. Disk Space Warning

**Alert**: "Disk Space >80%"
**Trigger**: Disk usage >80%
**Severity**: P3 (Medium)

**Response**:
```bash
# Check disk usage
df -h

# Find large files
du -sh /opt/routing-ml/* | sort -h | tail -10

# Common cleanup:
# - Old model versions: rm -rf /opt/routing-ml/models/old-version-*
# - Old logs: find /opt/routing-ml/logs -type f -mtime +30 -delete
# - Old backups: find /backups/routing-ml -type f -mtime +30 -delete
# - Docker cleanup: docker system prune -a --volumes -f

# Verify
df -h
```

---

## Common Tasks

### 1. Deploy New Model

```bash
# 1. Train new model (via UI or CLI)
curl -X POST http://localhost:8000/api/trainer/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version_label": "production-v2",
    "dry_run": false
  }'

# 2. Monitor training status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/trainer/status | jq

# 3. Verify model artifacts
ls -la /opt/routing-ml/models/production-v2/
cat /opt/routing-ml/models/production-v2/metrics.json | jq

# 4. Test predictions with new model
curl -X POST http://localhost:8000/api/routing/predict \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "item_code": "TEST_ITEM",
    "context": {},
    "model_version": "production-v2"
  }'

# 5. Activate new model (update registry)
docker exec routing-ml-backend python -c "
from backend.maintenance.model_registry import set_active_version
set_active_version('production-v2')
"

# 6. Verify active version
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/trainer/status | jq '.latest_version'

# 7. Invalidate cache to force reload
docker-compose restart routing-ml-backend
```

---

### 2. View Model Metrics

```bash
# List all trained models with metrics
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/trainer/history | jq

# View specific model metrics
cat /opt/routing-ml/models/production-v2/metrics.json | jq

# Expected output:
{
  "generated_at": "2025-10-09T12:00:00+00:00",
  "model_version": "production-v2",
  "training_samples": 1500,
  "dataset_stats": {
    "total_samples": 1500,
    "unique_items": 120,
    "unique_processes": 45
  },
  "training_duration_sec": 3.5,
  "accuracy": 0.92,
  "precision_weighted": 0.89,
  "recall_weighted": 0.91,
  "f1_weighted": 0.90
}
```

---

### 3. Invalidate Model Cache

```bash
# Method 1: Restart backend (full cache clear)
docker-compose restart routing-ml-backend

# Method 2: Touch manifest.json (mtime-based refresh)
touch /opt/routing-ml/models/default/manifest.json

# Wait 2-3 seconds for auto-reload
sleep 3

# Verify cache refreshed
docker-compose logs routing-ml-backend | grep -i "manifest\|cache" | tail -5
```

---

### 4. Rotate Logs

```bash
# Manual log rotation
docker-compose logs routing-ml-backend > \
  /opt/routing-ml/logs/backend-$(date +%Y%m%d).log

# Truncate current logs
: > $(docker inspect --format='{{.LogPath}}' routing-ml-backend)

# Automated (via logrotate)
cat > /etc/logrotate.d/routing-ml << 'EOF'
/var/lib/docker/containers/*/*.log {
  daily
  rotate 14
  compress
  delaycompress
  missingok
  notifempty
  copytruncate
}
EOF
```

---

### 5. Scale Services

```bash
# Scale frontend instances (horizontal)
docker-compose -f /opt/routing-ml/docker-compose.prod.yml \
  up -d --scale frontend-training=3

# Verify
docker-compose ps | grep frontend-training

# Scale backend (vertical - increase resources)
# Edit docker-compose.prod.yml:
services:
  routing-ml-backend:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G

# Apply changes
docker-compose -f /opt/routing-ml/docker-compose.prod.yml up -d

# Verify resource limits
docker stats routing-ml-backend
```

---

### 6. Update Environment Variables

```bash
# 1. Edit .env file
nano /opt/routing-ml/.env

# Example: Change JWT expiry
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=7200  # 2 hours

# 2. Restart affected services
docker-compose restart routing-ml-backend

# 3. Verify new config loaded
docker exec routing-ml-backend python -c "
from backend.api.config import get_settings
settings = get_settings()
print(f'JWT Expiry: {settings.jwt_access_token_expire_minutes} minutes')
"
```

---

## Troubleshooting

### Problem: Predictions returning wrong results

**Symptoms**: Predictions not matching expected process routes

**Diagnosis**:
```bash
# Check active model version
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/trainer/status | jq '.latest_version'

# Check model artifacts
ls -la /opt/routing-ml/models/default/

# Verify model manifest
cat /opt/routing-ml/models/default/manifest.json | jq

# Check feature weights
cat /opt/routing-ml/models/default/feature_weights.json | jq '.weights'
```

**Solutions**:
1. **Wrong model loaded**: Activate correct model via registry
2. **Model corrupted**: Retrain model or restore from backup
3. **Data drift**: Retrain with recent data
4. **Feature mismatch**: Check training data columns match prediction input

---

### Problem: Training UI not loading

**Symptoms**: Blank page, React errors in browser console

**Diagnosis**:
```bash
# Check frontend service
docker-compose ps | grep frontend-training

# Check frontend logs
docker-compose logs frontend-training --tail=100

# Check browser console (F12)
# Look for: CORS errors, 401 Unauthorized, network errors

# Check backend API accessibility
curl -I https://api.routing.example.com/health
```

**Solutions**:
1. **CORS error**: Add frontend domain to CORS_ALLOWED_ORIGINS
2. **401 Unauthorized**: Check authentication token, session expired
3. **Frontend service down**: Restart frontend container
4. **Backend API unreachable**: Check nginx routing, backend service status

---

### Problem: metrics.json not generated

**Symptoms**: New model trained but metrics.json file missing

**Diagnosis**:
```bash
# Check model directory
ls -la /opt/routing-ml/models/new-version/

# Check training logs
docker-compose logs routing-ml-backend | grep -i "metrics\|training"

# Check how model was trained
cat /opt/routing-ml/models/new-version/training_request.json | jq
```

**Root Cause**:
- CLI training bypasses metrics collection (only API includes metrics)
- Metrics collection failed (non-critical, logged as warning)

**Solutions**:
1. **Use API training**: Train via `/api/trainer/run` endpoint, not CLI
2. **Manual metrics generation**:
   ```python
   from backend.api.services.model_metrics import save_model_metrics
   from pathlib import Path

   metrics = {
       "training_samples": 1500,
       "dataset_stats": {...},
       "training_duration_sec": 3.5
   }
   save_model_metrics(Path('./models/new-version'), metrics, overwrite=True)
   ```
3. **Check logs for warnings**: Non-critical failures logged, don't abort training

---

### Problem: Cache not invalidating

**Symptoms**: Manifest changes not reflected, stale predictions

**Diagnosis**:
```bash
# Check manifest mtime
stat /opt/routing-ml/models/default/manifest.json

# Check last cache refresh
docker-compose logs routing-ml-backend | grep -i "manifest\|cache" | tail -10

# Check if backend restarted recently
docker inspect routing-ml-backend | jq '.[0].State.StartedAt'
```

**Solutions**:
1. **Wait for auto-refresh**: mtime-based, checks every request (usually <2s)
2. **Force refresh**: Touch manifest file or restart backend
3. **Manual invalidate**: Use Python to call invalidate() method (if exposed)
4. **Verify mtime updated**: `touch` command updates mtime

---

## Incident Response

### Incident Severity Classification

| Severity | Impact | Response |
|----------|--------|----------|
| **SEV-1** | Production completely down, all users affected | Immediate response, all hands on deck |
| **SEV-2** | Major functionality broken, significant user impact | 15-minute response, primary team |
| **SEV-3** | Minor functionality broken, limited user impact | 1-hour response, individual engineer |
| **SEV-4** | No immediate impact, cosmetic issues | Next business day |

### SEV-1: Production Down

**Incident**: Complete production outage

**Response Procedure**:

1. **Acknowledge** (0-5 min):
   ```bash
   # Notify team
   slack-cli post -c routing-ml-incidents "SEV-1: Production down. Investigating."

   # Check service status
   docker-compose ps
   curl https://api.routing.example.com/health
   ```

2. **Diagnose** (5-10 min):
   ```bash
   # Check logs for errors
   docker-compose logs --tail=200 | grep -i "error\|critical"

   # Check resource usage
   docker stats --no-stream
   df -h
   free -h

   # Check database
   docker exec database pg_isready
   ```

3. **Mitigate** (10-15 min):
   ```bash
   # Quick restart
   docker-compose restart routing-ml-backend

   # If still down, rollback
   git checkout tags/v1.0-stable
   docker-compose down && docker-compose up -d

   # If database issue, restore from backup
   psql $DATABASE_URL < /backups/routing-ml/db_latest.sql
   ```

4. **Communicate** (throughout):
   - Update Slack every 5 minutes
   - Post status page update
   - Notify stakeholders

5. **Resolve & Document**:
   - Verify production restored
   - Document root cause
   - Create post-mortem ticket
   - Schedule blameless post-mortem meeting

---

### SEV-2: Major Functionality Broken

**Examples**: Model training failures, authentication issues, high error rates

**Response Procedure**:

1. **Assess Impact** (0-15 min):
   - How many users affected?
   - Which functionality broken?
   - Workaround available?

2. **Communicate** (15 min):
   - Post incident in Slack
   - Update status page if public-facing

3. **Fix** (15-60 min):
   - Apply hotfix if available
   - Restart affected services
   - Rollback if necessary

4. **Verify** (60+ min):
   - Test affected functionality
   - Monitor for recurrence
   - Update stakeholders

---

## Maintenance Procedures

### Weekly Maintenance (Every Sunday 2 AM)

```bash
#!/bin/bash
# weekly-maintenance.sh

# 1. Update system packages
apt-get update && apt-get upgrade -y

# 2. Docker cleanup
docker system prune -a --volumes -f

# 3. Rotate old logs
find /opt/routing-ml/logs -type f -mtime +30 -delete

# 4. Clean old backups
find /backups/routing-ml -type f -mtime +30 -delete

# 5. Vacuum database
docker exec database psql -U routing_ml -c "VACUUM ANALYZE;"

# 6. Check SSL certificate expiry
certbot certificates

# 7. Restart services (brief downtime)
docker-compose -f /opt/routing-ml/docker-compose.prod.yml restart

# 8. Verify services
sleep 30
curl https://api.routing.example.com/health
```

**Schedule**: `0 2 * * 0 /opt/routing-ml/weekly-maintenance.sh`

---

### Monthly Maintenance (First Sunday)

1. **Review Deferred Tasks**: Evaluate P2-3, P2-4, P2-5 for implementation
2. **Performance Analysis**: Review Grafana metrics, identify optimization opportunities
3. **Security Updates**: Update dependencies, apply security patches
4. **Backup Testing**: Restore from backup to test environment
5. **Documentation Update**: Update runbook with new procedures
6. **Capacity Planning**: Review growth trends, plan scaling

---

## Escalation Procedures

### Level 1: On-Call Engineer

**Scope**: Handle P3/P4 incidents, routine operations
**Response Time**: <1 hour
**Contact**: PagerDuty rotation

### Level 2: Senior Engineer

**Scope**: Handle P2 incidents, complex issues
**Response Time**: <15 minutes
**Contact**: Direct call/SMS
**Escalate When**:
- Unable to resolve P3 within 2 hours
- P2 incident declared

### Level 3: Engineering Manager

**Scope**: Handle P1 incidents, critical decisions
**Response Time**: <10 minutes
**Contact**: Phone (24/7)
**Escalate When**:
- P1 incident (production down)
- P2 incident unresolved after 1 hour
- Need rollback decision

### Level 4: CTO / VP Engineering

**Scope**: Business-critical decisions, major outages
**Response Time**: Immediate
**Contact**: Phone (24/7)
**Escalate When**:
- Multi-hour outage
- Data breach or security incident
- Customer contract SLA violation

---

## Appendix

### Useful Commands Cheat Sheet

```bash
# Service management
docker-compose ps                  # List services
docker-compose restart <service>   # Restart service
docker-compose logs -f <service>   # Follow logs

# Health checks
curl http://localhost:8000/health  # Backend health
curl http://localhost:9090/-/healthy  # Prometheus

# Monitoring
docker stats                       # Resource usage
df -h                             # Disk usage
free -h                           # Memory usage

# Database
docker exec database psql -U routing_ml -c "SELECT COUNT(*) FROM routing_data;"

# Model management
ls -la /opt/routing-ml/models/    # List models
cat models/<version>/metrics.json | jq  # View metrics

# Backups
ls -lht /backups/routing-ml/ | head  # Recent backups
```

### Contact Information

| Role | Name | Email | Phone | Slack |
|------|------|-------|-------|-------|
| On-Call Engineer | Rotation | oncall@example.com | PagerDuty | @oncall |
| Senior Engineer | John Doe | john@example.com | +1-555-0100 | @john |
| Engineering Manager | Jane Smith | jane@example.com | +1-555-0200 | @jane |
| DevOps Lead | Bob Johnson | bob@example.com | +1-555-0300 | @bob |

### External Resources

- **Documentation**: https://docs.routing.example.com
- **Grafana**: https://routing.example.com:3003
- **Status Page**: https://status.routing.example.com
- **GitHub**: https://github.com/example/routing-ml
- **Slack**: #routing-ml-ops

---

**Document Version**: 1.0
**Last Updated**: 2025-10-09
**Next Review**: 2025-11-09
