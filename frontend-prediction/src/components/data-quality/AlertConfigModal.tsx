import { Bell, BellOff,Edit2, Plus, Trash2, X } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";

import {
  createAlertRule,
  deleteAlertRule,
  loadAlertRules,
  toggleAlertRule,
  updateAlertRule,
} from "../../services/alertService";
import type { AlertCondition, AlertMetricType, AlertRule, AlertSeverity,CreateAlertRuleInput } from "../../types/alerts";

interface AlertConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AlertConfigModal({ isOpen, onClose }: AlertConfigModalProps) {
  const [rules, setRules] = useState<AlertRule[]>(loadAlertRules());
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateAlertRuleInput>({
    name: "",
    metric: "completeness",
    condition: "below",
    threshold: 90,
    severity: "warning",
  });

  if (!isOpen) return null;

  const handleRefresh = () => {
    setRules(loadAlertRules());
  };

  const handleToggleRule = (id: string) => {
    const updated = toggleAlertRule(id);
    if (updated) {
      handleRefresh();
      toast.success(`Alert ${updated.enabled ? "enabled" : "disabled"}`);
    }
  };

  const handleDeleteRule = (id: string) => {
    if (confirm("Are you sure you want to delete this alert rule?")) {
      const success = deleteAlertRule(id);
      if (success) {
        handleRefresh();
        toast.success("Alert rule deleted");
      }
    }
  };

  const handleStartEdit = (rule: AlertRule) => {
    setEditingId(rule.id);
    setFormData({
      name: rule.name,
      metric: rule.metric,
      condition: rule.condition,
      threshold: rule.threshold,
      severity: rule.severity,
    });
    setIsCreating(true);
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData({
      name: "",
      metric: "completeness",
      condition: "below",
      threshold: 90,
      severity: "warning",
    });
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Please enter a rule name");
      return;
    }

    if (formData.threshold < 0 || formData.threshold > 100) {
      toast.error("Threshold must be between 0 and 100");
      return;
    }

    try {
      if (editingId) {
        updateAlertRule(editingId, formData);
        toast.success("Alert rule updated");
      } else {
        createAlertRule(formData);
        toast.success("Alert rule created");
      }

      handleRefresh();
      handleCancelForm();
    } catch (error) {
      toast.error("Failed to save alert rule");
    }
  };

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return "text-red-400 bg-red-900/20 border-red-800";
      case "warning":
        return "text-yellow-400 bg-yellow-900/20 border-yellow-800";
      case "info":
        return "text-blue-400 bg-blue-900/20 border-blue-800";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl border border-gray-700 w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Bell size={20} className="text-blue-400" />
            Alert Rules Configuration
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Create/Edit Form */}
          {isCreating ? (
            <form onSubmit={handleSubmitForm} className="bg-gray-800/50 rounded-lg p-4 mb-6 border border-gray-700">
              <h3 className="text-lg font-medium text-white mb-4">
                {editingId ? "Edit Alert Rule" : "Create New Alert Rule"}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Rule Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g., Critical Completeness Alert"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Metric
                  </label>
                  <select
                    value={formData.metric}
                    onChange={(e) => setFormData({ ...formData, metric: e.target.value as AlertMetricType })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="completeness">Completeness</option>
                    <option value="validity">Validity</option>
                    <option value="consistency">Consistency</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Condition
                  </label>
                  <select
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value as AlertCondition })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="below">Below</option>
                    <option value="above">Above</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Threshold (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.threshold}
                    onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Severity
                  </label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value as AlertSeverity })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="critical">Critical</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingId ? "Update Rule" : "Create Rule"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-6"
            >
              <Plus size={16} />
              Add New Rule
            </button>
          )}

          {/* Rules List */}
          <div className="space-y-3">
            {rules.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No alert rules configured. Create one to get started.
              </div>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`bg-gray-800/50 rounded-lg p-4 border ${rule.enabled ? "border-gray-700" : "border-gray-800 opacity-60"}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-white font-medium">{rule.name}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs border ${getSeverityColor(rule.severity)}`}>
                          {rule.severity}
                        </span>
                        {!rule.enabled && (
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-400">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        Alert when <span className="text-gray-300">{rule.metric}</span> is{" "}
                        <span className="text-gray-300">{rule.condition}</span>{" "}
                        <span className="text-gray-300">{rule.threshold}%</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleRule(rule.id)}
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                        title={rule.enabled ? "Disable rule" : "Enable rule"}
                      >
                        {rule.enabled ? <Bell size={16} /> : <BellOff size={16} />}
                      </button>
                      <button
                        onClick={() => handleStartEdit(rule)}
                        className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                        title="Edit rule"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                        title="Delete rule"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
