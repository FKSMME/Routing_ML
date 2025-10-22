import { format } from "date-fns";
import { AlertCircle, AlertTriangle, Check, Info, Trash2, X } from "lucide-react";
import React, { useEffect, useRef,useState } from "react";
import toast from "react-hot-toast";

import {
  acknowledgeAlert,
  clearAlertHistory,
  getRecentAlerts,
} from "../../services/alertService";
import type { Alert, AlertSeverity } from "../../types/alerts";

interface AlertDropdownProps {
  onClose: () => void;
  onAlertsUpdated: () => void;
}

export function AlertDropdown({ onClose, onAlertsUpdated }: AlertDropdownProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAlerts();

    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const loadAlerts = () => {
    const recentAlerts = getRecentAlerts(20);
    setAlerts(recentAlerts);
  };

  const handleAcknowledge = (alertId: string) => {
    acknowledgeAlert(alertId);
    loadAlerts();
    onAlertsUpdated();
    toast.success("Alert acknowledged");
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all alert history?")) {
      clearAlertHistory();
      loadAlerts();
      onAlertsUpdated();
      toast.success("Alert history cleared");
    }
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return <AlertCircle size={16} className="text-red-400" />;
      case "warning":
        return <AlertTriangle size={16} className="text-yellow-400" />;
      case "info":
        return <Info size={16} className="text-blue-400" />;
    }
  };

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return "bg-red-900/20 border-red-800";
      case "warning":
        return "bg-yellow-900/20 border-yellow-800";
      case "info":
        return "bg-blue-900/20 border-blue-800";
    }
  };

  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged);

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-12 w-96 bg-gray-900 rounded-lg shadow-xl border border-gray-700 z-50 max-h-[600px] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div>
          <h3 className="text-white font-medium">Alerts</h3>
          {unacknowledgedAlerts.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {unacknowledgedAlerts.length} unacknowledged
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <button
              onClick={handleClearAll}
              className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
              title="Clear all"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <AlertCircle size={48} className="mb-2 opacity-50" />
            <p className="text-sm">No alerts</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 hover:bg-gray-800/50 transition-colors ${
                  alert.acknowledged ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getSeverityIcon(alert.severity)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-medium text-white">
                        {alert.ruleName}
                      </h4>
                      {alert.acknowledged && (
                        <span className="flex-shrink-0 text-green-400" title="Acknowledged">
                          <Check size={14} />
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-400 mb-2">{alert.message}</p>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {format(new Date(alert.timestamp), "MMM d, HH:mm")}
                      </span>

                      {!alert.acknowledged && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {alerts.length > 0 && (
        <div className="p-3 border-t border-gray-700 text-center">
          <p className="text-xs text-gray-500">
            Showing {Math.min(alerts.length, 20)} most recent alerts
          </p>
        </div>
      )}
    </div>
  );
}
