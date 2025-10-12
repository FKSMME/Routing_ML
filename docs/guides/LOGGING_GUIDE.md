# Logging Guide

## Overview

The Routing ML system uses structured logging with support for both human-readable text format and machine-parseable JSON format. This guide explains how to configure, use, and monitor logging effectively.

## Quick Start

### Development Environment

```bash
# .env (development)
LOG_LEVEL=DEBUG
LOG_FORMAT=text
LOG_TO_FILE=true
```

```python
from common.logger import get_logger

logger = get_logger("my_service")
logger.debug("Detailed debugging information")
logger.info("General information")
logger.warning("Warning message")
logger.error("Error occurred", extra={"user_id": 123, "action": "login"})
```

### Production Environment

```bash
# .env (production)
LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_TO_FILE=true
```

Output (JSON format):
```json
{
  "timestamp": "2025-10-09 01:15:30",
  "name": "my_service",
  "level": "INFO",
  "message": "User logged in successfully",
  "filename": "auth.py",
  "lineno": 45,
  "funcName": "login",
  "threadName": "MainThread",
  "user_id": 123,
  "session_id": "abc123xyz"
}
```

## Configuration

### Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `LOG_LEVEL` | DEBUG, INFO, WARNING, ERROR, CRITICAL | INFO | Minimum log level to record |
| `LOG_FORMAT` | json, text | text | Log output format |
| `LOG_TO_FILE` | true, false | true | Enable file logging |

### Logger Factory

```python
from common.logger import get_logger

# Basic logger (respects environment variables)
logger = get_logger("my_service")

# Override environment variables
logger = get_logger(
    "my_service",
    level=logging.DEBUG,  # Override LOG_LEVEL
    use_json=True,        # Override LOG_FORMAT
    log_to_file=False,    # Override LOG_TO_FILE
    log_dir="custom/path",
    max_bytes=20 * 1024 * 1024,  # 20MB
    backup_count=10,
)
```

## Log Formats

### Text Format (Development)

**Human-readable**, easy to read in console:

```
2025-10-09 01:15:30 | my_service | INFO     | [auth.py:45] | login | MainThread | User logged in successfully
```

**Pros**:
- Easy to read during development
- No parsing required for quick debugging
- Color-coded in most terminals

**Cons**:
- Hard to parse programmatically
- Not suitable for log aggregation tools
- No structured metadata

### JSON Format (Production)

**Machine-parseable**, ideal for log aggregation:

```json
{
  "timestamp": "2025-10-09 01:15:30",
  "name": "my_service",
  "level": "INFO",
  "message": "User logged in successfully",
  "filename": "auth.py",
  "lineno": 45,
  "funcName": "login",
  "threadName": "MainThread",
  "user_id": 123,
  "session_id": "abc123xyz",
  "request_id": "req-789",
  "correlation_id": "corr-456"
}
```

**Pros**:
- Easy to parse with tools (jq, Elasticsearch, Splunk)
- Structured metadata
- Supports complex data types
- Ideal for centralized logging

**Cons**:
- Hard to read raw format
- Larger file size (~30% overhead)

## Usage Examples

### Basic Logging

```python
from common.logger import get_logger

logger = get_logger("api.prediction")

logger.info("Prediction request received")
logger.warning("Model confidence below threshold", extra={"confidence": 0.65})
logger.error("Failed to load model", exc_info=True)
```

### Structured Logging with Context

```python
logger.info(
    "Routing prediction completed",
    extra={
        "user_id": 123,
        "item_code": "ITEM-001",
        "predicted_route": "WC-05",
        "confidence": 0.92,
        "latency_ms": 45,
        "model_version": "v3.2",
    }
)
```

Output (JSON):
```json
{
  "timestamp": "2025-10-09 01:20:15",
  "name": "api.prediction",
  "level": "INFO",
  "message": "Routing prediction completed",
  "filename": "prediction.py",
  "lineno": 128,
  "funcName": "predict_route",
  "threadName": "uvicorn-worker-1",
  "user_id": 123,
  "item_code": "ITEM-001",
  "predicted_route": "WC-05",
  "confidence": 0.92,
  "latency_ms": 45,
  "model_version": "v3.2"
}
```

### Exception Logging

```python
try:
    result = predict_routing(item_code)
except ModelNotFoundError as e:
    logger.error(
        f"Model not found for item {item_code}",
        exc_info=True,  # Include stack trace
        extra={
            "item_code": item_code,
            "error_type": "ModelNotFoundError",
            "model_path": "/app/models/default",
        }
    )
    raise
```

### Performance Logging

```python
from common.logger import performance_logger
import time

start = time.time()
result = expensive_operation()
elapsed = time.time() - start

performance_logger.info(
    "Expensive operation completed",
    extra={
        "operation": "data_aggregation",
        "duration_ms": elapsed * 1000,
        "row_count": 10000,
        "throughput_rows_per_sec": 10000 / elapsed,
    }
)
```

### Audit Logging

```python
from common.logger import audit_routing_event

audit_routing_event(
    action="routing.snapshot.save",
    payload={
        "snapshot_id": "snap-123",
        "item_count": 50,
        "group_name": "ProductionRoutes",
    },
    result="success",
    username="user@example.com",
    client_host="192.168.1.10",
    request_id="req-abc123",
    correlation_id="corr-xyz789",
)
```

## Log Levels

### DEBUG (Development Only)

**When to use**:
- Detailed variable values
- Step-by-step execution flow
- Temporary debugging

**Example**:
```python
logger.debug(f"Processing item {item_code}, current step: validation")
logger.debug(f"Model input features: {features}")
```

**⚠️ Never use DEBUG in production** - generates too much noise

### INFO (Default)

**When to use**:
- Normal operations
- API requests/responses
- Business events (user login, order placed)
- Performance metrics

**Example**:
```python
logger.info("Prediction API request received", extra={"item_code": "ITEM-001"})
logger.info("Model loaded successfully", extra={"model_version": "v3.2"})
```

### WARNING

**When to use**:
- Deprecated features used
- Non-critical errors (retry succeeded)
- Configuration issues (using defaults)
- Performance degradation

**Example**:
```python
logger.warning("Model confidence below threshold", extra={"confidence": 0.65, "threshold": 0.8})
logger.warning("Slow database query detected", extra={"duration_ms": 2500})
```

### ERROR

**When to use**:
- Failed operations (cannot proceed)
- External service failures
- Data validation errors
- Unhandled exceptions

**Example**:
```python
logger.error("Failed to connect to database", exc_info=True, extra={"host": "db.example.com"})
logger.error("Invalid item code format", extra={"item_code": "INVALID-123"})
```

### CRITICAL

**When to use**:
- System-level failures
- Data corruption
- Security breaches
- Service unavailable

**Example**:
```python
logger.critical("Database connection pool exhausted", extra={"active_connections": 100})
logger.critical("Model file corrupted", extra={"model_path": "/app/models/default"})
```

## Log Storage

### File Rotation

Logs are automatically rotated to prevent disk space issues:

- **Max file size**: 10 MB (configurable)
- **Backup count**: 5 files (configurable)
- **Naming**: `{logger_name}_{YYYYMMDD}.log`

**Example directory structure**:
```
logs/
├── routing_ml_20251009.log      (current)
├── routing_ml_20251009.log.1    (backup 1)
├── routing_ml_20251009.log.2    (backup 2)
├── routing_ml_20251009.log.3    (backup 3)
├── routing_ml_20251009.log.4    (backup 4)
├── routing_ml_20251009.log.5    (backup 5)
├── performance/
│   └── performance.training_20251009.log
└── audit/
    └── ui_actions.log
```

### Log Retention

**Recommended policies**:

| Environment | Retention | Format | Storage |
|-------------|-----------|--------|---------|
| Development | 7 days | Text | Local disk |
| Staging | 30 days | JSON | S3/Azure Blob |
| Production | 90 days | JSON | S3/Azure Blob |
| Audit logs | 1 year | JSON | S3 Glacier |

**Cleanup script**:
```bash
# Delete logs older than 30 days
find logs/ -name "*.log*" -mtime +30 -delete

# Archive old logs to S3
aws s3 sync logs/ s3://routing-ml-logs/$(date +%Y%m%d)/ \
    --exclude "*" --include "*.log*" \
    && find logs/ -name "*.log.*" -delete
```

## Log Analysis

### Using jq (JSON logs)

```bash
# Filter by log level
cat logs/routing_ml_20251009.log | jq 'select(.level == "ERROR")'

# Extract user IDs from login events
cat logs/routing_ml_20251009.log | jq 'select(.message | contains("login")) | .user_id'

# Calculate average latency
cat logs/routing_ml_20251009.log | jq -s 'map(.latency_ms) | add/length'

# Group by error type
cat logs/routing_ml_20251009.log | jq -s 'group_by(.error_type) | map({error: .[0].error_type, count: length})'
```

### Using grep (Text logs)

```bash
# Find all ERROR logs
grep "ERROR" logs/routing_ml_20251009.log

# Find logs for specific user
grep "user_id.*123" logs/routing_ml_20251009.log

# Count warnings by type
grep "WARNING" logs/routing_ml_20251009.log | awk '{print $NF}' | sort | uniq -c
```

### Using Elasticsearch

```bash
# Index logs into Elasticsearch
cat logs/routing_ml_20251009.log | while read line; do
  curl -X POST "localhost:9200/routing-ml-logs/_doc" \
    -H 'Content-Type: application/json' \
    -d "$line"
done

# Query errors in the last hour
curl -X GET "localhost:9200/routing-ml-logs/_search" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": {
      "bool": {
        "must": [
          {"match": {"level": "ERROR"}},
          {"range": {"timestamp": {"gte": "now-1h"}}}
        ]
      }
    }
  }'
```

## Monitoring and Alerting

### Prometheus Metrics from Logs

```python
from prometheus_client import Counter, Histogram

# Count errors by type
error_counter = Counter(
    'routing_ml_errors_total',
    'Total errors by type',
    ['error_type']
)

# Track latency
latency_histogram = Histogram(
    'routing_ml_latency_seconds',
    'Request latency',
    ['endpoint']
)

# In your code
try:
    result = process_request()
except SpecificError as e:
    error_counter.labels(error_type='SpecificError').inc()
    logger.error("Processing failed", exc_info=True)
```

### Alert Rules

**Grafana Loki alert examples**:

```yaml
# Alert on high error rate
- alert: HighErrorRate
  expr: |
    sum(rate({job="routing-ml"} |= "ERROR" [5m])) > 10
  for: 5m
  annotations:
    summary: "High error rate detected"
    description: "More than 10 errors per second in the last 5 minutes"

# Alert on slow queries
- alert: SlowDatabaseQueries
  expr: |
    avg_over_time({job="routing-ml"} |= "Slow database query" | json | unwrap duration_ms [5m]) > 1000
  for: 2m
  annotations:
    summary: "Slow database queries detected"
    description: "Average query time exceeded 1000ms"
```

## Best Practices

### 1. Log Contextual Information

✅ **Good**:
```python
logger.error(
    "Failed to predict routing",
    extra={
        "item_code": "ITEM-001",
        "user_id": 123,
        "model_version": "v3.2",
        "error_type": "TimeoutError",
    }
)
```

❌ **Bad**:
```python
logger.error("Prediction failed")  # No context!
```

### 2. Use Appropriate Log Levels

✅ **Good**:
```python
logger.info("Request received", extra={"item_code": "ITEM-001"})
logger.warning("Confidence below threshold", extra={"confidence": 0.65})
logger.error("Database connection failed", exc_info=True)
```

❌ **Bad**:
```python
logger.debug("Request received")  # Should be INFO
logger.error("Confidence below threshold")  # Should be WARNING
logger.info("Database connection failed")  # Should be ERROR
```

### 3. Include Request/Correlation IDs

✅ **Good**:
```python
logger.info(
    "Processing started",
    extra={
        "request_id": request.headers.get("X-Request-ID"),
        "correlation_id": request.headers.get("X-Correlation-ID"),
    }
)
```

### 4. Don't Log Sensitive Data

❌ **Never log**:
- Passwords
- API keys
- JWT tokens
- Credit card numbers
- Personal identifiable information (PII) without consent

✅ **Instead**:
```python
logger.info("User authenticated", extra={"user_id": user.id})  # Don't log password!
logger.info("API call succeeded", extra={"api_endpoint": "/prediction"})  # Don't log API key!
```

### 5. Use Structured Logging

✅ **Good** (structured):
```python
logger.info("Order placed", extra={
    "order_id": 12345,
    "item_count": 3,
    "total_amount": 299.99,
    "customer_id": 67890
})
```

❌ **Bad** (string interpolation):
```python
logger.info(f"Order {order_id} placed with {item_count} items for ${total_amount}")
```

### 6. Log Exceptions Properly

✅ **Good**:
```python
try:
    result = risky_operation()
except Exception as e:
    logger.error("Operation failed", exc_info=True, extra={"operation": "risky_operation"})
    raise
```

❌ **Bad**:
```python
try:
    result = risky_operation()
except Exception as e:
    logger.error(f"Error: {e}")  # No stack trace!
```

## Troubleshooting

### Logs Not Appearing

**Check**:
1. Log level: `export LOG_LEVEL=DEBUG`
2. Handler configured: `logger.handlers`
3. Logger propagation: `logger.propagate = True`

```python
# Debug logger configuration
logger = get_logger("test")
print(f"Logger level: {logger.level}")
print(f"Handlers: {logger.handlers}")
print(f"Effective level: {logger.getEffectiveLevel()}")
```

### Log Files Growing Too Large

**Solutions**:
1. Lower log level: `LOG_LEVEL=WARNING`
2. Reduce rotation size: `max_bytes=5*1024*1024` (5MB)
3. Decrease backup count: `backup_count=3`
4. Enable log compression:

```python
import gzip
import shutil

# Compress old log files
for log_file in Path("logs").glob("*.log.*"):
    with open(log_file, 'rb') as f_in:
        with gzip.open(f"{log_file}.gz", 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
    log_file.unlink()
```

### JSON Parsing Errors

**Problem**: Invalid JSON in log file

**Causes**:
- Multi-line exception traces
- Invalid characters

**Solution**: Use `jq -R -r '. as $line | try fromjson'`

```bash
# Robust JSON parsing
cat logs/routing_ml.log | jq -R -r '. as $line | try fromjson catch $line'
```

## Production Checklist

- [ ] Set `LOG_LEVEL=INFO` (not DEBUG)
- [ ] Enable `LOG_FORMAT=json`
- [ ] Configure log retention policy
- [ ] Set up centralized logging (ELK, Splunk, CloudWatch)
- [ ] Configure log rotation (max 10MB per file)
- [ ] Set up monitoring alerts (error rate, slow queries)
- [ ] Sanitize logs (no PII, passwords, keys)
- [ ] Document log schema for your team
- [ ] Test log aggregation pipeline
- [ ] Set up log backup to S3/Azure Blob

## Additional Resources

- **Python Logging Documentation**: https://docs.python.org/3/library/logging.html
- **Structured Logging Best Practices**: https://www.structlog.org/
- **ELK Stack**: https://www.elastic.co/what-is/elk-stack
- **Grafana Loki**: https://grafana.com/oss/loki/
- **AWS CloudWatch Logs**: https://docs.aws.amazon.com/cloudwatch/

## Support

For logging issues:
- Review [DIAGNOSIS_AND_IMPROVEMENT_PLAN.md](../DIAGNOSIS_AND_IMPROVEMENT_PLAN.md)
- Check log configuration: `.env`
- Open GitHub issue with `[Logging]` tag
