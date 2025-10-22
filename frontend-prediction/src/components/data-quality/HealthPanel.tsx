import { type ComponentHealth,fetchDataQualityHealth, type HealthStatus } from "@lib/apiClient";
import { Activity,AlertTriangle, CheckCircle, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

type HealthStatusType = "healthy" | "degraded" | "unhealthy";

export function HealthPanel() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadHealth = async (showSpinner = true) => {
    try {
      if (showSpinner) {
        setIsRefreshing(true);
      }
      setError(null);
      const data = await fetchDataQualityHealth();
      setHealth(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to load health status:", err);
      setError(err instanceof Error ? err.message : "Failed to load health status");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const handleManualRefresh = () => {
    loadHealth(true);
  };

  const getStatusConfig = (status: HealthStatusType) => {
    switch (status) {
      case "healthy":
        return {
          icon: CheckCircle,
          color: "text-green-400",
          bgColor: "bg-green-500/10",
          borderColor: "border-green-500/30",
          label: "Healthy",
        };
      case "degraded":
        return {
          icon: AlertTriangle,
          color: "text-yellow-400",
          bgColor: "bg-yellow-500/10",
          borderColor: "border-yellow-500/30",
          label: "Degraded",
        };
      case "unhealthy":
        return {
          icon: XCircle,
          color: "text-red-400",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/30",
          label: "Unhealthy",
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading health status...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-400">Error: {error}</div>
        <button
          onClick={handleManualRefresh}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">No health data available</div>
      </div>
    );
  }

  const overallConfig = getStatusConfig(health.status);
  const OverallIcon = overallConfig.icon;

  const ComponentHealthCard = ({
    name,
    component,
  }: {
    name: string;
    component: ComponentHealth;
  }) => {
    const config = getStatusConfig(component.status);
    const Icon = config.icon;

    return (
      <div
        className={`rounded-lg border p-4 ${config.bgColor} ${config.borderColor}`}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-gray-300">{name}</h3>
            <div className={`flex items-center gap-2 mt-1 ${config.color}`}>
              <Icon size={18} />
              <span className="text-sm font-medium">{config.label}</span>
            </div>
          </div>
          <Activity size={20} className="text-gray-500" />
        </div>
        {component.message && (
          <p className="text-xs text-gray-400 mb-2">{component.message}</p>
        )}
        <div className="text-xs text-gray-500">
          Last check: {new Date(component.lastCheck).toLocaleString()}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">System Health Status</h2>
          <p className="text-sm text-gray-400 mt-1">
            Real-time monitoring of system components and services
          </p>
          {lastUpdated && (
            <p className="text-sm text-gray-400 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Overall Status */}
      <div
        className={`rounded-lg border p-6 ${overallConfig.bgColor} ${overallConfig.borderColor}`}
      >
        <div className="flex items-center gap-4">
          <OverallIcon size={48} className={overallConfig.color} />
          <div>
            <h3 className="text-sm text-gray-400 uppercase tracking-wide">Overall Status</h3>
            <div className={`text-3xl font-bold ${overallConfig.color} mt-1`}>
              {overallConfig.label}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              All system components are being monitored
            </p>
          </div>
        </div>
      </div>

      {/* Component Status */}
      <div>
        <h3 className="text-lg font-medium text-white mb-4">Component Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ComponentHealthCard
            name="Database"
            component={health.components.database}
          />
          <ComponentHealthCard
            name="API"
            component={health.components.api}
          />
          <ComponentHealthCard
            name="Workers"
            component={health.components.workers}
          />
        </div>
      </div>

      {/* System Timestamp */}
      <div className="text-xs text-gray-500 border-t border-gray-700 pt-4">
        System timestamp: {new Date(health.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
