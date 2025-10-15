import { AlertCircle, CheckCircle, Info, X, XCircle } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const toastContainerStyle: CSSProperties = {
  position: "fixed",
  top: "1rem",
  right: "1rem",
  zIndex: 9999,
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  pointerEvents: "none",
};

const toastBaseStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.875rem 1rem",
  borderRadius: "var(--layout-radius, 0.5rem)",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
  minWidth: "300px",
  maxWidth: "500px",
  fontSize: "0.9rem",
  fontWeight: 500,
  pointerEvents: "auto",
  animation: "slideInFromRight 0.3s ease-out",
  transition: "all 0.3s ease",
};

const toastStyles: Record<ToastType, CSSProperties> = {
  success: {
    background: "#10b981",
    color: "#ffffff",
    border: "1px solid #059669",
  },
  error: {
    background: "#ef4444",
    color: "#ffffff",
    border: "1px solid #dc2626",
  },
  warning: {
    background: "#f59e0b",
    color: "#ffffff",
    border: "1px solid #d97706",
  },
  info: {
    background: "#3b82f6",
    color: "#ffffff",
    border: "1px solid #2563eb",
  },
};

const iconStyle: CSSProperties = {
  flexShrink: 0,
};

const messageStyle: CSSProperties = {
  flex: 1,
  wordBreak: "break-word",
};

const closeButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  padding: "0.25rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "0.25rem",
  opacity: 0.8,
  transition: "opacity 0.2s",
  flexShrink: 0,
};

function Toast({ toast, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(toast.id);
    }, 300);
  };

  const getIcon = () => {
    const size = 20;
    switch (toast.type) {
      case "success":
        return <CheckCircle size={size} />;
      case "error":
        return <XCircle size={size} />;
      case "warning":
        return <AlertCircle size={size} />;
      case "info":
        return <Info size={size} />;
    }
  };

  const style: CSSProperties = {
    ...toastBaseStyle,
    ...toastStyles[toast.type],
    ...(isExiting ? { opacity: 0, transform: "translateX(100%)" } : {}),
  };

  return (
    <div style={style} role="alert">
      <div style={iconStyle}>{getIcon()}</div>
      <div style={messageStyle}>{toast.message}</div>
      <button
        type="button"
        onClick={handleClose}
        style={closeButtonStyle}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
        aria-label="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <>
      <style>
        {`
          @keyframes slideInFromRight {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}
      </style>
      <div style={toastContainerStyle}>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={onClose} />
        ))}
      </div>
    </>
  );
}
