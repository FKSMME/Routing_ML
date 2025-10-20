import { useEffect, useState } from "react";
import { RefreshCw, TrendingUp } from "lucide-react";
import {
  fetchDataQualityMetrics,
  fetchHistoricalMetrics,
  type DataQualityMetrics,
  type HistoricalMetricsDataPoint
} from "@lib/apiClient";
import { KPICard } from "./KPICard";
import { TrendChart } from "./TrendChart";
import { ExportButton, type ExportFormat } from "./ExportButton";
import { TimeRangeSelector, type TimeRange, type DateRange, getDateRangeFromSelection } from "./TimeRangeSelector";
import { HistoricalMetricsChart } from "./HistoricalMetricsChart";
import { exportMetricsToCSV, exportMetricsToPDF } from "../../services/exportService";
import { checkMetricsForAlerts } from "../../services/alertService";
import toast, { Toaster } from "react-hot-toast";

interface MetricsPanelProps {
  autoRefreshInterval?: number; // in seconds, 0 to disable
}

export function MetricsPanel({ autoRefreshInterval = 30 }: MetricsPanelProps) {
  const [metrics, setMetrics] = useState<DataQualityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Historical data state
  const [showHistorical, setShowHistorical] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>("7d");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [historicalData, setHistoricalData] = useState<HistoricalMetricsDataPoint[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);

  const loadMetrics = async (showSpinner = true) => {
    try {
      if (showSpinner) {
        setIsRefreshing(true);
      }
      setError(null);
      const data = await fetchDataQualityMetrics();
      setMetrics(data);
      setLastUpdated(new Date());

      // Check for alerts
      const triggeredAlerts = checkMetricsForAlerts(data);
      triggeredAlerts.forEach((alert) => {
        const toastOptions = {
          duration: 5000,
          icon: alert.severity === "critical" ? "🔴" : alert.severity === "warning" ? "⚠️" : "ℹ️",
        };

        if (alert.severity === "critical") {
          toast.error(alert.message, toastOptions);
        } else if (alert.severity === "warning") {
          toast(alert.message, { ...toastOptions, style: { background: "#713f12", color: "#fcd34d" } });
        } else {
          toast(alert.message, toastOptions);
        }
      });
    } catch (err) {
      console.error("Failed to load metrics:", err);
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadMetrics();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const interval = setInterval(() => {
      loadMetrics(false); // Silent refresh
    }, autoRefreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefreshInterval]);

  // Load historical data when toggled
  useEffect(() => {
    if (showHistorical && historicalData.length === 0) {
      const dateRange = getDateRangeFromSelection(selectedTimeRange, customDateRange);
      loadHistoricalData(selectedTimeRange, dateRange);
    }
  }, [showHistorical]);

  const loadHistoricalData = async (range: TimeRange, dateRange: DateRange) => {
    try {
      setHistoricalLoading(true);
      const response = await fetchHistoricalMetrics({
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
        interval: "1h",
      });
      setHistoricalData(response.dataPoints);
    } catch (err) {
      console.error("Failed to load historical data:", err);
      toast.error("Failed to load historical data");
    } finally {
      setHistoricalLoading(false);
    }
  };

  const handleTimeRangeChange = (range: TimeRange, dateRange: DateRange) => {
    setSelectedTimeRange(range);
    if (range === "custom") {
      setCustomDateRange(dateRange);
    }
    loadHistoricalData(range, dateRange);
  };

  const handleManualRefresh = () => {
    loadMetrics(true);
    if (showHistorical) {
      const dateRange = getDateRangeFromSelection(selectedTimeRange, customDateRange);
      loadHistoricalData(selectedTimeRange, dateRange);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!metrics) return;

    try {
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `data-quality-metrics-${timestamp}`;

      if (format === "csv") {
        exportMetricsToCSV(metrics, { filename: `${filename}.csv` });
        toast.success("Metrics exported to CSV successfully");
      } else {
        exportMetricsToPDF(metrics, {
          filename: `${filename}.pdf`,
          title: "Data Quality Metrics Report",
        });
        toast.success("Metrics exported to PDF successfully");
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Export failed. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading metrics...</div>
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

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">No metrics data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header with refresh and export buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Data Quality Metrics</h2>
          {lastUpdated && (
            <p className="text-sm text-gray-400 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
              {autoRefreshInterval > 0 && (
                <span className="ml-2 text-gray-500">
                  (auto-refresh every {autoRefreshInterval}s)
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <ExportButton
            onExport={handleExport}
            exportType="metrics"
            disabled={!metrics}
          />
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Completeness"
          value={metrics.completeness}
          thresholds={{ good: 95, warning: 85 }}
        />
        <KPICard
          title="Consistency"
          value={metrics.consistency}
          thresholds={{ good: 90, warning: 75 }}
        />
        <KPICard
          title="Validity"
          value={metrics.validity}
          thresholds={{ good: 95, warning: 80 }}
        />
      </div>

      {/* Trend Charts */}
      {metrics.trends && (
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-4">Trends (Recent)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TrendChart
              data={metrics.trends.completeness}
              label="Completeness Trend"
              color="#22c55e"
            />
            <TrendChart
              data={metrics.trends.consistency}
              label="Consistency Trend"
              color="#3b82f6"
            />
            <TrendChart
              data={metrics.trends.validity}
              label="Validity Trend"
              color="#a855f7"
            />
          </div>
        </div>
      )}

      {/* Historical Data Section */}
      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-400" />
            <h3 className="text-lg font-medium text-white">Historical Analysis</h3>
          </div>
          <button
            onClick={() => setShowHistorical(!showHistorical)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showHistorical
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {showHistorical ? "Hide Historical View" : "Show Historical View"}
          </button>
        </div>

        {showHistorical && (
          <div className="space-y-4">
            <TimeRangeSelector
              selectedRange={selectedTimeRange}
              onRangeChange={handleTimeRangeChange}
              customRange={customDateRange}
              disabled={historicalLoading}
            />

            {historicalLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-gray-400">Loading historical data...</div>
              </div>
            ) : (
              <HistoricalMetricsChart
                data={historicalData}
                height={400}
              />
            )}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="text-xs text-gray-500 border-t border-gray-700 pt-4">
        <div>Timestamp: {metrics.timestamp}</div>
      </div>
    </div>
  );
}
