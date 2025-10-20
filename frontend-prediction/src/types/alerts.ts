export type AlertSeverity = "critical" | "warning" | "info";
export type AlertMetricType = "completeness" | "validity" | "consistency";
export type AlertCondition = "below" | "above";

export interface AlertRule {
  id: string;
  name: string;
  metric: AlertMetricType;
  condition: AlertCondition;
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  metric: AlertMetricType;
  currentValue: number;
  threshold: number;
  condition: AlertCondition;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

export interface AlertHistory {
  alerts: Alert[];
  lastChecked: string;
}

export interface CreateAlertRuleInput {
  name: string;
  metric: AlertMetricType;
  condition: AlertCondition;
  threshold: number;
  severity: AlertSeverity;
}

export interface UpdateAlertRuleInput extends Partial<CreateAlertRuleInput> {
  enabled?: boolean;
}
