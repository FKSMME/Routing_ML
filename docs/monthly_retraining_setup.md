# Monthly Automatic Retraining Pipeline Setup

## Overview

Automated ML model retraining pipeline that runs monthly to keep the routing recommendations up-to-date with latest production data.

## Features

- 📅 **Scheduled Execution**: 1st of every month at 2:00 AM
- 🔄 **A/B Testing**: Compares new model with current production model
- 📊 **Data Extraction**: Automatically pulls latest training data from Access DB
- 🚀 **Auto-Deployment**: Deploys new model only if it performs better
- 📝 **Logging**: Comprehensive logs for each training run
- 🔔 **Notifications**: Slack/Teams alerts on success/failure
- 🧹 **Cleanup**: Removes models older than 6 months

## Installation

### 1. Cron Job Setup

Add the following line to your crontab:

```bash
# Edit crontab
crontab -e

# Add this line (runs at 2:00 AM on the 1st of every month)
0 2 1 * * /workspaces/Routing_ML_4/scripts/monthly_retrain.sh >> /workspaces/Routing_ML_4/logs/cron.log 2>&1
```

### 2. Environment Variables

Set Slack webhook URL for notifications (optional):

```bash
# Add to ~/.bashrc or /etc/environment
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

### 3. Verify Cron Configuration

```bash
# List current cron jobs
crontab -l

# Expected output:
# 0 2 1 * * /workspaces/Routing_ML_4/scripts/monthly_retrain.sh >> /workspaces/Routing_ML_4/logs/cron.log 2>&1
```

## Manual Execution

To manually trigger retraining (for testing):

```bash
# Dry run (check if script works)
bash -x /workspaces/Routing_ML_4/scripts/monthly_retrain.sh

# Production run
/workspaces/Routing_ML_4/scripts/monthly_retrain.sh
```

## Pipeline Workflow

### Step 1: Data Extraction
- Pulls last 100,000 routing records from Access DB
- Saves as Parquet file: `/mnt/backup/training_dataset_YYYYMM.parquet`
- Validates minimum data size (>1000 records required)

### Step 2: Model Training
- Runs `backend/cli/train_model.py` with extracted dataset
- Creates new model directory: `deliverables/models/model_YYYYMMDD_HHMMSS/`
- Exports TensorBoard projector with ITEM_CODE and ROUTING_NAME metadata
- Saves model artifacts: `model.pkl`, `scaler.pkl`, `index.bin`

### Step 3: A/B Testing
- Compares new model vs current production model (`models/active`)
- Evaluation metrics:
  - Model file size (proxy for training data volume)
  - In production: Accuracy, F1-score, Precision, Recall
- Deploys new model only if it outperforms current

### Step 4: Deployment
- Updates `models/active` symlink to new model (if better)
- Old production model remains for rollback
- API automatically picks up new model on next request

### Step 5: Cleanup
- Deletes model directories older than 180 days
- Keeps last 6 months of models for analysis

## Logs

Training logs are stored in:
```
/workspaces/Routing_ML_4/logs/retraining/retrain_YYYYMMDD.log
```

Log format:
```
[2025-10-01 02:00:01] ==========================================
[2025-10-01 02:00:01] Starting Monthly Retraining Pipeline
[2025-10-01 02:00:01] ==========================================
[2025-10-01 02:00:02] Step 1: Extracting training dataset...
[2025-10-01 02:00:15] Dataset size: 25.3 MiB
[2025-10-01 02:00:16] Step 2: Training new model...
[2025-10-01 02:15:30] ✅ New model trained: .../model_20251001_020002
[2025-10-01 02:15:31] Step 3: Running A/B test...
[2025-10-01 02:15:45] A/B Test Result: Winner = new
[2025-10-01 02:15:45] ✅ New model performs better - deploying...
[2025-10-01 02:15:45] Step 4: Cleaning up old models...
[2025-10-01 02:15:46] ✅ Monthly Retraining Complete!
```

## Monitoring

### Check Last Run Status

```bash
# View latest log
tail -100 /workspaces/Routing_ML_4/logs/retraining/retrain_*.log | head -50

# Check if retraining succeeded
grep "✅ Monthly Retraining Complete" /workspaces/Routing_ML_4/logs/retraining/retrain_*.log
```

### Verify Active Model

```bash
# Check which model is currently active
ls -la /workspaces/Routing_ML_4/deliverables/models/active

# Expected output:
# active -> /workspaces/Routing_ML_4/deliverables/models/model_20251001_020002
```

### List All Models

```bash
# Show all trained models with dates
ls -lt /workspaces/Routing_ML_4/deliverables/models/ | grep "^d"
```

## Rollback Procedure

If new model causes issues:

```bash
# List previous models
ls -lt /workspaces/Routing_ML_4/deliverables/models/ | grep "model_"

# Rollback to previous model (replace with actual directory name)
cd /workspaces/Routing_ML_4/deliverables/models/
ln -sfn model_20250901_020002 active

# Verify
ls -la active
# active -> model_20250901_020002

# Restart API server to pick up old model
pkill -f "uvicorn backend.run_api:app"
venv-linux/bin/python -m uvicorn backend.run_api:app --host 0.0.0.0 --port 8000 &
```

## Slack Notifications

### Success Notification
```
✅ Monthly Retraining Complete
Model: model_20251001_020002
Active: model_20251001_020002
Log: /workspaces/Routing_ML_4/logs/retraining/retrain_20251001.log
```

### Failure Notification
```
🚨 Monthly Retraining Failed
Line: 45
Log: /workspaces/Routing_ML_4/logs/retraining/retrain_20251001.log
```

## Troubleshooting

### Issue: Cron job doesn't run

```bash
# Check if cron service is running
systemctl status cron

# Start cron if stopped
sudo systemctl start cron

# Check cron logs
grep CRON /var/log/syslog | tail -20
```

### Issue: Insufficient training data

```bash
# Check data extraction
python3 -c "
from backend.database import get_routing_records_for_training
records = get_routing_records_for_training(limit=10)
print(f'Sample records: {len(records)}')
"
```

### Issue: Model training fails

```bash
# Test training manually with small dataset
cd /workspaces/Routing_ML_4
venv-linux/bin/python backend/cli/train_model.py \
    tests/fixtures/sample_dataset.csv \
    --output-root /tmp/test_models \
    --name test_model
```

### Issue: A/B test always picks old model

```bash
# Run evaluation manually
cd /workspaces/Routing_ML_4
venv-linux/bin/python -c "
import pickle
from pathlib import Path

new_model = Path('deliverables/models/model_20251001_020002/model.pkl')
old_model = Path('deliverables/models/active/model.pkl')

with open(new_model, 'rb') as f:
    new = pickle.load(f)
    print(f'New model: {type(new)}')

with open(old_model, 'rb') as f:
    old = pickle.load(f)
    print(f'Old model: {type(old)}')
"
```

## Advanced Configuration

### Custom Training Parameters

Edit `scripts/monthly_retrain.sh` to customize:

```bash
# Change training data range
DATASET_PATH="${DATA_BACKUP_DIR}/training_dataset_last_year.parquet"

# Modify model training command
"$PYTHON" "${REPO_ROOT}/backend/cli/train_model.py" \
    "$DATASET_PATH" \
    --output-root "$MODELS_DIR" \
    --name "model_custom_$(date +%Y%m%d)" \
    --projector-metadata ITEM_CODE ROUTING_NAME OPERATION_NO \
    --export-projector
```

### Integration with Monitoring

Add Prometheus metrics to track retraining:

```python
# In backend/api/routes/health.py
from prometheus_client import Counter, Gauge

retraining_count = Counter('routing_ml_retraining_total', 'Total retraining runs')
retraining_success = Gauge('routing_ml_retraining_success', 'Last retraining status (1=success, 0=fail)')
active_model_timestamp = Gauge('routing_ml_active_model_timestamp', 'Active model creation timestamp')
```

## References

- Training CLI: `backend/cli/train_model.py`
- Trainer Service: `backend/trainer_ml.py`
- Model Directory: `deliverables/models/`
- Backup Script: `scripts/backup_access_db.sh`

## Changelog

- **2025-10-05**: Initial setup with A/B testing and Slack notifications
- **Future**: Add accuracy-based A/B testing, GPU training support

## Contact

For issues or questions:
- Check logs: `/workspaces/Routing_ML_4/logs/retraining/`
- Review documentation: `docs/monthly_retraining_setup.md`
- Contact: ML Team <ml-team@company.com>
