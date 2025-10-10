import type { WorkflowConfigResponse } from "@app-types/workflow";
import { CardShell } from "@components/common/CardShell";
import {
  fetchMssqlMetadata,
  fetchWorkflowConfig,
  fetchWorkspaceSettings,
  postUiAudit,
  testMssqlConnection,
  type DataSourceMetadataResponse,
  type WorkspaceSettingsResponse,
} from "@lib/apiClient";
import { useWorkspaceStore, type WorkspaceColumnMappingRow } from "@store/workspaceStore";
import { AlertTriangle, Check, Plus, Shield, Trash2, XCircle } from "lucide-react";
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

const DEFAULT_OPTIONS = {
  standard: ["zscore"] as string[],
  similarity: ["cosine", "profile"] as string[],
  accessPath: "",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

interface ErrorWithDetail {
  response?: {
    data?: {
      detail?: string;
    };
  };
}

const randomId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `map-${Math.random().toString(36).slice(2)}`;

const makeRow = (row?: Partial<WorkspaceColumnMappingRow>): WorkspaceColumnMappingRow => ({
  id: row?.id ?? randomId(),
  scope: row?.scope ?? "",
  source: row?.source ?? "",
  target: row?.target ?? "",
});

const normalizeMappingCandidate = (
  value: unknown,
  fallbackScope?: string,
): WorkspaceColumnMappingRow[] => {
  if (!value) {
    return [];
  }
  const rows: WorkspaceColumnMappingRow[] = [];

  const pushRow = (candidate: Partial<WorkspaceColumnMappingRow>) => {
    const scope = `${candidate.scope ?? fallbackScope ?? ""}`.trim();
    const source = `${candidate.source ?? ""}`.trim();
    const target = `${candidate.target ?? ""}`.trim();
    if (!scope && !source && !target) {
      return;
    }
    rows.push(
      makeRow({
        id: candidate.id,
        scope,
        source,
        target,
      }),
    );
  };

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      if (typeof entry === "string") {
        pushRow({ scope: fallbackScope ?? `Mapping ${index + 1}`, source: entry, target: entry });
        return;
      }
      if (typeof entry === "object" && entry !== null) {
        const scopedEntry = entry as Record<string, unknown>;
        pushRow({
          id: typeof scopedEntry.id === "string" ? scopedEntry.id : undefined,
          scope: typeof scopedEntry.scope === "string" ? scopedEntry.scope : fallbackScope,
          source: typeof scopedEntry.source === "string" ? scopedEntry.source : "",
          target: typeof scopedEntry.target === "string" ? scopedEntry.target : "",
        });
      }
    });
    return rows;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    Object.entries(record).forEach(([scopeKey, entry]) => {
      if (Array.isArray(entry)) {
        entry.forEach((inner) => {
          if (typeof inner === "string") {
            pushRow({ scope: scopeKey || fallbackScope, source: inner, target: inner });
          } else if (typeof inner === "object" && inner !== null) {
            const nested = inner as Record<string, unknown>;
            pushRow({
              id: typeof nested.id === "string" ? nested.id : undefined,
              scope: typeof nested.scope === "string" ? nested.scope : scopeKey || fallbackScope,
              source: typeof nested.source === "string" ? nested.source : "",
              target: typeof nested.target === "string" ? nested.target : "",
            });
          }
        });
        return;
      }
      if (typeof entry === "object" && entry !== null) {
        const nestedRecord = entry as Record<string, unknown>;
        Object.entries(nestedRecord).forEach(([sourceKey, targetValue]) => {
          pushRow({
            scope: scopeKey || fallbackScope,
            source: sourceKey,
            target: typeof targetValue === "string" ? targetValue : `${targetValue ?? ""}`,
          });
        });
        return;
      }
      if (typeof entry === "string") {
        pushRow({ scope: scopeKey || fallbackScope, source: entry, target: entry });
      }
    });
    return rows;
  }

  return rows;
};

const dedupeMappings = (rows: WorkspaceColumnMappingRow[]): WorkspaceColumnMappingRow[] => {
  const map = new Map<string, WorkspaceColumnMappingRow>();
  rows.forEach((row) => {
    const key = `${row.scope.toLowerCase()}::${row.source.toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, row);
    }
  });
  return Array.from(map.values());
};

type ColumnMappingRow = WorkspaceColumnMappingRow;

const extractWorkflowMappings = (workflow: WorkflowConfigResponse | null | undefined): WorkspaceColumnMappingRow[] => {
  if (!workflow) {
    return [];
  }

  const candidates: ColumnMappingRow[] = [];
  const asAny = workflow as unknown as Record<string, unknown>;
  const collect = (value: unknown, scope?: string) => {
    candidates.push(...normalizeMappingCandidate(value, scope));
  };

  collect(asAny["column_mappings"]);
  collect(asAny["column_mapping"]);

  if (workflow.graph?.nodes) {
    workflow.graph.nodes.forEach((node) => {
      if (node.settings && typeof node.settings === "object") {
        const settings = node.settings as Record<string, unknown>;
        if ("column_mappings" in settings) {
          collect(settings["column_mappings"], node.label || node.id);
        }
        if ("column_mapping" in settings) {
          collect(settings["column_mapping"], node.label || node.id);
        }
      }
    });
  }

  const dataSourceUnknown = workflow.data_source as unknown;
  if (isRecord(dataSourceUnknown)) {
    collect(dataSourceUnknown["column_mappings"], "Data Source");
    collect(dataSourceUnknown["column_mapping"], "Data Source");
  }

  const sqlUnknown = workflow.sql as unknown;
  if (isRecord(sqlUnknown)) {
    collect(sqlUnknown["column_mappings"], "Output");
    collect(sqlUnknown["column_mapping"], "Output");
  }

  return dedupeMappings(candidates);
};

export function OptionsWorkspace() {
  const workspaceOptions = useWorkspaceStore((state) => state.workspaceOptions);
  const setWorkspaceOptionsLoading = useWorkspaceStore((state) => state.setWorkspaceOptionsLoading);
  const setWorkspaceOptionsSnapshot = useWorkspaceStore((state) => state.setWorkspaceOptionsSnapshot);
  const updateWorkspaceOptions = useWorkspaceStore((state) => state.updateWorkspaceOptions);
  const updateWorkspaceColumnMappings = useWorkspaceStore((state) => state.updateWorkspaceColumnMappings);
  const saveWorkspaceOptions = useWorkspaceStore((state) => state.saveWorkspaceOptions);
  const setErpInterfaceEnabled = useWorkspaceStore((state) => state.setErpInterfaceEnabled);

  const standardOptions = workspaceOptions.data.standard;
  const similarityOptions = workspaceOptions.data.similarity;
  const accessPath = workspaceOptions.data.accessPath;
  const accessTable = workspaceOptions.data.accessTable;
  const erpInterface = workspaceOptions.data.erpInterface;
  const columnMappings = workspaceOptions.data.columnMappings;
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [testedPath, setTestedPath] = useState<string>("");
  const [metadataPreview, setMetadataPreview] = useState<DataSourceMetadataResponse | null>(null);
  const [metadataLoading, setMetadataLoading] = useState<boolean>(false);
  const [metadataError, setMetadataError] = useState<string>("");
  const [testing, setTesting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [testMessage, setTestMessage] = useState<string>("");
  const [columnMappingSource, setColumnMappingSource] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        setWorkspaceOptionsLoading(true);
        const data: WorkspaceSettingsResponse = await fetchWorkspaceSettings();
        if (cancelled) return;
        const options = data.options ?? {};
        const standard = Array.isArray(options.standard) ? (options.standard as string[]) : DEFAULT_OPTIONS.standard;
        const similarity = Array.isArray(options.similarity) ? (options.similarity as string[]) : DEFAULT_OPTIONS.similarity;
        const initialPath = (options.access_path as string | undefined) ?? (data.access?.path as string | undefined) ?? DEFAULT_OPTIONS.accessPath;
        const savedTable = (options.access_table as string | undefined) ?? (data.access?.table as string | undefined) ?? "";
        setAvailableTables([]);
        setTestedPath("");
        const erpEnabled = Boolean((options.erp_interface as boolean | undefined) ?? (data.export?.erp_interface_enabled as boolean | undefined));

        let mappingRows = dedupeMappings(normalizeMappingCandidate((options.column_mappings as unknown) ?? null));
        let mappingSource = "workspace";
        if (mappingRows.length === 0) {
          try {
            const workflow = await fetchWorkflowConfig();
            if (cancelled) return;
            const extracted = extractWorkflowMappings(workflow);
            if (extracted.length > 0) {
              mappingRows = extracted;
              mappingSource = "workflow";
            }
          } catch {
            // Ignore workflow fetch errors. A fallback row will be used below.
          }
        }
        if (mappingRows.length === 0) {
          mappingRows = [makeRow({ scope: "Routing Generation" })];
          mappingSource = "fallback";
        }
        setWorkspaceOptionsSnapshot(
          {
            standard,
            similarity,
            accessPath: initialPath,
            accessTable: savedTable,
            erpInterface: erpEnabled,
            columnMappings: mappingRows,
          },
          { dirty: false, lastSyncedAt: data.updated_at },
        );
        setColumnMappingSource(mappingSource);
      } catch {
        if (!cancelled) {
          setStatusMessage("Failed to load saved options. Using defaults.");
          setWorkspaceOptionsSnapshot(
            {
              standard: DEFAULT_OPTIONS.standard,
              similarity: DEFAULT_OPTIONS.similarity,
              accessPath: DEFAULT_OPTIONS.accessPath,
              accessTable: "",
              erpInterface: false,
              columnMappings: [makeRow({ scope: "Routing Generation" })],
            },
            { dirty: false },
          );
        }
      } finally {
        if (!cancelled) {
          setWorkspaceOptionsLoading(false);
        }
      }
    }
    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [setWorkspaceOptionsLoading, setWorkspaceOptionsSnapshot]);

  const standardConflicts = useMemo(() => {
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

  const mappingDiagnostics = useMemo(() => {
    const rowErrors = new Map<string, string>();
    const conflictSummary: string[] = [];
    const seenSourceTarget = new Map<string, { id: string; target: string }>();
    const seenTarget = new Map<string, string>();

    columnMappings.forEach((row) => {
      const scope = row.scope.trim();
      const source = row.source.trim();
      const target = row.target.trim();
      if (!scope || !source || !target) {
        rowErrors.set(row.id, "Complete all fields");
        return;
      }
      const key = `${scope.toLowerCase()}::${source.toLowerCase()}`;
      const existing = seenSourceTarget.get(key);
      if (existing && existing.target !== target) {
        rowErrors.set(row.id, `Conflicts with ${existing.target}`);
        rowErrors.set(existing.id, `Conflicts with ${target}`);
        conflictSummary.push(`${scope}: ${source} → ${target}`);
        return;
      }
      seenSourceTarget.set(key, { id: row.id, target });
      const targetKey = `${scope.toLowerCase()}::${target.toLowerCase()}`;
      const existingTarget = seenTarget.get(targetKey);
      if (existingTarget && existingTarget !== source) {
        rowErrors.set(row.id, `Target reused by ${existingTarget}`);
        conflictSummary.push(`${scope}: ${source} ↔ ${target}`);
      } else {
        seenTarget.set(targetKey, source);
      }
    });

    return {
      rowErrors,
      conflictSummary: Array.from(new Set(conflictSummary)),
    };
  }, [columnMappings]);

  const toggleStandard = (id: string) => {
    updateWorkspaceOptions((prev) => ({
      ...prev,
      standard: prev.standard.includes(id) ? prev.standard.filter((item) => item !== id) : [...prev.standard, id],
    }));
  };

  const toggleSimilarity = (id: string) => {
    updateWorkspaceOptions((prev) => ({
      ...prev,
      similarity: prev.similarity.includes(id)
        ? prev.similarity.filter((item) => item !== id)
        : [...prev.similarity, id],
    }));
  };

  const handleToggleErp = (next: boolean) => {
    setErpInterfaceEnabled(next);
    postUiAudit({
      action: "ui.options.erp_toggle",
      username: "codex",
      payload: { enabled: next },
    }).catch(() => undefined);
  };

  const handleAddMappingRow = () => {
    updateWorkspaceColumnMappings((prev) => [...prev, makeRow({ scope: prev[prev.length - 1]?.scope ?? "" })]);
    setColumnMappingSource("workspace");
  };

  const handleUpdateMappingRow = (id: string, patch: Partial<Omit<WorkspaceColumnMappingRow, "id">>) => {
    let changed = false;
    const nextRows = columnMappings.map((row) => {
      if (row.id !== id) {
        return row;
      }
      const nextRow = { ...row, ...patch };
      if (nextRow.scope !== row.scope || nextRow.source !== row.source || nextRow.target !== row.target) {
        changed = true;
      }
      return nextRow;
    });
    if (changed) {
      updateWorkspaceColumnMappings(() => nextRows);
      setColumnMappingSource("workspace");
    }
  };

  const handleRemoveMappingRow = (id: string) => {
    if (columnMappings.length <= 1) {
      return;
    }
    const next = columnMappings.filter((row) => row.id !== id);
    if (next.length !== columnMappings.length) {
      updateWorkspaceColumnMappings(() => (next.length > 0 ? next : [makeRow()]));
      setColumnMappingSource("workspace");
    }
  };

  const handleSave = async () => {
    if (mappingDiagnostics.rowErrors.size > 0) {
      const issues = Array.from(new Set(mappingDiagnostics.rowErrors.values()));
      setStatusMessage(`Resolve column mapping issues: ${issues.join(", ")}`);
      await postUiAudit({
        action: "ui.options.column_mapping.conflict",
        username: "codex",
        payload: {
          issues: Array.from(mappingDiagnostics.rowErrors.entries()).map(([id, message]) => ({ id, message })),
        },
      }).catch(() => undefined);
      return;
    }
    try {
      setStatusMessage("");
      const previousSource = columnMappingSource;
      const normalizedRows = columnMappings.map((row) =>
        makeRow({
          id: row.id,
          scope: row.scope.trim(),
          source: row.source.trim(),
          target: row.target.trim(),
        }),
      );
      const payloadMappings = normalizedRows
        .map((row) => ({
          scope: row.scope,
          source: row.source,
          target: row.target,
        }))
        .filter((row) => row.scope || row.source || row.target);
      const mappingScopes = Array.from(new Set(payloadMappings.map((row) => row.scope).filter(Boolean)));
      const metadataPayload = metadataPreview
        ? {
            access_table: metadataPreview.table,
            column_count: metadataPreview.columns.length,
            inspected_path: metadataPreview.path,
            inspected_at: metadataPreview.updated_at,
          }
        : undefined;
      await saveWorkspaceOptions({ metadata: metadataPayload, version: Date.now(), columnMappings: normalizedRows });
      setColumnMappingSource("workspace");
      await postUiAudit({
        action: "ui.options.save",
        username: "codex",
        payload: {
          status: "success",
          standard: standardOptions,
          similarity: similarityOptions,
          access_path: accessPath,
          access_table: accessTable || null,
          erp_interface: erpInterface,
          column_mapping_count: payloadMappings.length,
          column_mapping_scopes: mappingScopes,
          column_mapping_source_before: previousSource,
          metadata_included: Boolean(metadataPayload),
        },
      }).catch(() => undefined);
      setStatusMessage(
        payloadMappings.length > 0
          ? `Options saved successfully. ${payloadMappings.length} column mappings stored.`
          : "Options saved successfully.",
      );
    } catch (error: unknown) {
      setStatusMessage("Failed to save options.");
      const detail = error instanceof Error ? error.message : undefined;
      await postUiAudit({
        action: "ui.options.save.error",
        username: "codex",
        payload: {
          status: "error",
          message: detail,
          access_path: accessPath,
          access_table: accessTable || null,
          mapping_rows: columnMappings.length,
        },
      }).catch(() => undefined);
    }
  };

  const handleTestConnection = async () => {
    const trimmedPath = accessPath.trim();
    if (!trimmedPath) {
      setTestMessage("Enter an MSSQL server address.");
      return;
    }
    try {
      setTesting(true);
      setTestMessage("");
      setMetadataPreview(null);
      setMetadataError("");
      const response = await testMssqlConnection({ path: trimmedPath, table: accessTable ? accessTable.trim() : undefined });
      setTestedPath(response.ok ? trimmedPath : "");
      const tables = response.table_profiles ?? [];
      setAvailableTables(tables);
      if (response.verified_table) {
        updateWorkspaceOptions((prev) => ({ ...prev, accessTable: response.verified_table ?? prev.accessTable }));
      } else if (accessTable && tables.length > 0 && !tables.includes(accessTable)) {
        updateWorkspaceOptions((prev) => ({ ...prev, accessTable: tables[0] }));
      } else if (!accessTable && tables.length > 0) {
        updateWorkspaceOptions((prev) => ({ ...prev, accessTable: tables[0] }));
      }
      const parts: string[] = [response.message ?? "Connection checked."];
      if (typeof response.elapsed_ms === "number") {
        parts.push(`(${response.elapsed_ms.toFixed(1)} ms)`);
      }
      setTestMessage(parts.join(" "));
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
      setTestMessage(detail ?? "MSSQL connection test failed.");
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
        const response = await fetchMssqlMetadata({ table: accessTable, path: trimmedPath });
        if (cancelled) return;
        setMetadataPreview(response);
        setMetadataError("");
      } catch {
        if (!cancelled) {
          setMetadataPreview(null);
          setMetadataError("Failed to load MSSQL metadata.");
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

  const loading = workspaceOptions.loading;
  const saving = workspaceOptions.saving;
  const dirty = workspaceOptions.dirty;

  const standardValid = standardOptions.length > 0;
  const similarityValid = similarityOptions.length > 0;
  const trimmedServerAddress = accessPath.trim();
  const isServerProvided = Boolean(trimmedServerAddress);
  const isServerVerified = isServerProvided && testedPath === trimmedServerAddress;
  const isViewProvided = !isServerProvided || Boolean(accessTable.trim());
  const mappingHasErrors = mappingDiagnostics.rowErrors.size > 0;

  return (
    <div className="options-workspace" role="region" aria-label="System Options">
      <CardShell as="section" innerClassName="options-card" tone="soft">
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
        <div
          className={`option-hint${standardValid && standardConflicts.length === 0 ? " is-success" : standardValid ? "" : " is-warning"}`}
          role="status"
          aria-live="polite"
        >
          {standardValid ? (
            standardConflicts.length > 0 ? (
              <span>
                <AlertTriangle size={14} /> Avoid conflicting combination: {standardConflicts.join(", ")}
              </span>
            ) : (
              <span>
                <Check size={14} /> {standardOptions.length} normalization option{standardOptions.length > 1 ? "s" : ""} selected.
              </span>
            )
          ) : (
            <span>
              <AlertTriangle size={14} /> Select at least one normalization option.
            </span>
          )}
        </div>
        {standardConflicts.length > 0 ? (
          <div className="option-conflict">
            <AlertTriangle size={16} /> Conflicting combination: {standardConflicts.join(", ")}
          </div>
        ) : null}
      </CardShell>

      <CardShell as="section" innerClassName="options-card" tone="soft">
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
        <div className={`option-hint${similarityValid ? " is-success" : " is-warning"}`} role="status" aria-live="polite">
          {similarityValid ? (
            <span>
              <Check size={14} /> {similarityOptions.length} similarity algorithm{similarityOptions.length > 1 ? "s" : ""} enabled.
            </span>
          ) : (
            <span>
              <AlertTriangle size={14} /> Choose at least one similarity algorithm.
            </span>
          )}
        </div>
      </CardShell>

      <CardShell as="section" innerClassName="options-card" tone="soft">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">Column Mapping</h2>
            <p className="panel-subtitle">Relationships between training, generation, and output fields.</p>
            {columnMappingSource === "workflow" ? <span className="panel-subtitle">Loaded from workflow configuration.</span> : null}
          </div>
          <button type="button" className="btn-secondary" onClick={handleAddMappingRow}>
            <Plus size={16} /> Add mapping
          </button>
        </header>
        <table className="mapping-table">
          <thead>
            <tr>
              <th>Scope</th>
              <th>Source</th>
              <th>Target</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {columnMappings.map((row) => {
              const error = mappingDiagnostics.rowErrors.get(row.id);
              return (
                <tr key={row.id}>
                  <td>
                    <input
                      type="text"
                      value={row.scope}
                      onChange={(event) => handleUpdateMappingRow(row.id, { scope: event.target.value })}
                      placeholder="Routing Generation"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.source}
                      onChange={(event) => handleUpdateMappingRow(row.id, { source: event.target.value })}
                      placeholder="ITEM_CD"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.target}
                      onChange={(event) => handleUpdateMappingRow(row.id, { target: event.target.value })}
                      placeholder="items.item_code"
                    />
                  </td>
                  <td>
                    {error ? (
                      <span className="option-conflict">
                        <AlertTriangle size={14} /> {error}
                      </span>
                    ) : (
                      <span className="text-accent">
                        <Check size={14} className="text-accent" /> linked
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleRemoveMappingRow(row.id)}
                      aria-label="Remove mapping"
                      disabled={columnMappings.length <= 1}
                      style={{ padding: "0.25rem 0.6rem" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className={`option-hint${mappingHasErrors ? " is-warning" : " is-success"}`} role="status" aria-live="polite">
          {mappingHasErrors ? (
            <span>
              <AlertTriangle size={14} /> Complete all column mapping fields before saving.
            </span>
          ) : (
            <span>
              <Check size={14} /> {columnMappings.length} mapping row{columnMappings.length === 1 ? "" : "s"} configured.
            </span>
          )}
        </div>
        {mappingDiagnostics.conflictSummary.length > 0 ? (
          <div className="option-conflict">
            <AlertTriangle size={16} /> Resolve mapping conflicts: {mappingDiagnostics.conflictSummary.join(", ")}
          </div>
        ) : null}
      </CardShell>

      <CardShell as="section" innerClassName="options-card" tone="soft">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">MSSQL Connection & ERP Interface</h2>
            <p className="panel-subtitle">Validate MSSQL endpoints and interface options.</p>
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
              <span>MSSQL server address</span>
              <input
                type="text"
                value={accessPath}
                onChange={(event) => {
                  const value = event.target.value;
                  updateWorkspaceOptions((prev) => ({ ...prev, accessPath: value }));
                  setTestedPath("");
                  setMetadataPreview(null);
                  setMetadataError("");
                  setAvailableTables([]);
                }}
                placeholder="K3-DB.ksm.co.kr,1433"
              />
            </label>
            <label>
              <span>MSSQL view</span>
              <input
                type="text"
                value={accessTable}
                onChange={(event) => {
                  const value = event.target.value;
                  updateWorkspaceOptions((prev) => ({ ...prev, accessTable: value }));
                  setTestedPath("");
                  setMetadataPreview(null);
                  setMetadataError("");
                }}
                list="datasource-view-options"
                placeholder="dbo.BI_ITEM_INFO_VIEW"
              />
              {availableTables.length > 0 ? (
                <datalist id="datasource-view-options">
                  {availableTables.map((table) => (
                    <option key={table} value={table} />
                  ))}
                </datalist>
              ) : null}
            </label>
            <div className="options-access__actions">
              <button type="button" onClick={handleTestConnection} disabled={testing || !accessPath.trim()} className="btn-secondary">
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
                  {metadataPreview.columns.map((column: any) => (
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
            <div className={`option-hint${isServerProvided && isServerVerified && isViewProvided ? " is-success" : " is-warning"}`} role="status" aria-live="polite">
              {isServerProvided ? (
                isServerVerified ? (
                  isViewProvided ? (
                    <span>
                      <Check size={14} /> MSSQL server recorded{accessTable ? ` with view ${accessTable}` : ""}.
                    </span>
                  ) : (
                    <span>
                      <AlertTriangle size={14} /> Provide a view name for the verified server.
                    </span>
                  )
                ) : (
                  <span>
                    <AlertTriangle size={14} /> Test the connection to verify this server.
                  </span>
                )
              ) : (
                <span>
                  <AlertTriangle size={14} /> Enter an MSSQL server address to enable validation.
                </span>
              )}
            </div>
          </div>
        </div>
      </CardShell>

      <footer className="options-footer">
        <button
          type="button"
          className="primary-button"
          onClick={handleSave}
          disabled={saving || loading || !dirty || mappingHasErrors}
        >
          {saving ? "Saving..." : dirty ? "Save changes" : "Saved"}
        </button>
        {statusMessage ? <p className="options-footer__status">{statusMessage}</p> : null}
      </footer>
    </div>
  );
}
