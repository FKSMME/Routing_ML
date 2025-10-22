# Operator Manual: Routing ML Iterative Training System

**Document ID**: OPERATOR_MANUAL_2025-10-22_routing-ml-iterative
**Version**: 1.0
**Created**: 2025-10-22
**Audience**: System Operators, DevOps, Site Reliability Engineers

**Related Documents**:
- User Guide: [deliverables/USER_GUIDE_2025-10-22_routing-ml-iterative.md](USER_GUIDE_2025-10-22_routing-ml-iterative.md)
- Deployment Runbook: [deliverables/DEPLOYMENT_RUNBOOK_2025-10-22_routing-ml-iterative.md](DEPLOYMENT_RUNBOOK_2025-10-22_routing-ml-iterative.md)
- QA Report: [deliverables/QA_REPORT_2025-10-22_routing-ml-iterative.md](QA_REPORT_2025-10-22_routing-ml-iterative.md)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Monitoring & Alerts](#3-monitoring--alerts)
4. [Troubleshooting](#4-troubleshooting)
5. [Emergency Procedures](#5-emergency-procedures)
6. [Rollback Procedures](#6-rollback-procedures)
7. [Maintenance Tasks](#7-maintenance-tasks)
8. [Performance Tuning](#8-performance-tuning)
9. [Security](#9-security)
10. [Runbook](#10-runbook)

---

## 1. System Overview

### 1.1 Purpose

The Routing ML Iterative Training System provides:
- Automated quality monitoring for ML prediction accuracy
- Automatic model retraining when quality degrades
- Seamless model deployment with zero downtime
- Comprehensive logging and alerting

### 1.2 Components

| Component | Technology | Location | Port | Status Endpoint |
|-----------|-----------|----------|------|-----------------|
| FastAPI Backend | Python 3.10+ | `backend/` | 8000 | `/health` |
| React Frontend | React 18 + Vite | `frontend-prediction/` | 5173 | `/` |
| Database | MSSQL | K3-DB/KsmErp | 1433 | N/A |
| Training Worker | Python multiprocessing | `backend/iter_training/` | N/A | `/api/training/jobs` |
| Model Storage | File system | `models/` | N/A | `/api/models/versions` |
| Log Files | File system | `logs/`, `deliverables/` | N/A | N/A |

### 1.3 Key Directories

```
Routing_ML_251014/
├── backend/
│   ├── api/               # FastAPI routes
│   ├── iter_training/     # Training modules
│   ├── quality_evaluator.py
│   └── predictor_ml.py
├── frontend-prediction/
│   ├── src/
│   │   ├── components/    # React components
│   │   └── store/         # Zustand stores
│   └── tests/e2e/         # Playwright tests
├── models/                # ML model storage
│   ├── default/           # Active model
│   ├── version_*/         # Versioned models
│   └── manifest.json      # Model metadata
├── data/
│   ├── training_jobs/     # Training job state
│   └── retraining_queue.json
├── logs/
│   └── performance/       # Performance logs
├── deliverables/
│   └── quality_reports/   # Quality reports
└── config/
    └── iter_training.yaml # Configuration
```

---

## 2. Architecture

### 2.1 Request Flow

```
User Browser
    ↓
React Frontend (Port 5173)
    ↓ HTTP/WebSocket
FastAPI Backend (Port 8000)
    ↓
┌─────────────┬─────────────┬─────────────┐
│  Database   │   Models    │   Logs      │
│  (MSSQL)    │(File System)│(File System)│
└─────────────┴─────────────┴─────────────┘
```

### 2.2 Quality Evaluation Workflow

```
1. QualityEvaluator.sample()
   ↓ Query BI_ITEM_INFO_VIEW
2. QualityEvaluator.predict()
   ↓ Call predictor_ml.predict_items()
3. QualityEvaluator.evaluate()
   ↓ Query BI_WORK_ORDER_RESULTS
4. QualityEvaluator.calculate_metrics()
   ↓ Compute MAE, Process Match, etc.
5. QualityEvaluator.log_results()
   ↓ Save to logs/ and deliverables/
6. Check thresholds → Trigger retraining?
```

### 2.3 Training Workflow

```
1. POST /api/training/start
   ↓
2. TrainingQueue.enqueue(job)
   ↓ Check queue capacity (max 3)
3. TrainingWorker.start_training()
   ↓ Launch multiprocessing.Process
4. Background Process:
   a. Sample items
   b. Train models (Baseline, MLP, Stacking)
   c. Compare models (select best)
   d. Deploy model (with backup)
   ↓
5. ModelDeployer.save_model()
   ↓ Save to models/version_*/
6. ModelDeployer.activate_version()
   ↓ Update manifest.json
7. ModelDeployer.invalidate_cache()
   ↓ Clear prediction cache
```

---

## 3. Monitoring & Alerts

### 3.1 Health Checks

**Backend Health**:
```bash
# Check API health
curl http://localhost:8000/health

# Expected Response:
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-10-22T14:30:15Z"
}
```

**Database Health**:
```bash
# Test database connection
curl http://localhost:8000/api/db/health

# Expected Response:
{
  "database": "connected",
  "server": "K3-DB",
  "database_name": "KsmErp"
}
```

**Training Worker Health**:
```bash
# Check worker status
curl http://localhost:8000/api/training/jobs

# Expected Response:
{
  "jobs": [...],
  "total": 5,
  "running": 1,
  "queue_size": 2
}
```

### 3.2 Key Metrics to Monitor

| Metric | Threshold | Alert Level | Action |
|--------|-----------|-------------|--------|
| API Response Time | >500ms | Warning | Investigate slow queries |
| API Response Time | >2s | Critical | Scale backend |
| MAE | >5 minutes | Warning | Monitor trend |
| MAE | >10 minutes | Critical | Trigger retraining |
| Process Match | <85% | Warning | Monitor trend |
| Process Match | <80% | Critical | Investigate data quality |
| Training Job Duration | >2 hours | Warning | Check worker logs |
| Training Job Failure Rate | >20% | Critical | Investigate errors |
| Queue Full Events | >5/day | Warning | Increase queue size |
| Database Connection Errors | >3/hour | Critical | Check database |

### 3.3 Log Files

**Location**: `logs/performance/`

**File**: `performance.quality.log`

**Format**:
```
[2025-10-22 14:30:15] INFO: Quality evaluation started (cycle_123)
[2025-10-22 14:30:25] INFO: MAE = 4.2 minutes (✅ within threshold)
[2025-10-22 14:30:30] WARNING: CV = 0.35 (⚠️ approaching threshold 0.3)
[2025-10-22 14:30:35] ERROR: Prediction failed for item_12345 (timeout)
```

**Monitoring**:
```bash
# Tail logs in real-time
tail -f logs/performance/performance.quality.log

# Filter errors
grep ERROR logs/performance/performance.quality.log

# Count errors per hour
grep ERROR logs/performance/performance.quality.log | grep "2025-10-22 14:" | wc -l
```

### 3.4 Alert Configuration

**Prometheus Metrics** (if configured):
```yaml
# Metrics exposed at /metrics
routing_ml_quality_mae_minutes: Current MAE value
routing_ml_quality_process_match_percent: Process match percentage
routing_ml_training_jobs_total: Total training jobs (by status)
routing_ml_training_duration_seconds: Training job duration
routing_ml_queue_size: Current queue size
routing_ml_api_request_duration_seconds: API request latency
```

**Alert Rules** (Prometheus/Grafana):
```yaml
# High MAE Alert
- alert: HighMAE
  expr: routing_ml_quality_mae_minutes > 10
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "MAE exceeds critical threshold (10 minutes)"

# Training Job Failed
- alert: TrainingJobFailed
  expr: increase(routing_ml_training_jobs_total{status="FAILED"}[1h]) > 2
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Multiple training jobs failed in last hour"
```

---

## 4. Troubleshooting

### 4.1 Backend Not Responding

**Symptoms**:
- API returns 502 Bad Gateway
- Frontend shows "Connection refused"
- Health check fails

**Diagnosis**:
```bash
# 1. Check if process is running
ps aux | grep uvicorn
# OR (Windows)
tasklist | findstr python

# 2. Check if port is listening
netstat -an | grep 8000
# OR (Windows)
netstat -an | findstr 8000

# 3. Check logs
tail -n 100 logs/uvicorn.log
```

**Solutions**:

**Solution 1: Restart Backend**
```bash
# Linux
pkill -f uvicorn
cd backend
source ../.venv/bin/activate
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload &

# Windows
taskkill /F /IM python.exe /FI "WINDOWTITLE eq uvicorn*"
cd backend
..\.venv\Scripts\activate
..\.venv\Scripts\python.exe -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

**Solution 2: Check Configuration**
```bash
# Verify environment variables
cat .env
# Check: DATABASE_URL, MODEL_PATH, LOG_PATH

# Verify database connection
python -c "from backend._connection_pool import get_connection; conn = get_connection(); print('Connected')"
```

**Solution 3: Check Disk Space**
```bash
# Linux
df -h

# Windows
wmic logicaldisk get size,freespace,caption

# If disk full:
# - Clean old logs: logs/performance/*.log (keep last 30 days)
# - Clean old models: models/version_* (keep last 10 versions)
# - Clean build artifacts: dist/, build/
```

### 4.2 Training Job Stuck

**Symptoms**:
- Job status = RUNNING for >2 hours
- Progress frozen at X%
- No new logs

**Diagnosis**:
```bash
# 1. Check training job state
curl http://localhost:8000/api/training/jobs/{job_id}/status

# 2. Check worker process
ps aux | grep "training_worker"
# Look for high CPU (still training) or zombie process (hung)

# 3. Check logs
tail -n 50 data/training_jobs/{job_id}/state.json
```

**Solutions**:

**Solution 1: Cancel Job**
```bash
# Via API
curl -X DELETE http://localhost:8000/api/training/jobs/{job_id}

# Via CLI
python -c "from backend.iter_training.worker import TrainingWorker; w = TrainingWorker(); w.cancel_job('{job_id}')"
```

**Solution 2: Kill Hung Process**
```bash
# Find PID
ps aux | grep {job_id}

# Kill process
kill -9 {PID}

# Windows
taskkill /F /PID {PID}
```

**Solution 3: Clean Up Job State**
```bash
# Mark job as FAILED (manual cleanup)
python scripts/cleanup_hung_job.py {job_id}
```

### 4.3 High MAE (Quality Degraded)

**Symptoms**:
- MAE suddenly increased (e.g., 4 min → 12 min)
- Process Match dropped (e.g., 90% → 70%)
- Multiple 🔴 Critical alerts

**Diagnosis**:
```bash
# 1. Check recent quality reports
ls -lt deliverables/quality_reports/cycle_*.json | head -5
cat deliverables/quality_reports/cycle_{latest}.json

# 2. Check data quality
# Query database for recent items
python scripts/check_data_quality.py --days 7

# 3. Check model version
cat models/manifest.json
# Verify: active_version, last_updated
```

**Solutions**:

**Solution 1: Trigger Manual Retraining**
```bash
# Via API
curl -X POST http://localhost:8000/api/training/start \
  -H "Content-Type: application/json" \
  -d '{"sample_size": 1000, "strategy": "stratified"}'

# Monitor progress
curl http://localhost:8000/api/training/jobs/{job_id}/status
```

**Solution 2: Rollback to Previous Model** (if recent deployment)
```bash
# Via API
curl -X POST http://localhost:8000/api/models/rollback

# Via CLI
python -c "from backend.iter_training.deployer import ModelDeployer; d = ModelDeployer(); d.rollback()"

# Verify
cat models/manifest.json
# Check: active_version changed to previous
```

**Solution 3: Investigate Data Issues**
```bash
# Check for missing work orders
python scripts/check_work_orders.py --recent 30

# Check for outliers
python scripts/analyze_outliers.py --threshold 3.0

# Check database connection
python scripts/test_db_connection.py
```

### 4.4 Queue Full Error

**Symptoms**:
- Error: "큐가 가득 찼습니다" (Queue is full)
- Cannot enqueue new training jobs

**Diagnosis**:
```bash
# Check queue status
curl http://localhost:8000/api/training/jobs | jq '.running'

# Check queue file
cat data/retraining_queue.json
```

**Solutions**:

**Solution 1: Wait for Completion**
```bash
# Monitor running jobs
watch -n 5 'curl -s http://localhost:8000/api/training/jobs | jq ".jobs[] | select(.status==\"RUNNING\")"'

# Typically 10-30 minutes per job
```

**Solution 2: Cancel Low-Priority Job**
```bash
# List jobs
curl http://localhost:8000/api/training/jobs

# Cancel oldest job
curl -X DELETE http://localhost:8000/api/training/jobs/{job_id}
```

**Solution 3: Increase Queue Size** (temporary)
```bash
# Edit config
vi config/iter_training.yaml

# Change:
queue:
  max_size: 5  # Was 3

# Restart backend for changes to take effect
pkill -f uvicorn
uvicorn backend.api.main:app --reload &
```

**Solution 4: Clean Stuck Jobs** (if queue corrupted)
```bash
# Backup queue
cp data/retraining_queue.json data/retraining_queue.json.backup

# Clean queue
python -c "import json; open('data/retraining_queue.json', 'w').write(json.dumps({'jobs': [], 'max_size': 3}))"

# Restart backend
pkill -f uvicorn && uvicorn backend.api.main:app --reload &
```

### 4.5 Prediction Errors

**Symptoms**:
- API returns 500 errors for `/api/predict`
- Frontend shows "Prediction failed"
- Logs show "Model not found" or "Feature mismatch"

**Diagnosis**:
```bash
# 1. Check model files
ls -lh models/default/
# Expected: model.pkl, vectorizer.pkl, feature_config.json

# 2. Test prediction directly
python -c "from backend.predictor_ml import predict_items_with_ml_optimized; print(predict_items_with_ml_optimized(['ITEM001']))"

# 3. Check logs
grep "prediction" logs/performance/performance.quality.log | tail -20
```

**Solutions**:

**Solution 1: Rebuild Model Cache**
```bash
# Delete cache
rm -rf models/default/.cache

# Restart backend (cache rebuilds automatically)
pkill -f uvicorn && uvicorn backend.api.main:app --reload &
```

**Solution 2: Rollback Model**
```bash
# Rollback to previous working version
python -c "from backend.iter_training.deployer import ModelDeployer; d = ModelDeployer(); d.rollback()"

# Verify prediction works
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"item_codes": ["ITEM001"]}'
```

**Solution 3: Retrain from Scratch**
```bash
# Trigger full retraining
curl -X POST http://localhost:8000/api/training/start \
  -H "Content-Type: application/json" \
  -d '{"sample_size": 2000, "strategy": "stratified", "force_retrain": true}'
```

---

## 5. Emergency Procedures

### 5.1 System Down (Complete Outage)

**Severity**: P0 - Critical

**Impact**: All prediction requests fail

**Response Time**: <15 minutes

**Procedure**:

1. **Acknowledge Incident** (0-2 min)
   ```bash
   # Post to incident channel (Slack/Teams)
   echo "INCIDENT: Routing ML system down. Investigating..."
   ```

2. **Quick Diagnostics** (2-5 min)
   ```bash
   # Check backend
   curl http://localhost:8000/health

   # Check database
   telnet K3-DB 1433

   # Check disk space
   df -h | grep -E "/$|/var|/home"
   ```

3. **Restart Services** (5-10 min)
   ```bash
   # Restart backend
   pkill -f uvicorn
   cd backend
   source ../.venv/bin/activate
   nohup uvicorn api.main:app --host 0.0.0.0 --port 8000 > ../logs/uvicorn.log 2>&1 &

   # Restart frontend (if needed)
   pkill -f vite
   cd frontend-prediction
   nohup npm run dev > ../logs/vite.log 2>&1 &
   ```

4. **Verify Recovery** (10-12 min)
   ```bash
   # Health check
   curl http://localhost:8000/health

   # Test prediction
   curl -X POST http://localhost:8000/api/predict \
     -H "Content-Type: application/json" \
     -d '{"item_codes": ["ITEM001"]}'

   # Test frontend
   curl http://localhost:5173/
   ```

5. **Post-Incident** (12-15 min)
   ```bash
   # Post recovery message
   echo "RESOLVED: System restored. Root cause analysis in progress."

   # Collect logs for analysis
   tar -czf incident_$(date +%Y%m%d_%H%M%S).tar.gz logs/
   ```

### 5.2 Database Connection Lost

**Severity**: P1 - High

**Impact**: Quality evaluation and training fail

**Response Time**: <30 minutes

**Procedure**:

1. **Verify Database Issue** (0-5 min)
   ```bash
   # Test connection
   python -c "from backend._connection_pool import get_connection; conn = get_connection(); print('Connected')"

   # Check database server
   ping K3-DB
   telnet K3-DB 1433
   ```

2. **Contact DBA** (5-10 min)
   ```bash
   # Check with database team
   # - Is database online?
   # - Any planned maintenance?
   # - Network issues?
   ```

3. **Fallback Mode** (10-20 min)
   ```bash
   # Enable mock mode (temporary)
   export USE_MOCK_DATA=true

   # Restart backend with fallback
   pkill -f uvicorn
   uvicorn backend.api.main:app --reload &

   # Frontend switches to demo mode automatically
   ```

4. **Monitor Recovery** (20-30 min)
   ```bash
   # Wait for database restore
   while ! python -c "from backend._connection_pool import get_connection; get_connection()" 2>/dev/null; do
     echo "Waiting for database..."
     sleep 30
   done

   # Disable mock mode
   unset USE_MOCK_DATA
   pkill -f uvicorn
   uvicorn backend.api.main:app --reload &
   ```

### 5.3 Disk Space Exhausted

**Severity**: P1 - High

**Impact**: Training fails, logs stop writing

**Response Time**: <20 minutes

**Procedure**:

1. **Identify Space Hog** (0-5 min)
   ```bash
   # Find largest directories
   du -h --max-depth=2 | sort -hr | head -20

   # Check specific directories
   du -sh logs/ models/ deliverables/ dist/ build/
   ```

2. **Emergency Cleanup** (5-10 min)
   ```bash
   # Clean old logs (keep last 30 days)
   find logs/ -name "*.log" -mtime +30 -delete

   # Clean old quality reports (keep last 90 days)
   find deliverables/quality_reports/ -name "cycle_*.json" -mtime +90 -delete

   # Clean build artifacts
   rm -rf dist/* build/*

   # Clean old model versions (keep last 10)
   python scripts/cleanup_old_models.py --keep 10
   ```

3. **Verify Space** (10-12 min)
   ```bash
   # Check available space
   df -h

   # Should have >10% free space
   ```

4. **Resume Operations** (12-20 min)
   ```bash
   # Restart failed jobs
   python scripts/retry_failed_jobs.py

   # Monitor disk usage
   watch -n 60 'df -h | grep -E "/$"'
   ```

---

## 6. Rollback Procedures

### 6.1 Model Rollback

**When to Rollback**:
- New model performs worse than previous (higher MAE)
- Prediction errors increased after deployment
- User reports quality degradation

**Procedure**:

1. **Check Current Version** (0-2 min)
   ```bash
   # View manifest
   cat models/manifest.json

   # Expected output:
   {
     "active_version": "version_20251022_143000",
     "previous_version": "version_20251021_120000",
     ...
   }
   ```

2. **Backup Current State** (2-4 min)
   ```bash
   # Create rollback backup
   cp models/manifest.json models/manifest.json.before_rollback
   cp -r models/default models/default.before_rollback
   ```

3. **Execute Rollback** (4-8 min)
   ```bash
   # Via API
   curl -X POST http://localhost:8000/api/models/rollback \
     -H "Authorization: Bearer {admin_token}"

   # OR via CLI
   python -c "
   from backend.iter_training.deployer import ModelDeployer
   deployer = ModelDeployer()
   result = deployer.rollback()
   print(f'Rolled back to {result[\"version\"]}')
   "
   ```

4. **Verify Rollback** (8-12 min)
   ```bash
   # Check active version
   cat models/manifest.json | jq '.active_version'

   # Test prediction
   curl -X POST http://localhost:8000/api/predict \
     -H "Content-Type: application/json" \
     -d '{"item_codes": ["ITEM001", "ITEM002"]}'

   # Check quality (wait for next evaluation cycle)
   curl http://localhost:8000/api/quality/current
   ```

5. **Document Rollback** (12-15 min)
   ```bash
   # Create incident report
   echo "Model Rollback - $(date)" > deliverables/rollback_$(date +%Y%m%d_%H%M%S).md
   echo "Rolled back from version_A to version_B" >> deliverables/rollback_*.md
   echo "Reason: [describe issue]" >> deliverables/rollback_*.md
   ```

### 6.2 Configuration Rollback

**When to Rollback**:
- Invalid configuration causes errors
- Threshold changes cause excessive retraining
- System behavior changed unexpectedly

**Procedure**:

1. **Backup Current Config** (0-2 min)
   ```bash
   cp config/iter_training.yaml config/iter_training.yaml.$(date +%Y%m%d_%H%M%S)
   ```

2. **Restore Previous Config** (2-5 min)
   ```bash
   # Find previous version
   ls -lt config/iter_training.yaml.* | head -5

   # Restore
   cp config/iter_training.yaml.20251021_120000 config/iter_training.yaml
   ```

3. **Restart Services** (5-8 min)
   ```bash
   # Restart backend (reloads config)
   pkill -f uvicorn
   uvicorn backend.api.main:app --reload &
   ```

4. **Verify Configuration** (8-10 min)
   ```bash
   # Check config loaded
   curl http://localhost:8000/api/config/current

   # Verify thresholds
   curl http://localhost:8000/api/config/thresholds
   ```

### 6.3 Full System Rollback (Git)

**When to Rollback**:
- Deployment broke system
- Code changes caused critical bugs
- Need to restore to last known good state

**Procedure**:

1. **Identify Last Good Commit** (0-5 min)
   ```bash
   # View recent commits
   git log --oneline -10

   # Identify last working commit (e.g., abc1234)
   ```

2. **Create Rollback Branch** (5-8 min)
   ```bash
   # Create emergency rollback branch
   git checkout -b rollback/emergency_$(date +%Y%m%d_%H%M%S)

   # Reset to last good commit
   git reset --hard abc1234
   ```

3. **Deploy Rollback** (8-15 min)
   ```bash
   # Stop services
   pkill -f uvicorn
   pkill -f vite

   # Reinstall dependencies (if needed)
   pip install -r requirements.txt
   cd frontend-prediction && npm install && cd ..

   # Restart services
   uvicorn backend.api.main:app --reload &
   cd frontend-prediction && npm run dev &
   ```

4. **Verify System** (15-20 min)
   ```bash
   # Health checks
   curl http://localhost:8000/health
   curl http://localhost:5173/

   # Test key workflows
   python scripts/smoke_test.py
   ```

5. **Document Rollback** (20-25 min)
   ```bash
   # Create rollback record
   echo "# Git Rollback - $(date)" > docs/rollback_$(date +%Y%m%d).md
   echo "Rolled back from commit $CURRENT to $GOOD" >> docs/rollback_*.md
   echo "Reason: [describe issue]" >> docs/rollback_*.md
   ```

---

## 7. Maintenance Tasks

### 7.1 Daily Maintenance

**Time**: 5-10 minutes/day

**Tasks**:

1. **Check System Health** (2 min)
   ```bash
   # Health checks
   curl http://localhost:8000/health

   # Check logs for errors
   grep -i error logs/performance/performance.quality.log | tail -20
   ```

2. **Review Quality Metrics** (3 min)
   ```bash
   # Check current MAE
   curl http://localhost:8000/api/quality/current | jq '.mae'

   # Check recent alerts
   curl http://localhost:8000/api/quality/alerts | jq '.[] | select(.severity=="critical")'
   ```

3. **Check Training Jobs** (2 min)
   ```bash
   # List recent jobs
   curl http://localhost:8000/api/training/jobs | jq '.jobs[] | {job_id, status, progress}'

   # Check for failed jobs
   curl http://localhost:8000/api/training/jobs | jq '.jobs[] | select(.status=="FAILED")'
   ```

### 7.2 Weekly Maintenance

**Time**: 30-60 minutes/week

**Tasks**:

1. **Clean Old Logs** (10 min)
   ```bash
   # Archive logs older than 30 days
   find logs/ -name "*.log" -mtime +30 -exec gzip {} \;

   # Move to archive
   mkdir -p logs/archive/$(date +%Y%m)
   mv logs/*.log.gz logs/archive/$(date +%Y%m)/
   ```

2. **Clean Old Models** (10 min)
   ```bash
   # List model versions
   ls -lt models/version_*

   # Keep last 10 versions, archive rest
   python scripts/cleanup_old_models.py --keep 10 --archive
   ```

3. **Review Performance** (15 min)
   ```bash
   # Export quality history (last 7 days)
   curl "http://localhost:8000/api/quality/history?days=7" > weekly_quality.json

   # Analyze trends
   python scripts/analyze_quality_trends.py weekly_quality.json

   # Review:
   # - MAE trend (improving/degrading?)
   # - Training frequency (too often/rare?)
   # - Error rates (increasing?)
   ```

4. **Database Maintenance** (15 min)
   ```bash
   # Check database growth
   python scripts/check_db_size.py

   # Archive old work orders (>6 months)
   python scripts/archive_old_work_orders.py --months 6
   ```

### 7.3 Monthly Maintenance

**Time**: 2-3 hours/month

**Tasks**:

1. **Performance Audit** (60 min)
   ```bash
   # Run full performance test
   python scripts/performance_audit.py --duration 1h

   # Review results:
   # - API latency (p50, p95, p99)
   # - Training duration trends
   # - Database query performance
   ```

2. **Security Audit** (30 min)
   ```bash
   # Check dependencies for vulnerabilities
   pip-audit

   # Update vulnerable packages
   pip install --upgrade {package}

   # Frontend security
   cd frontend-prediction
   npm audit
   npm audit fix
   ```

3. **Capacity Planning** (30 min)
   ```bash
   # Check disk usage trend
   python scripts/disk_usage_forecast.py --days 90

   # Check database growth
   python scripts/db_growth_forecast.py --months 3

   # Estimate resource needs for next quarter
   ```

4. **Documentation Update** (30 min)
   ```bash
   # Update runbook with new procedures
   # Update architecture diagram if changed
   # Document any incidents/resolutions
   ```

---

## 8. Performance Tuning

### 8.1 Backend Performance

**Optimize Database Queries**:
```python
# Use connection pooling
# backend/_connection_pool.py already implements this

# Add indexes (if missing)
CREATE INDEX idx_item_info_create_date ON BI_ITEM_INFO_VIEW(CREATE_DATE);
CREATE INDEX idx_work_order_item_code ON BI_WORK_ORDER_RESULTS(ITEM_CODE);
```

**Optimize Prediction Cache**:
```python
# Increase cache size
# Edit backend/predictor_ml.py
CACHE_SIZE = 10000  # Default: 5000

# Enable persistent cache
CACHE_PERSIST = True
CACHE_FILE = "models/default/.cache/predictions.pkl"
```

**Optimize API Concurrency**:
```bash
# Increase worker count
uvicorn backend.api.main:app --workers 4 --host 0.0.0.0 --port 8000

# Or use Gunicorn
gunicorn backend.api.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### 8.2 Training Performance

**Optimize Sample Size**:
```yaml
# config/iter_training.yaml
sampling:
  sample_size: 500  # Start small (500-1000)
  # Increase only if accuracy improves significantly
```

**Optimize Model Training**:
```python
# backend/iter_training/trainer.py
# Use parallel processing
cross_val_score(..., n_jobs=-1)  # Use all CPU cores

# Reduce cross-validation folds
cv=3  # Instead of 5 (faster, slightly less accurate)
```

**Optimize Queue Management**:
```yaml
# config/iter_training.yaml
queue:
  max_size: 3  # Increase if needed (5-10)
  cooldown_hours: 24  # Prevent excessive retraining
```

### 8.3 Frontend Performance

**Optimize Chart Rendering**:
```typescript
// Use virtualization for large datasets
// frontend-prediction/src/components/quality/QualityDashboard.tsx
const chartData = useMemo(() => {
  return history.slice(-50);  // Limit to 50 points
}, [history]);
```

**Optimize Polling**:
```typescript
// Reduce polling frequency when inactive
const pollingInterval = isActive ? 5000 : 30000;  // 5s active, 30s inactive
```

---

## 9. Security

### 9.1 Access Control

**API Authentication**:
- All `/api/training/*` endpoints require authentication
- Admin endpoints require `admin` role
- Use JWT tokens with expiration

**Database Access**:
- Use read-only user for quality evaluation
- Use separate user with write access for training

### 9.2 Secrets Management

**DO NOT commit**:
- `.env` files
- Database credentials
- API keys
- Certificates

**Store secrets in**:
- Environment variables (production)
- `.env.local` (development, .gitignored)
- Secret management service (AWS Secrets Manager, Azure Key Vault)

### 9.3 Audit Logging

**Log all critical operations**:
```python
# backend/iter_training/deployer.py
logger.info(f"Model deployed: {version} by user {user_id}")
logger.info(f"Model rolled back: {from_version} -> {to_version} by user {user_id}")
logger.info(f"Configuration changed: {field}={old_value} -> {new_value} by user {user_id}")
```

---

## 10. Runbook

### 10.1 System Startup

```bash
#!/bin/bash
# startup.sh

# 1. Activate virtual environment
source .venv/bin/activate

# 2. Verify database connection
python scripts/test_db_connection.py

# 3. Start backend
cd backend
nohup uvicorn api.main:app --host 0.0.0.0 --port 8000 > ../logs/uvicorn.log 2>&1 &
echo $! > ../backend.pid

# 4. Start frontend (development)
cd ../frontend-prediction
nohup npm run dev > ../logs/vite.log 2>&1 &
echo $! > ../frontend.pid

# 5. Health check
sleep 5
curl http://localhost:8000/health
curl http://localhost:5173/

echo "System started successfully"
```

### 10.2 System Shutdown

```bash
#!/bin/bash
# shutdown.sh

# 1. Stop frontend
kill $(cat frontend.pid)
rm frontend.pid

# 2. Stop backend
kill $(cat backend.pid)
rm backend.pid

# 3. Wait for graceful shutdown
sleep 5

# 4. Force kill if still running
pkill -f uvicorn
pkill -f vite

echo "System stopped"
```

### 10.3 Quick Health Check

```bash
#!/bin/bash
# health_check.sh

echo "=== Routing ML Health Check ==="

# Backend
echo -n "Backend: "
curl -s http://localhost:8000/health | jq -r '.status' || echo "DOWN"

# Frontend
echo -n "Frontend: "
curl -s http://localhost:5173/ > /dev/null && echo "UP" || echo "DOWN"

# Database
echo -n "Database: "
python -c "from backend._connection_pool import get_connection; get_connection(); print('CONNECTED')" 2>/dev/null || echo "DOWN"

# Disk Space
echo -n "Disk Space: "
df -h | grep -E "/$" | awk '{print $5}' | sed 's/%//'

# Training Queue
echo -n "Training Queue: "
curl -s http://localhost:8000/api/training/jobs | jq -r '.running' || echo "ERROR"
```

---

## Appendix A: Error Codes

| Code | Message | Severity | Action |
|------|---------|----------|--------|
| 1001 | Database connection failed | P0 | Check database server, credentials |
| 1002 | Model not found | P1 | Rollback or retrain model |
| 1003 | Queue full | P2 | Wait or increase queue size |
| 1004 | Training failed | P2 | Check logs, retry with smaller sample |
| 1005 | Prediction timeout | P2 | Check model cache, restart backend |
| 2001 | Disk space low (<10%) | P1 | Clean old logs/models |
| 2002 | High memory usage (>80%) | P2 | Restart services, check for leaks |
| 3001 | MAE exceeds critical threshold | P1 | Trigger retraining |
| 3002 | Process Match <80% | P1 | Investigate data quality |

---

## Appendix B: Contact Information

| Role | Contact | Escalation |
|------|---------|------------|
| On-Call Operator | [Phone/Email] | 24/7 |
| ML Engineer | [Phone/Email] | Business hours |
| DBA | [Phone/Email] | 24/7 for P0 |
| DevOps Lead | [Phone/Email] | Business hours |

---

**Document Version**: 1.0
**Last Updated**: 2025-10-22
**Next Review**: Monthly
