import { useEffect, useState } from "react";
import { RefreshCw, Copy, Check } from "lucide-react";
import { fetchPrometheusMetrics } from "@lib/apiClient";

export function PrometheusPanel() {
  const [metrics, setMetrics] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadMetrics = async (showSpinner = true) => {
    try {
      if (showSpinner) {
        setIsRefreshing(true);
      }
      setError(null);
      const data = await fetchPrometheusMetrics();
      setMetrics(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to load Prometheus metrics:", err);
      setError(err instanceof Error ? err.message : "Failed to load Prometheus metrics");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const handleManualRefresh = () => {
    loadMetrics(true);
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(metrics);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading Prometheus metrics...</div>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Prometheus Metrics Export</h2>
          <p className="text-sm text-gray-400 mt-1">
            Metrics in Prometheus exposition format for monitoring integration
          </p>
          {lastUpdated && (
            <p className="text-sm text-gray-400 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopyToClipboard}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors"
          >
            {copied ? (
              <>
                <Check size={16} className="text-green-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy size={16} />
                Copy
              </>
            )}
          </button>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-blue-400 mt-0.5">ℹ️</div>
          <div>
            <h3 className="text-sm font-medium text-blue-300">Prometheus Integration</h3>
            <p className="text-sm text-blue-400/80 mt-1">
              These metrics can be scraped by Prometheus for monitoring. Configure your Prometheus
              server to scrape the <code className="bg-blue-500/20 px-1 py-0.5 rounded">/data-quality/prometheus</code> endpoint.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Display */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
          <div className="text-xs font-medium text-gray-400 uppercase">Metrics Output</div>
          <div className="text-xs text-gray-500">
            {metrics.split('\n').filter(line => line.trim() && !line.startsWith('#')).length} metrics
          </div>
        </div>
        <div className="p-4 overflow-auto max-h-[600px]">
          <pre className="text-xs text-gray-300 font-mono leading-relaxed whitespace-pre">
            {metrics || "No metrics available"}
          </pre>
        </div>
      </div>

      {/* Example Usage */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-medium text-white mb-3">Example Prometheus Configuration</h3>
        <pre className="text-xs text-gray-300 font-mono bg-gray-900 p-3 rounded overflow-x-auto">
{`scrape_configs:
  - job_name: 'data-quality'
    static_configs:
      - targets: ['your-api-host:port']
    metrics_path: '/data-quality/prometheus'
    scrape_interval: 30s`}
        </pre>
      </div>
    </div>
  );
}
