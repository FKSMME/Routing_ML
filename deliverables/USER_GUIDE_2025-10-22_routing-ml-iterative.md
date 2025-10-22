# User Guide: Routing ML Iterative Training System

**Document ID**: USER_GUIDE_2025-10-22_routing-ml-iterative
**Version**: 1.0
**Created**: 2025-10-22
**Audience**: End Users, Data Analysts, ML Engineers

**Related Documents**:
- PRD: [docs/planning/PRD_2025-10-22_routing-ml-iterative-training.md](../docs/planning/PRD_2025-10-22_routing-ml-iterative-training.md)
- Operator Manual: [deliverables/OPERATOR_MANUAL_2025-10-22_routing-ml-iterative.md](OPERATOR_MANUAL_2025-10-22_routing-ml-iterative.md)
- QA Report: [deliverables/QA_REPORT_2025-10-22_routing-ml-iterative.md](QA_REPORT_2025-10-22_routing-ml-iterative.md)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Quality Monitoring Dashboard](#3-quality-monitoring-dashboard)
4. [Training Monitor](#4-training-monitor)
5. [Settings Configuration](#5-settings-configuration)
6. [Log Viewer](#6-log-viewer)
7. [Interpreting Metrics](#7-interpreting-metrics)
8. [Common Workflows](#8-common-workflows)
9. [Troubleshooting](#9-troubleshooting)
10. [FAQ](#10-faq)

---

## 1. Introduction

### 1.1 What is the Iterative Training System?

The Routing ML Iterative Training System is an automated quality monitoring and model retraining platform that continuously evaluates prediction accuracy and automatically improves the machine learning model based on real-world production data.

**Key Benefits**:
- **Automated Quality Monitoring**: Evaluates prediction accuracy every cycle
- **Proactive Model Improvement**: Automatically retrains when quality degrades
- **Transparent Metrics**: Real-time dashboards show prediction performance
- **Zero Downtime**: Model updates happen seamlessly without service interruption

### 1.2 Who Should Use This Guide?

- **Data Analysts**: Monitor quality metrics and identify trends
- **ML Engineers**: Trigger manual retraining and adjust thresholds
- **Operations Team**: Troubleshoot issues and manage deployments
- **Business Users**: Understand prediction confidence and quality

### 1.3 System Architecture Overview

```
┌─────────────────┐
│ Quality Monitor │ ← Samples items, predicts, evaluates
└────────┬────────┘
         │ Quality degrades?
         ↓
┌─────────────────┐
│ Training Queue  │ ← Queues retraining jobs
└────────┬────────┘
         │ Job starts
         ↓
┌─────────────────┐
│ Training Worker │ ← Trains new model
└────────┬────────┘
         │ Model ready?
         ↓
┌─────────────────┐
│ Model Deployer  │ ← Deploys new model (with backup)
└─────────────────┘
```

---

## 2. Getting Started

### 2.1 Accessing the System

**URL**: `http(s)://[server-address]/`

**Login**:
1. Navigate to the system URL
2. Enter your credentials (username/password)
3. Click "로그인" (Login)

**First-Time Setup**:
- Default settings are pre-configured
- No configuration required for basic usage
- Advanced users can adjust settings (see Section 5)

### 2.2 Navigation

**Main Menu** (left sidebar or top navigation):

| Menu Item | Icon | Description |
|-----------|------|-------------|
| **품질 모니터** (Quality Monitor) | 📊 | View quality metrics and trends |
| **학습 모니터** (Training Monitor) | 🎯 | Monitor training jobs and history |
| **학습 설정** (Training Settings) | ⚙️ | Configure thresholds and parameters |
| **로그 뷰어** (Log Viewer) | 📄 | View real-time system logs |

### 2.3 Dashboard Overview

**Home Screen** shows:
- Current quality metrics (MAE, Process Match, etc.)
- Recent training jobs
- System status (Active/Idle)
- Quick actions (Start Training, View Logs)

---

## 3. Quality Monitoring Dashboard

### 3.1 Accessing the Dashboard

**Navigation**: 메인 메뉴 → **품질 모니터** (Quality Monitor)

**URL**: `/#/quality-monitor`

### 3.2 Current Metrics Cards

The dashboard displays 6 key metric cards:

#### 3.2.1 MAE (Mean Absolute Error)

**Definition**: Average prediction error in minutes

**Card Display**:
```
┌─────────────────────┐
│ MAE                 │
│ 4.2 분 (minutes)    │
│ ▼ -0.5 (improving)  │
└─────────────────────┘
```

**Interpretation**:
- **<5 minutes**: ✅ Excellent (green)
- **5-10 minutes**: ⚠️ Acceptable (yellow)
- **>10 minutes**: ❌ Poor (red)

**Trend Indicator**:
- ▼ (down arrow): Quality improving
- ▲ (up arrow): Quality degrading

#### 3.2.2 Trim-MAE (Trimmed Mean Absolute Error)

**Definition**: MAE after removing top/bottom 10% outliers

**Why It Matters**: More robust to extreme outliers than regular MAE

**Interpretation**:
- Trim-MAE < MAE: Outliers inflating error (normal)
- Trim-MAE ≈ MAE: Error distributed evenly
- Trim-MAE > MAE: Unusual (investigate)

#### 3.2.3 RMSE (Root Mean Squared Error)

**Definition**: Square root of mean squared errors (penalizes large errors)

**Interpretation**:
- RMSE ≈ MAE: Errors evenly distributed
- RMSE >> MAE: Many large outliers (investigate)

#### 3.2.4 Process Match (%)

**Definition**: Percentage of predictions where process matches WORK_ORDER result

**Card Display**:
```
┌─────────────────────┐
│ Process Match       │
│ 87.3%               │
│ ▲ +2.1% (improving) │
└─────────────────────┘
```

**Interpretation**:
- **>90%**: ✅ Excellent
- **80-90%**: ⚠️ Acceptable
- **<80%**: ❌ Poor (investigate)

**Common Causes of Low Match**:
- Model trained on outdated data
- Process changes not reflected in training data
- Data quality issues (missing/incorrect work orders)

#### 3.2.5 Outsourcing Success (%)

**Definition**: Percentage of outsourcing decisions that were successful

**Interpretation**:
- **>95%**: ✅ Excellent
- **85-95%**: ⚠️ Acceptable
- **<85%**: ❌ Poor

#### 3.2.6 CV (Coefficient of Variation)

**Definition**: Standard deviation / Mean (variability measure)

**Interpretation**:
- **<0.3**: ✅ Consistent predictions
- **0.3-0.5**: ⚠️ Moderate variability
- **>0.5**: ❌ High variability (unreliable)

**Example**:
- Mean prediction: 10 minutes
- StdDev: 2 minutes
- CV = 2 / 10 = 0.2 (✅ Consistent)

### 3.3 MAE Trend Chart

**Chart Type**: Line chart with 3 series

**X-Axis**: Evaluation cycle date/time
**Y-Axis**: Error in minutes

**Series**:
1. **MAE** (blue line): Mean Absolute Error
2. **Trim-MAE** (green line): Trimmed MAE
3. **RMSE** (red line): Root Mean Squared Error

**Reading the Chart**:
- Downward trend: Quality improving ✅
- Flat trend: Quality stable
- Upward trend: Quality degrading ⚠️
- Sudden spike: Investigate outliers

**Example Interpretation**:
```
MAE (minutes)
12 │        ╱╲
10 │       ╱  ╲
 8 │      ╱    ╲___
 6 │_____╱         ╲___
 4 │                   ╲___
 2 │                        ╲___
 0 └─────────────────────────────→
   Day 1  Day 3  Day 5  Day 7  Time

Analysis:
- Days 1-3: Stable quality (~6 min MAE)
- Days 3-4: Quality spike (model drift?)
- Days 5-7: Quality improving after retraining
```

### 3.4 Recent Alerts Table

**Table Columns**:

| Column | Description | Example |
|--------|-------------|---------|
| **Severity** | Alert level | 🔴 Critical, 🟡 Warning, 🔵 Info |
| **Message** | Alert description | "MAE exceeds threshold (5.0 minutes)" |
| **Value** | Metric value | "8.2 minutes" |
| **Timestamp** | When alert triggered | "2025-10-22 14:30:15" |

**Alert Severity**:
- **🔴 Critical**: Immediate action required (MAE >10 min)
- **🟡 Warning**: Monitor closely (MAE 5-10 min, CV >0.5)
- **🔵 Info**: FYI only (model retrained, queue full)

**Example Alerts**:
```
🔴 Critical │ MAE exceeds critical threshold      │ 12.5 min │ 2025-10-22 14:30:15
🟡 Warning  │ CV exceeds threshold (0.3)          │ 0.42     │ 2025-10-22 14:15:10
🔵 Info     │ Model retrained successfully        │ v1.2.3   │ 2025-10-22 13:00:00
```

### 3.5 Date Range Filters

**Filter Options**:

1. **Cycle Limit** (cycles 수 제한)
   - Display last N evaluation cycles
   - Default: 30 cycles
   - Range: 1-100 cycles

2. **Start Date** (시작 날짜)
   - Filter cycles after this date
   - Example: 2025-10-15

3. **End Date** (종료 날짜)
   - Filter cycles before this date
   - Example: 2025-10-22

**Usage**:
```
1. Set filters:
   - Cycle Limit: 50
   - Start Date: 2025-10-01
   - End Date: 2025-10-22

2. Click "필터 적용" (Apply Filters)

3. Chart and table update automatically
```

### 3.6 Export Functionality

**Export Options**:

1. **Export to JSON**
   - Full quality history data
   - All metrics, alerts, metadata
   - Filename: `quality_history_{timestamp}.json`

2. **Export to CSV**
   - Cycle summary table
   - Metrics only (no nested data)
   - Filename: `quality_summary_{timestamp}.csv`

**Usage**:
1. Configure date filters (optional)
2. Click **"JSON으로 내보내기"** or **"CSV로 내보내기"**
3. Download starts automatically
4. Open file in Excel, Python, or analysis tool

**CSV Example**:
```csv
cycle_id,timestamp,mae,trim_mae,rmse,process_match,cv
cycle_001,2025-10-22T10:00:00,4.2,3.8,5.1,87.3,0.28
cycle_002,2025-10-22T14:00:00,5.5,4.9,6.8,85.1,0.35
```

---

## 4. Training Monitor

### 4.1 Accessing Training Monitor

**Navigation**: 메인 메뉴 → **학습 모니터** (Training Monitor)

**URL**: `/#/training-monitor`

### 4.2 Starting a Training Job

**Button**: **"학습 시작"** (Start Training)

**Steps**:
1. Click "학습 시작" button
2. Configure parameters (modal dialog):
   - **Sample Size** (샘플 크기): 100-10,000 items (default: 500)
   - **Sampling Strategy** (샘플링 전략):
     - `random`: Random sampling (default)
     - `stratified`: Stratified by PART_TYPE/ITEM_TYPE
     - `recent_bias`: Bias towards recent items
3. Click "확인" (Confirm)
4. Training job starts immediately

**Response**:
- Success: "학습 작업이 시작되었습니다. Job ID: job_20251022_143015"
- Failure: Error message (e.g., "큐가 가득 찼습니다")

### 4.3 Monitoring Training Progress

**Progress Bar**:
```
Progress: 45% [▓▓▓▓▓░░░░░]

Current Step: Training MLP model...
Elapsed Time: 2 min 15 sec
Estimated Remaining: 2 min 45 sec
```

**Status Indicators**:
- 🟢 **RUNNING**: Training in progress
- 🔵 **SUCCEEDED**: Training completed successfully
- 🔴 **FAILED**: Training failed (see error message)
- ⏸️ **CANCELLED**: User cancelled training
- ⏭️ **SKIPPED**: Job skipped (cooldown period)

### 4.4 Real-Time Logs

**Log Viewer** (scrollable box):
```
[2025-10-22 14:30:15 INFO] Starting training job: job_20251022_143015
[2025-10-22 14:30:17 INFO] Sampling 500 items with strategy: random
[2025-10-22 14:30:25 INFO] Sample complete: 500 items retrieved
[2025-10-22 14:30:30 INFO] Training baseline model (HNSW)...
[2025-10-22 14:31:45 INFO] Baseline MAE: 6.2 minutes
[2025-10-22 14:31:50 INFO] Training MLP model...
[2025-10-22 14:33:10 INFO] MLP MAE: 4.8 minutes (✅ 22% improvement)
[2025-10-22 14:33:15 INFO] Deploying model version v1.2.3...
[2025-10-22 14:33:20 INFO] ✅ Training complete! New model deployed.
```

**Auto-Scroll**:
- Enabled by default (scrolls to latest log)
- Toggle with checkbox: ☑ "자동 스크롤" (Auto-scroll)

### 4.5 Cancelling a Training Job

**Steps**:
1. Locate running job in progress bar
2. Click **"취소"** (Cancel) button
3. Confirm cancellation (popup)
4. Job status changes to **CANCELLED**

**Note**: Cancellation may take up to 30 seconds (worker cleanup)

### 4.6 Training History Table

**Table Columns**:

| Column | Description | Example |
|--------|-------------|---------|
| **Job ID** | Unique job identifier | job_20251022_143015 |
| **Status** | Current status | 🔵 SUCCEEDED |
| **Progress** | Completion % | 100% |
| **Current Step** | Last step executed | Model deployed |
| **Started At** | Job start time | 2025-10-22 14:30:15 |
| **Completed At** | Job end time | 2025-10-22 14:33:20 |

**Sorting**:
- Default: Most recent jobs first
- Click column header to sort

**Filtering**:
- Filter by status: ALL / SUCCEEDED / FAILED / RUNNING
- Date range filter (optional)

---

## 5. Settings Configuration

### 5.1 Accessing Settings

**Navigation**: 메인 메뉴 → **학습 설정** (Training Settings)

**URL**: `/#/training-settings`

### 5.2 Configuration Parameters

#### 5.2.1 Sample Size (샘플 크기)

**Purpose**: Number of items to sample for quality evaluation

**Range**: 10 - 10,000 items
**Default**: 500 items

**Guidance**:
- **Small datasets (<10,000 items)**: Use 100-500 samples
- **Medium datasets (10,000-100,000 items)**: Use 500-1,000 samples
- **Large datasets (>100,000 items)**: Use 1,000-5,000 samples

**Trade-offs**:
- **Larger sample**: More accurate metrics, slower evaluation
- **Smaller sample**: Faster evaluation, less accurate metrics

#### 5.2.2 MAE Threshold (MAE 임계값)

**Purpose**: Retraining trigger threshold for MAE

**Range**: 0.1 - 100.0 minutes
**Default**: 5.0 minutes

**Guidance**:
- **Tight SLA (±3 min)**: Set threshold to 3.0-5.0 minutes
- **Moderate SLA (±5-10 min)**: Set threshold to 5.0-10.0 minutes
- **Loose SLA (>±10 min)**: Set threshold to 10.0-20.0 minutes

**Example**:
```
Current MAE: 8.2 minutes
Threshold: 5.0 minutes
Result: ⚠️ Retraining triggered (MAE exceeds threshold)
```

#### 5.2.3 CV Threshold (CV 임계값)

**Purpose**: Retraining trigger threshold for Coefficient of Variation

**Range**: 0.01 - 1.0
**Default**: 0.3

**Guidance**:
- **Consistent predictions required**: Set to 0.2-0.3
- **Moderate variability acceptable**: Set to 0.3-0.5
- **High variability tolerated**: Set to 0.5-1.0

**Example**:
```
Current CV: 0.45
Threshold: 0.3
Result: ⚠️ Retraining triggered (high variability)
```

#### 5.2.4 Queue Max Size (큐 최대 크기)

**Purpose**: Maximum number of concurrent training jobs in queue

**Range**: 1 - 20 jobs
**Default**: 3 jobs

**Guidance**:
- **Single-user environment**: 1-3 jobs
- **Multi-user environment**: 3-5 jobs
- **High-traffic environment**: 5-10 jobs

**Trade-offs**:
- **Larger queue**: More concurrent jobs, higher resource usage
- **Smaller queue**: Fewer concurrent jobs, lower resource usage

#### 5.2.5 Polling Interval (폴링 간격)

**Purpose**: Auto-refresh interval for training status (seconds)

**Range**: 1 - 60 seconds
**Default**: 5 seconds

**Guidance**:
- **Real-time monitoring**: 1-5 seconds
- **Casual monitoring**: 5-10 seconds
- **Low-priority monitoring**: 10-30 seconds

### 5.3 Saving Settings

**Steps**:
1. Modify parameters as needed
2. Click **"저장"** (Save) button
3. Success message: "설정이 저장되었습니다" (Settings saved)
4. Settings persist in browser localStorage

**Validation**:
- Form validates inputs before saving
- Invalid values show error messages:
  - "Sample size must be between 10 and 10,000"
  - "MAE threshold must be between 0.1 and 100"

### 5.4 Resetting to Defaults

**Steps**:
1. Click **"기본값으로 재설정"** (Reset to Defaults) button
2. Confirm reset (popup)
3. All parameters reset to default values
4. Click "저장" to persist changes

---

## 6. Log Viewer

### 6.1 Accessing Log Viewer

**Navigation**: 메인 메뉴 → **로그 뷰어** (Log Viewer)

**URL**: `/#/log-viewer`

### 6.2 Log Display

**Display Format**:
```
[2025-10-22 14:30:15] INFO: Quality evaluation started (cycle_123)
[2025-10-22 14:30:17] DEBUG: Sampled 500 items from BI_ITEM_INFO_VIEW
[2025-10-22 14:30:20] WARNING: Prediction timeout for 2 items (retrying...)
[2025-10-22 14:30:25] INFO: Evaluation complete: MAE = 4.2 minutes
[2025-10-22 14:30:30] ERROR: Failed to save metrics to database (retrying...)
```

**Log Levels** (color-coded):
- **ERROR** (🔴 red): Critical errors requiring attention
- **WARNING** (🟡 yellow): Warnings or potential issues
- **INFO** (🔵 blue): Informational messages
- **DEBUG** (⚪ gray): Detailed debugging information

### 6.3 Auto-Refresh

**Default**: Enabled (5-second interval)

**Controls**:
- **Pause** (일시정지): Stop auto-refresh
- **Resume** (재개): Resume auto-refresh

**Usage**:
1. Auto-refresh runs by default
2. New logs appear automatically every 5 seconds
3. Click "Pause" to freeze logs (for reading)
4. Click "Resume" to resume auto-refresh

### 6.4 Auto-Scroll

**Default**: Enabled (scrolls to bottom)

**Toggle**: ☑ "자동 스크롤" (Auto-scroll)

**Usage**:
- **Enabled**: Latest logs always visible (auto-scrolls)
- **Disabled**: Scroll position fixed (manual scrolling)

### 6.5 Download Logs

**Steps**:
1. Click **"전체 로그 다운로드"** (Download Full Log) button
2. File downloads: `quality_log_{timestamp}.txt`
3. Open in text editor or log viewer

**File Format**: Plain text (.txt)

**Example Content**:
```
=== Quality Evaluation Logs ===
Downloaded: 2025-10-22 14:45:00

[2025-10-22 10:00:00] INFO: System started
[2025-10-22 10:05:15] INFO: Quality evaluation started
...
[2025-10-22 14:40:00] INFO: Training job completed
```

---

## 7. Interpreting Metrics

### 7.1 MAE (Mean Absolute Error)

**Formula**: `MAE = Σ|predicted - actual| / N`

**Example Calculation**:
```
Item 1: Predicted = 10 min, Actual = 12 min → Error = 2 min
Item 2: Predicted = 15 min, Actual = 10 min → Error = 5 min
Item 3: Predicted = 8 min,  Actual = 9 min  → Error = 1 min

MAE = (2 + 5 + 1) / 3 = 2.67 minutes
```

**Business Impact**:
- MAE = 2.67 min → Predictions off by ~3 minutes on average
- Lower MAE = more accurate predictions = better planning

### 7.2 Process Match

**Formula**: `Process Match = (Correct Processes / Total Items) × 100%`

**Example Calculation**:
```
Total Items: 100
Predicted: LASER → Actual: LASER (✅ match)
Predicted: BEND  → Actual: LASER (❌ mismatch)
...
Correct: 87 items
Incorrect: 13 items

Process Match = 87 / 100 × 100% = 87%
```

**Business Impact**:
- 87% match → 13% of items routed to wrong process
- Higher match = fewer routing errors = less rework

### 7.3 CV (Coefficient of Variation)

**Formula**: `CV = StdDev / Mean`

**Example Calculation**:
```
Predictions: [8, 10, 12, 14, 16] minutes
Mean: 12 minutes
StdDev: 2.83 minutes

CV = 2.83 / 12 = 0.236 (23.6%)
```

**Interpretation**:
- CV = 0.236 → Predictions vary by ±24% from mean (✅ acceptable)
- CV > 0.5 → High variability (⚠️ unreliable predictions)

---

## 8. Common Workflows

### 8.1 Daily Quality Check

**Frequency**: Daily (morning)

**Steps**:
1. Log in to system
2. Navigate to **Quality Monitor**
3. Check current metrics:
   - ✅ MAE < 5 minutes?
   - ✅ Process Match > 85%?
   - ✅ CV < 0.3?
4. Review recent alerts (any 🔴 Critical?)
5. If quality degraded:
   - Check MAE trend chart (sudden spike?)
   - Review training history (recent retraining?)
   - Consider manual retraining if needed

**Time Required**: 2-3 minutes

### 8.2 Triggering Manual Retraining

**When to Use**:
- Quality degraded below threshold
- New production data available (monthly)
- Business process changes (new equipment, processes)

**Steps**:
1. Navigate to **Training Monitor**
2. Click "학습 시작" (Start Training)
3. Configure:
   - Sample Size: 1,000 items (larger sample for better accuracy)
   - Strategy: `stratified` (balanced across part types)
4. Click "확인" (Confirm)
5. Monitor progress (check every 5 minutes)
6. Wait for completion (~10-30 minutes)
7. Verify deployment:
   - Check Training History (status = SUCCEEDED?)
   - Navigate to Quality Monitor
   - Verify MAE improved in next evaluation cycle

**Time Required**: 30-60 minutes (mostly waiting)

### 8.3 Investigating Quality Degradation

**Symptoms**:
- MAE suddenly increased (e.g., 4 min → 10 min)
- Process Match dropped (e.g., 90% → 75%)
- Multiple 🔴 Critical alerts

**Investigation Steps**:

1. **Check MAE Trend Chart**
   - Gradual increase? (model drift, normal)
   - Sudden spike? (data quality issue, process change)

2. **Review Recent Alerts**
   - Any "Prediction failure" alerts? (API issue)
   - Any "CV exceeds threshold" alerts? (variability spike)

3. **Check Training History**
   - When was last successful retraining?
   - Any failed training jobs?

4. **Download Logs**
   - Navigate to Log Viewer
   - Click "Download Full Log"
   - Search for ERROR or WARNING messages

5. **Check Database**
   - Query BI_ITEM_INFO_VIEW (recent data quality?)
   - Query BI_WORK_ORDER_RESULTS (work orders available?)

6. **Contact Support** (if unresolved)
   - Attach: Quality metrics, logs, screenshots
   - Describe: Timeline, symptoms, investigation steps

### 8.4 Adjusting Thresholds

**When to Adjust**:
- Too many retraining jobs (threshold too tight)
- Too few retraining jobs (threshold too loose)
- Business SLA changed

**Steps**:
1. Review historical MAE:
   - Navigate to Quality Monitor
   - Set date range: Last 30 days
   - Export to CSV
   - Calculate: Average MAE, 95th percentile MAE

2. Set new threshold:
   - **Conservative**: 95th percentile MAE × 1.2
   - **Moderate**: 95th percentile MAE × 1.5
   - **Aggressive**: 95th percentile MAE × 2.0

3. Update settings:
   - Navigate to Training Settings
   - Set new MAE Threshold
   - Click "저장" (Save)

4. Monitor impact (next 7 days):
   - Track retraining frequency
   - Verify quality stays within SLA

**Example**:
```
Historical Data (last 30 days):
- Average MAE: 4.2 minutes
- 95th percentile MAE: 6.5 minutes

New Threshold Calculation:
- Conservative: 6.5 × 1.2 = 7.8 minutes
- Moderate: 6.5 × 1.5 = 9.75 minutes
- Aggressive: 6.5 × 2.0 = 13.0 minutes

Decision: Set threshold to 8.0 minutes (conservative)
```

---

## 9. Troubleshooting

### 9.1 Dashboard Not Loading

**Symptoms**:
- Blank screen or spinner
- Error message: "Failed to load quality metrics"

**Solutions**:

1. **Check Network**:
   - Open browser console (F12)
   - Check for 500/503 errors
   - Verify server reachable (ping server)

2. **Check Backend**:
   - Verify FastAPI server running
   - Check logs: `logs/performance/performance.quality.log`
   - Restart server if needed

3. **Clear Cache**:
   - Clear browser cache (Ctrl+Shift+Del)
   - Hard refresh (Ctrl+F5)
   - Try incognito mode

4. **Check Database**:
   - Verify database connection (MSSQL K3-DB)
   - Test query: `SELECT TOP 10 * FROM BI_ITEM_INFO_VIEW`

### 9.2 Training Job Stuck

**Symptoms**:
- Progress bar frozen at X%
- Status = RUNNING for >2 hours
- No new logs

**Solutions**:

1. **Check Worker Process**:
   - Open Task Manager (Windows) or `top` (Linux)
   - Verify Python process running (high CPU = still training)

2. **Check Logs**:
   - Navigate to Log Viewer
   - Download full log
   - Search for last log entry (timestamp?)
   - Look for ERROR or TIMEOUT messages

3. **Cancel Job** (if hung):
   - Click "취소" (Cancel) button
   - Wait 30 seconds for cancellation
   - Retry training with smaller sample size

4. **Restart Worker** (admin only):
   - Stop FastAPI server
   - Kill hung Python process (if any)
   - Restart FastAPI server
   - Re-enqueue job

### 9.3 Settings Not Saving

**Symptoms**:
- Click "저장" (Save) → no success message
- Settings reset after page refresh

**Solutions**:

1. **Check localStorage**:
   - Open browser console (F12)
   - Run: `localStorage.getItem('iterTrainingConfig')`
   - If null: localStorage disabled (privacy mode?)

2. **Disable Privacy Mode**:
   - Exit private/incognito mode
   - Enable cookies for site
   - Retry saving

3. **Clear localStorage** (if corrupted):
   - Browser console (F12)
   - Run: `localStorage.clear()`
   - Reload page
   - Reconfigure settings

### 9.4 Queue Full Error

**Symptoms**:
- Error: "큐가 가득 찼습니다" (Queue is full)
- Cannot start new training job

**Solutions**:

1. **Check Queue Status**:
   - Navigate to Training Monitor
   - View Training History table
   - Count RUNNING jobs (should be <3)

2. **Wait for Completion**:
   - Wait for 1 job to finish (10-30 min)
   - Retry starting new job

3. **Cancel Low-Priority Job** (if urgent):
   - Identify oldest/lowest-priority RUNNING job
   - Click "취소" (Cancel) button
   - Start new high-priority job

4. **Increase Queue Size** (admin only):
   - Navigate to Training Settings
   - Increase "Queue Max Size" (e.g., 3 → 5)
   - Click "저장" (Save)
   - Note: Higher resource usage!

---

## 10. FAQ

### 10.1 How often should I check quality metrics?

**Recommendation**: Daily (morning check)

**Automated Alerts**: System sends alerts for critical issues (if configured)

**High-Traffic Periods**: Check more frequently (2-3 times per day)

### 10.2 When does automatic retraining happen?

**Triggers**:
1. MAE exceeds threshold (default: 5.0 minutes)
2. CV exceeds threshold (default: 0.3)
3. Process Match drops below threshold (default: 80%)

**Cooldown**: 24 hours (prevents excessive retraining)

**Manual Override**: You can trigger retraining anytime via Training Monitor

### 10.3 How long does retraining take?

**Typical Duration**: 10-30 minutes

**Factors**:
- Sample size (larger = slower)
- Server resources (CPU, RAM)
- Model complexity (MLP vs Stacking)

**Breakdown**:
- Sampling: 1-2 minutes
- Prediction: 3-5 minutes
- Training: 5-15 minutes
- Deployment: 1-2 minutes

### 10.4 Will retraining affect production predictions?

**No**: Retraining runs in background without affecting production

**Deployment**: New model deployed seamlessly (zero downtime)

**Rollback**: If new model performs worse, automatic rollback to previous version

### 10.5 What if the new model is worse than the old one?

**Automatic Protection**:
1. New model must improve Trim-MAE by ≥5% (configurable)
2. If not, deployment skipped (keep old model)
3. Alert generated: "신규 모델 성능 부족" (New model underperformed)

**Manual Rollback** (if deployed):
- Contact operator/admin
- Rollback to previous version (1-click)

### 10.6 Can I see past quality reports?

**Yes**: Navigate to Quality Monitor

**Export Historical Data**:
1. Set date range filters (Start Date, End Date)
2. Click "Export to CSV"
3. Open in Excel for analysis

**Deliverables Folder**: `deliverables/quality_reports/`
- `cycle_{timestamp}.json`: Individual cycle reports
- `quality_summary.csv`: Summary table

### 10.7 What is the difference between MAE and Trim-MAE?

**MAE (Mean Absolute Error)**:
- Average of ALL errors
- Sensitive to outliers (extreme values)

**Trim-MAE (Trimmed MAE)**:
- Average after removing top/bottom 10% outliers
- More robust to extreme values

**Example**:
```
Errors: [1, 2, 3, 4, 100] minutes

MAE = (1+2+3+4+100) / 5 = 22 minutes (inflated by outlier!)
Trim-MAE = (2+3+4) / 3 = 3 minutes (outlier removed)
```

**Which to Use?**:
- **Trim-MAE**: Better for trigger thresholds (ignores outliers)
- **MAE**: Better for overall system performance (includes all errors)

### 10.8 Can I customize sampling strategy?

**Yes**: When starting manual training

**Strategies**:
1. **random**: Uniform random sampling (default)
2. **stratified**: Balanced across PART_TYPE/ITEM_TYPE
3. **recent_bias**: Weighted towards recent items (last 30 days)

**Recommendation**:
- **Production environment**: Use `stratified` (balanced)
- **Rapid prototyping**: Use `random` (faster)
- **Recent changes**: Use `recent_bias` (captures new patterns)

### 10.9 What happens if the database is unavailable?

**Graceful Degradation**:
1. Quality evaluation fails
2. Error logged: "Database connection timeout"
3. Alert generated: 🔴 "데이터베이스 연결 실패"
4. Previous metrics remain visible (not replaced)

**Auto-Retry**:
- System retries 3 times (exponential backoff)
- If all retries fail, evaluation skipped
- Next cycle attempts again (no impact on future cycles)

### 10.10 Can I disable automatic retraining?

**Not directly**, but you can:

1. **Set very high thresholds**:
   - MAE Threshold: 100.0 minutes (effectively disabled)
   - CV Threshold: 1.0 (effectively disabled)

2. **Set queue size to 0** (requires code change):
   - Navigate to Training Settings
   - Note: Queue size minimum is 1 (cannot be 0)

3. **Contact admin** for custom configuration

**Recommendation**: Keep auto-retraining enabled for best quality

---

## Appendix A: Metric Reference Table

| Metric | Unit | Good | Acceptable | Poor | Trigger Threshold (Default) |
|--------|------|------|------------|------|-----------------------------|
| MAE | minutes | <5 | 5-10 | >10 | 5.0 |
| Trim-MAE | minutes | <4 | 4-8 | >8 | N/A |
| RMSE | minutes | <6 | 6-12 | >12 | N/A |
| Process Match | % | >90 | 80-90 | <80 | 80.0 |
| Outsourcing Success | % | >95 | 85-95 | <85 | N/A |
| CV | ratio | <0.3 | 0.3-0.5 | >0.5 | 0.3 |
| Sample Count | count | >500 | 100-500 | <100 | N/A |

---

## Appendix B: Glossary

- **MAE**: Mean Absolute Error - average prediction error in minutes
- **Trim-MAE**: Trimmed MAE - MAE after removing outliers (top/bottom 10%)
- **RMSE**: Root Mean Squared Error - error metric that penalizes large errors
- **Process Match**: Percentage of predictions where process matches work order
- **Outsourcing Success**: Percentage of successful outsourcing decisions
- **CV**: Coefficient of Variation - standard deviation / mean (variability measure)
- **FIFO**: First-In-First-Out - queue processing order
- **Cooldown**: Minimum time between retraining jobs (prevents excessive retraining)
- **Rollback**: Restoring previous model version after failed deployment
- **Stratified Sampling**: Sampling balanced across categories (PART_TYPE/ITEM_TYPE)

---

## Appendix C: Keyboard Shortcuts

| Action | Shortcut | Context |
|--------|----------|---------|
| Refresh Dashboard | F5 | Quality Monitor |
| Export to CSV | Ctrl+E | Quality Monitor |
| Start Training | Ctrl+T | Training Monitor |
| Cancel Training | Esc | Training Monitor (job running) |
| Download Logs | Ctrl+D | Log Viewer |
| Pause Auto-Refresh | Space | Log Viewer |
| Toggle Auto-Scroll | Ctrl+S | Log Viewer |

---

**Document Version**: 1.0
**Last Updated**: 2025-10-22
**Feedback**: Report issues to ML team or create ticket in issue tracker
