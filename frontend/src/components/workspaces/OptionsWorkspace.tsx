import {
  type AccessMetadataResponse,
  fetchAccessMetadata,
  fetchWorkspaceSettings,
  postUiAudit,
  saveWorkspaceSettings,
  testAccessConnection,
  type WorkspaceSettingsPayload,
  type WorkspaceSettingsResponse,
} from "@lib/apiClient";
import { useRoutingStore } from "@store/routingStore";
import { AlertTriangle, Check, Shield, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const STANDARD_OPTIONS = [
  { id: "zscore", label: "Z-Score", description: "Standard deviation based normalization", incompatible: ["mad"] },
  { id: "mad", label: "MAD", description: "Median Absolute Deviation", incompatible: ["zscore"] },
  { id: "robust", label: "Robust Scaling", description: "Interquartile range" },
];

const SIMILARITY_OPTIONS = [
  { id: "cosine", label: "Cosine", description: "Vector cosine similarity" },
  { id: "hnsw", label: "HNSW", description: "High dimensional nearest neighbor" },
  { id: "profile", label: "Weighted Profile", description: "Feature profile matching" },
];

const COLUMN_MAPPINGS = [
  { scope: "Routing Generation", source: "ITEM_CD", target: "items.item_code" },
  { scope: "Routing Generation", source: "ROUTING_ID", target: "items.routing_id" },
  { scope: "Training", source: "SETUP_TIME", target: "training.setup_minutes" },
  { scope: "Output", source: "PROC_SEQ", target: "output.sequence" },
];

const DEFAULT_OPTIONS = {
  standard: ["zscore"] as string[],
  similarity: ["cosine", "profile"] as string[],
  accessPath: "",
};

interface ErrorWithDetail {
  response?: {
    data?: {
      detail?: string;
    };
  };
}

export function OptionsWorkspace() {
  const setERPRequired = useRoutingStore((state) => state.setERPRequired);

  const [standardOptions, setStandardOptions] = useState<string[]>(DEFAULT_OPTIONS.standard);
  const [similarityOptions, setSimilarityOptions] = useState<string[]>(DEFAULT_OPTIONS.similarity);
  const [accessPath, setAccessPath] = useState<string>(DEFAULT_OPTIONS.accessPath);
  const [accessTable, setAccessTable] = useState<string>("");
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [testedPath, setTestedPath] = useState<string>("");
  const [metadataPreview, setMetadataPreview] = useState<AccessMetadataResponse | null>(null);
  const [metadataLoading, setMetadataLoading] = useState<boolean>(false);
  const [metadataError, setMetadataError] = useState<string>("");
  const [erpInterface, setErpInterface] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [dirty, setDirty] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [testMessage, setTestMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        setLoading(true);
        const data: WorkspaceSettingsResponse = await fetchWorkspaceSettings();
        if (cancelled) return;
        const options = data.options ?? {};
        setStandardOptions(Array.isArray(options.standard) ? (options.standard as string[]) : DEFAULT_OPTIONS.standard);
        setSimilarityOptions(Array.isArray(options.similarity) ? (options.similarity as string[]) : DEFAULT_OPTIONS.similarity);
        const initialPath = (options.access_path as string | undefined) ?? (data.access?.path as string | undefined) ?? DEFAULT_OPTIONS.accessPath;
        setAccessPath(initialPath);
        const savedTable = (options.access_table as string | undefined) ?? (data.access?.table as string | undefined) ?? "";
        setAccessTable(savedTable);
        setAvailableTables([]);
        setTestedPath("");
        const erpEnabled = Boolean((options.erp_interface as boolean | undefined) ?? (data.export?.erp_interface_enabled as boolean | undefined));
        setErpInterface(erpEnabled);
        setERPRequired(erpEnabled);
        setDirty(false);
      } catch {
        if (!cancelled) {
          setStatusMessage("Failed to load saved options. Using defaults.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [setERPRequired]);

  const conflicts = useMemo(() => {
    const warnings: string[] = [];
    STANDARD_OPTIONS.forEach((option) => {
      if (standardOptions.includes(option.id)) {
        option.incompatible?.forEach((other) => {
          if (standardOptions.includes(other)) {
            const otherLabel = STANDARD_OPTIONS.find((candidate) => candidate.id === other)?.label ?? other;
            warnings.push(`${option.label} + ${otherLabel}`);
          }
        });
      }
    });
    return warnings;
  }, [standardOptions]);

  const toggleStandard = (id: string) => {
    setStandardOptions((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      setDirty(true);
      return next;
    });
  };

  const toggleSimilarity = (id: string) => {
    setSimilarityOptions((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      setDirty(true);
      return next;
    });
  };

  const handleToggleErp = (next: boolean) => {
    setErpInterface(next);
    setERPRequired(next);
    setDirty(true);
    postUiAudit({
      action: "ui.options.erp_toggle",
      username: "codex",
      payload: { enabled: next },
    }).catch(() => undefined);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setStatusMessage("");
      const metadataPayload = metadataPreview
        ? {
            access_table: metadataPreview.table,
            column_count: metadataPreview.columns.length,
            inspected_path: metadataPreview.path,
            inspected_at: metadataPreview.updated_at,
          }
        : undefined;
      const payload: WorkspaceSettingsPayload = {
        version: Date.now(),
        options: {
          standard: standardOptions,
          similarity: similarityOptions,
          access_path: accessPath,
          access_table: accessTable || null,
          erp_interface: erpInterface,
        },
        access: {
          path: accessPath || null,
          table: accessTable || null,
        },
        metadata: metadataPayload,
      };
      await saveWorkspaceSettings(payload);
      await postUiAudit({
        action: "ui.options.update",
        username: "codex",
        payload: {
          standard: standardOptions,
          similarity: similarityOptions,
          access_path: accessPath,
          access_table: accessTable || null,
          erp_interface: erpInterface,
        },
      });
      setStatusMessage("Options saved successfully.");
      setDirty(false);
    } catch {
      setStatusMessage("Failed to save options.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestAccess = async () => {
    const trimmedPath = accessPath.trim();
    if (!trimmedPath) {
      setTestMessage("Enter an Access database path.");
      return;
    }
    try {
      setTesting(true);
      setTestMessage("");
      setMetadataPreview(null);
      setMetadataError("");
      const response = await testAccessConnection({ path: trimmedPath, table: accessTable ? accessTable.trim() : undefined });
      setTestedPath(response.ok ? trimmedPath : "");
      const tables = response.table_profiles ?? [];
      setAvailableTables(tables);
      if (response.verified_table) {
        setAccessTable(response.verified_table);
      } else if (accessTable && tables.length > 0 && !tables.includes(accessTable)) {
        setAccessTable(tables[0]);
      } else if (!accessTable && tables.length > 0) {
        setAccessTable(tables[0]);
      }
      const parts: string[] = [response.message ?? "Connection checked."];
      if (typeof response.elapsed_ms === "number") {
        parts.push(`(${response.elapsed_ms.toFixed(1)} ms)`);
      }
      setTestMessage(parts.join(" "));
      setDirty(true);
      await postUiAudit({
        action: "ui.access.connection",
        username: "codex",
        payload: {
          path_hash: response.path_hash,
          ok: response.ok,
          table_count: tables.length,
          verified_table: response.verified_table,
        },
      });
    } catch (error: unknown) {
      const detail = (error as ErrorWithDetail).response?.data?.detail;
      setTestMessage(detail ?? "Access connection test failed.");
      setTestedPath("");
      setAvailableTables([]);
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    const trimmedPath = accessPath.trim();
    if (!testedPath || testedPath !== trimmedPath || !accessTable.trim()) {
      setMetadataPreview(null);
      if (!accessTable.trim()) {
        setMetadataError("");
      }
      return;
    }
    let cancelled = false;
    async function loadMetadata() {
      try {
        setMetadataLoading(true);
        const response = await fetchAccessMetadata({ table: accessTable, path: trimmedPath });
        if (cancelled) return;
        setMetadataPreview(response);
        setMetadataError("");
      } catch {
        if (!cancelled) {
          setMetadataPreview(null);
          setMetadataError("Failed to load Access metadata.");
        }
      } finally {
        if (!cancelled) {
          setMetadataLoading(false);
        }
      }
    }
    void loadMetadata();
    return () => {
      cancelled = true;
    };
  }, [accessTable, accessPath, testedPath]);


  return (
    <div className="options-workspace" role="region" aria-label="System Options">
      <section className="panel-card options-card">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">Standard Deviation Options</h2>
            <p className="panel-subtitle">Normalization strategies applied before similarity calculation.</p>
          </div>
        </header>
        <div className="option-grid">
          {STANDARD_OPTIONS.map((option) => (
            <label key={option.id} className={`option-tile${standardOptions.includes(option.id) ? " is-active" : ""}`}>
              <input type="checkbox" checked={standardOptions.includes(option.id)} onChange={() => toggleStandard(option.id)} />
              <span className="option-tile__label">{option.label}</span>
              <span className="option-tile__desc">{option.description}</span>
            </label>
          ))}
        </div>
        {conflicts.length > 0 ? (
          <div className="option-conflict">
            <AlertTriangle size={16} /> Conflicting combination: {conflicts.join(", ")}
          </div>
        ) : null}
      </section>

      <section className="panel-card options-card">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">Similarity Search</h2>
            <p className="panel-subtitle">Algorithms used for Drag-Drop recommendations.</p>
          </div>
        </header>
        <div className="option-grid">
          {SIMILARITY_OPTIONS.map((option) => (
            <label key={option.id} className={`option-tile${similarityOptions.includes(option.id) ? " is-active" : ""}`}>
              <input type="checkbox" checked={similarityOptions.includes(option.id)} onChange={() => toggleSimilarity(option.id)} />
              <span className="option-tile__label">{option.label}</span>
              <span className="option-tile__desc">{option.description}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="panel-card options-card">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">Column Mapping</h2>
            <p className="panel-subtitle">Relationships between training, generation, and output fields.</p>
          </div>
        </header>
        <table className="mapping-table">
          <thead>
            <tr>
              <th>Scope</th>
              <th>Source</th>
              <th>Target</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {COLUMN_MAPPINGS.map((row) => (
              <tr key={`${row.scope}-${row.source}`}>
                <td>{row.scope}</td>
                <td>{row.source}</td>
                <td>{row.target}</td>
                <td>
                  <Check size={14} className="text-accent" /> mapped
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel-card options-card">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">Access Connection & ERP Interface</h2>
            <p className="panel-subtitle">Validate Access paths and interface options.</p>
          </div>
        </header>
        <div className="option-grid">
          <div className="options-security">
            <article>
              <Shield size={32} />
              <h3>ERP interface</h3>
              <p>When enabled, the routing save dialog activates the INTERFACE button automatically.</p>
            </article>
            <article>
              <XCircle size={32} />
              <h3>Conflict guard</h3>
              <p>Conflicting combinations are revalidated on save and recorded in audit logs.</p>
            </article>
          </div>
          <div className="options-access">
            <label>
              <span>Access database path</span>
              <input
                type="text"
                value={accessPath}
                onChange={(event) => {
                  const value = event.target.value;
                  setAccessPath(value);
                  setDirty(true);
                  setTestedPath("");
                  setMetadataPreview(null);
                  setMetadataError("");
                  setAvailableTables([]);
                }}
                placeholder="\\Share\Routing\ROUTING.accdb"
              />
            </label>
            <label>
              <span>Access table</span>
              <input
                type="text"
                value={accessTable}
                onChange={(event) => {
                  const value = event.target.value;
                  setAccessTable(value);
                  setDirty(true);
                  setTestedPath("");
                  setMetadataPreview(null);
                  setMetadataError("");
                }}
                list="access-table-options"
                placeholder="dbo_BI_ITEM_INFO_VIEW"
              />
              {availableTables.length > 0 ? (
                <datalist id="access-table-options">
                  {availableTables.map((table) => (
                    <option key={table} value={table} />
                  ))}
                </datalist>
              ) : null}
            </label>
            <div className="options-access__actions">
              <button type="button" onClick={handleTestAccess} disabled={testing || !accessPath.trim()} className="btn-secondary">
                {testing ? "Testing..." : "Test connection"}
              </button>
            </div>
            <div className="options-access__toggle">
              <label>
                <input type="checkbox" checked={erpInterface} onChange={(event) => handleToggleErp(event.target.checked)} />
                <span>Enable ERP interface</span>
              </label>
              <p className="options-access__status">
                {erpInterface
                  ? "INTERFACE button will be available on the routing save panel."
                  : "INTERFACE button stays disabled until this option is enabled."}
              </p>
            </div>
            {testMessage ? <p className="options-access__status">{testMessage}</p> : null}
            {metadataLoading ? (
              <p className="options-access__status">Loading metadata...</p>
            ) : metadataError ? (
              <p className="options-access__status">{metadataError}</p>
            ) : metadataPreview ? (
              <div className="options-access__metadata">
                <p className="options-access__status">
                  {metadataPreview.table} ({metadataPreview.columns.length} columns)
                </p>
                <ul className="metadata-list">
                  {metadataPreview.columns.map((column) => (
                    <li key={column.name}>
                      <span className="metadata-list__name">{column.name}</span>
                      <span className="metadata-list__type">
                        {column.type}
                        {column.nullable === false ? " · NOT NULL" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="options-footer">
        <button type="button" className="primary-button" onClick={handleSave} disabled={saving || loading || !dirty}>
          {saving ? "Saving..." : dirty ? "Save changes" : "Saved"}
        </button>
        {statusMessage ? <p className="options-footer__status">{statusMessage}</p> : null}
      </footer>
    </div>
  );
}
