import { X } from "lucide-react";
import React, { useEffect,useState } from "react";

interface TimeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  stepId: string;
  processCode: string;
  currentSetupTime?: number;
  currentRunTime?: number;
  currentWaitTime?: number;
  onSave: (stepId: string, times: { setupTime?: number; runTime?: number; waitTime?: number }) => void;
}

export function TimeEditModal({
  isOpen,
  onClose,
  stepId,
  processCode,
  currentSetupTime,
  currentRunTime,
  currentWaitTime,
  onSave,
}: TimeEditModalProps) {
  const [setupTime, setSetupTime] = useState(currentSetupTime?.toString() ?? "");
  const [runTime, setRunTime] = useState(currentRunTime?.toString() ?? "");
  const [waitTime, setWaitTime] = useState(currentWaitTime?.toString() ?? "");

  useEffect(() => {
    setSetupTime(currentSetupTime?.toString() ?? "");
    setRunTime(currentRunTime?.toString() ?? "");
    setWaitTime(currentWaitTime?.toString() ?? "");
  }, [currentSetupTime, currentRunTime, currentWaitTime, isOpen]);

  const handleSave = () => {
    const times = {
      setupTime: setupTime ? parseFloat(setupTime) : undefined,
      runTime: runTime ? parseFloat(runTime) : undefined,
      waitTime: waitTime ? parseFloat(waitTime) : undefined,
    };
    onSave(stepId, times);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          backgroundColor: "#1e293b",
          borderRadius: "12px",
          padding: "24px",
          minWidth: "400px",
          maxWidth: "500px",
          border: "1px solid #475569",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ color: "#f1f5f9", fontSize: "18px", fontWeight: "600", margin: 0 }}>
            시간 설정 - {processCode}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", color: "#cbd5e1", fontSize: "13px", marginBottom: "6px" }}>
              셋업시간 (분)
            </label>
            <input
              type="number"
              step="0.1"
              value={setupTime}
              onChange={(e) => setSetupTime(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: "#0f172a",
                border: "1px solid #475569",
                borderRadius: "6px",
                color: "#f1f5f9",
                fontSize: "14px",
              }}
              placeholder="0.0"
            />
          </div>

          <div>
            <label style={{ display: "block", color: "#cbd5e1", fontSize: "13px", marginBottom: "6px" }}>
              표준시간 (분)
            </label>
            <input
              type="number"
              step="0.1"
              value={runTime}
              onChange={(e) => setRunTime(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: "#0f172a",
                border: "1px solid #475569",
                borderRadius: "6px",
                color: "#f1f5f9",
                fontSize: "14px",
              }}
              placeholder="0.0"
            />
          </div>

          <div>
            <label style={{ display: "block", color: "#cbd5e1", fontSize: "13px", marginBottom: "6px" }}>
              대기시간 (분)
            </label>
            <input
              type="number"
              step="0.1"
              value={waitTime}
              onChange={(e) => setWaitTime(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: "#0f172a",
                border: "1px solid #475569",
                borderRadius: "6px",
                color: "#f1f5f9",
                fontSize: "14px",
              }}
              placeholder="0.0"
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              backgroundColor: "#334155",
              border: "1px solid #475569",
              borderRadius: "6px",
              color: "#cbd5e1",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "8px 16px",
              backgroundColor: "#3b82f6",
              border: "none",
              borderRadius: "6px",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
