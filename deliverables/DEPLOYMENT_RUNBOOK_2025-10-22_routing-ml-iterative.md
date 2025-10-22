# Deployment Runbook: Routing ML Iterative Training System

**Document ID**: DEPLOYMENT_RUNBOOK_2025-10-22_routing-ml-iterative
**Version**: 1.0
**Created**: 2025-10-22
**Audience**: DevOps, System Operators, Release Managers

**Related Documents**:
- Operator Manual: [deliverables/OPERATOR_MANUAL_2025-10-22_routing-ml-iterative.md](OPERATOR_MANUAL_2025-10-22_routing-ml-iterative.md)
- User Guide: [deliverables/USER_GUIDE_2025-10-22_routing-ml-iterative.md](USER_GUIDE_2025-10-22_routing-ml-iterative.md)
- QA Report: [deliverables/QA_REPORT_2025-10-22_routing-ml-iterative.md](QA_REPORT_2025-10-22_routing-ml-iterative.md)

---

## Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [Environment Setup](#2-environment-setup)
3. [Deployment Steps](#3-deployment-steps)
4. [Post-Deployment Verification](#4-post-deployment-verification)
5. [Rollback Plan](#5-rollback-plan)
6. [Monitoring Configuration](#6-monitoring-configuration)
7. [Troubleshooting](#7-troubleshooting)
8. [Appendix](#8-appendix)

---

## 1. Pre-Deployment Checklist

### 1.1 Code Readiness

**Git Repository**:
- [ ] All changes committed to `251014` branch
- [ ] Branch merged to `main`
- [ ] No uncommitted changes (`git status` clean)
- [ ] All tests passing (pytest + Playwright)
- [ ] Code review approved

**Verification**:
```bash
# Check git status
git status
# Expected: "nothing to commit, working tree clean"

# Check branch
git branch --show-current
# Expected: "251014" or "main"

# Run tests
pytest tests/backend/iter_training/ -v
cd frontend-prediction && npx playwright test tests/e2e/
```

### 1.2 Environment Readiness

**Server Requirements**:
- [ ] Python 3.10+ installed
- [ ] Node.js 18+ installed (frontend build)
- [ ] MSSQL database accessible (K3-DB/KsmErp)
- [ ] Sufficient disk space (>10 GB free)
- [ ] Sufficient RAM (>4 GB available)

**Verification**:
```bash
# Python version
python --version  # ≥3.10

# Node.js version
node --version  # ≥18.0

# Disk space
df -h | grep -E "/$"  # >10GB free

# RAM
free -h  # >4GB available (Linux)
# OR
wmic OS get FreePhysicalMemory  # Windows

# Database connection
telnet K3-DB 1433
```

### 1.3 Backup Completion

**Critical Data to Backup**:
- [ ] Current model files (`models/default/`)
- [ ] Configuration (`config/iter_training.yaml`)
- [ ] Database (if schema changes)
- [ ] Logs (last 30 days)

**Backup Commands**:
```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=backups/$(date +%Y%m%d_%H%M%S)

# Backup models
cp -r models/default $BACKUP_DIR/models_default

# Backup config
cp config/iter_training.yaml $BACKUP_DIR/

# Backup manifest
cp models/manifest.json $BACKUP_DIR/

# Backup logs (last 30 days)
find logs/ -mtime -30 -type f -exec cp --parents {} $BACKUP_DIR \;

# Create archive
tar -czf backups/backup_$(date +%Y%m%d_%H%M%S).tar.gz $BACKUP_DIR/

echo "Backup created: backups/backup_$(date +%Y%m%d_%H%M%S).tar.gz"
```

### 1.4 Dependency Check

**Backend Dependencies**:
- [ ] All packages in `requirements.txt` compatible
- [ ] No known security vulnerabilities

**Frontend Dependencies**:
- [ ] All packages in `package.json` compatible
- [ ] No known security vulnerabilities

**Verification**:
```bash
# Backend dependency check
pip install -r requirements.txt --dry-run

# Backend security audit
pip-audit

# Frontend dependency check
cd frontend-prediction
npm install --dry-run

# Frontend security audit
npm audit
```

### 1.5 Communication

**Stakeholder Notifications**:
- [ ] Deployment window communicated (email/Slack)
- [ ] Expected downtime announced (if any)
- [ ] Rollback contact prepared
- [ ] Incident response team on standby

**Sample Notification**:
```
Subject: Routing ML Iterative Training System Deployment - [DATE] [TIME]

Team,

We will be deploying the Routing ML Iterative Training System on:
- Date: [2025-10-22]
- Time: [14:00-16:00 KST]
- Expected Downtime: <5 minutes (backend restart)

New Features:
- Automated quality monitoring
- Background model retraining
- Real-time quality dashboard
- Training job management

Contact: [Your Name] ([Phone/Email]) for issues

Rollback Plan: Available if deployment fails
```

---

## 2. Environment Setup

### 2.1 Server Configuration

**Operating System**:
- Windows Server 2019+ OR Linux (Ubuntu 20.04+)

**Firewall Rules**:
```bash
# Open ports (if not already open)
# Backend API: 8000
# Frontend Dev: 5173 (development only)
# Frontend Prod: 80/443 (production with Nginx)

# Windows
netsh advfirewall firewall add rule name="FastAPI Backend" dir=in action=allow protocol=TCP localport=8000

# Linux (ufw)
sudo ufw allow 8000/tcp
```

### 2.2 Python Environment

**Virtual Environment Setup**:
```bash
# Create virtual environment (if not exists)
python -m venv .venv

# Activate virtual environment
# Windows
.venv\Scripts\activate

# Linux/Mac
source .venv/bin/activate

# Upgrade pip
python -m pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Verify installation
pip list | grep -E "fastapi|uvicorn|scikit-learn|pytest"
```

### 2.3 Database Setup

**Connection String**:
```ini
# .env file (create if not exists)
DATABASE_SERVER=K3-DB
DATABASE_NAME=KsmErp
DATABASE_DRIVER=ODBC Driver 17 for SQL Server
DATABASE_TRUSTED_CONNECTION=yes
```

**Test Connection**:
```bash
# Test database connection
python -c "
from backend._connection_pool import get_connection
try:
    conn = get_connection()
    print('✅ Database connection successful')
except Exception as e:
    print(f'❌ Database connection failed: {e}')
"
```

**Create Indexes** (if not exists):
```sql
-- Run these queries in SSMS or via sqlcmd
USE KsmErp;

-- Index for sampling (if not exists)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_item_info_create_date')
CREATE INDEX idx_item_info_create_date ON BI_ITEM_INFO_VIEW(CREATE_DATE);

-- Index for evaluation (if not exists)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_work_order_item_code')
CREATE INDEX idx_work_order_item_code ON BI_WORK_ORDER_RESULTS(ITEM_CODE);
```

### 2.4 Configuration Files

**Create Config Directory**:
```bash
# Ensure config exists
mkdir -p config

# Copy default config (if not exists)
if [ ! -f config/iter_training.yaml ]; then
  cp config/iter_training.yaml.example config/iter_training.yaml
fi

# Review and adjust config
nano config/iter_training.yaml  # OR vi, notepad++
```

**Key Configuration Parameters**:
```yaml
# config/iter_training.yaml

sampling:
  sample_size: 500  # Adjust based on data size
  strategy: "random"  # Options: random, stratified, recent_bias

thresholds:
  mae_threshold: 5.0  # minutes
  cv_threshold: 0.3
  process_match_threshold: 0.8  # 80%

queue:
  max_size: 3
  cooldown_hours: 24

logging:
  level: "INFO"  # Options: DEBUG, INFO, WARNING, ERROR
  file: "logs/performance/performance.quality.log"
```

### 2.5 Directory Structure

**Create Required Directories**:
```bash
# Create directory structure
mkdir -p logs/performance
mkdir -p deliverables/quality_reports
mkdir -p models/default
mkdir -p data/training_jobs
mkdir -p old

# Set permissions (Linux)
chmod 755 logs deliverables models data old
chmod 644 config/iter_training.yaml
```

---

## 3. Deployment Steps

### 3.1 Pre-Deployment Smoke Test

**Run on staging/development environment**:

```bash
# 1. Start backend (test mode)
cd backend
uvicorn api.main:app --reload --port 8001 &
BACKEND_PID=$!

# 2. Wait for startup
sleep 5

# 3. Health check
curl http://localhost:8001/health
# Expected: {"status": "healthy", ...}

# 4. Test prediction
curl -X POST http://localhost:8001/api/predict \
  -H "Content-Type: application/json" \
  -d '{"item_codes": ["ITEM001"]}'
# Expected: {"predictions": [...], ...}

# 5. Test training API
curl -X POST http://localhost:8001/api/training/start \
  -H "Content-Type: application/json" \
  -d '{"sample_size": 10, "strategy": "random"}'
# Expected: {"job_id": "job_...", "status": "STARTED"}

# 6. Stop test backend
kill $BACKEND_PID
```

**Expected Results**:
- ✅ All API endpoints respond with 200 OK
- ✅ Health check returns "healthy"
- ✅ Prediction returns valid results
- ✅ Training job starts successfully

**If smoke test fails**: DO NOT PROCEED. Debug issues first.

### 3.2 Production Deployment

**Step 1: Stop Existing Services** (2 min)
```bash
# Stop backend (if running)
pkill -f "uvicorn backend.api.main:app"
# OR (Windows)
taskkill /F /FI "WINDOWTITLE eq uvicorn*"

# Verify stopped
ps aux | grep uvicorn  # Should return empty
```

**Step 2: Pull Latest Code** (3 min)
```bash
# Fetch latest changes
git fetch origin

# Checkout main branch
git checkout main

# Pull latest
git pull origin main

# Verify version
git log --oneline -3
```

**Step 3: Update Dependencies** (5 min)
```bash
# Activate virtual environment
source .venv/bin/activate  # Linux/Mac
# OR
.venv\Scripts\activate  # Windows

# Update backend dependencies
pip install -r requirements.txt --upgrade

# Update frontend dependencies (if building frontend)
cd frontend-prediction
npm install
cd ..
```

**Step 4: Database Migration** (2 min)
```bash
# Run migration script (if exists)
python scripts/migrate_database.py

# OR manually run SQL scripts
# sqlcmd -S K3-DB -d KsmErp -i migrations/add_indexes.sql
```

**Step 5: Configuration Update** (2 min)
```bash
# Backup current config
cp config/iter_training.yaml config/iter_training.yaml.backup

# Review new config (if changed)
diff config/iter_training.yaml.backup config/iter_training.yaml.example

# Apply changes manually (if needed)
nano config/iter_training.yaml
```

**Step 6: Start Backend** (3 min)
```bash
# Start backend in background
cd backend
nohup uvicorn api.main:app --host 0.0.0.0 --port 8000 > ../logs/uvicorn.log 2>&1 &

# Save PID
echo $! > ../backend.pid

# Wait for startup
sleep 5

# Health check
curl http://localhost:8000/health
```

**Step 7: Verify Deployment** (5 min)

See Section 4: Post-Deployment Verification

---

## 4. Post-Deployment Verification

### 4.1 Functional Tests

**Test 1: Health Check** (30 sec)
```bash
# Backend health
curl http://localhost:8000/health
# Expected: {"status": "healthy", "version": "1.0.0", ...}

# Database health
curl http://localhost:8000/api/db/health
# Expected: {"database": "connected", ...}
```

**Test 2: Prediction Endpoint** (1 min)
```bash
# Test prediction with real item
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "item_codes": ["ITEM001", "ITEM002"]
  }'

# Expected: 200 OK with predictions array
```

**Test 3: Quality Monitoring** (1 min)
```bash
# Get current quality metrics
curl http://localhost:8000/api/quality/current

# Expected: 200 OK with metrics (or 404 if no evaluation yet)
```

**Test 4: Training API** (2 min)
```bash
# Start small training job
curl -X POST http://localhost:8000/api/training/start \
  -H "Content-Type: application/json" \
  -d '{
    "sample_size": 100,
    "strategy": "random"
  }'

# Expected: {"job_id": "job_...", "status": "STARTED"}

# Check job status
JOB_ID=[job_id_from_above]
curl http://localhost:8000/api/training/jobs/$JOB_ID/status

# Expected: {"status": "RUNNING" or "SUCCEEDED", ...}
```

**Test 5: Frontend Access** (1 min)
```bash
# Access frontend (if deployed)
curl http://localhost:5173/

# OR (production)
curl https://[production-url]/

# Expected: HTML page loads
```

### 4.2 Performance Tests

**Test 1: API Latency** (2 min)
```bash
# Measure prediction latency
time curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"item_codes": ["ITEM001"]}'

# Expected: <500ms response time
```

**Test 2: Concurrent Requests** (3 min)
```bash
# Install Apache Bench (if not installed)
# sudo apt-get install apache2-utils

# Load test (100 requests, 10 concurrent)
ab -n 100 -c 10 -p predict_payload.json -T application/json \
  http://localhost:8000/api/predict

# Expected:
# - 0% failed requests
# - Mean response time <500ms
# - Requests per second >20
```

**Test 3: Memory Usage** (1 min)
```bash
# Check backend memory usage
ps aux | grep uvicorn | awk '{print $6, $11}'

# Expected: <500 MB memory usage

# Check system memory
free -h  # Linux
# OR
wmic OS get FreePhysicalMemory  # Windows

# Expected: >2 GB free memory
```

### 4.3 Data Integrity Tests

**Test 1: Model Files** (1 min)
```bash
# Check model files exist
ls -lh models/default/
# Expected files:
# - model.pkl
# - vectorizer.pkl
# - feature_config.json

# Check manifest
cat models/manifest.json
# Expected: valid JSON with active_version
```

**Test 2: Logs** (1 min)
```bash
# Check logs being written
tail -f logs/performance/performance.quality.log

# Trigger an action (quality evaluation)
# Verify logs appear in real-time

# Ctrl+C to stop
```

**Test 3: Database Queries** (1 min)
```bash
# Test sampling query
python -c "
from backend.iter_training.sampler import sample_items
items = sample_items(10, strategy='random')
print(f'Sampled {len(items)} items')
"

# Expected: "Sampled 10 items"
```

### 4.4 End-to-End Test

**Full Workflow Test** (10 min):

1. **Trigger Quality Evaluation**:
   ```bash
   curl -X POST http://localhost:8000/api/quality/evaluate
   # Wait 2-3 minutes for completion
   ```

2. **Check Quality Metrics**:
   ```bash
   curl http://localhost:8000/api/quality/current | jq '.mae'
   # Expected: MAE value (e.g., 4.2)
   ```

3. **Trigger Training** (if MAE high):
   ```bash
   curl -X POST http://localhost:8000/api/training/start \
     -H "Content-Type: application/json" \
     -d '{"sample_size": 500, "strategy": "stratified"}'
   ```

4. **Monitor Training Progress**:
   ```bash
   JOB_ID=[job_id_from_step_3]
   watch -n 5 "curl -s http://localhost:8000/api/training/jobs/$JOB_ID/status | jq '.progress, .current_step'"
   # Watch until status = SUCCEEDED
   ```

5. **Verify Model Deployment**:
   ```bash
   cat models/manifest.json | jq '.active_version'
   # Expected: New version deployed
   ```

6. **Test Prediction with New Model**:
   ```bash
   curl -X POST http://localhost:8000/api/predict \
     -H "Content-Type: application/json" \
     -d '{"item_codes": ["ITEM001"]}'
   # Expected: Prediction using new model
   ```

---

## 5. Rollback Plan

### 5.1 When to Rollback

**Rollback Triggers**:
- ✅ Deployment verification failed (Section 4)
- ✅ Critical bugs discovered (P0/P1)
- ✅ Performance degraded significantly (>2x latency)
- ✅ Data corruption detected
- ✅ Unexpected system behavior

**Do NOT Rollback**:
- ❌ Minor UI issues (P3)
- ❌ Non-critical warnings in logs
- ❌ Cosmetic bugs

### 5.2 Rollback Decision Tree

```
Deployment Issue
    ↓
Is it a P0/P1 bug?
    ├─ YES → Rollback immediately
    └─ NO → Can it be hot-fixed in <30 min?
              ├─ YES → Apply hot-fix
              └─ NO → Rollback
```

### 5.3 Quick Rollback (Git)

**Time**: 5-10 minutes

**Step 1: Identify Last Good Commit** (1 min)
```bash
# View recent commits
git log --oneline -10

# Identify last working commit (before deployment)
# Example: abc1234
```

**Step 2: Rollback Code** (2 min)
```bash
# Stop services
pkill -f uvicorn

# Checkout last good commit
git checkout abc1234

# OR rollback to previous tagged version
git tag -l  # List tags
git checkout v1.0.0  # Example: rollback to v1.0.0
```

**Step 3: Reinstall Dependencies** (3 min)
```bash
# Activate venv
source .venv/bin/activate

# Reinstall dependencies (versions may have changed)
pip install -r requirements.txt
```

**Step 4: Restart Services** (2 min)
```bash
# Start backend
cd backend
nohup uvicorn api.main:app --host 0.0.0.0 --port 8000 > ../logs/uvicorn.log 2>&1 &
echo $! > ../backend.pid
```

**Step 5: Verify Rollback** (2 min)
```bash
# Health check
curl http://localhost:8000/health

# Test prediction
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"item_codes": ["ITEM001"]}'

# Check version (if logged)
git log --oneline -1
```

### 5.4 Model Rollback

**Time**: 2-5 minutes

**When**: New model performs worse than previous

**Step 1: Check Current Model** (30 sec)
```bash
cat models/manifest.json | jq '.active_version, .previous_version'
```

**Step 2: Rollback Model** (1 min)
```bash
# Via API
curl -X POST http://localhost:8000/api/models/rollback

# OR via CLI
python -c "
from backend.iter_training.deployer import ModelDeployer
deployer = ModelDeployer()
result = deployer.rollback()
print(f'Rolled back to {result[\"version\"]}')
"
```

**Step 3: Verify Rollback** (2 min)
```bash
# Check active version
cat models/manifest.json | jq '.active_version'

# Test prediction
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"item_codes": ["ITEM001"]}'

# Check quality (wait for next evaluation cycle)
curl http://localhost:8000/api/quality/current | jq '.mae'
```

### 5.5 Full Rollback (Restore from Backup)

**Time**: 15-30 minutes

**When**: Complete system corruption, all other rollback methods failed

**Step 1: Stop Services** (1 min)
```bash
pkill -f uvicorn
pkill -f vite
```

**Step 2: Restore Backup** (10 min)
```bash
# Find latest backup
ls -lt backups/backup_*.tar.gz | head -1

# Extract backup
BACKUP_FILE=backups/backup_20251022_140000.tar.gz
tar -xzf $BACKUP_FILE -C /tmp/

# Restore models
rm -rf models/default
cp -r /tmp/backups/*/models_default models/default

# Restore config
cp /tmp/backups/*/iter_training.yaml config/

# Restore manifest
cp /tmp/backups/*/manifest.json models/
```

**Step 3: Restart Services** (2 min)
```bash
# Start backend
cd backend
nohup uvicorn api.main:app --host 0.0.0.0 --port 8000 > ../logs/uvicorn.log 2>&1 &
echo $! > ../backend.pid
```

**Step 4: Verify Restore** (5 min)
```bash
# Health check
curl http://localhost:8000/health

# Test prediction
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"item_codes": ["ITEM001"]}'

# Check model version
cat models/manifest.json | jq '.active_version'

# Trigger quality evaluation to verify system
curl -X POST http://localhost:8000/api/quality/evaluate
```

### 5.6 Post-Rollback Actions

**Required Actions**:

1. **Notify Stakeholders** (5 min)
   ```
   Subject: Routing ML Deployment Rolled Back - [DATE] [TIME]

   Team,

   Deployment has been rolled back due to [REASON].

   System Status: Restored to previous version [VERSION]
   Impact: [DESCRIBE IMPACT]
   Next Steps: [ROOT CAUSE ANALYSIS, FIX PLAN]

   Contact: [Your Name] for questions
   ```

2. **Document Rollback** (10 min)
   ```bash
   # Create rollback report
   cat > deliverables/rollback_$(date +%Y%m%d_%H%M%S).md <<EOF
   # Rollback Report - $(date)

   ## Reason
   [Describe why rollback was necessary]

   ## Rollback Method
   - [ ] Git rollback
   - [ ] Model rollback
   - [ ] Full backup restore

   ## Timeline
   - Deployment started: [TIME]
   - Issue detected: [TIME]
   - Rollback started: [TIME]
   - System restored: [TIME]

   ## Root Cause
   [Describe root cause if known]

   ## Prevention
   [How to prevent this in future]

   ## Sign-off
   Operator: [Name]
   Date: $(date)
   EOF
   ```

3. **Root Cause Analysis** (30 min - 2 hours)
   - Review deployment logs
   - Review error logs
   - Identify what went wrong
   - Document findings

4. **Create Fix Plan** (variable)
   - Identify fix for root cause
   - Test fix in staging
   - Schedule re-deployment

---

## 6. Monitoring Configuration

### 6.1 Application Logs

**Log Locations**:
```bash
# Backend logs
logs/uvicorn.log           # Uvicorn server logs
logs/performance/performance.quality.log  # Quality evaluation logs

# Training logs
data/training_jobs/{job_id}/state.json  # Training job state

# Frontend logs (development)
logs/vite.log
```

**Log Monitoring**:
```bash
# Tail all logs in real-time (Linux)
tail -f logs/uvicorn.log logs/performance/performance.quality.log

# Windows
Get-Content logs\uvicorn.log -Wait -Tail 50
```

**Log Rotation** (recommended):
```bash
# Add to cron (Linux) - rotate daily
0 0 * * * find logs/ -name "*.log" -mtime +30 -exec gzip {} \;
0 0 * * * find logs/ -name "*.log.gz" -mtime +90 -delete

# Windows Task Scheduler
# Create task to run: powershell scripts/rotate_logs.ps1
```

### 6.2 Prometheus Metrics (if configured)

**Expose Metrics**:
```bash
# Backend already exposes /metrics endpoint
curl http://localhost:8000/metrics

# Sample metrics:
# routing_ml_quality_mae_minutes 4.2
# routing_ml_training_jobs_total{status="SUCCEEDED"} 15
# routing_ml_api_request_duration_seconds_bucket{le="0.5"} 98
```

**Prometheus Config** (`prometheus.yml`):
```yaml
scrape_configs:
  - job_name: 'routing_ml_backend'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### 6.3 Grafana Dashboards (if configured)

**Import Dashboards**:
1. Access Grafana: `http://[grafana-server]:3000`
2. Navigate to: Dashboards → Import
3. Upload: `deliverables/grafana/routing-ml-dashboard.json` (if created)
4. Select datasource: Prometheus
5. Save dashboard

**Key Panels**:
- **MAE Trend**: Line chart of MAE over time
- **Training Jobs**: Counter of jobs by status
- **API Latency**: p50, p95, p99 latencies
- **System Health**: Health check status

### 6.4 Alerts (if configured)

**Critical Alerts**:
```yaml
# High MAE Alert
- alert: HighMAE
  expr: routing_ml_quality_mae_minutes > 10
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "MAE exceeds critical threshold (10 minutes)"
    description: "Current MAE: {{ $value }} minutes"

# Backend Down Alert
- alert: BackendDown
  expr: up{job="routing_ml_backend"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Routing ML backend is down"
```

**Alert Channels**:
- Email: [ops-team@company.com]
- Slack: #routing-ml-alerts
- PagerDuty: (for P0 alerts)

---

## 7. Troubleshooting

### 7.1 Deployment Failed - Dependencies

**Symptom**: `pip install` fails

**Solution**:
```bash
# Clear pip cache
pip cache purge

# Reinstall from scratch
pip uninstall -r requirements.txt -y
pip install -r requirements.txt

# If specific package fails, install manually
pip install {package_name}==desired_version
```

### 7.2 Deployment Failed - Port Already in Use

**Symptom**: `Address already in use: 8000`

**Solution**:
```bash
# Find process using port 8000
lsof -i :8000  # Linux/Mac
netstat -ano | findstr :8000  # Windows

# Kill process
kill -9 {PID}  # Linux/Mac
taskkill /F /PID {PID}  # Windows

# Restart backend
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
```

### 7.3 Deployment Failed - Database Connection

**Symptom**: `Database connection failed` in logs

**Solution**:
```bash
# Test database connection
python scripts/test_db_connection.py

# Check database server
ping K3-DB

# Check credentials in .env
cat .env | grep DATABASE

# Test with sqlcmd (if available)
sqlcmd -S K3-DB -d KsmErp -Q "SELECT TOP 5 * FROM BI_ITEM_INFO_VIEW"
```

### 7.4 Frontend Not Loading

**Symptom**: Blank page or 404 errors

**Solution**:
```bash
# Check frontend server
curl http://localhost:5173/

# Rebuild frontend (if production build)
cd frontend-prediction
npm run build

# Check for build errors
npm run lint

# Clear cache
rm -rf node_modules/.vite
```

---

## 8. Appendix

### 8.1 Environment Variables

**Required Variables** (`.env`):
```ini
# Database
DATABASE_SERVER=K3-DB
DATABASE_NAME=KsmErp
DATABASE_DRIVER=ODBC Driver 17 for SQL Server
DATABASE_TRUSTED_CONNECTION=yes

# Paths
MODEL_PATH=models/default
LOG_PATH=logs/performance

# Server
API_HOST=0.0.0.0
API_PORT=8000

# Feature Flags (optional)
ENABLE_TRAINING=true
ENABLE_QUALITY_MONITORING=true
```

### 8.2 Port Reference

| Service | Port | Protocol | Description |
|---------|------|----------|-------------|
| FastAPI Backend | 8000 | HTTP | Main API server |
| Frontend Dev | 5173 | HTTP | Vite dev server |
| Frontend Prod | 80/443 | HTTP/HTTPS | Nginx (if deployed) |
| Database | 1433 | TCP | MSSQL Server |
| Prometheus | 9090 | HTTP | Metrics (if configured) |
| Grafana | 3000 | HTTP | Dashboards (if configured) |

### 8.3 Deployment Timeline

**Estimated Times** (end-to-end):
| Phase | Duration | Notes |
|-------|----------|-------|
| Pre-Deployment Checklist | 15 min | Code review, backups |
| Environment Setup | 10 min | Dependencies, config |
| Deployment Steps | 20 min | Stop, deploy, start |
| Post-Deployment Verification | 20 min | Tests, monitoring |
| **Total (Normal)** | **65 min** | ~1 hour |
| **Total (with Issues)** | **90-120 min** | Including rollback |

### 8.4 Rollback Timeline

**Estimated Times**:
| Method | Duration | Use Case |
|--------|----------|----------|
| Quick Rollback (Git) | 5-10 min | Code issues |
| Model Rollback | 2-5 min | Model performance issues |
| Full Backup Restore | 15-30 min | Complete failure |

### 8.5 Success Criteria

**Deployment Considered Successful When**:
- ✅ All health checks passing (Section 4.1)
- ✅ All functional tests passing (Section 4.1)
- ✅ Performance tests meeting SLA (Section 4.2)
- ✅ End-to-end workflow working (Section 4.4)
- ✅ No critical errors in logs (first 30 minutes)
- ✅ Monitoring dashboards showing healthy metrics
- ✅ Stakeholders notified of successful deployment

**Sign-off Required From**:
- [ ] DevOps Engineer
- [ ] ML Engineer
- [ ] QA Lead
- [ ] Product Owner

---

**Document Version**: 1.0
**Last Updated**: 2025-10-22
**Next Review**: Before each deployment
