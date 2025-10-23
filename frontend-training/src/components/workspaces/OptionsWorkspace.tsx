import type { WorkflowConfigResponse } from "@app-types/workflow";
import { CardShell } from "@components/common/CardShell";
import { DatabaseSettings } from "@components/DatabaseSettings";
import { fetchWorkflowConfig, fetchWorkspaceSettings, postUiAudit } from "@lib/apiClient";

type WorkspaceSettingsResponse = any;
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
  offlineDatasetPath: "",
  databaseTargetTable: "dbo.ROUTING_MASTER",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;



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
  const offlineDatasetPath = workspaceOptions.data.offlineDatasetPath;
  const databaseTargetTable = workspaceOptions.data.databaseTargetTable;
  const erpInterface = workspaceOptions.data.erpInterface;
  const columnMappings = workspaceOptions.data.columnMappings;
  const [statusMessage, setStatusMessage] = useState<string>("");
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
        const datasetPath = typeof options.offline_dataset_path === "string"
          ? options.offline_dataset_path
          : (typeof data.data_source?.offline_dataset_path === "string"
              ? data.data_source.offline_dataset_path
              : DEFAULT_OPTIONS.offlineDatasetPath);
        const targetTable = typeof options.database_target_table === "string"
          ? options.database_target_table
          : (typeof data.export?.database_target_table === "string"
              ? data.export.database_target_table
              : DEFAULT_OPTIONS.databaseTargetTable);
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
            offlineDatasetPath: datasetPath,
            databaseTargetTable: targetTable,
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
              offlineDatasetPath: DEFAULT_OPTIONS.offlineDatasetPath,
              databaseTargetTable: DEFAULT_OPTIONS.databaseTargetTable,
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
      await saveWorkspaceOptions({ version: Date.now(), columnMappings: normalizedRows });
      setColumnMappingSource("workspace");
      await postUiAudit({
        action: "ui.options.save",
        username: "codex",
        payload: {
          status: "success",
          standard: standardOptions,
          similarity: similarityOptions,
          offline_dataset_path: offlineDatasetPath,
          database_target_table: databaseTargetTable || null,
          erp_interface: erpInterface,
          column_mapping_count: payloadMappings.length,
          column_mapping_scopes: mappingScopes,
          column_mapping_source_before: previousSource,
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
          offline_dataset_path: offlineDatasetPath,
          database_target_table: databaseTargetTable || null,
          mapping_rows: columnMappings.length,
        },
      }).catch(() => undefined);
    }
  };

  const loading = workspaceOptions.loading;
  const saving = workspaceOptions.saving;
  const dirty = workspaceOptions.dirty;

  const standardValid = standardOptions.length > 0;
  const similarityValid = similarityOptions.length > 0;
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
            <h2 className="panel-title">데이터베이스 & ERP 설정</h2>
            <p className="panel-subtitle">오프라인 데이터셋 경로와 내보내기 대상 테이블을 관리합니다.</p>
          </div>
        </header>
        <div className="option-grid">
          <div className="options-security">
            <article>
              <Shield size={32} />
              <h3>ERP interface</h3>
              <p>INTERFACE 버튼 활성화 여부와 회귀 검증 로깅을 제어합니다.</p>
            </article>
            <article>
              <XCircle size={32} />
              <h3>Export guard</h3>
              <p>내보내기 테이블과 컬럼 매핑을 저장하기 전에 항상 검증합니다.</p>
            </article>
          </div>
          <div className="options-access">
            <label>
              <span>Offline dataset path (선택)</span>
              <input
                type="text"
                value={offlineDatasetPath}
                onChange={(event) => {
                  const value = event.target.value;
                  updateWorkspaceOptions((prev) => ({ ...prev, offlineDatasetPath: value }));
                }}
                placeholder="Optional CSV 또는 Parquet 파일 경로"
              />
            </label>
            <p className="option-hint" role="status">
              <AlertTriangle size={14} /> 지정된 파일이 있을 경우 학습 전처리에 사용되며, 없으면 MSSQL 품목 뷰를 참조합니다.
            </p>

            <label>
              <span>Export target table</span>
              <input
                type="text"
                value={databaseTargetTable}
                onChange={(event) => {
                  const value = event.target.value;
                  updateWorkspaceOptions((prev) => ({ ...prev, databaseTargetTable: value }));
                }}
                placeholder="dbo.ROUTING_MASTER"
              />
            </label>
            <p className="option-hint" role="status">
              <Check size={14} /> 예측 결과를 저장할 MSSQL 테이블을 지정하세요. 스키마는 워크플로우에서 구성된 매핑을 따릅니다.
            </p>

            <div className="options-access__toggle">
              <label>
                <input type="checkbox" checked={erpInterface} onChange={(event) => handleToggleErp(event.target.checked)} />
                <span>Enable ERP interface</span>
              </label>
              <p className="options-access__status">
                {erpInterface
                  ? "INTERFACE 버튼이 라우팅 저장 패널에서 활성화됩니다."
                  : "옵션을 켜기 전까지는 INTERFACE 버튼이 비활성 상태로 유지됩니다."}
              </p>
            </div>
          </div>
        </div>
      </CardShell>

      <CardShell as="section" innerClassName="options-card" tone="soft">
        <DatabaseSettings />
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
