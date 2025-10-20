import { TrendingDown, TrendingUp } from "lucide-react";

interface KPICardProps {
  title: string;
  value: number;
  unit?: string;
  trend?: number;
  thresholds?: {
    good: number;
    warning: number;
  };
  format?: "percentage" | "number";
}

export function KPICard({
  title,
  value,
  unit = "%",
  trend,
  thresholds = { good: 90, warning: 70 },
  format = "percentage",
}: KPICardProps) {
  // Determine color based on thresholds
  const getStatusColor = (val: number): string => {
    if (val >= thresholds.good) return "text-green-400 bg-green-500/10 border-green-500/30";
    if (val >= thresholds.warning) return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
    return "text-red-400 bg-red-500/10 border-red-500/30";
  };

  const getStatusDot = (val: number): string => {
    if (val >= thresholds.good) return "bg-green-500";
    if (val >= thresholds.warning) return "bg-yellow-500";
    return "bg-red-500";
  };

  const formatValue = (val: number): string => {
    if (format === "percentage") {
      return `${val.toFixed(1)}${unit}`;
    }
    return `${val.toLocaleString()}${unit}`;
  };

  const statusColor = getStatusColor(value);
  const statusDot = getStatusDot(value);

  return (
    <div
      className={`rounded-lg border p-4 transition-all hover:scale-105 ${statusColor}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${statusDot}`} />
            <h3 className="text-sm font-medium text-gray-300">{title}</h3>
          </div>
          <div className="text-3xl font-bold mb-2">{formatValue(value)}</div>
          {trend !== undefined && (
            <div className="flex items-center gap-1 text-xs">
              {trend >= 0 ? (
                <>
                  <TrendingUp size={14} className="text-green-400" />
                  <span className="text-green-400">+{trend.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <TrendingDown size={14} className="text-red-400" />
                  <span className="text-red-400">{trend.toFixed(1)}%</span>
                </>
              )}
              <span className="text-gray-500 ml-1">vs last period</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
