import type { DataQualityMetrics } from "@lib/apiClient";

import type {
  Alert,
  AlertHistory,
  AlertRule,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
} from "../types/alerts";

const STORAGE_KEY_RULES = "dataQuality_alertRules";
const STORAGE_KEY_HISTORY = "dataQuality_alertHistory";
const MAX_HISTORY_SIZE = 100;

// ============================================================================
// Alert Rules Management
// ============================================================================

export function loadAlertRules(): AlertRule[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_RULES);
    if (!stored) return getDefaultAlertRules();

    const rules = JSON.parse(stored) as AlertRule[];
    return rules.length > 0 ? rules : getDefaultAlertRules();
  } catch (error) {
    console.error("Failed to load alert rules:", error);
    return getDefaultAlertRules();
  }
}

export function saveAlertRules(rules: AlertRule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
  } catch (error) {
    console.error("Failed to save alert rules:", error);
  }
}

export function createAlertRule(input: CreateAlertRuleInput): AlertRule {
  const now = new Date().toISOString();
  const rule: AlertRule = {
    id: generateId(),
    name: input.name,
    metric: input.metric,
    condition: input.condition,
    threshold: input.threshold,
    severity: input.severity,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  const rules = loadAlertRules();
  rules.push(rule);
  saveAlertRules(rules);

  return rule;
}

export function updateAlertRule(id: string, input: UpdateAlertRuleInput): AlertRule | null {
  const rules = loadAlertRules();
  const index = rules.findIndex((r) => r.id === id);

  if (index === -1) return null;

  const updatedRule: AlertRule = {
    ...rules[index],
    ...input,
    updatedAt: new Date().toISOString(),
  };

  rules[index] = updatedRule;
  saveAlertRules(rules);

  return updatedRule;
}

export function deleteAlertRule(id: string): boolean {
  const rules = loadAlertRules();
  const filtered = rules.filter((r) => r.id !== id);

  if (filtered.length === rules.length) return false;

  saveAlertRules(filtered);
  return true;
}

export function toggleAlertRule(id: string): AlertRule | null {
  const rules = loadAlertRules();
  const rule = rules.find((r) => r.id === id);

  if (!rule) return null;

  return updateAlertRule(id, { enabled: !rule.enabled });
}

// ============================================================================
// Alert History Management
// ============================================================================

export function loadAlertHistory(): AlertHistory {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (!stored) {
      return { alerts: [], lastChecked: new Date().toISOString() };
    }
    return JSON.parse(stored) as AlertHistory;
  } catch (error) {
    console.error("Failed to load alert history:", error);
    return { alerts: [], lastChecked: new Date().toISOString() };
  }
}

export function saveAlertHistory(history: AlertHistory): void {
  try {
    // Trim history to max size
    if (history.alerts.length > MAX_HISTORY_SIZE) {
      history.alerts = history.alerts.slice(-MAX_HISTORY_SIZE);
    }
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
  } catch (error) {
    console.error("Failed to save alert history:", error);
  }
}

export function addAlertToHistory(alert: Alert): void {
  const history = loadAlertHistory();
  history.alerts.push(alert);
  history.lastChecked = new Date().toISOString();
  saveAlertHistory(history);
}

export function acknowledgeAlert(alertId: string): void {
  const history = loadAlertHistory();
  const alert = history.alerts.find((a) => a.id === alertId);

  if (alert) {
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date().toISOString();
    saveAlertHistory(history);
  }
}

export function clearAlertHistory(): void {
  const history: AlertHistory = {
    alerts: [],
    lastChecked: new Date().toISOString(),
  };
  saveAlertHistory(history);
}

export function getUnacknowledgedAlerts(): Alert[] {
  const history = loadAlertHistory();
  return history.alerts.filter((a) => !a.acknowledged);
}

export function getRecentAlerts(limit: number = 10): Alert[] {
  const history = loadAlertHistory();
  return history.alerts.slice(-limit).reverse();
}

// ============================================================================
// Alert Checking
// ============================================================================

export function checkMetricsForAlerts(metrics: DataQualityMetrics): Alert[] {
  const rules = loadAlertRules().filter((r) => r.enabled);
  const triggeredAlerts: Alert[] = [];

  for (const rule of rules) {
    const currentValue = getMetricValue(metrics, rule.metric);
    const isTriggered = evaluateCondition(currentValue, rule.condition, rule.threshold);

    if (isTriggered) {
      const alert: Alert = {
        id: generateId(),
        ruleId: rule.id,
        ruleName: rule.name,
        metric: rule.metric,
        currentValue,
        threshold: rule.threshold,
        condition: rule.condition,
        severity: rule.severity,
        message: generateAlertMessage(rule, currentValue),
        timestamp: new Date().toISOString(),
        acknowledged: false,
      };

      triggeredAlerts.push(alert);
      addAlertToHistory(alert);
    }
  }

  return triggeredAlerts;
}

function getMetricValue(metrics: DataQualityMetrics, metric: string): number {
  switch (metric) {
    case "completeness":
      return metrics.completeness;
    case "validity":
      return metrics.validity;
    case "consistency":
      return metrics.consistency;
    default:
      return 0;
  }
}

function evaluateCondition(value: number, condition: string, threshold: number): boolean {
  switch (condition) {
    case "below":
      return value < threshold;
    case "above":
      return value > threshold;
    default:
      return false;
  }
}

function generateAlertMessage(rule: AlertRule, currentValue: number): string {
  const metricName = rule.metric.charAt(0).toUpperCase() + rule.metric.slice(1);
  const conditionText = rule.condition === "below" ? "dropped below" : "exceeded";

  return `${metricName} ${conditionText} threshold: ${currentValue.toFixed(1)}% (threshold: ${rule.threshold}%)`;
}

// ============================================================================
// Default Rules
// ============================================================================

function getDefaultAlertRules(): AlertRule[] {
  const now = new Date().toISOString();

  return [
    {
      id: generateId(),
      name: "Critical Completeness Alert",
      metric: "completeness",
      condition: "below",
      threshold: 90,
      severity: "critical",
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      name: "Warning Validity Alert",
      metric: "validity",
      condition: "below",
      threshold: 95,
      severity: "warning",
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      name: "Warning Consistency Alert",
      metric: "consistency",
      condition: "below",
      threshold: 85,
      severity: "warning",
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

// ============================================================================
// Utilities
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
