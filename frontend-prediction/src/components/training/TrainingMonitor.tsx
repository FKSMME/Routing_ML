import axios from "axios";
import { AlertCircle, CheckCircle2, Clock, Pause, Play, RefreshCw, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface StartTrainingRequest {
  cycle_id?: string;
  sample_size: number;
  strategy: "random" | "stratified" | "recent_bias";
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

interface JobStatus {
  job_id: string;
  status: string;
  progress: number;
  current_step: string;
  logs: LogEntry[];
  started_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  result?: Record<string, any> | null;
}

interface Job {
  job_id: string;
  status: string;
  progress: number;
  current_step: string;
  started_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
}

export function TrainingMonitor() {
  const [currentJob, setCurrentJob] = useState<JobStatus | null>(null);
  const [jobHistory, setJobHistory] = useState<Job[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [sampleSize, setSampleSize] = useState(500);
  const [strategy, setStrategy] = useState<"random" | "stratified" | "recent_bias">("stratified");
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [currentJob?.logs]);

  // Fetch job history
  const fetchJobHistory = useCallback(async () => {
    try {
      const response = await axios.get<{ jobs: Job[]; total: number }>("/api/training/jobs");
      setJobHistory(response.data.jobs);
    } catch (err) {
      console.error("Failed to fetch job history:", err);
    }
  }, []);

  // Fetch current job status
  const fetchJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await axios.get<JobStatus>(`/api/training/jobs/${jobId}/status`);
      setCurrentJob(response.data);

      // Stop polling if job is completed or failed
      if (["SUCCEEDED", "FAILED", "CANCELLED", "SKIPPED"].includes(response.data.status)) {
        setPollingEnabled(false);
        fetchJobHistory(); // Refresh history
      }
    } catch (err) {
      console.error("Failed to fetch job status:", err);
      setPollingEnabled(false);
    }
  }, [fetchJobHistory]);

  // Polling interval effect
  useEffect(() => {
    if (!pollingEnabled || !currentJob?.job_id) {
      return;
    }

    const interval = setInterval(() => {
      fetchJobStatus(currentJob.job_id);
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [pollingEnabled, currentJob?.job_id, fetchJobStatus]);

  // Initial fetch
  useEffect(() => {
    fetchJobHistory();
  }, [fetchJobHistory]);

  const handleStartTraining = async () => {
    setIsStarting(true);
    setError(null);

    try {
      const request: StartTrainingRequest = {
        sample_size: sampleSize,
        strategy: strategy,
      };

      const response = await axios.post<{ job_id: string; status: string; message: string }>(
        "/api/training/start",
        request
      );

      // Start polling for the new job
      const jobId = response.data.job_id;
      setCurrentJob({
        job_id: jobId,
        status: "PENDING",
        progress: 0,
        current_step: "Initializing...",
        logs: [],
      });
      setPollingEnabled(true);

      // Immediately fetch status
      await fetchJobStatus(jobId);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || err.message);
      } else {
        setError("Failed to start training");
      }
      console.error("Start training error:", err);
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancelJob = async () => {
    if (!currentJob?.job_id) return;

    try {
      await axios.delete(`/api/training/jobs/${currentJob.job_id}`);
      setPollingEnabled(false);
      fetchJobHistory();
    } catch (err) {
      console.error("Failed to cancel job:", err);
    }
  };

  const canStartTraining = !currentJob || ["SUCCEEDED", "FAILED", "CANCELLED", "SKIPPED"].includes(currentJob.status);
  const isRunning = currentJob && ["PENDING", "RUNNING"].includes(currentJob.status);

  return (
    <div className="training-monitor" style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#e2e8f0", marginBottom: "8px" }}>
          학습 모니터
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "14px" }}>
          Iterative Training 실행 및 진행 상황 추적
        </p>
      </div>

      {/* Control Panel */}
      <div
        style={{
          marginBottom: "24px",
          padding: "20px",
          backgroundColor: "#1e293b",
          borderRadius: "8px",
          border: "1px solid #334155",
        }}
      >
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#e2e8f0", marginBottom: "16px" }}>
          학습 설정
        </h2>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 200px" }}>
            <label style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 500 }}>샘플 크기</label>
            <input
              type="number"
              value={sampleSize}
              onChange={(e) => setSampleSize(Number(e.target.value))}
              min={10}
              max={10000}
              disabled={!canStartTraining}
              style={{
                padding: "8px 12px",
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#e2e8f0",
                fontSize: "14px",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 200px" }}>
            <label style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 500 }}>샘플링 전략</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as any)}
              disabled={!canStartTraining}
              style={{
                padding: "8px 12px",
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#e2e8f0",
                fontSize: "14px",
              }}
            >
              <option value="random">Random</option>
              <option value="stratified">Stratified</option>
              <option value="recent_bias">Recent Bias</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            type="button"
            onClick={handleStartTraining}
            disabled={!canStartTraining || isStarting}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              backgroundColor: canStartTraining ? "#3b82f6" : "#475569",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: canStartTraining ? "pointer" : "not-allowed",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              if (canStartTraining) {
                e.currentTarget.style.backgroundColor = "#2563eb";
              }
            }}
            onMouseLeave={(e) => {
              if (canStartTraining) {
                e.currentTarget.style.backgroundColor = "#3b82f6";
              }
            }}
          >
            <Play size={16} />
            {isStarting ? "시작 중..." : "학습 시작"}
          </button>
          {isRunning && (
            <button
              type="button"
              onClick={handleCancelJob}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                backgroundColor: "#dc2626",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#b91c1c";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#dc2626";
              }}
            >
              <X size={16} />
              취소
            </button>
          )}
          <button
            type="button"
            onClick={fetchJobHistory}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              backgroundColor: "#475569",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#64748b";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#475569";
            }}
          >
            <RefreshCw size={16} />
            새로고침
          </button>
        </div>
        {error && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              backgroundColor: "#7f1d1d",
              border: "1px solid #dc2626",
              borderRadius: "6px",
              color: "#fca5a5",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Current Job Status */}
      {currentJob && (
        <div
          style={{
            marginBottom: "24px",
            padding: "20px",
            backgroundColor: "#1e293b",
            borderRadius: "8px",
            border: "1px solid #334155",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#e2e8f0" }}>
              현재 작업: {currentJob.job_id}
            </h2>
            <StatusBadge status={currentJob.status} />
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", color: "#94a3b8" }}>{currentJob.current_step}</span>
              <span style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 600 }}>
                {currentJob.progress.toFixed(0)}%
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: "12px",
                backgroundColor: "#0f172a",
                borderRadius: "6px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${currentJob.progress}%`,
                  height: "100%",
                  backgroundColor: getProgressColor(currentJob.status),
                  transition: "width 0.5s ease-in-out",
                }}
              />
            </div>
          </div>

          {/* Log Viewer */}
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#cbd5e1", marginBottom: "8px" }}>
              실시간 로그
            </h3>
            <div
              ref={logContainerRef}
              style={{
                maxHeight: "300px",
                overflowY: "auto",
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "6px",
                padding: "12px",
                fontFamily: "monospace",
                fontSize: "12px",
              }}
            >
              {currentJob.logs && currentJob.logs.length > 0 ? (
                currentJob.logs.map((log, index) => (
                  <div
                    key={index}
                    style={{
                      color: getLogColor(log.level),
                      marginBottom: "4px",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    <span style={{ color: "#64748b" }}>[{log.timestamp}]</span>{" "}
                    <span style={{ fontWeight: 600 }}>[{log.level}]</span> {log.message}
                  </div>
                ))
              ) : (
                <div style={{ color: "#64748b" }}>로그가 없습니다.</div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {currentJob.error_message && (
            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                backgroundColor: "#7f1d1d",
                border: "1px solid #dc2626",
                borderRadius: "6px",
                color: "#fca5a5",
                fontSize: "13px",
              }}
            >
              <strong>오류:</strong> {currentJob.error_message}
            </div>
          )}

          {/* Result */}
          {currentJob.result && (
            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                backgroundColor: "#064e3b",
                border: "1px solid #059669",
                borderRadius: "6px",
                color: "#6ee7b7",
                fontSize: "13px",
              }}
            >
              <strong>결과:</strong> {JSON.stringify(currentJob.result, null, 2)}
            </div>
          )}
        </div>
      )}

      {/* Job History */}
      <div
        style={{
          padding: "20px",
          backgroundColor: "#1e293b",
          borderRadius: "8px",
          border: "1px solid #334155",
        }}
      >
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#e2e8f0", marginBottom: "16px" }}>
          학습 히스토리 ({jobHistory.length}개)
        </h2>
        {jobHistory.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            학습 히스토리가 없습니다.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155" }}>
                  <th style={{ padding: "12px", textAlign: "left", color: "#94a3b8", fontSize: "12px", fontWeight: 500 }}>
                    작업 ID
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", color: "#94a3b8", fontSize: "12px", fontWeight: 500 }}>
                    상태
                  </th>
                  <th style={{ padding: "12px", textAlign: "center", color: "#94a3b8", fontSize: "12px", fontWeight: 500 }}>
                    진행률
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", color: "#94a3b8", fontSize: "12px", fontWeight: 500 }}>
                    현재 단계
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", color: "#94a3b8", fontSize: "12px", fontWeight: 500 }}>
                    시작 시간
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", color: "#94a3b8", fontSize: "12px", fontWeight: 500 }}>
                    완료 시간
                  </th>
                </tr>
              </thead>
              <tbody>
                {jobHistory.map((job) => (
                  <tr key={job.job_id} style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "12px", fontSize: "12px", color: "#cbd5e1", fontFamily: "monospace" }}>
                      {job.job_id}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <StatusBadge status={job.status} />
                    </td>
                    <td style={{ padding: "12px", fontSize: "12px", color: "#cbd5e1", textAlign: "center" }}>
                      {job.progress.toFixed(0)}%
                    </td>
                    <td style={{ padding: "12px", fontSize: "12px", color: "#94a3b8" }}>
                      {job.current_step}
                    </td>
                    <td style={{ padding: "12px", fontSize: "12px", color: "#94a3b8" }}>
                      {job.started_at ? new Date(job.started_at).toLocaleString("ko-KR") : "-"}
                    </td>
                    <td style={{ padding: "12px", fontSize: "12px", color: "#94a3b8" }}>
                      {job.completed_at ? new Date(job.completed_at).toLocaleString("ko-KR") : "-"}
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
function StatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 10px",
        borderRadius: "4px",
        backgroundColor: config.bg,
        color: config.text,
        fontSize: "11px",
        fontWeight: 600,
      }}
    >
      {config.icon}
      {status}
    </span>
  );
}

function getStatusConfig(status: string): { bg: string; text: string; icon: JSX.Element } {
  switch (status.toUpperCase()) {
    case "PENDING":
      return { bg: "#1e3a8a", text: "#93c5fd", icon: <Clock size={12} /> };
    case "RUNNING":
      return { bg: "#78350f", text: "#fcd34d", icon: <RefreshCw size={12} className="animate-spin" /> };
    case "SUCCEEDED":
      return { bg: "#064e3b", text: "#6ee7b7", icon: <CheckCircle2 size={12} /> };
    case "FAILED":
      return { bg: "#7f1d1d", text: "#fca5a5", icon: <XCircle size={12} /> };
    case "CANCELLED":
      return { bg: "#475569", text: "#cbd5e1", icon: <Pause size={12} /> };
    case "SKIPPED":
      return { bg: "#475569", text: "#94a3b8", icon: <AlertCircle size={12} /> };
    default:
      return { bg: "#1e293b", text: "#94a3b8", icon: <Clock size={12} /> };
  }
}

function getProgressColor(status: string): string {
  switch (status.toUpperCase()) {
    case "RUNNING":
      return "#3b82f6";
    case "SUCCEEDED":
      return "#10b981";
    case "FAILED":
      return "#ef4444";
    case "CANCELLED":
      return "#64748b";
    default:
      return "#475569";
  }
}

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
