import { X } from "lucide-react";
import React, { useEffect, useState } from "react";
import type { OperationStep } from "@app-types/routing";

interface CandidateDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  operation: OperationStep;
  isCustom: boolean;
  onSave?: (operation: OperationStep) => void;
  onAddToTimeline?: () => void;
}

/**
 * 후보 공정 노드 상세 정보 모달
 *
 * 공정 코드, 설명, 시간 정보 등을 표시하고 편집할 수 있습니다.
 */
export function CandidateDetailModal({
  isOpen,
  onClose,
  operation,
  isCustom,
  onSave,
  onAddToTimeline,
}: CandidateDetailModalProps) {
  const [procCode, setProcCode] = useState(operation.PROC_CD);
  const [procDesc, setProcDesc] = useState(operation.PROC_DESC ?? "");
  const [setupTime, setSetupTime] = useState(operation.SETUP_TIME?.toString() ?? "");
  const [runTime, setRunTime] = useState(operation.RUN_TIME?.toString() ?? "");
  const [waitTime, setWaitTime] = useState(operation.WAIT_TIME?.toString() ?? "");

  useEffect(() => {
    if (isOpen) {
      setProcCode(operation.PROC_CD);
      setProcDesc(operation.PROC_DESC ?? "");
      setSetupTime(operation.SETUP_TIME?.toString() ?? "");
      setRunTime(operation.RUN_TIME?.toString() ?? "");
      setWaitTime(operation.WAIT_TIME?.toString() ?? "");
    }
  }, [isOpen, operation]);

  const handleSave = () => {
    if (!onSave || !isCustom) {
      onClose();
      return;
    }

    const updated: OperationStep = {
      ...operation,
      PROC_CD: procCode,
      PROC_DESC: procDesc || undefined,
      SETUP_TIME: setupTime ? parseFloat(setupTime) : undefined,
      RUN_TIME: runTime ? parseFloat(runTime) : undefined,
      WAIT_TIME: waitTime ? parseFloat(waitTime) : undefined,
    };

    onSave(updated);
    onClose();
  };

  const handleAddToTimeline = () => {
    if (onAddToTimeline) {
      onAddToTimeline();
    }
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
          minWidth: "450px",
          maxWidth: "600px",
          maxHeight: "80vh",
          overflowY: "auto",
          border: "1px solid #475569",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ color: "#f1f5f9", fontSize: "18px", fontWeight: "600", margin: 0 }}>
            공정 상세 정보 - {operation.PROC_CD}
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
          {/* 공정 코드 */}
          <div>
            <label style={{ display: "block", color: "#cbd5e1", fontSize: "13px", marginBottom: "6px" }}>
              공정 코드 {!isCustom && <span style={{ color: "#94a3b8" }}>(읽기 전용)</span>}
            </label>
            <input
              type="text"
              value={procCode}
              onChange={(e) => setProcCode(e.target.value)}
              disabled={!isCustom}
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: isCustom ? "#0f172a" : "#334155",
                border: "1px solid #475569",
                borderRadius: "6px",
                color: "#f1f5f9",
                fontSize: "14px",
              }}
            />
          </div>

          {/* 공정 설명 */}
          <div>
            <label style={{ display: "block", color: "#cbd5e1", fontSize: "13px", marginBottom: "6px" }}>
              공정 설명 {!isCustom && <span style={{ color: "#94a3b8" }}>(읽기 전용)</span>}
            </label>
            <textarea
              value={procDesc}
              onChange={(e) => setProcDesc(e.target.value)}
              disabled={!isCustom}
              rows={2}
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: isCustom ? "#0f172a" : "#334155",
                border: "1px solid #475569",
                borderRadius: "6px",
                color: "#f1f5f9",
                fontSize: "14px",
                resize: "vertical",
              }}
              placeholder="공정 설명"
            />
          </div>

          {/* 시간 정보 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", color: "#cbd5e1", fontSize: "13px", marginBottom: "6px" }}>
                셋업시간 (분)
              </label>
              <input
                type="number"
                step="0.1"
                value={setupTime}
                onChange={(e) => setSetupTime(e.target.value)}
                disabled={!isCustom}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  backgroundColor: isCustom ? "#0f172a" : "#334155",
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
                가공시간 (분)
              </label>
              <input
                type="number"
                step="0.1"
                value={runTime}
                onChange={(e) => setRunTime(e.target.value)}
                disabled={!isCustom}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  backgroundColor: isCustom ? "#0f172a" : "#334155",
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
                disabled={!isCustom}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  backgroundColor: isCustom ? "#0f172a" : "#334155",
                  border: "1px solid #475569",
                  borderRadius: "6px",
                  color: "#f1f5f9",
                  fontSize: "14px",
                }}
                placeholder="0.0"
              />
            </div>
          </div>

          {/* 추가 정보 (읽기 전용) */}
          {!isCustom && (
            <div
              style={{
                backgroundColor: "#0f172a",
                padding: "12px",
                borderRadius: "6px",
                border: "1px solid #334155",
              }}
            >
              <h3 style={{ color: "#cbd5e1", fontSize: "13px", marginBottom: "8px", fontWeight: "600" }}>
                통계 정보
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px" }}>
                {operation.SAMPLE_COUNT !== undefined && operation.SAMPLE_COUNT !== null && (
                  <div style={{ color: "#94a3b8" }}>
                    <strong style={{ color: "#cbd5e1" }}>샘플 수:</strong> {operation.SAMPLE_COUNT}
                  </div>
                )}
                {operation.WORK_ORDER_CONFIDENCE !== undefined && operation.WORK_ORDER_CONFIDENCE !== null && (
                  <div style={{ color: "#94a3b8" }}>
                    <strong style={{ color: "#cbd5e1" }}>신뢰도:</strong>{" "}
                    {Math.round(operation.WORK_ORDER_CONFIDENCE * 100)}%
                  </div>
                )}
                {operation.TRIM_MEAN !== undefined && operation.TRIM_MEAN !== null && (
                  <div style={{ color: "#94a3b8" }}>
                    <strong style={{ color: "#cbd5e1" }}>Trim 평균:</strong> {operation.TRIM_MEAN.toFixed(2)}분
                  </div>
                )}
                {operation.OUTSOURCING_REPLACED && (
                  <div style={{ color: "#f97316" }}>
                    <strong>사내전환</strong>
                  </div>
                )}
              </div>
            </div>
          )}
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
            닫기
          </button>
          {onAddToTimeline && (
            <button
              onClick={handleAddToTimeline}
              style={{
                padding: "8px 16px",
                backgroundColor: "#10b981",
                border: "none",
                borderRadius: "6px",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              타임라인에 추가
            </button>
          )}
          {isCustom && onSave && (
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
          )}
        </div>
      </div>
    </div>
  );
}
