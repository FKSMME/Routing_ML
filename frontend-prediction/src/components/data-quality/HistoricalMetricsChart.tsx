import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { DataQualityMetrics } from "@lib/apiClient";

export interface HistoricalDataPoint {
  timestamp: string;
  metrics: DataQualityMetrics;
}

interface HistoricalMetricsChartProps {
  data: HistoricalDataPoint[];
  showComparison?: boolean;
  comparisonData?: HistoricalDataPoint[];
  height?: number;
}

interface ChartDataPoint {
  timestamp: string;
  date: Date;
  completeness: number;
  validity: number;
  consistency: number;
  prevCompleteness?: number;
  prevValidity?: number;
  prevConsistency?: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="text-sm text-gray-300 mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-400">{entry.name}:</span>
          <span className="font-medium text-white">{entry.value?.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function calculateTrend(current: number, previous: number): { value: number; direction: "up" | "down" | "neutral" } {
  const diff = current - previous;
  const direction = diff > 0.5 ? "up" : diff < -0.5 ? "down" : "neutral";
  return { value: Math.abs(diff), direction };
}

export function HistoricalMetricsChart({
  data,
  showComparison = false,
  comparisonData,
  height = 400,
}: HistoricalMetricsChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((point) => {
      const dataPoint: ChartDataPoint = {
        timestamp: format(new Date(point.timestamp), "MMM d, HH:mm"),
        date: new Date(point.timestamp),
        completeness: point.metrics.completeness,
        validity: point.metrics.validity,
        consistency: point.metrics.consistency,
      };

      // Add comparison data if available
      if (showComparison && comparisonData) {
        const matchingComparison = comparisonData.find(
          (cp) => format(new Date(cp.timestamp), "MMM d, HH:mm") === dataPoint.timestamp
        );
        if (matchingComparison) {
          dataPoint.prevCompleteness = matchingComparison.metrics.completeness;
          dataPoint.prevValidity = matchingComparison.metrics.validity;
          dataPoint.prevConsistency = matchingComparison.metrics.consistency;
        }
      }

      return dataPoint;
    });
  }, [data, showComparison, comparisonData]);

  const latestMetrics = useMemo(() => {
    if (chartData.length === 0) return null;
    const latest = chartData[chartData.length - 1];
    const previous = chartData.length > 1 ? chartData[chartData.length - 2] : latest;

    return {
      completeness: calculateTrend(latest.completeness, previous.completeness),
      validity: calculateTrend(latest.validity, previous.validity),
      consistency: calculateTrend(latest.consistency, previous.consistency),
    };
  }, [chartData]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-800/50 rounded-lg border border-gray-700">
        <p className="text-gray-400">No historical data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Trend Indicators */}
      {latestMetrics && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { name: "Completeness", trend: latestMetrics.completeness, color: "text-blue-400" },
            { name: "Validity", trend: latestMetrics.validity, color: "text-green-400" },
            { name: "Consistency", trend: latestMetrics.consistency, color: "text-purple-400" },
          ].map((metric) => (
            <div key={metric.name} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{metric.name}</span>
                <div className="flex items-center gap-1">
                  {metric.trend.direction === "up" && (
                    <TrendingUp size={14} className="text-green-500" />
                  )}
                  {metric.trend.direction === "down" && (
                    <TrendingDown size={14} className="text-red-500" />
                  )}
                  {metric.trend.direction === "neutral" && (
                    <Minus size={14} className="text-gray-500" />
                  )}
                  <span
                    className={`text-xs font-medium ${
                      metric.trend.direction === "up"
                        ? "text-green-500"
                        : metric.trend.direction === "down"
                        ? "text-red-500"
                        : "text-gray-500"
                    }`}
                  >
                    {metric.trend.value.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="timestamp"
              stroke="#9CA3AF"
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#9CA3AF"
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              label={{ value: "Score (%)", angle: -90, position: "insideLeft", fill: "#9CA3AF" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: "20px" }}
              iconType="line"
            />

            {/* Current Period Lines */}
            <Line
              type="monotone"
              dataKey="completeness"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ fill: "#3B82F6", r: 4 }}
              activeDot={{ r: 6 }}
              name="Completeness"
            />
            <Line
              type="monotone"
              dataKey="validity"
              stroke="#10B981"
              strokeWidth={2}
              dot={{ fill: "#10B981", r: 4 }}
              activeDot={{ r: 6 }}
              name="Validity"
            />
            <Line
              type="monotone"
              dataKey="consistency"
              stroke="#8B5CF6"
              strokeWidth={2}
              dot={{ fill: "#8B5CF6", r: 4 }}
              activeDot={{ r: 6 }}
              name="Consistency"
            />

            {/* Comparison Period Lines (dashed) */}
            {showComparison && (
              <>
                <Line
                  type="monotone"
                  dataKey="prevCompleteness"
                  stroke="#3B82F6"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Prev Completeness"
                />
                <Line
                  type="monotone"
                  dataKey="prevValidity"
                  stroke="#10B981"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Prev Validity"
                />
                <Line
                  type="monotone"
                  dataKey="prevConsistency"
                  stroke="#8B5CF6"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Prev Consistency"
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
