import { AlertCircle, AlertTriangle, Info } from "lucide-react";

export type IssueSeverity = "critical" | "warning" | "info";

interface IssueBadgeProps {
  severity: IssueSeverity;
  size?: "sm" | "md" | "lg";
}

export function IssueBadge({ severity, size = "md" }: IssueBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  const configs = {
    critical: {
      label: "Critical",
      icon: AlertCircle,
      className: "bg-red-500/20 text-red-400 border border-red-500/50",
    },
    warning: {
      label: "Warning",
      icon: AlertTriangle,
      className: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50",
    },
    info: {
      label: "Info",
      icon: Info,
      className: "bg-blue-500/20 text-blue-400 border border-blue-500/50",
    },
  };

  const config = configs[severity];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses[size]} ${config.className}`}
    >
      <Icon size={iconSizes[size]} />
      {config.label}
    </span>
  );
}
