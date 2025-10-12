# Staging Environment Testing Guide
**Version**: 1.0
**Date**: 2025-10-09
**Purpose**: Comprehensive testing procedures for staging environment before production deployment

---

## Overview

This guide provides step-by-step testing procedures to validate all P2 improvements (model metrics, cache invalidation, training UI) in a staging environment before production deployment.

---

## Prerequisites

### Environment Setup

1. **Staging Server**:
   - Ubuntu 20.04+ or similar Linux distribution
   - Docker & Docker Compose installed
   - Python 3.11+ with venv
   - Node.js 18+ and npm
   - Git access to repository

2. **Environment Variables**:
   ```bash
   # Required
   export JWT_SECRET_KEY="<staging-secret-min-32-chars>"
   export DATABASE_URL="<staging-database-connection>"
   export CORS_ALLOWED_ORIGINS="http://localhost:3000,http://staging.example.com"

   # Optional
   export WINDOWS_LDAP_SERVER="<ldap-server-address>"
   export LOG_LEVEL="INFO"
   export ENVIRONMENT="staging"
   ```

3. **Database**:
   - Staging database with sample routing data
   - Minimum 100 routing records for meaningful tests
   - Access/MSSQL connection configured

---

## Phase 1: Backend API Testing

### 1.1 Start Backend Server

```bash
# Clone repository
git clone <repository-url>
cd Routing_ML_4

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export JWT_SECRET_KEY="staging-secret-key-min-32-chars-long-12345"
export DATABASE_URL="sqlite:///./staging.db"

# Start backend
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000 --reload
```

**Expected Output**:
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 1.2 Health Check

```bash
curl http://localhost:8000/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-10-09T12:00:00Z"
}
```

### 1.3 Authentication Test

```bash
# Login with test user
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

**Expected Response**:
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user": {
    "username": "admin",
    "display_name": "Administrator"
  }
}
```

**Save token for subsequent tests**:
```bash
export TOKEN="<access_token_from_response>"
```

---

## Phase 2: Model Metrics Testing (P2-1)

### 2.1 Prepare Training Dataset

Create a test dataset with realistic routing data:

```bash
cat > /tmp/staging_training_data.csv << 'EOF'
ITEM_CD,PROC_CD,DURATION_MIN
ITEM_A001,PROC_CUT,10
ITEM_A001,PROC_WELD,15
ITEM_A001,PROC_PAINT,20
ITEM_B002,PROC_CUT,12
ITEM_B002,PROC_WELD,18
ITEM_B002,PROC_PAINT,22
ITEM_C003,PROC_CUT,8
ITEM_C003,PROC_ASSEMBLE,25
ITEM_C003,PROC_PAINT,18
ITEM_D004,PROC_CUT,11
ITEM_D004,PROC_WELD,16
ITEM_D004,PROC_ASSEMBLE,28
ITEM_D004,PROC_PAINT,21
EOF
```

**Dataset specs**:
- 13 samples
- 4 unique items (ITEM_A001, B002, C003, D004)
- 4 unique processes (CUT, WELD, ASSEMBLE, PAINT)

### 2.2 Train Model via CLI

```bash
python -m backend.cli.train_model \
  /tmp/staging_training_data.csv \
  --output-root ./models \
  --name staging-test-v1
```

**Expected Output**:
```
INFO: Starting training run
INFO: 모델 저장 완료: ./models/staging-test-v1
INFO: ✅ ML 모델 학습 완료!
./models/staging-test-v1
```

### 2.3 Verify metrics.json Generation

**Note**: CLI training doesn't automatically generate metrics.json. We need to test via API.

### 2.4 Train Model via API

```bash
# Start training via API
curl -X POST http://localhost:8000/api/trainer/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version_label": "staging-api-v1",
    "projector_metadata": [],
    "dry_run": false
  }'
```

**Expected Response** (202 Accepted):
```json
{
  "status": "scheduled",
  "job_id": "api-train-20251009120000",
  "version": "staging-api-v1",
  "message": "학습 작업을 백그라운드에서 시작했습니다."
}
```

### 2.5 Monitor Training Status

Poll for training completion:

```bash
# Check status every 3 seconds
watch -n 3 'curl -s http://localhost:8000/api/trainer/status \
  -H "Authorization: Bearer $TOKEN" | jq'
```

**Expected Status Progression**:
```json
// Initial
{
  "status": "scheduled",
  "progress": 1,
  "message": "학습 작업을 준비 중입니다"
}

// Running
{
  "status": "running",
  "progress": 50,
  "message": "모델 학습 중..."
}

// Completed
{
  "status": "completed",
  "progress": 100,
  "message": "학습 완료",
  "version_path": "./models/staging-api-v1"
}
```

### 2.6 Verify metrics.json

```bash
# Check if metrics.json exists
ls -la ./models/staging-api-v1/metrics.json

# View metrics content
cat ./models/staging-api-v1/metrics.json | jq
```

**Expected metrics.json**:
```json
{
  "generated_at": "2025-10-09T12:05:00+00:00",
  "model_version": "staging-api-v1",
  "training_samples": 13,
  "dataset_stats": {
    "total_samples": 13,
    "unique_items": 4,
    "unique_processes": 4,
    "missing_item_code": 0.0,
    "missing_process_code": 0.0,
    "missing_duration_min": 0.0
  },
  "training_duration_sec": 0.5,
  "note": "Model quality metrics (accuracy, precision) require evaluation dataset"
}
```

**✅ Test Pass Criteria**:
- metrics.json file exists
- Contains `generated_at`, `model_version`, `training_samples`
- `dataset_stats` includes `unique_items`, `unique_processes`, missing rates
- `training_duration_sec` > 0

---

## Phase 3: Cache Invalidation Testing (P2-2)

### 3.1 Load Model and Cache Manifest

```bash
# Make prediction to load model into cache
curl -X POST http://localhost:8000/api/routing/predict \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "item_code": "ITEM_A001",
    "context": {}
  }'
```

**Expected**: Model loaded, manifest cached

### 3.2 Test Cache Invalidation

**Python Test Script**:
```python
import requests
from pathlib import Path

# Test cache invalidation API (if exposed)
# Note: Currently invalidate() is internal method
# For staging, we can test by modifying manifest.json and checking reload

# Modify manifest.json
manifest_path = Path("./models/staging-api-v1/manifest.json")
manifest = json.loads(manifest_path.read_text())
manifest["revision"] = "modified-for-test"
manifest_path.write_text(json.dumps(manifest, indent=2))

# Wait for mtime-based auto-refresh (should detect change)
import time
time.sleep(2)

# Make another prediction
response = requests.post(
    "http://localhost:8000/api/routing/predict",
    headers={"Authorization": f"Bearer {token}"},
    json={"item_code": "ITEM_A001", "context": {}}
)

# Check if new manifest loaded (via logs or response metadata)
```

**✅ Test Pass Criteria**:
- Modified manifest.json detected within 2 seconds
- New manifest loaded without service restart
- Predictions continue to work correctly

### 3.3 Manual Cache Clear Test

```bash
# Restart backend to clear all caches
pkill -f uvicorn
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000 --reload &

# Wait for startup
sleep 3

# Verify cache cleared (first prediction loads fresh)
curl -X POST http://localhost:8000/api/routing/predict \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"item_code": "ITEM_A001", "context": {}}'
```

**✅ Test Pass Criteria**:
- Service restarts successfully
- Model reloads from disk
- Predictions work correctly

---

## Phase 4: Training UI Testing (Frontend)

### 4.1 Start Frontend Development Server

```bash
# In separate terminal
cd frontend-training
npm install
npm run dev
```

**Expected Output**:
```
VITE v4.x.x  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### 4.2 Access Training UI

Open browser: `http://localhost:5173`

**Navigation Test**:
1. Login with test credentials
2. Click "모델 학습" (Model Training) in navigation menu
3. Verify ModelTrainingPanel component loads

**✅ Test Pass Criteria**:
- UI loads without errors
- Training panel displays correctly
- Navigation works

### 4.3 Test Training Workflow

**Test Case 1: Manual Version Name**

1. Enter version name: `staging-ui-test-v1`
2. Leave "Dry Run" unchecked
3. Click "학습 시작" (Start Training)

**Expected Behavior**:
- Button shows loading state
- Training starts (status: scheduled → running)
- Progress bar updates (0% → 100%)
- Status badge changes (Pending → Running → Completed)
- Duration counter increments
- Success message displayed

**✅ Test Pass Criteria**:
- Training starts without errors
- Real-time status updates every 3 seconds
- Progress bar reflects actual progress
- Final status shows "completed"
- Model version displayed correctly

**Test Case 2: Auto-Generated Version**

1. Leave version name empty
2. Check "Dry Run" checkbox
3. Click "학습 시작"

**Expected Behavior**:
- Auto-generates version name (e.g., `version_20251009120530`)
- Dry run executes (faster, no model saved)
- Status updates normally
- Completes successfully

**✅ Test Pass Criteria**:
- Auto-generated version name shown
- Dry run flag respected
- Status monitoring works

**Test Case 3: Error Handling**

1. Stop backend server (`pkill -f uvicorn`)
2. Try starting training

**Expected Behavior**:
- Error message displayed
- User-friendly error text (e.g., "학습 시작 실패")
- No UI crash
- Retry possible after backend restart

**✅ Test Pass Criteria**:
- Graceful error handling
- User-friendly error message
- UI remains functional

### 4.4 Verify Model Artifacts

After successful training via UI:

```bash
# Check model directory
ls -la ./models/staging-ui-test-v1/

# Verify metrics.json
cat ./models/staging-ui-test-v1/metrics.json | jq
```

**✅ Test Pass Criteria**:
- Model directory created
- All artifacts present (encoder, scaler, similarity_engine, manifest.json)
- metrics.json generated with correct data

---

## Phase 5: Integration Testing

### 5.1 End-to-End Prediction Flow

```bash
# 1. Train model via UI (use staging-e2e-v1 as version)
# 2. Verify model saved

# 3. Make prediction with new model
curl -X POST http://localhost:8000/api/routing/predict \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "item_code": "ITEM_A001",
    "context": {},
    "model_version": "staging-e2e-v1"
  }'
```

**Expected Response**:
```json
{
  "item_code": "ITEM_A001",
  "candidates": [
    {
      "process_code": "PROC_CUT",
      "score": 0.95,
      "duration_min": 10
    },
    {
      "process_code": "PROC_WELD",
      "score": 0.88,
      "duration_min": 15
    },
    ...
  ]
}
```

**✅ Test Pass Criteria**:
- Prediction uses newly trained model
- Candidates returned correctly
- Scores and durations realistic

### 5.2 Model Registry Integration

```bash
# Check model registry
curl http://localhost:8000/api/trainer/history \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected Response**:
```json
[
  {
    "label": "staging-e2e-v1",
    "timestamp": "2025-10-09T12:10:00Z",
    "metrics": { ... },
    "metadata": { ... }
  },
  {
    "label": "staging-api-v1",
    "timestamp": "2025-10-09T12:05:00Z",
    ...
  }
]
```

**✅ Test Pass Criteria**:
- All trained models listed
- Sorted by timestamp (newest first)
- Metrics included for each model

### 5.3 Concurrent Training Test

**Attempt 1**: Start training via API
```bash
curl -X POST http://localhost:8000/api/trainer/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version_label": "concurrent-1", "dry_run": false}'
```

**Attempt 2**: Immediately start another training (while first is running)
```bash
curl -X POST http://localhost:8000/api/trainer/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version_label": "concurrent-2", "dry_run": false}'
```

**Expected Behavior**:
- First training proceeds normally
- Second request returns error: "이미 학습 작업이 실행 중입니다."

**✅ Test Pass Criteria**:
- Only one training job runs at a time
- Second request rejected gracefully
- No data corruption or race conditions

---

## Phase 6: Performance Testing

### 6.1 Metrics Collection Overhead

```bash
# Train model and measure time
time python -m backend.cli.train_model \
  /tmp/staging_training_data.csv \
  --output-root ./models \
  --name perf-test-baseline
```

**Baseline**: Record training time without metrics

**With Metrics** (via API):
```bash
# Time the API training (includes metrics collection)
time curl -X POST http://localhost:8000/api/trainer/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version_label": "perf-test-with-metrics", "dry_run": false}'
```

**✅ Test Pass Criteria**:
- Metrics overhead < 5% of total training time
- For 13 samples: overhead < 100ms
- For 1,000 samples: overhead < 500ms

### 6.2 Cache Performance

```bash
# Cold start (first prediction after restart)
curl -X POST http://localhost:8000/api/routing/predict \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"item_code": "ITEM_A001", "context": {}}' \
  -w "\nTime: %{time_total}s\n"

# Warm cache (subsequent predictions)
for i in {1..10}; do
  curl -s -X POST http://localhost:8000/api/routing/predict \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"item_code": "ITEM_A001", "context": {}}' \
    -w "Time: %{time_total}s\n" -o /dev/null
done
```

**✅ Test Pass Criteria**:
- Cold start: < 500ms
- Warm cache: < 100ms
- Cache hit rate: > 95%

### 6.3 Training UI Responsiveness

**Manual Test**:
1. Start training with large dataset (1,000+ samples)
2. Monitor UI updates

**✅ Test Pass Criteria**:
- UI remains responsive during training
- Status updates every 3 seconds
- Progress bar smooth (no jumps)
- No UI freezing or lag

---

## Phase 7: Data Validation

### 7.1 Metrics Accuracy

Train model and manually verify metrics:

```python
from backend.api.services.model_metrics import calculate_model_metrics
import pandas as pd

# Load training data
df = pd.read_csv('/tmp/staging_training_data.csv')

# Simulate predictions (for testing, use actual labels)
y_true = df['PROC_CD'].tolist()
y_pred = y_true  # Perfect prediction for testing

# Calculate metrics
metrics = calculate_model_metrics(y_true, y_pred)
print(metrics)
```

**Expected**:
```python
{
  'accuracy': 1.0,  # Perfect prediction
  'precision_weighted': 1.0,
  'recall_weighted': 1.0,
  'f1_weighted': 1.0,
  'sample_count': 13
}
```

**✅ Test Pass Criteria**:
- Metrics calculation correct
- Accuracy = 1.0 for perfect predictions
- Weighted averages calculated correctly

### 7.2 Dataset Statistics

```python
from backend.api.services.model_metrics import evaluate_training_dataset

df = pd.read_csv('/tmp/staging_training_data.csv')
stats = evaluate_training_dataset(df)
print(stats)
```

**Expected**:
```python
{
  'total_samples': 13,
  'unique_items': 4,
  'unique_candidates': 4,
  'missing_rates': {
    'ITEM_CD': 0.0,
    'PROC_CD': 0.0,
    'DURATION_MIN': 0.0
  }
}
```

**✅ Test Pass Criteria**:
- Sample count correct
- Unique counts accurate
- Missing rates calculated correctly (0% for complete data)

---

## Phase 8: Regression Testing

### 8.1 Existing Functionality

Test that P2 improvements don't break existing features:

**Prediction API**:
```bash
curl -X POST http://localhost:8000/api/routing/predict \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"item_code": "ITEM_A001", "context": {}}'
```

**Data Quality API**:
```bash
curl http://localhost:8000/api/data-quality/metrics \
  -H "Authorization: Bearer $TOKEN"
```

**Routing Groups**:
```bash
curl http://localhost:8000/api/routing-groups \
  -H "Authorization: Bearer $TOKEN"
```

**✅ Test Pass Criteria**:
- All existing APIs work correctly
- No new errors in logs
- Response times unchanged

### 8.2 Backend Test Suite

```bash
export JWT_SECRET_KEY="staging-test-key-min-32-chars"
pytest tests/backend -v --tb=short
```

**✅ Test Pass Criteria**:
- 56/56 tests passing
- No new test failures
- All performance benchmarks passing

---

## Phase 9: Security Testing

### 9.1 Authentication

```bash
# Test without token
curl -X POST http://localhost:8000/api/trainer/run \
  -H "Content-Type: application/json" \
  -d '{"version_label": "unauthorized", "dry_run": false}'
```

**Expected**: 401 Unauthorized

### 9.2 Authorization

```bash
# Test with expired token (wait for JWT expiry)
# Or test with invalid token
curl -X POST http://localhost:8000/api/trainer/run \
  -H "Authorization: Bearer invalid_token_xyz" \
  -H "Content-Type: application/json" \
  -d '{"version_label": "unauthorized", "dry_run": false}'
```

**Expected**: 401 Unauthorized or 403 Forbidden

### 9.3 Input Validation

```bash
# Test with invalid input
curl -X POST http://localhost:8000/api/trainer/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version_label": "", "dry_run": "not_a_boolean"}'
```

**Expected**: 422 Unprocessable Entity with validation errors

**✅ Test Pass Criteria**:
- Unauthorized requests blocked
- Invalid inputs rejected
- Proper error messages returned

---

## Test Results Documentation

### Success Criteria Summary

| Phase | Test | Status | Notes |
|-------|------|--------|-------|
| 1 | Backend API | ☐ | Health check, auth |
| 2 | Model Metrics (P2-1) | ☐ | metrics.json generation |
| 3 | Cache Invalidation (P2-2) | ☐ | Manifest reload |
| 4 | Training UI | ☐ | Web interface |
| 5 | Integration | ☐ | End-to-end flow |
| 6 | Performance | ☐ | Overhead < 5% |
| 7 | Data Validation | ☐ | Metrics accuracy |
| 8 | Regression | ☐ | 56/56 tests pass |
| 9 | Security | ☐ | Auth/validation |

### Issues Log Template

| Issue # | Phase | Description | Severity | Status | Resolution |
|---------|-------|-------------|----------|--------|------------|
| 1 | | | | | |

### Sign-off

- [ ] All test phases completed
- [ ] No critical issues remaining
- [ ] Performance meets requirements
- [ ] Security validated
- [ ] Documentation updated

**Tested By**: _______________
**Date**: _______________
**Approved For Production**: ☐ Yes ☐ No

---

## Troubleshooting

### Common Issues

**Issue**: Training API returns 500 error
**Cause**: Database connection failure
**Solution**: Check DATABASE_URL, verify database accessible

**Issue**: metrics.json not generated
**Cause**: Training via CLI (bypasses API metrics logic)
**Solution**: Use API endpoint `/api/trainer/run` instead

**Issue**: Frontend can't connect to backend
**Cause**: CORS configuration
**Solution**: Add frontend URL to CORS_ALLOWED_ORIGINS

**Issue**: Cache not invalidating
**Cause**: File mtime not updating
**Solution**: Explicitly modify file or restart service

---

## Next Steps

After successful staging testing:

1. ✅ Document all test results
2. ✅ Resolve any issues found
3. ✅ Update deployment checklist
4. ✅ Proceed to production deployment

See [PRODUCTION_DEPLOYMENT_CHECKLIST.md](PRODUCTION_DEPLOYMENT_CHECKLIST.md) for production deployment steps.
