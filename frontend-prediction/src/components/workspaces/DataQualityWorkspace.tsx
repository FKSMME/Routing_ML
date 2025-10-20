/**
 * Data Quality Workspace
 *
 * Provides comprehensive data quality monitoring with:
 * - Real-time metrics dashboard
 * - Quality issue tracking
 * - Prometheus metrics export
 * - Service health monitoring
 */

import { useState } from "react";
import { MetricsPanel } from "@components/data-quality/MetricsPanel";
import { IssuesPanel } from "@components/data-quality/IssuesPanel";

// Type Definitions
interface DataQualityMetrics {
  completeness: number;
  consistency: number;
  validity: number;
  timestamp: string;
  trends: {
    completeness: number[];
    consistency: number[];
    validity: number[];
  };
}

interface DataQualityIssue {
  id: string;
  severity: "critical" | "warning" | "info";
  type: string;
  message: string;
  affectedRecords: number;
  timestamp: string;
  details?: Record<string, any>;
}

interface DataQualityReport {
  issues: DataQualityIssue[];
  summary: {
    critical: number;
    warning: number;
    info: number;
  };
  lastCheck: string;
}

interface ComponentHealth {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  lastCheck: string;
}

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  components: {
    database: ComponentHealth;
    api: ComponentHealth;
    workers: ComponentHealth;
  };
  timestamp: string;
}

type TabType = "metrics" | "issues" | "prometheus" | "health";

export default function DataQualityWorkspace() {
  const [activeTab, setActiveTab] = useState<TabType>("metrics");

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-700 bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Data Quality Monitoring</h1>
            <p className="mt-1 text-sm text-gray-400">
              Real-time monitoring of data quality metrics, issues, and system health
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex-shrink-0 border-b border-gray-700 bg-gray-800">
        <nav className="flex space-x-1 px-6" aria-label="Tabs">
          {[
            { id: "metrics", label: "📊 Metrics Dashboard", description: "Real-time quality KPIs" },
            { id: "issues", label: "⚠️ Quality Issues", description: "Current data quality problems" },
            { id: "prometheus", label: "📈 Prometheus Export", description: "Metrics for monitoring" },
            { id: "health", label: "💚 System Health", description: "Component status" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`
                group relative min-w-0 flex-1 overflow-hidden px-4 py-3 text-center text-sm font-medium
                transition-colors duration-150
                ${
                  activeTab === tab.id
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-750"
                }
              `}
            >
              <span className="block truncate">{tab.label}</span>
              <span className="block text-xs text-gray-500 mt-0.5">{tab.description}</span>
              {activeTab === tab.id && (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "metrics" && (
          <MetricsPanel autoRefreshInterval={30} />
        )}

        {activeTab === "issues" && (
          <IssuesPanel />
        )}

        {activeTab === "prometheus" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Prometheus Metrics</h2>
            <p className="text-gray-400">Prometheus panel will be implemented in Phase 4</p>
          </div>
        )}

        {activeTab === "health" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">System Health</h2>
            <p className="text-gray-400">Health panel will be implemented in Phase 4</p>
          </div>
        )}
      </div>
    </div>
  );
}
