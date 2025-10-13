import type { MasterDataConnectionStatus, MasterDataLogEntry } from "@app-types/masterData";

interface MasterDataInfoPanelProps {
  connection: MasterDataConnectionStatus;
  logs: MasterDataLogEntry[];
  onDownloadLog: () => void | Promise<void>;
  onRefresh?: () => void;
}

const STATUS_LABEL: Record<MasterDataConnectionStatus["status"], string> = {
  connected: "Connected",
  disconnected: "Disconnected",
};

export function MasterDataInfoPanel({ connection, logs, onDownloadLog, onRefresh }: MasterDataInfoPanelProps) {
  const statusClass = ["status-dot", `status-${connection.status}`].join(" ");
  const statusLabel = STATUS_LABEL[connection.status];

  return (
    <div className="space-y-4">
      <section className="panel-card interactive-card">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">MSSQL Connection</h2>
            <p className="panel-subtitle">Current server state and last check</p>
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
            <dd className="truncate" title={connection.server ?? ""}>
              {connection.server ?? "-"}
            </dd>
          </div>
          <div>
            <dt>Database</dt>
            <dd>{connection.database ?? "-"}</dd>
          </div>
          <div>
            <dt>Last checked</dt>
            <dd>{connection.last_checked ?? "-"}</dd>
          </div>
        </dl>
        <div className="flex gap-2 mt-3">
          {onRefresh ? (
            <button type="button" className="btn-secondary flex-1" onClick={onRefresh}>
              Refresh
            </button>
          ) : null}
          <button type="button" className="btn-secondary flex-1" onClick={() => void onDownloadLog()}>
            Download log
          </button>
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
