import axios from "axios";
import { Download, Pause, Play, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface LogLine {
  timestamp: string;
  level: string;
  message: string;
}

export function LogViewer() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Fetch logs function
  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to fetch from backend API
      // If API doesn't exist, we'll use mock data
      const response = await axios.get<{ logs: LogLine[]; total: number }>("/api/training/logs", {
        params: { limit: 500 },
      });
      setLogs(response.data.logs);
      setLastFetchTime(new Date().toLocaleTimeString("ko-KR"));
    } catch (err) {
      // If API doesn't exist, show mock data for demonstration
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        // Generate mock logs
        const mockLogs: LogLine[] = Array.from({ length: 50 }, (_, i) => ({
          timestamp: new Date(Date.now() - i * 60000).toISOString(),
          level: ["INFO", "WARNING", "ERROR", "DEBUG"][Math.floor(Math.random() * 4)],
          message: `Sample log message ${i + 1}: System ${["started", "running", "processing", "completed"][Math.floor(Math.random() * 4)]}`,
        })).reverse();
        setLogs(mockLogs);
        setLastFetchTime(new Date().toLocaleTimeString("ko-KR"));
        setError("Using mock data (API not available)");
      } else {
        setError("Failed to fetch logs");
        console.error("Fetch logs error:", err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchLogs(); // Initial fetch

    if (!autoRefresh) {
      return;
    }

    const interval = setInterval(() => {
      fetchLogs();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Download logs
  const handleDownload = () => {
    const content = logs
      .map((log) => `[${log.timestamp}] [${log.level}] ${log.message}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quality-logs-${new Date().toISOString().split("T")[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="log-viewer" style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#e2e8f0", marginBottom: "8px" }}>
            로그 뷰어
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "14px" }}>
            실시간 학습 및 품질 평가 로그 (performance.quality.log)
          </p>
          {lastFetchTime && (
            <p style={{ color: "#64748b", fontSize: "12px", marginTop: "4px" }}>
              마지막 업데이트: {lastFetchTime}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px" }}
          >
            {autoRefresh ? <Pause size={16} /> : <Play size={16} />}
            {autoRefresh ? "일시정지" : "재개"}
          </button>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={isLoading}
            className="btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px" }}
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            새로고침
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px" }}
          >
            <Download size={16} />
            다운로드
          </button>
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          marginBottom: "16px",
          padding: "12px 16px",
          backgroundColor: "#1e293b",
          borderRadius: "8px",
          border: "1px solid #334155",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="checkbox"
            id="auto-scroll"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            style={{ cursor: "pointer" }}
          />
          <label htmlFor="auto-scroll" style={{ color: "#cbd5e1", fontSize: "13px", cursor: "pointer" }}>
            자동 스크롤
          </label>
        </div>
        <div style={{ fontSize: "13px", color: "#94a3b8" }}>
          총 {logs.length}개 로그
          {autoRefresh && <span style={{ marginLeft: "8px", color: "#10b981" }}>● 실시간 업데이트 중</span>}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px",
            backgroundColor: "#78350f",
            border: "1px solid #f59e0b",
            borderRadius: "6px",
            color: "#fcd34d",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      {/* Log Container */}
      <div
        style={{
          padding: "20px",
          backgroundColor: "#1e293b",
          borderRadius: "8px",
          border: "1px solid #334155",
        }}
      >
        <div
          ref={logContainerRef}
          style={{
            height: "600px",
            overflowY: "auto",
            backgroundColor: "#0f172a",
            border: "1px solid #334155",
            borderRadius: "6px",
            padding: "16px",
            fontFamily: "monospace",
            fontSize: "12px",
            lineHeight: "1.6",
          }}
        >
          {isLoading && logs.length === 0 ? (
            <div style={{ textAlign: "center", color: "#64748b", paddingTop: "100px" }}>
              로그를 불러오는 중...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: "center", color: "#64748b", paddingTop: "100px" }}>
              로그가 없습니다.
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                style={{
                  marginBottom: "4px",
                  color: getLogColor(log.level),
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                <span style={{ color: "#64748b" }}>[{new Date(log.timestamp).toLocaleString("ko-KR")}]</span>{" "}
                <span
                  style={{
                    fontWeight: 600,
                    color: getLevelBadgeColor(log.level),
                    padding: "2px 6px",
                    borderRadius: "3px",
                    backgroundColor: getLevelBadgeBg(log.level),
                    marginRight: "6px",
                  }}
                >
                  {log.level}
                </span>{" "}
                {log.message}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Info Box */}
      <div
        style={{
          marginTop: "20px",
          padding: "14px",
          backgroundColor: "#1e3a8a",
          border: "1px solid #3b82f6",
          borderRadius: "8px",
          color: "#93c5fd",
          fontSize: "12px",
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: "6px" }}>ℹ️ 로그 정보</p>
        <ul style={{ marginLeft: "20px", lineHeight: "1.5" }}>
          <li>자동 새로고침은 5초 간격으로 실행됩니다.</li>
          <li>최근 500개의 로그 라인이 표시됩니다.</li>
          <li>&quot;다운로드&quot; 버튼으로 전체 로그를 텍스트 파일로 저장할 수 있습니다.</li>
          <li>자동 스크롤을 활성화하면 새 로그가 추가될 때 자동으로 아래로 스크롤됩니다.</li>
        </ul>
      </div>
    </div>
  );
}

// Helper functions
function getLogColor(level: string): string {
  switch (level.toUpperCase()) {
    case "ERROR":
      return "#fca5a5";
    case "WARNING":
      return "#fcd34d";
    case "INFO":
      return "#93c5fd";
    case "DEBUG":
      return "#94a3b8";
    default:
      return "#cbd5e1";
  }
}

function getLevelBadgeColor(level: string): string {
  switch (level.toUpperCase()) {
    case "ERROR":
      return "#fca5a5";
    case "WARNING":
      return "#fcd34d";
    case "INFO":
      return "#93c5fd";
    case "DEBUG":
      return "#94a3b8";
    default:
      return "#cbd5e1";
  }
}

function getLevelBadgeBg(level: string): string {
  switch (level.toUpperCase()) {
    case "ERROR":
      return "#7f1d1d";
    case "WARNING":
      return "#78350f";
    case "INFO":
      return "#1e3a8a";
    case "DEBUG":
      return "#1e293b";
    default:
      return "#0f172a";
  }
}
