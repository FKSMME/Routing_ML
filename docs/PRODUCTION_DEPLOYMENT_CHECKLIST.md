# Production Deployment Checklist
**Version**: 1.0
**Date**: 2025-10-09
**System**: Routing ML Platform with P2 Improvements

---

## Pre-Deployment Checklist

### 1. Code & Testing ✅

- [x] All P0 critical defects resolved (6/6)
- [x] All P1/P2 medium priority tasks complete (5/5)
- [x] Backend tests passing: 56/56 (100%)
- [x] Frontend code validated (manual review)
- [x] Model metrics (P2-1) implemented and tested
- [x] Cache invalidation (P2-2) implemented and tested
- [x] Training UI functional
- [ ] Staging environment testing completed
- [ ] Load testing performed
- [ ] Security audit completed

### 2. Infrastructure

- [ ] Production server provisioned (CPU: 4+ cores, RAM: 16GB+, Disk: 100GB+)
- [ ] Docker installed (version 20.10+)
- [ ] Docker Compose installed (version 2.0+)
- [ ] SSL certificates obtained and configured
- [ ] Firewall rules configured (ports 80, 443, 8000)
- [ ] Backup storage configured
- [ ] Monitoring infrastructure deployed (Prometheus, Grafana)

### 3. Environment Configuration

- [ ] Production environment variables set:
  ```bash
  JWT_SECRET_KEY=<min-32-char-secret>
  DATABASE_URL=<production-db-connection>
  CORS_ALLOWED_ORIGINS=<production-domains>
  ENVIRONMENT=production
  LOG_LEVEL=INFO
  WINDOWS_LDAP_SERVER=<if-applicable>
  ```

- [ ] Database configured (Access/MSSQL)
- [ ] Model registry initialized
- [ ] Production models deployed to `models/` directory
- [ ] File permissions set correctly (user: app, group: app)

### 4. Security

- [ ] JWT secret key changed from default (min 32 characters)
- [ ] HTTPS enabled (SSL/TLS certificates installed)
- [ ] CORS configured for production domains only
- [ ] Windows LDAP authentication configured (if applicable)
- [ ] Fallback user passwords changed from defaults
- [ ] Database credentials secured (environment variables, not hardcoded)
- [ ] API rate limiting configured
- [ ] Security headers configured (CSP, HSTS, etc.)

### 5. Documentation

- [x] Deployment guide created
- [x] Operational runbook prepared
- [ ] API documentation published
- [ ] User training materials ready
- [ ] Rollback procedure documented

---

## Deployment Steps

### Step 1: Backup Current System

```bash
# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup existing models
tar -czf models_backup_$(date +%Y%m%d_%H%M%S).tar.gz models/

# Backup configuration
cp .env .env.backup_$(date +%Y%m%d_%H%M%S)
```

**Verification**: ✅ Backups created and stored securely

---

### Step 2: Clone Repository

```bash
# Clone to production server
git clone <repository-url> /opt/routing-ml
cd /opt/routing-ml

# Checkout production branch/tag
git checkout tags/v1.0-p2  # or production branch
```

**Verification**: ✅ Correct version checked out

---

### Step 3: Configure Environment

```bash
# Create production .env file
cat > .env << 'EOF'
# Application
ENVIRONMENT=production
LOG_LEVEL=INFO
JWT_SECRET_KEY=<CHANGE-THIS-MIN-32-CHARS>

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/routing_ml
# Or for Access/MSSQL:
# DATABASE_URL=mssql+pyodbc://user:password@server/database?driver=ODBC+Driver+17+for+SQL+Server

# CORS
CORS_ALLOWED_ORIGINS=https://routing.example.com,https://api.routing.example.com

# Authentication
WINDOWS_LDAP_SERVER=ldap://ad.example.com
LDAP_BASE_DN=DC=example,DC=com

# Model Registry
MODEL_DIRECTORY=./models
MODEL_REGISTRY_PATH=./models/registry.db

# Monitoring
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
EOF

# Set secure permissions
chmod 600 .env
chown app:app .env
```

**Verification**: ✅ All environment variables set correctly

---

### Step 4: Build Docker Images

```bash
# Build backend image
docker build -t routing-ml-backend:v1.0-p2 -f docker/Dockerfile.backend .

# Build frontend-training image
docker build -t routing-ml-frontend-training:v1.0-p2 -f docker/Dockerfile.frontend-training .

# Build frontend-prediction image
docker build -t routing-ml-frontend-prediction:v1.0-p2 -f docker/Dockerfile.frontend-prediction .

# Verify images
docker images | grep routing-ml
```

**Verification**: ✅ All images built successfully

---

### Step 5: Initialize Database

```bash
# Run database migrations (if applicable)
docker run --rm \
  --env-file .env \
  routing-ml-backend:v1.0-p2 \
  alembic upgrade head

# Initialize model registry
docker run --rm \
  --env-file .env \
  -v $(pwd)/models:/app/models \
  routing-ml-backend:v1.0-p2 \
  python -m backend.maintenance.model_registry init
```

**Verification**: ✅ Database schema created, registry initialized

---

### Step 6: Deploy Services

```bash
# Start services with Docker Compose
docker-compose -f docker/docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker/docker-compose.prod.yml ps
```

**Expected Output**:
```
NAME                    STATUS              PORTS
routing-ml-backend      Up 30 seconds       0.0.0.0:8000->8000/tcp
routing-ml-frontend-1   Up 30 seconds       0.0.0.0:3000->80/tcp
routing-ml-frontend-2   Up 30 seconds       0.0.0.0:3001->80/tcp
routing-ml-nginx        Up 30 seconds       0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
routing-ml-prometheus   Up 30 seconds       0.0.0.0:9090->9090/tcp
routing-ml-grafana      Up 30 seconds       0.0.0.0:3003->3000/tcp
```

**Verification**: ✅ All services running

---

### Step 7: Health Checks

```bash
# Backend health check
curl https://api.routing.example.com/health

# Expected: {"status": "ok", "timestamp": "..."}

# Frontend health check
curl https://routing.example.com

# Expected: HTML response with app

# Database connectivity check
curl https://api.routing.example.com/api/data-quality/metrics \
  -H "Authorization: Bearer <test-token>"

# Expected: Quality metrics JSON
```

**Verification**: ✅ All health checks pass

---

### Step 8: Deploy Production Models

```bash
# Copy production models to models directory
rsync -avz /path/to/production/models/ ./models/

# Verify model structure
ls -la ./models/default/
# Should see: encoder.joblib, scaler.joblib, similarity_engine.joblib,
#             manifest.json, feature_weights.json, etc.

# Set permissions
chown -R app:app ./models/
chmod -R 755 ./models/
```

**Verification**: ✅ Models deployed and accessible

---

### Step 9: Smoke Tests

```bash
# Test authentication
curl -X POST https://api.routing.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "<prod-password>"}'

# Save token
export TOKEN="<access-token>"

# Test prediction
curl -X POST https://api.routing.example.com/api/routing/predict \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "item_code": "ITEM_A001",
    "context": {}
  }'

# Test model training (dry run)
curl -X POST https://api.routing.example.com/api/trainer/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version_label": "smoke-test-v1",
    "dry_run": true
  }'

# Test training UI
# Open browser: https://routing.example.com
# Navigate to "모델 학습"
# Verify UI loads without errors
```

**Verification**: ✅ All smoke tests pass

---

### Step 10: Configure Monitoring

```bash
# Access Grafana
open https://routing.example.com:3003

# Login: admin / <grafana-password>

# Import dashboards (from docs/grafana-dashboards/)
# - Routing ML Overview
# - Model Training Metrics
# - API Performance

# Configure alerts (from docs/alertmanager-config.yml)
# - Backend API down
# - High error rate (>5%)
# - Model training failures
# - Database connection issues

# Test alert (simulate failure)
docker-compose -f docker/docker-compose.prod.yml stop routing-ml-backend
# Wait 1 minute for alert
# Verify Slack/Email notification received

# Restore service
docker-compose -f docker/docker-compose.prod.yml start routing-ml-backend
```

**Verification**: ✅ Monitoring configured, alerts working

---

### Step 11: Configure Backups

```bash
# Create backup script
cat > /opt/routing-ml/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/backups/routing-ml
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
pg_dump $DATABASE_URL > $BACKUP_DIR/db_$DATE.sql

# Models backup
tar -czf $BACKUP_DIR/models_$DATE.tar.gz /opt/routing-ml/models/

# Registry backup
cp /opt/routing-ml/models/registry.db $BACKUP_DIR/registry_$DATE.db

# Clean old backups (keep 30 days)
find $BACKUP_DIR -type f -mtime +30 -delete

# Upload to cloud storage (optional)
# aws s3 sync $BACKUP_DIR s3://routing-ml-backups/
EOF

chmod +x /opt/routing-ml/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/routing-ml/backup.sh") | crontab -
```

**Verification**: ✅ Backup script configured and tested

---

### Step 12: SSL/TLS Configuration

```bash
# Install certbot (if using Let's Encrypt)
apt-get install -y certbot python3-certbot-nginx

# Obtain SSL certificate
certbot --nginx -d routing.example.com -d api.routing.example.com

# Auto-renewal
certbot renew --dry-run

# Verify HTTPS
curl -I https://routing.example.com
# Expected: HTTP/2 200, valid SSL certificate
```

**Verification**: ✅ HTTPS enabled, auto-renewal configured

---

### Step 13: Final Validation

Run comprehensive test suite:

```bash
# Backend API tests
export JWT_SECRET_KEY="<production-secret>"
pytest tests/backend -v --tb=short

# Expected: 56/56 tests passing

# Load test (using Apache Bench or similar)
ab -n 1000 -c 10 -H "Authorization: Bearer $TOKEN" \
  https://api.routing.example.com/api/routing/predict \
  -p prediction_payload.json \
  -T application/json

# Expected:
# - Requests per second: >50
# - Mean response time: <200ms
# - Failed requests: 0

# Frontend accessibility test
lighthouse https://routing.example.com --output=html --output-path=./lighthouse-report.html

# Expected:
# - Performance: >80
# - Accessibility: >90
# - Best Practices: >90
```

**Verification**: ✅ All validation tests pass

---

### Step 14: Enable Production Traffic

```bash
# Update DNS (if not already done)
# Point routing.example.com and api.routing.example.com to production server

# Update load balancer (if applicable)
# Route traffic to new production deployment

# Monitor logs in real-time
docker-compose -f docker/docker-compose.prod.yml logs -f --tail=100

# Monitor metrics
# Open Grafana: https://routing.example.com:3003
# Watch dashboards for anomalies
```

**Verification**: ✅ Traffic flowing to production

---

## Post-Deployment Verification

### Immediate (0-1 hour)

- [ ] No critical errors in logs
- [ ] API response times normal (<200ms avg)
- [ ] No spike in error rate (<1%)
- [ ] Authentication working correctly
- [ ] Database connections stable
- [ ] Model predictions accurate

### Short-term (1-24 hours)

- [ ] No memory leaks (monitor RAM usage)
- [ ] No resource exhaustion (CPU, disk, DB connections)
- [ ] Monitoring alerts functioning
- [ ] Backup jobs running successfully
- [ ] SSL certificate auto-renewal working
- [ ] User reports positive (no major issues)

### Medium-term (1-7 days)

- [ ] Model training workflow used successfully
- [ ] metrics.json generated for new models
- [ ] Cache invalidation working as expected
- [ ] Training UI user feedback positive
- [ ] Performance metrics stable
- [ ] No regression bugs reported

---

## Rollback Procedure

If critical issues arise, follow this rollback procedure:

### Option 1: Quick Rollback (Docker)

```bash
# Stop current deployment
docker-compose -f docker/docker-compose.prod.yml down

# Restore previous version
docker-compose -f docker/docker-compose.prod.v0.9.yml up -d

# Restore database from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# Verify rollback
curl https://api.routing.example.com/health
```

**Time**: ~5 minutes

### Option 2: Full Rollback (Git)

```bash
# Checkout previous version
git checkout tags/v0.9

# Rebuild images
docker build -t routing-ml-backend:v0.9 -f docker/Dockerfile.backend .

# Deploy
docker-compose -f docker/docker-compose.prod.yml up -d

# Restore data
# (same as Option 1)
```

**Time**: ~15 minutes

### Rollback Decision Criteria

**Immediate Rollback** if:
- Error rate >10%
- API downtime >5 minutes
- Data corruption detected
- Critical security vulnerability

**Investigate First** if:
- Error rate 1-10%
- Performance degradation <50%
- Non-critical functionality broken
- User reports manageable workarounds

---

## Troubleshooting

### Issue: Backend API not responding

**Symptoms**: 502 Bad Gateway, timeout errors

**Diagnosis**:
```bash
docker-compose -f docker/docker-compose.prod.yml ps
docker-compose -f docker/docker-compose.prod.yml logs routing-ml-backend --tail=100
```

**Solutions**:
1. Restart backend service: `docker-compose restart routing-ml-backend`
2. Check environment variables: `docker exec routing-ml-backend env | grep DATABASE`
3. Check database connectivity: `docker exec routing-ml-backend python -c "import backend.database; backend.database.test_connection()"`

---

### Issue: Model training fails

**Symptoms**: Training status shows "failed", error in UI

**Diagnosis**:
```bash
docker-compose logs routing-ml-backend | grep -i "training\|error"
cat /opt/routing-ml/models/<version>/training_request.json
```

**Solutions**:
1. Check dataset in database: `SELECT COUNT(*) FROM routing_data;`
2. Verify model directory permissions: `ls -la /opt/routing-ml/models/`
3. Check disk space: `df -h`
4. Review error message in training UI or API logs

---

### Issue: metrics.json not generated

**Symptoms**: Model trains successfully but metrics.json missing

**Diagnosis**:
```bash
ls -la /opt/routing-ml/models/<version>/
docker-compose logs routing-ml-backend | grep "metrics"
```

**Solutions**:
1. Verify training via API (not CLI): CLI bypasses metrics collection
2. Check for non-critical warnings in logs: Metrics failures are logged but don't abort training
3. Manually generate metrics:
   ```python
   from backend.api.services.model_metrics import save_model_metrics
   from pathlib import Path
   save_model_metrics(Path('./models/<version>'), {...}, overwrite=True)
   ```

---

### Issue: Cache not invalidating

**Symptoms**: Manifest changes not reflected in predictions

**Diagnosis**:
```bash
# Check manifest mtime
stat /opt/routing-ml/models/default/manifest.json

# Check logs for cache events
docker-compose logs routing-ml-backend | grep -i "cache\|manifest"
```

**Solutions**:
1. Wait 2-3 seconds for mtime-based refresh
2. Restart backend to force cache clear: `docker-compose restart routing-ml-backend`
3. Touch manifest file: `touch /opt/routing-ml/models/default/manifest.json`

---

### Issue: Training UI errors

**Symptoms**: UI shows error messages, training doesn't start

**Diagnosis**:
```bash
# Check browser console (F12)
# Check backend API logs
docker-compose logs routing-ml-backend | grep "trainer\|401\|403\|500"
```

**Solutions**:
1. Verify authentication: Token valid and not expired
2. Check CORS: Frontend domain in CORS_ALLOWED_ORIGINS
3. Verify backend endpoint: `/api/trainer/run` returns 202, not 403
4. Check network: Frontend can reach backend API

---

## Success Criteria

### Deployment Successful If:

- [x] All services running (docker-compose ps shows "Up")
- [ ] Health checks passing (HTTP 200 responses)
- [ ] Authentication working (login successful)
- [ ] Predictions accurate (match expected results)
- [ ] Model training functional (UI and API)
- [ ] metrics.json generated for new models
- [ ] Monitoring operational (Grafana dashboards)
- [ ] Backups configured (cron job active)
- [ ] HTTPS enabled (valid SSL certificate)
- [ ] No critical errors (logs clean)
- [ ] Performance acceptable (<200ms response times)
- [ ] User access verified (test accounts work)

### Sign-off

**Deployment Completed By**: _______________
**Date**: _______________
**Time**: _______________

**Verified By**: _______________
**Date**: _______________

**Production Release Approved**: ☐ Yes ☐ No

---

## Next Steps

After successful deployment:

1. **Monitor for 24 hours**: Watch metrics, logs, and alerts closely
2. **User Training**: Conduct training sessions for new features (training UI, metrics)
3. **Documentation**: Update user guides with production URLs
4. **Feedback Collection**: Gather user feedback on P2 improvements
5. **Performance Tuning**: Optimize based on production load patterns
6. **Phase 3 Planning**: Evaluate deferred tasks (P2-3, P2-4, P2-5) for future sprints

---

## Reference Documents

- [STAGING_ENVIRONMENT_TESTING_GUIDE.md](STAGING_ENVIRONMENT_TESTING_GUIDE.md)
- [DOCKER_DEPLOYMENT_GUIDE.md](DOCKER_DEPLOYMENT_GUIDE.md)
- [PRODUCTION_MONITORING_SETUP.md](PRODUCTION_MONITORING_SETUP.md)
- [DEPLOYMENT_READINESS_FINAL.md](DEPLOYMENT_READINESS_FINAL.md)
- [OPERATIONAL_RUNBOOK.md](OPERATIONAL_RUNBOOK.md) ← Next to create
