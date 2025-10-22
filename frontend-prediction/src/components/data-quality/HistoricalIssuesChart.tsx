import type { DataQualityIssue } from "@lib/apiClient";
import { format } from "date-fns";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";

export interface HistoricalIssuesDataPoint {
  timestamp: string;
  issues: DataQualityIssue[];
}

interface HistoricalIssuesChartProps {
  data: HistoricalIssuesDataPoint[];
  height?: number;
}

interface ChartDataPoint {
  timestamp: string;
  date: Date;
  critical: number;
  warning: number;
  info: number;
  total: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="text-sm text-gray-300 mb-2 font-medium">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-400">{entry.name}:</span>
            </div>
            <span className="font-medium text-white">{entry.value}</span>
          </div>
        ))}
        <div className="pt-2 mt-2 border-t border-gray-700 flex justify-between text-sm">
          <span className="text-gray-400">Total:</span>
          <span className="font-bold text-white">{total}</span>
        </div>
      </div>
    </div>
  );
}

export function HistoricalIssuesChart({
  data,
  height = 300,
}: HistoricalIssuesChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((point) => {
      const critical = point.issues.filter((i) => i.severity === "critical").length;
      const warning = point.issues.filter((i) => i.severity === "warning").length;
      const info = point.issues.filter((i) => i.severity === "info").length;

      return {
        timestamp: format(new Date(point.timestamp), "MMM d, HH:mm"),
        date: new Date(point.timestamp),
        critical,
        warning,
        info,
        total: critical + warning + info,
      };
    });
  }, [data]);

  const summary = useMemo(() => {
    if (chartData.length === 0) return null;

    const totals = chartData.reduce(
      (acc, point) => ({
        critical: acc.critical + point.critical,
        warning: acc.warning + point.warning,
        info: acc.info + point.info,
        total: acc.total + point.total,
      }),
      { critical: 0, warning: 0, info: 0, total: 0 }
    );

    const avg = {
      critical: (totals.critical / chartData.length).toFixed(1),
      warning: (totals.warning / chartData.length).toFixed(1),
      info: (totals.info / chartData.length).toFixed(1),
      total: (totals.total / chartData.length).toFixed(1),
    };

    return { totals, avg };
  }, [chartData]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-800/50 rounded-lg border border-gray-700">
        <p className="text-gray-400">No historical issue data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={16} className="text-red-400" />
              <span className="text-xs text-gray-400">Critical</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-red-400">{summary.totals.critical}</span>
              <span className="text-xs text-gray-500">avg {summary.avg.critical}</span>
            </div>
          </div>

          <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={16} className="text-yellow-400" />
              <span className="text-xs text-gray-400">Warning</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-yellow-400">{summary.totals.warning}</span>
              <span className="text-xs text-gray-500">avg {summary.avg.warning}</span>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Info size={16} className="text-blue-400" />
              <span className="text-xs text-gray-400">Info</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-400">{summary.totals.info}</span>
              <span className="text-xs text-gray-500">avg {summary.avg.info}</span>
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-400">Total Issues</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{summary.totals.total}</span>
              <span className="text-xs text-gray-500">avg {summary.avg.total}</span>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="timestamp"
              stroke="#9CA3AF"
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
            />
            <YAxis
              stroke="#9CA3AF"
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              label={{ value: "Issue Count", angle: -90, position: "insideLeft", fill: "#9CA3AF" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: "20px" }}
              iconType="square"
            />
            <Bar
              dataKey="critical"
              stackId="a"
              fill="#EF4444"
              name="Critical"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="warning"
              stackId="a"
              fill="#F59E0B"
              name="Warning"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="info"
              stackId="a"
              fill="#3B82F6"
              name="Info"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
