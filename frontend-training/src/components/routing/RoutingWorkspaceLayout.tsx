import { pastelSkyTheme } from "@styles/theme";
import type { CSSProperties, ReactNode } from "react";

interface RoutingWorkspaceLayoutProps {
  header?: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  className?: string;
}

type WorkspaceGridStyle = CSSProperties & {
  "--layout-workspace-columns"?: string;
};

export function RoutingWorkspaceLayout({
  header,
  left,
  center,
  right,
  className,
}: RoutingWorkspaceLayoutProps) {
  const gridStyle: WorkspaceGridStyle = {
    "--layout-workspace-columns": pastelSkyTheme.layout.workspaceColumns,
  };

  return (
    <div className={className ? `routing-workspace ${className}` : "routing-workspace"}>
      {header ? <div className="routing-workspace__header">{header}</div> : null}
      <div className="routing-workspace__grid" data-testid="routing-workspace-grid" style={gridStyle}>
        <aside className="routing-workspace__column routing-workspace__column--left">{left}</aside>
        <section className="routing-workspace__column routing-workspace__column--center">{center}</section>
        <aside className="routing-workspace__column routing-workspace__column--right">{right}</aside>
      </div>
    </div>
  );
}
