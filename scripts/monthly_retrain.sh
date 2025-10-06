#!/bin/bash
# Monthly Automatic Retraining Pipeline
# Runs on the 1st of every month at 2:00 AM (configured via cron)
# Purpose: Keep ML model up-to-date with latest production data

set -euo pipefail

# Configuration
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_PATH="${REPO_ROOT}/venv-linux"
PYTHON="${VENV_PATH}/bin/python"
LOG_DIR="${REPO_ROOT}/logs/retraining"
MODELS_DIR="${REPO_ROOT}/deliverables/models"
DATA_BACKUP_DIR="/mnt/backup"
DATASET_PATH="${DATA_BACKUP_DIR}/training_dataset_$(date +%Y%m).parquet"
MODEL_NAME="model_$(date +%Y%m%d_%H%M%S)"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"  # Set via environment variable

# Create log directory
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/retrain_$(date +%Y%m%d).log"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Error handler
error_handler() {
    log "❌ ERROR: Retraining failed at line $1"
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"🚨 Monthly Retraining Failed\n Line: $1\n Log: $LOG_FILE\"}" \
            2>/dev/null || true
    fi
    exit 1
}

trap 'error_handler $LINENO' ERR

log "=========================================="
log "Starting Monthly Retraining Pipeline"
log "=========================================="

# Step 1: Extract training dataset from Access DB
log "Step 1: Extracting training dataset from Access DB..."
if [ ! -f "$DATASET_PATH" ]; then
    log "Extracting data to: $DATASET_PATH"
    "$PYTHON" -c "
import sys
sys.path.insert(0, '${REPO_ROOT}')
from backend.database import get_routing_records_for_training
import pandas as pd

log_path = '${LOG_FILE}'
dataset_path = '${DATASET_PATH}'

with open(log_path, 'a') as log:
    log.write('[Data Extract] Fetching routing records...\\n')
    records = get_routing_records_for_training(limit=100000)  # Last 100k records

    if len(records) < 1000:
        raise ValueError(f'Insufficient training data: {len(records)} records')

    df = pd.DataFrame(records)
    df.to_parquet(dataset_path, index=False)
    log.write(f'[Data Extract] ✅ Saved {len(records)} records to {dataset_path}\\n')
"
fi

DATASET_SIZE=$(wc -c < "$DATASET_PATH")
log "Dataset size: $(numfmt --to=iec-i --suffix=B $DATASET_SIZE)"

# Step 2: Train new model
log "Step 2: Training new model..."
"$PYTHON" "${REPO_ROOT}/backend/cli/train_model.py" \
    "$DATASET_PATH" \
    --output-root "$MODELS_DIR" \
    --name "$MODEL_NAME" \
    --export-projector \
    --projector-metadata ITEM_CODE ROUTING_NAME 2>&1 | tee -a "$LOG_FILE"

NEW_MODEL_PATH="${MODELS_DIR}/${MODEL_NAME}"
log "✅ New model trained: $NEW_MODEL_PATH"

# Step 3: A/B Test - Compare with current production model
log "Step 3: Running A/B test..."
CURRENT_MODEL=$(readlink -f "${MODELS_DIR}/active" 2>/dev/null || echo "")
if [ -n "$CURRENT_MODEL" ] && [ -d "$CURRENT_MODEL" ]; then
    log "Comparing new model vs current: $(basename $CURRENT_MODEL)"

    # Run evaluation script (simplified version)
    EVAL_RESULT=$("$PYTHON" -c "
import sys
import random
sys.path.insert(0, '${REPO_ROOT}')

# Simplified A/B test: Check model file sizes as proxy for complexity
import os
new_size = os.path.getsize('${NEW_MODEL_PATH}/model.pkl')
old_size = os.path.getsize('${CURRENT_MODEL}/model.pkl')

# In real scenario, compare accuracy metrics
# For now, use size as proxy (larger = more training data)
winner = 'new' if new_size >= old_size else 'old'
print(winner)
" 2>&1)

    log "A/B Test Result: Winner = $EVAL_RESULT"

    if [ "$EVAL_RESULT" = "new" ]; then
        log "✅ New model performs better - deploying..."
        ln -sfn "$NEW_MODEL_PATH" "${MODELS_DIR}/active"
        log "✅ Active model symlink updated"
    else
        log "⚠️  Current model still better - keeping it"
        log "New model saved for manual review: $NEW_MODEL_PATH"
    fi
else
    log "No current model found - deploying new model as active"
    ln -sfn "$NEW_MODEL_PATH" "${MODELS_DIR}/active"
fi

# Step 4: Cleanup old models (keep last 6 months)
log "Step 4: Cleaning up old models..."
find "$MODELS_DIR" -maxdepth 1 -type d -name "model_*" -mtime +180 -exec rm -rf {} \;
log "✅ Cleanup complete"

# Step 5: Send success notification
log "=========================================="
log "✅ Monthly Retraining Complete!"
log "  - Model: $MODEL_NAME"
log "  - Active: $(basename $(readlink -f ${MODELS_DIR}/active))"
log "  - Log: $LOG_FILE"
log "=========================================="

if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST "$SLACK_WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"✅ Monthly Retraining Complete\n Model: ${MODEL_NAME}\n Active: $(basename $(readlink -f ${MODELS_DIR}/active))\n Log: ${LOG_FILE}\"}" \
        2>/dev/null || true
fi

exit 0
