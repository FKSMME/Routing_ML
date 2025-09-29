import { useWorkflowConfig } from "@hooks/useWorkflowConfig";
import {
  fetchOutputProfileDetail,
  fetchOutputProfiles,
  type OutputProfileColumn,
  type OutputProfileDetail,
  type OutputProfileSummary,
  postUiAudit,
  saveWorkspaceSettings,
} from "@lib/apiClient";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, DownloadCloud, Plus, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface MappingRow {
  source: string;
  mapped: string;
  type: string;
  required: boolean;
}

const COLUMN_TYPES: Array<{ value: string; label: string }> = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date/Time" },
];

function toMappingRow(column: OutputProfileColumn): MappingRow {
  return {
    source: column.source ?? "",
    mapped: column.mapped ?? "",
    type: column.type ?? "string",
    required: Boolean(column.required),
  };
}

function buildGeneratedPreview(rows: MappingRow[]): Array<Record<string, string>> {
  const columns = rows
    .map((row) => row.mapped.trim() || row.source.trim())
    .filter((column, index, all) => column !== "" && all.indexOf(column) === index);
  if (columns.length === 0) {
    return [];
  }
  const rowCount = Math.min(3, Math.max(1, columns.length));
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const record: Record<string, string> = {};
    columns.forEach((column, columnIndex) => {
      record[column] = `R${rowIndex + 1}-${columnIndex + 1}`;
    });
    return record;
  });
}

function safeFormatDate(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
}

export function DataOutputWorkspace() {
  const { data: workflowConfig, saveConfig, saving: configSaving, isLoading: configLoading } = useWorkflowConfig();

  const profilesQuery = useQuery<OutputProfileSummary[]>({
    queryKey: ["output-profiles"],
    queryFn: fetchOutputProfiles,
    staleTime: 60_000,
  });

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [format, setFormat] = useState<string>("CSV");
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [previewRows, setPreviewRows] = useState<Array<Record<string, unknown>>>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [dirty, setDirty] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const selectedProfile = useMemo(() => {
    if (!profilesQuery.data) {
      return null;
    }
    return profilesQuery.data.find((profile) => profile.id === selectedProfileId) ?? null;
  }, [profilesQuery.data, selectedProfileId]);

  useEffect(() => {
    if (!profilesQuery.data || profilesQuery.data.length === 0) {
      return;
    }
    const activeProfileName = workflowConfig?.sql.active_profile;
    const byActive = activeProfileName
      ? profilesQuery.data.find(
          (profile) => profile.id === activeProfileName || profile.name === activeProfileName,
        )
      : undefined;
    const fallback = profilesQuery.data[0];
    const next = byActive?.id ?? selectedProfileId ?? fallback?.id ?? null;
    if (next && next !== selectedProfileId) {
      setSelectedProfileId(next);
    }
  }, [profilesQuery.data, workflowConfig?.sql.active_profile, selectedProfileId]);

  const profileDetailQuery = useQuery<OutputProfileDetail>({
    queryKey: ["output-profile", selectedProfileId],
    queryFn: () => fetchOutputProfileDetail(selectedProfileId ?? ""),
    enabled: Boolean(selectedProfileId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!selectedProfileId && workflowConfig?.sql.output_columns?.length) {
      const fallbackRows = workflowConfig.sql.output_columns.map<MappingRow>((column) => ({
        source: column,
        mapped: column,
        type: "string",
        required: false,
      }));
      setMappingRows(fallbackRows);
      setPreviewRows(buildGeneratedPreview(fallbackRows));
    }
  }, [selectedProfileId, workflowConfig?.sql.output_columns]);

  useEffect(() => {
    const detail = profileDetailQuery.data;
    if (!detail) {
      return;
    }
    if (profileDetailQuery.isRefetching && dirty) {
      return;
    }
    const nextRows = detail.mappings?.map(toMappingRow) ?? [];
    setMappingRows(nextRows);
    if (!dirty) {
      const previewFromApi = detail.sample && detail.sample.length > 0 ? detail.sample : null;
      setPreviewRows(previewFromApi ?? buildGeneratedPreview(nextRows));
    }
    if (detail.format) {
      setFormat(detail.format);
    }
    setDirty(false);
  }, [dirty, profileDetailQuery.data, profileDetailQuery.isRefetching]);

  useEffect(() => {
    if (profileDetailQuery.isLoading) {
      return;
    }
    if (!dirty && profileDetailQuery.data?.sample && profileDetailQuery.data.sample.length > 0) {
      setPreviewRows(profileDetailQuery.data.sample);
      return;
    }
    setPreviewRows(buildGeneratedPreview(mappingRows));
  }, [dirty, mappingRows, profileDetailQuery.data?.sample, profileDetailQuery.isLoading]);

  const availableColumns = useMemo(() => {
    const base = workflowConfig?.sql.available_columns ?? [];
    const fromRows = mappingRows.map((row) => row.source).filter((value) => value.trim() !== "");
    const merged = new Set<string>([...base, ...fromRows]);
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [mappingRows, workflowConfig?.sql.available_columns]);

  const formatOptions = useMemo(() => {
    const exportCfg = workflowConfig?.export;
    const options: Array<{ value: string; label: string; enabled: boolean }> = [
      { value: "CSV", label: "CSV (comma)", enabled: exportCfg?.enable_csv ?? true },
      { value: "EXCEL", label: "Excel (XLSX)", enabled: exportCfg?.enable_excel ?? false },
      { value: "TXT", label: "Text (TXT)", enabled: exportCfg?.enable_txt ?? false },
      { value: "JSON", label: "JSON", enabled: exportCfg?.enable_json ?? false },
      { value: "PARQUET", label: "Parquet", enabled: exportCfg?.enable_parquet ?? false },
      { value: "ACCESS", label: "MS Access (ERP)", enabled: exportCfg?.erp_interface_enabled ?? false },
      { value: "XML", label: "XML", enabled: true },
    ];
    const enabled = options.filter((option) => option.enabled);
    return enabled.length > 0 ? enabled : [{ value: "CSV", label: "CSV (comma)", enabled: true }];
  }, [workflowConfig?.export]);

  useEffect(() => {
    if (formatOptions.length === 0) {
      return;
    }
    if (!formatOptions.some((option) => option.value === format)) {
      setFormat(formatOptions[0].value);
    }
  }, [format, formatOptions]);

  const previewColumns = useMemo(() => {
    const firstRow = previewRows[0];
    if (!firstRow) {
      return [];
    }
    return Object.keys(firstRow);
  }, [previewRows]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    const trimmedRows = mappingRows.map((row) => ({
      source: row.source.trim(),
      mapped: row.mapped.trim(),
      type: row.type.trim(),
      required: row.required,
    }));
    const requiredMissing = trimmedRows.filter((row) => row.required && (!row.source || !row.mapped));
    if (requiredMissing.length > 0) {
      issues.push(
        `Required columns missing mapping: ${requiredMissing
          .map((row) => row.source || row.mapped || "(blank)")
          .join(", ")}`,
      );
    }
    const sourceCounts = new Map<string, number>();
    trimmedRows.forEach((row) => {
      if (!row.source) {
        return;
      }
      sourceCounts.set(row.source, (sourceCounts.get(row.source) ?? 0) + 1);
    });
    const duplicates = Array.from(sourceCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([source]) => source);
    if (duplicates.length > 0) {
      issues.push(`Duplicate source columns: ${duplicates.join(", ")}`);
    }
    return issues;
  }, [mappingRows]);

  const handleAddRow = () => {
    setMappingRows((rows) => [...rows, { source: "", mapped: "", type: "string", required: false }]);
    setDirty(true);
  };

  const handleRemoveRow = (index: number) => {
    setMappingRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
    setDirty(true);
  };

  const handleRowChange = (index: number, field: keyof MappingRow, value: string | boolean) => {
    setMappingRows((rows) => {
      const next = [...rows];
      const current = { ...next[index] };
      if (field === "required" && typeof value === "boolean") {
        current.required = value;
      } else if (field === "source" && typeof value === "string") {
        current.source = value;
      } else if (field === "mapped" && typeof value === "string") {
        current.mapped = value;
      } else if (field === "type" && typeof value === "string") {
        current.type = value;
      }
      next[index] = current;
      return next;
    });
    setDirty(true);
  };

  const handleSaveProfile = async () => {
    if (!selectedProfileId) {
      return;
    }
    const trimmedRows = mappingRows
      .map((row) => ({
        source: row.source.trim(),
        mapped: row.mapped.trim(),
        type: row.type.trim() || "string",
        required: row.required,
      }))
      .filter((row) => row.source !== "");

    if (trimmedRows.length === 0) {
      setErrorMessage("Add at least one mapped column before saving.");
      return;
    }

    const missingRequired = trimmedRows.filter((row) => row.required && row.mapped === "");
    if (missingRequired.length > 0) {
      setErrorMessage("Fill in all required column aliases before saving.");
      return;
    }

    const duplicates = new Set<string>();
    const seenSources = new Set<string>();
    trimmedRows.forEach((row) => {
      if (seenSources.has(row.source)) {
        duplicates.add(row.source);
      } else {
        seenSources.add(row.source);
      }
    });
    if (duplicates.size > 0) {
      setErrorMessage(`Duplicate source columns: ${Array.from(duplicates).join(", ")}`);
      return;
    }

    try {
      setSaving(true);
      setStatusMessage("");
      setErrorMessage("");
      const aliasMap: Record<string, string> = {};
      trimmedRows.forEach((row) => {
        if (row.mapped && row.mapped !== row.source) {
          aliasMap[row.mapped] = row.source;
        }
      });
      await saveWorkspaceSettings({
        version: Date.now(),
        output: {
          profile_id: selectedProfileId,
          profile_name: selectedProfile?.name ?? null,
          format,
          mappings: trimmedRows,
        },
      });
      await saveConfig({
        sql: {
          output_columns: trimmedRows.map((row) => row.source),
          column_aliases: aliasMap,
          active_profile: selectedProfile?.id ?? selectedProfile?.name ?? selectedProfileId,
        },
      });
      await postUiAudit({
        action: "ui.output.profile.save",
        username: "codex",
        payload: {
          profile_id: selectedProfileId,
          format,
          column_count: trimmedRows.length,
          required_columns: trimmedRows.filter((row) => row.required).map((row) => row.source),
        },
      });
      setStatusMessage("Output profile saved.");
      setDirty(false);
    } catch (error) {
      setErrorMessage("Failed to save output profile.");
    } finally {
      setSaving(false);
    }
  };

  const isSaving = saving || configSaving;
  const isLoading = configLoading || profilesQuery.isLoading || profileDetailQuery.isLoading;

  return (
    <div className="workspace-grid output-grid" role="region" aria-label="Output profile setup">
      <aside className="output-column output-column--left">
        <header className="workspace-panel__header">
          <h2>Profiles</h2>
          <button type="button" className="workspace-toolbar__btn" title="Create new profile" disabled>
            <Plus size={14} /> New
          </button>
        </header>
        {profilesQuery.isLoading ? (
          <p className="output-status">Loading profiles…</p>
        ) : null}
        {profilesQuery.isError ? (
          <p className="output-status">Failed to load profiles.</p>
        ) : null}
        <ul className="output-profile-list" role="list">
          {profilesQuery.data?.map((profile) => {
            const formattedDate = safeFormatDate(profile.updated_at);
            const isActive = selectedProfileId === profile.id;
            return (
              <li key={profile.id} role="listitem">
                <button
                  type="button"
                  className={`output-profile-list__item${isActive ? " is-active" : ""}`}
                  onClick={() => {
                    setSelectedProfileId(profile.id);
                    setDirty(false);
                    setStatusMessage("");
                    setErrorMessage("");
                  }}
                >
                  <span className="output-profile-list__name">{profile.name}</span>
                  <span className="output-profile-list__desc">
                    {profile.description ?? profile.format ?? ""}
                  </span>
                  <span className="output-profile-list__date">
                    {formattedDate ? `Updated ${formattedDate}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="output-column output-column--center">
        <header className="workspace-panel__header">
          <div>
            <h2>Column Mapping</h2>
            {selectedProfile ? (
              <p className="workspace-panel__subtitle">{selectedProfile.description ?? selectedProfile.name}</p>
            ) : null}
          </div>
          <div className="workspace-toolbar">
            <button type="button" className="workspace-toolbar__btn" onClick={handleAddRow} disabled={isSaving}>
              <Plus size={14} /> Add column
            </button>
            <button type="button" className="workspace-toolbar__btn" disabled>
              <Upload size={14} /> Import
            </button>
            <button type="button" className="workspace-toolbar__btn" onClick={handleSaveProfile} disabled={isSaving}>
              <Save size={14} />
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </header>
        {isLoading ? (
          <p className="output-status">Loading profile mappings…</p>
        ) : (
          <table className="mapping-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Mapped</th>
                <th>Type</th>
                <th>Required</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mappingRows.map((row, index) => (
                <tr key={`${row.source}-${index}`}>
                  <td>
                    <select
                      value={row.source}
                      onChange={(event) => handleRowChange(index, "source", event.target.value)}
                    >
                      <option value="">Select column…</option>
                      {availableColumns.map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.mapped}
                      placeholder="Alias or export name"
                      onChange={(event) => handleRowChange(index, "mapped", event.target.value)}
                    />
                  </td>
                  <td>
                    <select value={row.type} onChange={(event) => handleRowChange(index, "type", event.target.value)}>
                      {COLUMN_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="mapping-table__cell--checkbox">
                    <input
                      type="checkbox"
                      checked={row.required}
                      onChange={(event) => handleRowChange(index, "required", event.target.checked)}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="workspace-toolbar__btn"
                      onClick={() => handleRemoveRow(index)}
                      aria-label="Remove row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {mappingRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <p className="output-status">No columns mapped yet. Add a column to get started.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
        {validationIssues.length > 0 ? (
          <div className="output-status output-status--warning" role="alert">
            <p>
              <AlertCircle size={14} /> Resolve the following before saving:
            </p>
            <ul>
              {validationIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {statusMessage ? <p className="output-status output-status--success">{statusMessage}</p> : null}
        {errorMessage ? <p className="output-status output-status--error">{errorMessage}</p> : null}
      </section>

      <aside className="output-column output-column--right">
        <header className="workspace-panel__header">
          <h2>Preview</h2>
          <select value={format} onChange={(event) => setFormat(event.target.value)}>
            {formatOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </header>
        <div className="output-preview" role="table">
          {previewColumns.length === 0 ? (
            <p className="output-status">No preview data.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  {previewColumns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={`preview-${index}`}>
                    {previewColumns.map((column) => (
                      <td key={`${index}-${column}`}>{(row as Record<string, unknown>)[column] ?? "-"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="output-preview__actions">
          <button type="button" className="btn-secondary" disabled={previewColumns.length === 0}>
            <DownloadCloud size={16} /> Download sample
          </button>
        </div>
      </aside>
    </div>
  );
}
