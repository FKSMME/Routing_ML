import type { MasterDataConnectionStatus, MasterDataLogEntry } from "@app-types/masterData";

interface MasterDataInfoPanelProps {
  connection: MasterDataConnectionStatus;
  logs: MasterDataLogEntry[];
  onDownloadLog: () => void;
  onRefresh?: () => void;
  onOpenConnection?: () => void;
}

const STATUS_LABEL: Record<MasterDataConnectionStatus["status"], string> = {
  connected: "Connected",
  disconnected: "Disconnected",
};

export function MasterDataInfoPanel({ connection, logs, onDownloadLog, onRefresh, onOpenConnection }: MasterDataInfoPanelProps) {
  const statusClass = ["status-dot", `status-${connection.status}`].join(" ");
  const statusLabel = STATUS_LABEL[connection.status];

  return (
    <div className="space-y-4">
      <section className="panel-card interactive-card">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">MSSQL Connection</h2>
            <p className="panel-subtitle">Server endpoint & last configuration status</p>
          </div>
          <span className={statusClass} aria-label={statusLabel} />
        </header>
        <dl className="info-grid">
          <div>
            <dt>Status</dt>
            <dd>{statusLabel}</dd>
          </div>
          <div>
            <dt>Server</dt>
            <dd className="truncate" title={connection.path}>
              {connection.path || "-"}
            </dd>
          </div>
          <div>
            <dt>Last sync</dt>
            <dd>{connection.last_sync ?? "-"}</dd>
          </div>
        </dl>
        <div className="flex flex-col gap-2 mt-3">
          {onOpenConnection ? (
            <button type="button" className="btn-primary w-full" onClick={onOpenConnection}>
              Connect source
            </button>
          ) : null}
          <div className="flex gap-2">
            {onRefresh ? (
              <button type="button" className="btn-secondary flex-1" onClick={onRefresh}>
                Refresh
              </button>
            ) : null}
            <button type="button" className="btn-secondary flex-1" onClick={onDownloadLog}>
              Download log
            </button>
          </div>
        </div>
      </section>

      <section className="panel-card interactive-card" aria-label="Recent audit trail">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">Audit trail</h2>
            <p className="panel-subtitle">Latest five operations</p>
          </div>
        </header>
        <ul className="log-list">
          {logs.length === 0 ? (
            <li className="text-muted">No audit entries available.</li>
          ) : (
            logs.map((log, index) => (
              <li key={`${log.timestamp}-${log.action}-${index}`}>
                <p className="log-action">
                  <span className="text-emphasis">{log.action}</span>
                  {log.target ? <span className="text-muted"> · {log.target}</span> : null}
                </p>
                <p className="log-meta">
                  {log.timestamp} · {log.ip} · {log.user}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
