// import type { AccessMetadataResponse } from "@lib/apiClient";
type AccessMetadataResponse = any;

interface MasterDataMetadataPanelProps {
  metadata: AccessMetadataResponse | null;
  isLoading: boolean;
}

export function MasterDataMetadataPanel({ metadata, isLoading }: MasterDataMetadataPanelProps) {
  const columns = metadata?.columns ?? [];
  return (
    <section className="panel-card interactive-card master-metadata" aria-label="Access metadata">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">Access Metadata</h2>
          <p className="panel-subtitle">Column definitions from the selected Access table.</p>
        </div>
      </header>
      {isLoading ? (
        <p className="text-sm text-muted">Loading metadata...</p>
      ) : columns.length === 0 ? (
        <p className="text-sm text-muted">No metadata available. Check Access connection.</p>
      ) : (
        <ul className="metadata-list">
          {columns.map((column: any) => (
            <li key={column.name}>
              <span className="metadata-list__name">{column.name}</span>
              <span className="metadata-list__type">
                {column.type}
                {column.nullable === false ? " · NOT NULL" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {metadata?.table ? <p className="metadata-list__table">Table: {metadata.table}</p> : null}
      {metadata?.updated_at ? <p className="metadata-list__table">Snapshot: {metadata.updated_at}</p> : null}
    </section>
  );
}
