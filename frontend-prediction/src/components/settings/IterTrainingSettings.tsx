import { CheckCircle2, Save, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

interface IterTrainingConfig {
  sample_size: number;
  mae_threshold: number;
  cv_threshold: number;
  queue_max_size: number;
  polling_interval: number;
}

const DEFAULT_CONFIG: IterTrainingConfig = {
  sample_size: 500,
  mae_threshold: 5.0,
  cv_threshold: 0.3,
  queue_max_size: 10,
  polling_interval: 5,
};

const STORAGE_KEY = "iter_training_config";

export function IterTrainingSettings() {
  const [config, setConfig] = useState<IterTrainingConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load config from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
      } catch (err) {
        console.error("Failed to parse stored config:", err);
      }
    }
  }, []);

  const validateConfig = (cfg: IterTrainingConfig): Record<string, string> => {
    const errs: Record<string, string> = {};

    if (cfg.sample_size < 10 || cfg.sample_size > 10000) {
      errs.sample_size = "Sample size must be between 10 and 10,000";
    }

    if (cfg.mae_threshold <= 0) {
      errs.mae_threshold = "MAE threshold must be positive";
    }

    if (cfg.cv_threshold < 0 || cfg.cv_threshold > 1) {
      errs.cv_threshold = "CV threshold must be between 0 and 1";
    }

    if (cfg.queue_max_size < 1 || cfg.queue_max_size > 100) {
      errs.queue_max_size = "Queue max size must be between 1 and 100";
    }

    if (cfg.polling_interval < 1 || cfg.polling_interval > 60) {
      errs.polling_interval = "Polling interval must be between 1 and 60 seconds";
    }

    return errs;
  };

  const handleSave = () => {
    const validationErrors = validateConfig(config);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save config:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setErrors({});
    setSaveSuccess(false);
  };

  const handleChange = (field: keyof IterTrainingConfig, value: number) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  return (
    <div className="iter-training-settings" style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#e2e8f0", marginBottom: "8px" }}>
          Iterative Training 설정
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "14px" }}>
          학습 프로세스 파라미터 및 임계값 설정
        </p>
      </div>

      {/* Success Message */}
      {saveSuccess && (
        <div
          style={{
            marginBottom: "20px",
            padding: "12px 16px",
            backgroundColor: "#064e3b",
            border: "1px solid #059669",
            borderRadius: "8px",
            color: "#6ee7b7",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle2 size={16} />
          설정이 성공적으로 저장되었습니다.
        </div>
      )}

      {/* Settings Form */}
      <div
        style={{
          padding: "24px",
          backgroundColor: "#1e293b",
          borderRadius: "8px",
          border: "1px solid #334155",
        }}
      >
        {/* Sample Size */}
        <div style={{ marginBottom: "24px" }}>
          <label
            htmlFor="sample_size"
            style={{ display: "block", fontSize: "14px", color: "#e2e8f0", fontWeight: 600, marginBottom: "8px" }}
          >
            샘플 크기 (Sample Size)
          </label>
          <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px" }}>
            품질 평가에 사용할 품목 샘플 개수 (10~10,000)
          </p>
          <input
            id="sample_size"
            type="number"
            value={config.sample_size}
            onChange={(e) => handleChange("sample_size", Number(e.target.value))}
            min={10}
            max={10000}
            style={{
              width: "100%",
              padding: "10px 12px",
              backgroundColor: "#0f172a",
              border: `1px solid ${errors.sample_size ? "#dc2626" : "#334155"}`,
              borderRadius: "6px",
              color: "#e2e8f0",
              fontSize: "14px",
            }}
          />
          {errors.sample_size && (
            <p style={{ marginTop: "4px", fontSize: "12px", color: "#fca5a5" }}>{errors.sample_size}</p>
          )}
        </div>

        {/* MAE Threshold */}
        <div style={{ marginBottom: "24px" }}>
          <label
            htmlFor="mae_threshold"
            style={{ display: "block", fontSize: "14px", color: "#e2e8f0", fontWeight: 600, marginBottom: "8px" }}
          >
            MAE 임계값 (분)
          </label>
          <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px" }}>
            재학습 트리거를 위한 Mean Absolute Error 임계값
          </p>
          <input
            id="mae_threshold"
            type="number"
            value={config.mae_threshold}
            onChange={(e) => handleChange("mae_threshold", Number(e.target.value))}
            min={0.1}
            step={0.1}
            style={{
              width: "100%",
              padding: "10px 12px",
              backgroundColor: "#0f172a",
              border: `1px solid ${errors.mae_threshold ? "#dc2626" : "#334155"}`,
              borderRadius: "6px",
              color: "#e2e8f0",
              fontSize: "14px",
            }}
          />
          {errors.mae_threshold && (
            <p style={{ marginTop: "4px", fontSize: "12px", color: "#fca5a5" }}>{errors.mae_threshold}</p>
          )}
        </div>

        {/* CV Threshold */}
        <div style={{ marginBottom: "24px" }}>
          <label
            htmlFor="cv_threshold"
            style={{ display: "block", fontSize: "14px", color: "#e2e8f0", fontWeight: 600, marginBottom: "8px" }}
          >
            CV 임계값 (Coefficient of Variation)
          </label>
          <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px" }}>
            변동계수 임계값 (0~1, 예: 0.3 = 30%)
          </p>
          <input
            id="cv_threshold"
            type="number"
            value={config.cv_threshold}
            onChange={(e) => handleChange("cv_threshold", Number(e.target.value))}
            min={0}
            max={1}
            step={0.01}
            style={{
              width: "100%",
              padding: "10px 12px",
              backgroundColor: "#0f172a",
              border: `1px solid ${errors.cv_threshold ? "#dc2626" : "#334155"}`,
              borderRadius: "6px",
              color: "#e2e8f0",
              fontSize: "14px",
            }}
          />
          {errors.cv_threshold && (
            <p style={{ marginTop: "4px", fontSize: "12px", color: "#fca5a5" }}>{errors.cv_threshold}</p>
          )}
        </div>

        {/* Queue Max Size */}
        <div style={{ marginBottom: "24px" }}>
          <label
            htmlFor="queue_max_size"
            style={{ display: "block", fontSize: "14px", color: "#e2e8f0", fontWeight: 600, marginBottom: "8px" }}
          >
            큐 최대 크기
          </label>
          <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px" }}>
            동시 대기 가능한 학습 작업 수 (1~100)
          </p>
          <input
            id="queue_max_size"
            type="number"
            value={config.queue_max_size}
            onChange={(e) => handleChange("queue_max_size", Number(e.target.value))}
            min={1}
            max={100}
            style={{
              width: "100%",
              padding: "10px 12px",
              backgroundColor: "#0f172a",
              border: `1px solid ${errors.queue_max_size ? "#dc2626" : "#334155"}`,
              borderRadius: "6px",
              color: "#e2e8f0",
              fontSize: "14px",
            }}
          />
          {errors.queue_max_size && (
            <p style={{ marginTop: "4px", fontSize: "12px", color: "#fca5a5" }}>{errors.queue_max_size}</p>
          )}
        </div>

        {/* Polling Interval */}
        <div style={{ marginBottom: "24px" }}>
          <label
            htmlFor="polling_interval"
            style={{ display: "block", fontSize: "14px", color: "#e2e8f0", fontWeight: 600, marginBottom: "8px" }}
          >
            폴링 간격 (초)
          </label>
          <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px" }}>
            학습 상태 업데이트 확인 간격 (1~60초)
          </p>
          <input
            id="polling_interval"
            type="number"
            value={config.polling_interval}
            onChange={(e) => handleChange("polling_interval", Number(e.target.value))}
            min={1}
            max={60}
            style={{
              width: "100%",
              padding: "10px 12px",
              backgroundColor: "#0f172a",
              border: `1px solid ${errors.polling_interval ? "#dc2626" : "#334155"}`,
              borderRadius: "6px",
              color: "#e2e8f0",
              fontSize: "14px",
            }}
          />
          {errors.polling_interval && (
            <p style={{ marginTop: "4px", fontSize: "12px", color: "#fca5a5" }}>{errors.polling_interval}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              backgroundColor: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: isSaving ? "not-allowed" : "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.currentTarget.style.backgroundColor = "#2563eb";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaving) {
                e.currentTarget.style.backgroundColor = "#3b82f6";
              }
            }}
          >
            <Save size={16} />
            {isSaving ? "저장 중..." : "저장"}
          </button>
          <button
            type="button"
            onClick={handleReset}
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
            <RotateCcw size={16} />
            기본값 복원
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div
        style={{
          marginTop: "24px",
          padding: "16px",
          backgroundColor: "#1e3a8a",
          border: "1px solid #3b82f6",
          borderRadius: "8px",
          color: "#93c5fd",
          fontSize: "13px",
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: "8px" }}>ℹ️ 참고 사항</p>
        <ul style={{ marginLeft: "20px", lineHeight: "1.6" }}>
          <li>설정은 브라우저 로컬 스토리지에 저장됩니다.</li>
          <li>MAE 임계값을 초과하면 자동으로 재학습이 트리거됩니다.</li>
          <li>샘플 크기가 클수록 정확도가 높아지지만 실행 시간이 길어집니다.</li>
          <li>폴링 간격이 짧을수록 실시간성이 높아지지만 서버 부하가 증가합니다.</li>
        </ul>
      </div>
    </div>
  );
}
