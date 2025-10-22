import { useQualityHistory, useQualityMetrics } from "@hooks/useQuality";
import type { AlertItem, QualityCycle } from "@lib/apiClient";
import { AlertTriangle, Download, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function QualityDashboard() {
  const [cycleLimit, setCycleLimit] = useState(30);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: currentMetrics, isLoading: metricsLoading, refresh: refreshMetrics } = useQualityMetrics();
  const { data: history, isLoading: historyLoading, refresh: refreshHistory } = useQualityHistory({
    limit: cycleLimit,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const isLoading = metricsLoading || historyLoading;

  // Chart data transformation
  const chartData = useMemo(() => {
    if (!history?.cycles) return [];
    return history.cycles.map((cycle: QualityCycle) => ({
      timestamp: new Date(cycle.timestamp).toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
      }),
      mae: cycle.metrics.mae,
      trim_mae: cycle.metrics.trim_mae,
      rmse: cycle.metrics.rmse,
      process_match: cycle.metrics.process_match * 100,
    }));
  }, [history]);

  // Recent alerts
  const recentAlerts = useMemo(() => {
    if (!history?.cycles) return [];
    const alerts: Array<AlertItem & { cycle_id: string; timestamp: string }> = [];
    history.cycles.forEach((cycle: QualityCycle) => {
      cycle.metrics.alerts.forEach((alert: AlertItem) => {
        alerts.push({
          ...alert,
          cycle_id: cycle.cycle_id,
          timestamp: cycle.timestamp,
        });
      });
    });
    return alerts.slice(0, 20); // Last 20 alerts
  }, [history]);

  // Export handlers
  const handleExportJSON = () => {
    if (!history) return;
    const dataStr = JSON.stringify(history, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quality-history-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!history?.cycles) return;
    const headers = ["Cycle ID", "Timestamp", "MAE", "Trim MAE", "RMSE", "Process Match", "Alerts Count"];
    const rows = history.cycles.map((cycle: QualityCycle) => [
      cycle.cycle_id,
      cycle.timestamp,
      cycle.metrics.mae.toFixed(2),
      cycle.metrics.trim_mae.toFixed(2),
      cycle.metrics.rmse.toFixed(2),
      (cycle.metrics.process_match * 100).toFixed(1),
      cycle.metrics.alerts.length,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quality-history-${new Date().toISOString()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    refreshMetrics();
    refreshHistory();
  };

  return (
    <div className="quality-dashboard" style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#e2e8f0", marginBottom: "8px" }}>
            품질 모니터링 대시보드
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "14px" }}>
            Iterative Training 품질 메트릭 및 알림 추적
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px" }}
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            새로고침
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            className="btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px" }}
          >
            <Download size={16} />
            JSON
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px" }}
          >
            <Download size={16} />
            CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          marginBottom: "24px",
          padding: "16px",
          backgroundColor: "#1e293b",
          borderRadius: "8px",
          border: "1px solid #334155",
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500 }}>사이클 개수</label>
          <select
            value={cycleLimit}
            onChange={(e) => setCycleLimit(Number(e.target.value))}
            style={{
              padding: "6px 10px",
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "6px",
              color: "#e2e8f0",
              fontSize: "13px",
            }}
          >
            <option value={10}>최근 10개</option>
            <option value={30}>최근 30개</option>
            <option value={50}>최근 50개</option>
            <option value={100}>최근 100개</option>
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500 }}>시작일</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              padding: "6px 10px",
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "6px",
              color: "#e2e8f0",
              fontSize: "13px",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500 }}>종료일</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              padding: "6px 10px",
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "6px",
              color: "#e2e8f0",
              fontSize: "13px",
            }}
          />
        </div>
      </div>

      {/* Current Metrics Cards */}
      {currentMetrics && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <MetricCard
            label="MAE (평균 절대 오차)"
            value={`${currentMetrics.mae.toFixed(2)}분`}
            trend={chartData.length > 1 ? chartData[chartData.length - 1].mae - chartData[0].mae : 0}
          />
          <MetricCard
            label="Trim-MAE"
            value={`${currentMetrics.trim_mae.toFixed(2)}분`}
            trend={chartData.length > 1 ? chartData[chartData.length - 1].trim_mae - chartData[0].trim_mae : 0}
          />
          <MetricCard
            label="RMSE"
            value={`${currentMetrics.rmse.toFixed(2)}분`}
            trend={chartData.length > 1 ? chartData[chartData.length - 1].rmse - chartData[0].rmse : 0}
          />
          <MetricCard
            label="공정 일치율"
            value={`${(currentMetrics.process_match * 100).toFixed(1)}%`}
            trend={
              chartData.length > 1
                ? chartData[chartData.length - 1].process_match - chartData[0].process_match
                : 0
            }
            inverse
          />
          <MetricCard
            label="샘플 평균"
            value={`${currentMetrics.sample_count.toFixed(1)}개`}
            trend={0}
          />
          <MetricCard
            label="알림 개수"
            value={`${currentMetrics.alerts.length}개`}
            trend={0}
            severity={currentMetrics.alerts.length > 5 ? "warning" : undefined}
          />
        </div>
      )}

      {/* MAE Trend Chart */}
      <div
        style={{
          marginBottom: "24px",
          padding: "20px",
          backgroundColor: "#1e293b",
          borderRadius: "8px",
          border: "1px solid #334155",
        }}
      >
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#e2e8f0", marginBottom: "16px" }}>
          MAE 트렌드 (최근 {cycleLimit}개 사이클)
        </h2>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8" }}>
            데이터를 불러오는 중...
          </div>
        ) : chartData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8" }}>
            표시할 데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="timestamp" stroke="#94a3b8" style={{ fontSize: "12px" }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }} />
              <Line type="monotone" dataKey="mae" stroke="#f59e0b" name="MAE" strokeWidth={2} />
              <Line type="monotone" dataKey="trim_mae" stroke="#3b82f6" name="Trim-MAE" strokeWidth={2} />
              <Line type="monotone" dataKey="rmse" stroke="#ef4444" name="RMSE" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent Alerts Table */}
      <div
        style={{
          padding: "20px",
          backgroundColor: "#1e293b",
          borderRadius: "8px",
          border: "1px solid #334155",
        }}
      >
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#e2e8f0", marginBottom: "16px" }}>
          최근 알림 (최근 20개)
        </h2>
        {recentAlerts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            알림이 없습니다.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155" }}>
                  <th style={{ padding: "12px", textAlign: "left", color: "#94a3b8", fontSize: "12px", fontWeight: 500 }}>
                    시간
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", color: "#94a3b8", fontSize: "12px", fontWeight: 500 }}>
                    품목 코드
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", color: "#94a3b8", fontSize: "12px", fontWeight: 500 }}>
                    공정 코드
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", color: "#94a3b8", fontSize: "12px", fontWeight: 500 }}>
                    이슈
                  </th>
                  <th style={{ padding: "12px", textAlign: "right", color: "#94a3b8", fontSize: "12px", fontWeight: 500 }}>
                    측정값
                  </th>
                  <th style={{ padding: "12px", textAlign: "right", color: "#94a3b8", fontSize: "12px", fontWeight: 500 }}>
                    임계값
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", color: "#94a3b8", fontSize: "12px", fontWeight: 500 }}>
                    메시지
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentAlerts.map((alert, index) => (
                  <tr
                    key={`${alert.cycle_id}-${alert.item_cd}-${index}`}
                    style={{ borderBottom: "1px solid #334155" }}
                  >
                    <td style={{ padding: "12px", fontSize: "12px", color: "#cbd5e1" }}>
                      {new Date(alert.timestamp).toLocaleString("ko-KR")}
                    </td>
                    <td style={{ padding: "12px", fontSize: "12px", color: "#cbd5e1", fontWeight: 500 }}>
                      {alert.item_cd}
                    </td>
                    <td style={{ padding: "12px", fontSize: "12px", color: "#94a3b8" }}>
                      {alert.proc_cd ?? "-"}
                    </td>
                    <td style={{ padding: "12px", fontSize: "12px" }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          backgroundColor: getSeverityColor(alert.issue).bg,
                          color: getSeverityColor(alert.issue).text,
                          fontSize: "11px",
                          fontWeight: 600,
                        }}
                      >
                        {alert.issue}
                      </span>
                    </td>
                    <td style={{ padding: "12px", fontSize: "12px", color: "#cbd5e1", textAlign: "right" }}>
                      {alert.value.toFixed(2)}
                    </td>
                    <td style={{ padding: "12px", fontSize: "12px", color: "#94a3b8", textAlign: "right" }}>
                      {alert.threshold.toFixed(2)}
                    </td>
                    <td style={{ padding: "12px", fontSize: "12px", color: "#cbd5e1" }}>
                      {alert.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components
interface MetricCardProps {
  label: string;
  value: string;
  trend: number;
  inverse?: boolean;
  severity?: "warning" | "error";
}

function MetricCard({ label, value, trend, inverse = false, severity }: MetricCardProps) {
  const isPositive = inverse ? trend < 0 : trend > 0;
  const trendColor = trend === 0 ? "#94a3b8" : isPositive ? "#10b981" : "#ef4444";

  return (
    <div
      style={{
        padding: "16px",
        backgroundColor: "#1e293b",
        borderRadius: "8px",
        border: `1px solid ${severity === "warning" ? "#f59e0b" : severity === "error" ? "#ef4444" : "#334155"}`,
      }}
    >
      <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px", fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: "24px", color: "#e2e8f0", fontWeight: 700, marginBottom: "4px" }}>
        {value}
      </div>
      {trend !== 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: trendColor }}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {Math.abs(trend).toFixed(2)}
        </div>
      )}
      {severity && (
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "8px", fontSize: "11px", color: "#f59e0b" }}>
          <AlertTriangle size={12} />
          주의 필요
        </div>
      )}
    </div>
  );
}

function getSeverityColor(issue: string): { bg: string; text: string } {
  if (issue.includes("HIGH") || issue.includes("CRITICAL")) {
    return { bg: "#7f1d1d", text: "#fca5a5" };
  }
  if (issue.includes("LOW") || issue.includes("WARNING")) {
    return { bg: "#78350f", text: "#fcd34d" };
  }
  return { bg: "#1e3a8a", text: "#93c5fd" };
}
