# Concept Drift Detection System

## Overview

The Concept Drift Detection system monitors prediction distributions in real-time to detect when the ML model's predictions are diverging from the training data distribution. When drift is detected, it automatically triggers retraining to maintain model accuracy.

## What is Concept Drift?

**Concept Drift** occurs when the statistical properties of the target variable (predictions) change over time in unforeseen ways. In the routing ML system, this can happen due to:

- **New product types** not seen during training
- **Process changes** in manufacturing
- **Seasonal variations** in routing patterns
- **Data quality degradation**
- **Equipment upgrades** changing operation sequences

## Detection Method: KL Divergence

We use **Kullback-Leibler (KL) Divergence** to measure the difference between two probability distributions:

```
D_KL(P || Q) = Σ P(x) * log(P(x) / Q(x))
```

Where:
- **P** = Current prediction distribution (recent 1000 predictions)
- **Q** = Baseline distribution (from training/validation data)
- **Threshold** = 0.5 (configurable)

### Interpretation

- **KL < 0.3**: Normal operation, predictions match training distribution
- **0.3 < KL < 0.5**: Minor drift, monitor closely
- **KL > 0.5**: Significant drift detected, retraining recommended
- **KL > 1.0**: Severe drift, immediate retraining required

## Architecture

### Components

1. **ConceptDriftDetector** (`backend/ml/concept_drift_detector.py`)
   - Maintains rolling window of recent predictions
   - Compares with baseline distribution
   - Tracks drift history

2. **Drift API** (`backend/api/routes/drift.py`)
   - `/api/drift/status` - Current drift status
   - `/api/drift/summary` - Historical drift summary
   - `/api/drift/reset` - Reset after retraining

3. **Prediction Integration**
   - Each prediction adds score to drift detector
   - Automatic drift check on every N predictions
   - Logs warning when drift detected

## Usage

### 1. Initialize Baseline Distribution

After training a new model, set the baseline distribution:

```python
from backend.ml.concept_drift_detector import initialize_baseline_from_model
from pathlib import Path

# Load baseline from model validation results
model_dir = Path("deliverables/models/model_20251001_020002")
initialize_baseline_from_model(model_dir)
```

The baseline distribution is automatically loaded from `model_dir/validation_scores.npy`.

### 2. Monitor Predictions

During prediction, scores are automatically tracked:

```python
from backend.ml.concept_drift_detector import get_drift_detector

detector = get_drift_detector()

# After each prediction
drift_detected, kl_div = detector.add_prediction(similarity_score)

if drift_detected:
    print(f"⚠️  Drift detected! KL Divergence: {kl_div:.3f}")

    if detector.should_retrain():
        print("🔄 Triggering retraining...")
        # Trigger monthly_retrain.sh script
```

### 3. Check Drift Status via API

#### Get Current Status

```bash
curl http://localhost:8000/api/drift/status | jq

# Response:
{
  "drift_detected": true,
  "kl_divergence": 0.62,
  "threshold": 0.5,
  "buffer_size": 1000,
  "buffer_mean": 0.73,
  "buffer_std": 0.15,
  "should_retrain": false
}
```

#### Get 7-Day Summary

```bash
curl "http://localhost:8000/api/drift/summary?days=7" | jq

# Response:
{
  "period_days": 7,
  "drift_count": 3,
  "max_kl_divergence": 0.72,
  "avg_kl_divergence": 0.58,
  "should_retrain": false,
  "events": [
    {
      "timestamp": "2025-10-04T14:32:10.123Z",
      "kl_divergence": 0.58,
      "threshold": 0.5,
      "buffer_size": 1000,
      "buffer_mean": 0.71,
      "buffer_std": 0.14
    }
  ]
}
```

#### Reset After Retraining

```bash
curl -X POST http://localhost:8000/api/drift/reset

# Response:
{
  "message": "Drift detector buffer reset successfully",
  "timestamp": "2025-10-05T02:15:30.456Z"
}
```

## Retraining Triggers

The system recommends retraining when:

### Condition 1: Frequent Drift
- **> 5 drift events** in last 7 days
- Indicates persistent distribution shift
- Action: Schedule retraining within 24 hours

### Condition 2: Severe Drift
- **Max KL Divergence > 1.0** in any event
- Indicates major concept shift
- Action: Immediate retraining required

### Example Workflow

```python
from backend.ml.concept_drift_detector import get_drift_detector
import subprocess

detector = get_drift_detector()

if detector.should_retrain():
    print("🚨 Retraining required!")

    # Trigger retraining script
    subprocess.run([
        "/workspaces/Routing_ML_4/scripts/monthly_retrain.sh"
    ], check=True)

    # Reset drift detector after successful retraining
    detector.reset_buffer()
```

## Integration with Monthly Retraining

The monthly retraining script automatically checks drift status:

```bash
# In scripts/monthly_retrain.sh
DRIFT_STATUS=$(curl -s http://localhost:8000/api/drift/summary?days=30 | jq '.should_retrain')

if [ "$DRIFT_STATUS" = "true" ]; then
    echo "⚠️  Drift detected - proceeding with retraining"
else
    echo "✅ No drift detected - skipping retraining this month"
    exit 0
fi
```

## Monitoring & Alerts

### Grafana Dashboard

Add drift metrics to Grafana:

```promql
# Current KL Divergence
routing_ml_drift_kl_divergence{job="routing-ml"}

# Drift events count (last 7 days)
increase(routing_ml_drift_events_total[7d])
```

### Slack Alerts

Configure Slack webhook for drift notifications:

```bash
# Set webhook URL
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Test drift alert
curl -X POST "$SLACK_WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "🚨 Concept Drift Detected\n KL Divergence: 0.65\n Threshold: 0.5\n Status: /api/drift/status"
  }'
```

## Troubleshooting

### Issue: False Positives

**Symptom**: Frequent drift alerts but model still performs well

**Solution**:
```python
# Increase threshold
detector = get_drift_detector()
detector.threshold = 0.7  # From default 0.5

# Or increase window size for more stable distribution
detector = ConceptDriftDetector(window_size=2000)  # From 1000
```

### Issue: No Baseline Set

**Symptom**: `WARNING: No baseline distribution set`

**Solution**:
```bash
# Generate validation scores during training
cd /workspaces/Routing_ML_4
venv-linux/bin/python backend/cli/train_model.py \
    dataset.parquet \
    --output-root deliverables/models \
    --name model_with_validation

# Baseline will be saved in model_with_validation/validation_scores.npy
```

### Issue: Drift Detected After Deployment

**Symptom**: Immediate drift alert after deploying new model

**Solution**:
```bash
# Reset drift detector via API
curl -X POST http://localhost:8000/api/drift/reset

# Or manually clear state
rm /workspaces/Routing_ML_4/data/drift_detector.pkl
```

## Performance Impact

- **Memory**: ~40KB for 1000-sample rolling buffer
- **CPU**: < 1ms per prediction (histogram + KL divergence)
- **Storage**: Drift history ~10KB per day

## Best Practices

### 1. Baseline Validation
Always validate baseline distribution after training:
```bash
import numpy as np
scores = np.load("deliverables/models/active/validation_scores.npy")
print(f"Baseline: mean={scores.mean():.3f}, std={scores.std():.3f}")
```

### 2. Regular Review
Review drift summary weekly:
```bash
# Add to cron
0 9 * * MON curl http://localhost:8000/api/drift/summary?days=7 | \
    mail -s "Weekly Drift Report" ml-team@company.com
```

### 3. Threshold Tuning
Start conservative, tune based on false positive rate:
```python
# Monitor for 2 weeks
detector.threshold = 0.5  # Initial

# Adjust based on alerts
if false_positives > 3:
    detector.threshold = 0.6
```

## References

- Original Paper: "Learning under Concept Drift" (Gama et al., 2014)
- KL Divergence: https://en.wikipedia.org/wiki/Kullback%E2%80%93Leibler_divergence
- Drift Detector Code: `backend/ml/concept_drift_detector.py`
- API Endpoints: `backend/api/routes/drift.py`

## Changelog

- **2025-10-05**: Initial implementation with KL Divergence
- **Future**: Add Kolmogorov-Smirnov test, ADWIN algorithm

## Contact

For drift detection issues:
- Check logs: `/workspaces/Routing_ML_4/logs/*.log | grep drift`
- Review documentation: `docs/concept_drift_detection.md`
- Contact: ML Team <ml-team@company.com>
