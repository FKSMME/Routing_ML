# Model Metrics Monitoring Guide
**Version**: 1.0
**Date**: 2025-10-09
**Feature**: P2-1 Model Quality Metrics Collection

---

## Overview

This guide explains how to use the automated model metrics collection feature (P2-1) to monitor model quality, track performance over time, and identify degradation or drift.

### What's Included

- **metrics.json**: Auto-generated quality metrics for each trained model
- **Dataset statistics**: Sample counts, unique values, missing data rates
- **Training metadata**: Duration, timestamp, version info
- **Quality scores**: Accuracy, precision, recall, F1 (when evaluation data available)

---

## metrics.json Schema

### Example

```json
{
  "generated_at": "2025-10-09T12:00:00+00:00",
  "model_version": "production-v2",
  "training_samples": 1500,
  "dataset_stats": {
    "total_samples": 1500,
    "unique_items": 120,
    "unique_processes": 45,
    "unique_candidates": 45,
    "total_columns": 8,
    "column_names": ["ITEM_CD", "PROC_CD", "DURATION_MIN", ...],
    "missing_rates": {
      "ITEM_CD": 0.0,
      "PROC_CD": 0.0,
      "DURATION_MIN": 0.02
    }
  },
  "training_duration_sec": 3.5,
  "accuracy": 0.92,
  "precision_weighted": 0.89,
  "recall_weighted": 0.91,
  "f1_weighted": 0.90,
  "note": "Model quality metrics (accuracy, precision) require evaluation dataset"
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `generated_at` | ISO datetime | Timestamp when metrics generated |
| `model_version` | string | Model version identifier |
| `training_samples` | integer | Number of samples used for training |
| `dataset_stats` | object | Dataset statistics (see below) |
| `training_duration_sec` | float | Training time in seconds |
| `accuracy` | float | Overall accuracy (0-1), requires eval data |
| `precision_weighted` | float | Weighted precision (0-1) |
| `recall_weighted` | float | Weighted recall (0-1) |
| `f1_weighted` | float | Weighted F1 score (0-1) |
| `note` | string | Additional context or warnings |

### Dataset Statistics

| Field | Description |
|-------|-------------|
| `total_samples` | Total number of training records |
| `unique_items` | Number of unique item codes |
| `unique_processes` | Number of unique process codes |
| `unique_candidates` | Number of unique prediction targets |
| `total_columns` | Number of features in dataset |
| `column_names` | List of column names |
| `missing_rates` | Missing data percentage per column (0-1) |

---

## How Metrics Are Generated

### Automatic Generation (API Training)

When training via API (`/api/trainer/run`), metrics are **automatically generated**:

```bash
curl -X POST http://localhost:8000/api/trainer/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version_label": "production-v3",
    "dry_run": false
  }'
```

**Flow**:
1. Training starts via `training_service.py`
2. Dataset loaded and statistics collected
3. Model trained
4. `save_model_metrics()` called automatically
5. metrics.json written to model directory

**Location**: `models/production-v3/metrics.json`

---

### Manual Generation (CLI Training)

CLI training **does not automatically generate** metrics.json. Manually add metrics:

```python
from backend.api.services.model_metrics import save_model_metrics
from pathlib import Path

# Define metrics
metrics = {
    "training_samples": 1500,
    "dataset_stats": {
        "total_samples": 1500,
        "unique_items": 120,
        "unique_processes": 45,
        "missing_rates": {"ITEM_CD": 0.0, "PROC_CD": 0.0}
    },
    "training_duration_sec": 3.5,
    "accuracy": 0.92,
    "precision_weighted": 0.89,
    "recall_weighted": 0.91,
    "f1_weighted": 0.90
}

# Save to model directory
model_dir = Path('./models/cli-trained-v1')
save_model_metrics(model_dir, metrics, overwrite=True)
```

---

## Accessing Metrics

### Via File System

```bash
# View specific model metrics
cat models/production-v3/metrics.json | jq

# Compare multiple models
for dir in models/production-v*; do
  echo "=== $dir ==="
  cat $dir/metrics.json | jq '.accuracy, .f1_weighted'
done

# Extract key metrics
cat models/production-v3/metrics.json | jq '{
  version: .model_version,
  accuracy: .accuracy,
  f1: .f1_weighted,
  samples: .training_samples
}'
```

### Via API

```bash
# Get training history (includes metrics)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/trainer/history | jq

# Response includes metrics for each version
[
  {
    "label": "production-v3",
    "timestamp": "2025-10-09T12:00:00Z",
    "metrics": {
      "training_samples": 1500,
      "accuracy": 0.92,
      ...
    }
  },
  ...
]
```

### Via Python

```python
from backend.api.services.model_metrics import load_model_metrics
from pathlib import Path

# Load metrics
metrics = load_model_metrics(Path('./models/production-v3'))
print(f"Accuracy: {metrics.get('accuracy')}")
print(f"F1 Score: {metrics.get('f1_weighted')}")
print(f"Training Samples: {metrics.get('training_samples')}")
```

---

## Monitoring Model Quality

### Baseline Metrics

Establish baseline for your initial production model:

```bash
# Extract baseline metrics
cat models/production-v1/metrics.json | jq '{
  accuracy: .accuracy,
  precision: .precision_weighted,
  recall: .recall_weighted,
  f1: .f1_weighted,
  samples: .training_samples
}' > baseline_metrics.json
```

**Example Baseline**:
```json
{
  "accuracy": 0.92,
  "precision": 0.89,
  "recall": 0.91,
  "f1": 0.90,
  "samples": 1500
}
```

### Quality Thresholds

Define acceptable ranges for alerts:

| Metric | Baseline | Warning Threshold | Critical Threshold |
|--------|----------|-------------------|-------------------|
| Accuracy | 0.92 | <0.85 (-7.6%) | <0.80 (-13%) |
| Precision | 0.89 | <0.82 (-7.9%) | <0.75 (-16%) |
| Recall | 0.91 | <0.84 (-7.7%) | <0.78 (-14%) |
| F1 Score | 0.90 | <0.83 (-7.8%) | <0.77 (-14%) |

### Comparison Script

```python
import json
from pathlib import Path

def compare_models(baseline_path, new_path, thresholds):
    """Compare new model metrics against baseline."""
    with open(baseline_path) as f:
        baseline = json.load(f)
    with open(new_path) as f:
        new_metrics = json.load(f)

    metrics_to_check = ['accuracy', 'precision_weighted', 'recall_weighted', 'f1_weighted']
    alerts = []

    for metric in metrics_to_check:
        baseline_val = baseline.get(metric, 0)
        new_val = new_metrics.get(metric, 0)
        delta = new_val - baseline_val
        pct_change = (delta / baseline_val * 100) if baseline_val > 0 else 0

        # Check thresholds
        if new_val < thresholds[metric]['critical']:
            alerts.append(f"CRITICAL: {metric} = {new_val:.3f} (baseline {baseline_val:.3f}, {pct_change:+.1f}%)")
        elif new_val < thresholds[metric]['warning']:
            alerts.append(f"WARNING: {metric} = {new_val:.3f} (baseline {baseline_val:.3f}, {pct_change:+.1f}%)")
        else:
            print(f"✓ {metric} = {new_val:.3f} (baseline {baseline_val:.3f}, {pct_change:+.1f}%)")

    if alerts:
        print("\n🚨 Alerts:")
        for alert in alerts:
            print(f"  - {alert}")
        return False
    else:
        print("\n✅ All metrics within acceptable range")
        return True

# Usage
thresholds = {
    'accuracy': {'warning': 0.85, 'critical': 0.80},
    'precision_weighted': {'warning': 0.82, 'critical': 0.75},
    'recall_weighted': {'warning': 0.84, 'critical': 0.78},
    'f1_weighted': {'warning': 0.83, 'critical': 0.77}
}

compare_models(
    'models/production-v1/metrics.json',
    'models/production-v3/metrics.json',
    thresholds
)
```

**Expected Output** (good model):
```
✓ accuracy = 0.920 (baseline 0.920, +0.0%)
✓ precision_weighted = 0.890 (baseline 0.890, +0.0%)
✓ recall_weighted = 0.910 (baseline 0.910, +0.0%)
✓ f1_weighted = 0.900 (baseline 0.900, +0.0%)

✅ All metrics within acceptable range
```

**Expected Output** (degraded model):
```
✓ accuracy = 0.860 (baseline 0.920, -6.5%)
WARNING: precision_weighted = 0.810 (baseline 0.890, -9.0%)
WARNING: recall_weighted = 0.830 (baseline 0.910, -8.8%)
WARNING: f1_weighted = 0.820 (baseline 0.900, -8.9%)

🚨 Alerts:
  - WARNING: precision_weighted = 0.810 (baseline 0.890, -9.0%)
  - WARNING: recall_weighted = 0.830 (baseline 0.910, -8.8%)
  - WARNING: f1_weighted = 0.820 (baseline 0.900, -8.9%)
```

---

## Automated Monitoring

### Grafana Dashboard

Create Grafana dashboard to visualize metrics over time:

**Panel 1: Model Accuracy Trend**
```
# Prometheus query (requires custom exporter)
routing_ml_model_accuracy{version="production-v*"}
```

**Panel 2: Training Sample Count**
```
routing_ml_training_samples{version="production-v*"}
```

**Panel 3: F1 Score Comparison**
```
# Table showing latest 5 models
routing_ml_model_f1_score{version=~"production-v.*"}
| sort_desc
| topk(5)
```

### Alerting Rules

**Prometheus Alert Rules** (`alertmanager-rules.yml`):

```yaml
groups:
  - name: model_quality
    interval: 5m
    rules:
      - alert: ModelAccuracyDegraded
        expr: routing_ml_model_accuracy < 0.85
        for: 10m
        labels:
          severity: warning
          component: ml-model
        annotations:
          summary: "Model accuracy below warning threshold"
          description: "Model {{ $labels.version }} accuracy is {{ $value }}, below 0.85 threshold"

      - alert: ModelAccuracyCritical
        expr: routing_ml_model_accuracy < 0.80
        for: 5m
        labels:
          severity: critical
          component: ml-model
        annotations:
          summary: "Model accuracy critically low"
          description: "Model {{ $labels.version }} accuracy is {{ $value }}, below 0.80 critical threshold. Immediate action required."

      - alert: ModelDatasetSizeDecreased
        expr: routing_ml_training_samples < 1000
        for: 10m
        labels:
          severity: warning
          component: ml-model
        annotations:
          summary: "Training dataset unusually small"
          description: "Model {{ $labels.version }} trained with only {{ $value }} samples, expected >1000"
```

### Metrics Exporter Script

Custom script to export metrics to Prometheus:

```python
#!/usr/bin/env python3
"""Export model metrics to Prometheus."""

from prometheus_client import start_http_server, Gauge
import json
import time
from pathlib import Path

# Define metrics
model_accuracy = Gauge('routing_ml_model_accuracy', 'Model accuracy', ['version'])
model_f1 = Gauge('routing_ml_model_f1_score', 'Model F1 score', ['version'])
model_samples = Gauge('routing_ml_training_samples', 'Training samples', ['version'])
model_duration = Gauge('routing_ml_training_duration_sec', 'Training duration', ['version'])

def collect_metrics():
    """Collect metrics from all model directories."""
    models_dir = Path('./models')

    for model_dir in models_dir.iterdir():
        if not model_dir.is_dir() or model_dir.name.startswith('.'):
            continue

        metrics_file = model_dir / 'metrics.json'
        if not metrics_file.exists():
            continue

        try:
            with open(metrics_file) as f:
                metrics = json.load(f)

            version = metrics.get('model_version', model_dir.name)

            # Update Prometheus metrics
            if 'accuracy' in metrics:
                model_accuracy.labels(version=version).set(metrics['accuracy'])
            if 'f1_weighted' in metrics:
                model_f1.labels(version=version).set(metrics['f1_weighted'])
            if 'training_samples' in metrics:
                model_samples.labels(version=version).set(metrics['training_samples'])
            if 'training_duration_sec' in metrics:
                model_duration.labels(version=version).set(metrics['training_duration_sec'])

        except Exception as e:
            print(f"Error processing {metrics_file}: {e}")

if __name__ == '__main__':
    # Start Prometheus HTTP server on port 9100
    start_http_server(9100)
    print("Metrics exporter started on port 9100")

    # Collect metrics every 60 seconds
    while True:
        collect_metrics()
        time.sleep(60)
```

**Run**:
```bash
python3 /opt/routing-ml/scripts/metrics_exporter.py &

# Add to systemd for auto-start
sudo systemctl enable routing-ml-metrics-exporter
sudo systemctl start routing-ml-metrics-exporter
```

---

## Trend Analysis

### Historical Comparison

Track metrics over time to identify trends:

```python
import json
import pandas as pd
from pathlib import Path
import matplotlib.pyplot as plt

def analyze_model_trends(models_dir='./models'):
    """Analyze metrics trends across model versions."""
    data = []

    for model_dir in Path(models_dir).iterdir():
        if not model_dir.is_dir():
            continue

        metrics_file = model_dir / 'metrics.json'
        if not metrics_file.exists():
            continue

        with open(metrics_file) as f:
            metrics = json.load(f)

        data.append({
            'version': metrics.get('model_version', model_dir.name),
            'timestamp': metrics.get('generated_at'),
            'accuracy': metrics.get('accuracy'),
            'f1_weighted': metrics.get('f1_weighted'),
            'training_samples': metrics.get('training_samples'),
            'duration_sec': metrics.get('training_duration_sec')
        })

    df = pd.DataFrame(data)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp')

    # Plot trends
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))

    # Accuracy trend
    axes[0, 0].plot(df['timestamp'], df['accuracy'], marker='o')
    axes[0, 0].set_title('Model Accuracy Over Time')
    axes[0, 0].set_ylabel('Accuracy')
    axes[0, 0].axhline(y=0.85, color='orange', linestyle='--', label='Warning')
    axes[0, 0].axhline(y=0.80, color='red', linestyle='--', label='Critical')
    axes[0, 0].legend()

    # F1 score trend
    axes[0, 1].plot(df['timestamp'], df['f1_weighted'], marker='o', color='green')
    axes[0, 1].set_title('F1 Score Over Time')
    axes[0, 1].set_ylabel('F1 Score')

    # Training samples
    axes[1, 0].bar(df['version'], df['training_samples'])
    axes[1, 0].set_title('Training Samples per Version')
    axes[1, 0].set_ylabel('Sample Count')
    axes[1, 0].tick_params(axis='x', rotation=45)

    # Training duration
    axes[1, 1].plot(df['timestamp'], df['duration_sec'], marker='s', color='purple')
    axes[1, 1].set_title('Training Duration Over Time')
    axes[1, 1].set_ylabel('Duration (seconds)')

    plt.tight_layout()
    plt.savefig('model_trends.png')
    print("Trend analysis saved to model_trends.png")

    return df

# Usage
df = analyze_model_trends()
print("\nSummary Statistics:")
print(df[['accuracy', 'f1_weighted', 'training_samples']].describe())
```

---

## Data Quality Insights

### Missing Data Analysis

```python
def analyze_missing_data(metrics_file):
    """Analyze missing data rates from metrics."""
    with open(metrics_file) as f:
        metrics = json.load(f)

    missing_rates = metrics.get('dataset_stats', {}).get('missing_rates', {})

    print(f"Missing Data Analysis for {metrics.get('model_version')}")
    print("=" * 50)

    for column, rate in sorted(missing_rates.items(), key=lambda x: x[1], reverse=True):
        pct = rate * 100
        status = "🔴" if pct > 10 else "🟡" if pct > 5 else "🟢"
        print(f"{status} {column}: {pct:.1f}% missing")

    # Alert if high missing rates
    high_missing = {k: v for k, v in missing_rates.items() if v > 0.10}
    if high_missing:
        print(f"\n⚠️  Warning: {len(high_missing)} column(s) with >10% missing data")
        print("Consider data cleaning or imputation before retraining")

# Usage
analyze_missing_data('models/production-v3/metrics.json')
```

**Output**:
```
Missing Data Analysis for production-v3
==================================================
🟢 ITEM_CD: 0.0% missing
🟢 PROC_CD: 0.0% missing
🟡 DURATION_MIN: 7.5% missing
🔴 OPTIONAL_FIELD: 15.2% missing

⚠️  Warning: 1 column(s) with >10% missing data
Consider data cleaning or imputation before retraining
```

---

## Best Practices

### 1. Always Train via API

✅ **Do**: Use `/api/trainer/run` endpoint
```bash
curl -X POST http://localhost:8000/api/trainer/run \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"version_label": "v1", "dry_run": false}'
```

❌ **Don't**: Use CLI training (skips metrics)
```bash
python -m backend.cli.train_model dataset.csv  # No metrics.json
```

### 2. Review Metrics Before Deployment

Before activating a new model in production:

1. **Check metrics.json**:
   ```bash
   cat models/new-version/metrics.json | jq
   ```

2. **Compare with baseline**:
   ```python
   compare_models('models/baseline/metrics.json', 'models/new-version/metrics.json')
   ```

3. **Verify quality thresholds met**:
   - Accuracy ≥ 0.85
   - F1 Score ≥ 0.83
   - Training samples ≥ 1000

4. **Check for data issues**:
   - Missing rates < 10%
   - Sufficient unique items/processes
   - Reasonable training duration

### 3. Monitor Trends, Not Just Snapshots

Track metrics over time to detect gradual degradation:

```python
# Weekly trend check
df = analyze_model_trends()
recent_accuracy = df.tail(5)['accuracy'].mean()
baseline_accuracy = df.head(5)['accuracy'].mean()

if recent_accuracy < baseline_accuracy * 0.95:  # 5% degradation
    print("⚠️  Model quality trending down, consider retraining")
```

### 4. Document Quality Baselines

Maintain a `baseline_metrics.json` file:

```json
{
  "baseline_version": "production-v1",
  "established_date": "2025-10-01",
  "quality_thresholds": {
    "accuracy": {"target": 0.92, "warning": 0.85, "critical": 0.80},
    "f1_weighted": {"target": 0.90, "warning": 0.83, "critical": 0.77}
  },
  "expected_dataset": {
    "min_samples": 1000,
    "min_unique_items": 50,
    "max_missing_rate": 0.10
  }
}
```

### 5. Automate Quality Checks

Integrate into CI/CD pipeline:

```yaml
# .github/workflows/model-quality-check.yml
name: Model Quality Check

on:
  push:
    paths:
      - 'models/**metrics.json'

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Check Model Quality
        run: |
          python scripts/compare_metrics.py \
            --baseline models/baseline/metrics.json \
            --new models/${{ github.event.head_commit.message }}/metrics.json \
            --fail-on-warning

      - name: Post Results
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          payload: |
            {
              "text": "⚠️  Model quality check failed for ${{ github.sha }}"
            }
```

---

## Troubleshooting

### metrics.json Not Generated

**Problem**: Model trained but metrics.json missing

**Check**:
```bash
ls -la models/new-version/ | grep metrics.json
```

**Solutions**:
1. **Verify trained via API**: CLI training doesn't generate metrics
2. **Check logs for errors**:
   ```bash
   docker-compose logs routing-ml-backend | grep -i "metrics\|error"
   ```
3. **Manual generation** (if needed):
   ```python
   from backend.api.services.model_metrics import save_model_metrics
   save_model_metrics(Path('./models/new-version'), {...}, overwrite=True)
   ```

### Incomplete Metrics

**Problem**: metrics.json exists but missing accuracy/F1 scores

**Explanation**: Quality metrics (accuracy, precision, recall, F1) require **evaluation dataset**. If only training data available, these fields will be empty or show placeholder note.

**Solution**:
1. Provide separate evaluation dataset during training
2. Calculate metrics post-training:
   ```python
   from backend.api.services.model_metrics import calculate_model_metrics

   # Use holdout test set
   y_true = test_data['PROC_CD'].tolist()
   y_pred = model.predict(test_data)

   metrics = calculate_model_metrics(y_true, y_pred)
   # Update metrics.json manually
   ```

---

## Next Steps

1. ✅ **Set Baseline**: Establish quality baseline from initial production model
2. ✅ **Configure Alerts**: Set up Grafana alerts for quality degradation
3. ✅ **Automate Comparison**: Add quality check to deployment pipeline
4. ✅ **Monitor Trends**: Schedule weekly trend analysis
5. ✅ **Document Learnings**: Update baseline as system evolves

---

## References

- [Testing Verification Report](TESTING_VERIFICATION_REPORT.md) - Test results for metrics collection
- [Operational Runbook](OPERATIONAL_RUNBOOK.md) - Day-to-day operations including model deployment
- [Production Monitoring Setup](PRODUCTION_MONITORING_SETUP.md) - Prometheus/Grafana configuration
- [model_metrics.py](../backend/api/services/model_metrics.py) - Source code for metrics calculation
