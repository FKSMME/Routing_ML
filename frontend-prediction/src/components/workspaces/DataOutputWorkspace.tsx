import { useOutputProfile, useOutputProfiles } from "@hooks/useOutputProfiles";
import { useWorkflowConfig } from "@hooks/useWorkflowConfig";
import {
  generateOutputPreview,
  // type OutputProfileColumn,
  postUiAudit,
  saveWorkspaceSettings,
} from "@lib/apiClient";

type OutputProfileColumn = any;
import { AlertCircle, DownloadCloud, Eye, FolderOpen, List, Plus, Save, Settings, Trash2, Upload } from "lucide-react";
import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { TabContainer, type Tab } from "@components/TabContainer";

import {
  OutputMappingRow as MappingRow,
  useWorkspaceStore,
} from "@store/workspaceStore";

const COLUMN_TYPES: Array<{ value: string; label: string }> = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date/Time" },
];

const FORMAT_EXTENSIONS: Record<string, string> = {
  CSV: ".csv",
  TXT: ".txt",
  JSON: ".json",
  XML: ".xml",
  EXCEL: ".xlsx",
  PARQUET: ".parquet",
  ACCESS: ".accdb",
};

const createMappingRowId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `mapping-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

function createMappingRow(partial?: Partial<Omit<MappingRow, "id">>): MappingRow {
  return {
    id: createMappingRowId(),
    source: partial?.source ?? "",
    mapped: partial?.mapped ?? "",
    type: partial?.type ?? "string",
    required: partial?.required ?? false,
    defaultValue: partial?.defaultValue ?? "",
  };
}

function toMappingRow(column: OutputProfileColumn): MappingRow {
  return createMappingRow({
    source: column.source ?? "",
    mapped: column.mapped ?? "",
    type: column.type ?? "string",
    required: Boolean(column.required),
    defaultValue: column.default_value ?? column.defaultValue ?? "",
  });
}

function rowsEqual(a: MappingRow[], b: MappingRow[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((row: any, index: number) => {
    const other = b[index];
    if (!other) {
      return false;
    }
    return (
      row.source === other.source &&
      row.mapped === other.mapped &&
      row.type === other.type &&
      row.required === other.required &&
      (row.defaultValue ?? "") === (other.defaultValue ?? "")
    );
  });
}

function buildColumnNames(rows: MappingRow[]): string[] {
  return rows
    .map((row: any) => row.mapped.trim() || row.source.trim())
    .filter((column, index, all) => column !== "" && all.indexOf(column) === index);
}

function buildGeneratedPreview(rows: MappingRow[]): Array<Record<string, string>> {
  const columns = buildColumnNames(rows);
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

type PreviewRenderable = string | number | boolean;

function renderPreviewValue(value: unknown): PreviewRenderable {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

export function DataOutputWorkspace() {
  const { data: workflowConfig, saveConfig, saving: configSaving, isLoading: configLoading } = useWorkflowConfig();

  const profilesQuery = useOutputProfiles();

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [format, setFormat] = useState<string>("CSV");
  const mappingRows = useWorkspaceStore((state) => state.outputMappings);
  const setOutputMappings = useWorkspaceStore((state) => state.setOutputMappings);
  const updateOutputMappings = useWorkspaceStore((state) => state.updateOutputMappings);
  const reorderOutputMappings = useWorkspaceStore((state) => state.reorderOutputMappings);
  const [previewRows, setPreviewRows] = useState<Array<Record<string, unknown>>>([]);
  const [previewColumnsState, setPreviewColumnsState] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewErrorMessage, setPreviewErrorMessage] = useState<string>("");
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

  const profileDetailQuery = useOutputProfile(selectedProfileId);

  const dragSourceIndex = useRef<number | null>(null);

  useEffect(() => {
    if (!selectedProfileId && workflowConfig?.sql.output_columns?.length) {
      const fallbackRows = workflowConfig.sql.output_columns.map((column) =>
        createMappingRow({
          source: column,
          mapped: column,
          type: "string",
          required: false,
        }),
      );
      if (!rowsEqual(mappingRows, fallbackRows)) {
        setOutputMappings(fallbackRows);
      }
      setPreviewRows(buildGeneratedPreview(fallbackRows));
      setPreviewColumnsState(buildColumnNames(fallbackRows));
      setPreviewErrorMessage("");
      setPreviewLoading(false);
    }
  }, [mappingRows, selectedProfileId, workflowConfig?.sql.output_columns]);

  useEffect(() => {
    const detail = profileDetailQuery.data;
    if (!detail) {
      return;
    }
    if (profileDetailQuery.isRefetching && dirty) {
      return;
    }
    const nextRows = detail.mappings?.map(toMappingRow) ?? [];
    if (!rowsEqual(mappingRows, nextRows)) {
      setOutputMappings(nextRows);
    }
    if (!dirty) {
      const previewFromApi = detail.sample && detail.sample.length > 0 ? detail.sample : null;
      const previewRowsFromData = previewFromApi ?? buildGeneratedPreview(nextRows);
      setPreviewRows(previewRowsFromData);
      if (previewFromApi && previewFromApi[0]) {
        setPreviewColumnsState(Object.keys(previewFromApi[0]));
      } else {
        setPreviewColumnsState(buildColumnNames(nextRows));
      }
      setPreviewErrorMessage("");
      setPreviewLoading(false);
    }
    if (detail.format) {
      setFormat(detail.format);
    }
    setDirty(false);
  }, [dirty, profileDetailQuery.data, profileDetailQuery.isRefetching]);

  useEffect(() => {
    if (profileDetailQuery.isLoading) {
      if (!dirty) {
        setPreviewLoading(true);
      }
      return;
    }

    if (!dirty && profileDetailQuery.data?.sample && profileDetailQuery.data.sample.length > 0) {
      const sampleRows = profileDetailQuery.data.sample;
      setPreviewRows(sampleRows);
      setPreviewColumnsState(Object.keys(sampleRows[0] ?? {}));
      setPreviewErrorMessage("");
      setPreviewLoading(false);
      return;
    }

    const generated = buildGeneratedPreview(mappingRows);
    setPreviewRows(generated);
    const generatedColumns = generated[0] ? Object.keys(generated[0]) : buildColumnNames(mappingRows);
    setPreviewColumnsState(generatedColumns);
    if (dirty) {
      setPreviewErrorMessage("Save to refresh backend preview.");
    } else {
      setPreviewErrorMessage("");
    }
    setPreviewLoading(false);
  }, [dirty, mappingRows, profileDetailQuery.data?.sample, profileDetailQuery.isLoading]);

  const availableColumns = useMemo(() => {
    const base = workflowConfig?.sql.available_columns ?? [];
    const fromRows = mappingRows.map((row: any) => row.source).filter((value) => value.trim() !== "");
    const merged = new Set<string>([...base, ...fromRows]);
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [mappingRows, workflowConfig?.sql.available_columns]);

  useEffect(() => {
    if (dirty) {
      return;
    }

    if (profileDetailQuery.isLoading || profileDetailQuery.isFetching) {
      return;
    }

    const trimmedRows = mappingRows
      .map((row: any) => ({
        source: row.source.trim(),
        mapped: row.mapped.trim(),
        type: row.type.trim() || "string",
        required: row.required,
        defaultValue: row.defaultValue?.trim() ?? "",
      }))
      .filter((row) => row.source !== "" || row.defaultValue !== "");

    if (trimmedRows.length === 0) {
      setPreviewRows([]);
      setPreviewColumnsState([]);
      setPreviewLoading(false);
      setPreviewErrorMessage("");
      return;
    }

    let ignore = false;
    setPreviewLoading(true);
    setPreviewErrorMessage("");

    generateOutputPreview({
      profileId: selectedProfileId,
      mappings: trimmedRows.map((row: any) => ({
        source: row.source,
        mapped: row.mapped,
        type: row.type,
        required: row.required,
        default_value: row.defaultValue || undefined,
      })),
      format,
    })
      .then(({ rows, columns }) => {
        if (ignore) {
          return;
        }
        if (rows.length > 0) {
          setPreviewRows(rows);
          setPreviewColumnsState(columns.length > 0 ? columns : Object.keys(rows[0]));
          setPreviewErrorMessage("");
        } else {
          const generated = buildGeneratedPreview(mappingRows);
          setPreviewRows(generated);
          const generatedColumns = generated[0]
            ? Object.keys(generated[0])
            : buildColumnNames(mappingRows);
          setPreviewColumnsState(generatedColumns);
          setPreviewErrorMessage("No preview rows returned. Showing generated sample.");
        }
      })
      .catch(() => {
        if (ignore) {
          return;
        }
        const generated = buildGeneratedPreview(mappingRows);
        setPreviewRows(generated);
        const generatedColumns = generated[0] ? Object.keys(generated[0]) : buildColumnNames(mappingRows);
        setPreviewColumnsState(generatedColumns);
        setPreviewErrorMessage("Failed to load backend preview. Showing generated sample.");
      })
      .finally(() => {
        if (!ignore) {
          setPreviewLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [
    dirty,
    mappingRows,
    selectedProfileId,
    format,
    profileDetailQuery.isFetching,
    profileDetailQuery.isLoading,
  ]);

  const formatOptions = useMemo(() => {
    const exportCfg = workflowConfig?.export;
    const options: Array<{ value: string; label: string; enabled: boolean }> = [
      { value: "CSV", label: "CSV (comma)", enabled: exportCfg?.enable_csv ?? true },
      { value: "EXCEL", label: "Excel (XLSX)", enabled: exportCfg?.enable_excel ?? false },
      { value: "TXT", label: "Text (TXT)", enabled: exportCfg?.enable_txt ?? false },
      { value: "JSON", label: "JSON", enabled: exportCfg?.enable_json ?? false },
      { value: "PARQUET", label: "Parquet", enabled: exportCfg?.enable_parquet ?? false },
      { value: "ACCESS", label: "MS MSSQL (ERP)", enabled: exportCfg?.erp_interface_enabled ?? false },
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

  const previewFileLabel = useMemo(() => {
    const extension = FORMAT_EXTENSIONS[format] ?? "";
    if (extension) {
      return `Sample export ${extension}`;
    }
    return `${format} preview`;
  }, [format]);

  const handleFormatChange = (nextFormat: string) => {
    setFormat(nextFormat);
    setDirty(true);
    setStatusMessage("");
    setErrorMessage("");
    const generated = buildGeneratedPreview(mappingRows);
    setPreviewRows(generated);
    const generatedColumns = generated[0] ? Object.keys(generated[0]) : buildColumnNames(mappingRows);
    setPreviewColumnsState(generatedColumns);
    setPreviewErrorMessage("Save to refresh backend preview.");
  };

  const previewColumns = useMemo(() => {
    if (previewColumnsState.length > 0) {
      return previewColumnsState;
    }
    const firstRow = previewRows[0];
    if (!firstRow) {
      return [];
    }
    return Object.keys(firstRow);
  }, [previewColumnsState, previewRows]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    const trimmedRows = mappingRows.map((row: any) => ({
      source: row.source.trim(),
      mapped: row.mapped.trim(),
      type: row.type.trim(),
      required: row.required,
      defaultValue: row.defaultValue?.trim() ?? "",
    }));
    const requiredMissing = trimmedRows.filter(
      (row) => row.required && ((!row.source && !row.defaultValue) || !row.mapped),
    );
    if (requiredMissing.length > 0) {
      issues.push(
        `Required columns missing mapping: ${requiredMissing
          .map((row: any) => row.source || row.mapped || "(blank)")
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
    updateOutputMappings((rows) => [...rows, createMappingRow()]);
    setDirty(true);
    setStatusMessage("");
    setErrorMessage("");
    setPreviewErrorMessage("Save to refresh backend preview.");
  };

  const handleRemoveRow = (index: number) => {
    updateOutputMappings((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
    setDirty(true);
    setStatusMessage("");
    setErrorMessage("");
    setPreviewErrorMessage("Save to refresh backend preview.");
  };

  const handleRowChange = (index: number, field: keyof MappingRow, value: string | boolean) => {
    updateOutputMappings((rows) => {
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
      } else if (field === "defaultValue" && typeof value === "string") {
        current.defaultValue = value;
      }
      next[index] = current;
      return next;
    });
    setDirty(true);
    setStatusMessage("");
    setErrorMessage("");
    setPreviewErrorMessage("Save to refresh backend preview.");
  };

  const handleRowDragStart = (index: number) => () => {
    dragSourceIndex.current = index;
  };

  const handleRowDragOver = (event: DragEvent<HTMLTableRowElement>) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  };

  const handleRowDrop = (index: number) => (event: DragEvent<HTMLTableRowElement>) => {
    event.preventDefault();
    const fromIndex = dragSourceIndex.current;
    dragSourceIndex.current = null;
    if (fromIndex === null || fromIndex === index) {
      return;
    }
    reorderOutputMappings(fromIndex, index);
    setDirty(true);
    setStatusMessage("");
    setErrorMessage("");
    setPreviewErrorMessage("Save to refresh backend preview.");
  };

  const handleRowDragEnd = () => {
    dragSourceIndex.current = null;
  };

  const handleSaveProfile = async () => {
    if (!selectedProfileId) {
      return;
    }
    const trimmedRows = mappingRows
      .map((row: any) => ({
        source: row.source.trim(),
        mapped: row.mapped.trim(),
        type: row.type.trim() || "string",
        required: row.required,
        defaultValue: row.defaultValue?.trim() ?? "",
      }))
      .filter((row) => row.source !== "" || row.defaultValue !== "");

    if (trimmedRows.length === 0) {
      setErrorMessage("Add at least one mapped column before saving.");
      return;
    }

    const missingRequired = trimmedRows.filter(
      (row) => row.required && (row.mapped === "" || (row.source === "" && row.defaultValue === "")),
    );
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
      setPreviewErrorMessage("");
      const aliasMap: Record<string, string> = {};
      trimmedRows.forEach((row) => {
        if (row.source && row.mapped && row.mapped !== row.source) {
          aliasMap[row.mapped] = row.source;
        }
      });
      const normalizedRows: MappingRow[] = trimmedRows.map((row: any, index) => ({
        id: mappingRows[index]?.id ?? createMappingRowId(),
        source: row.source,
        mapped: row.mapped || row.source,
        type: row.type,
        required: row.required,
        defaultValue: row.defaultValue,
      }));
      await saveWorkspaceSettings({
        version: Date.now(),
        output: {
          profile_id: selectedProfileId,
          profile_name: selectedProfile?.name ?? null,
          format,
          mappings: trimmedRows.map((row: any) => ({
            source: row.source,
            mapped: row.mapped,
            type: row.type,
            required: row.required,
            default_value: row.defaultValue || undefined,
          })),
        },
      });
      await saveConfig({
        sql: {
          output_columns: trimmedRows.filter((row) => row.source !== "").map((row: any) => row.source),
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
          required_columns: trimmedRows.filter((row) => row.required).map((row: any) => row.source),
        },
      });
      setOutputMappings(normalizedRows);
      setPreviewColumnsState(buildColumnNames(normalizedRows));
      setPreviewRows(buildGeneratedPreview(normalizedRows));
      setPreviewLoading(true);
      setStatusMessage("Output profile saved.");
      setDirty(false);
      void profilesQuery.refresh();
      void profileDetailQuery.refresh();
    } catch (error) {
      setErrorMessage("Failed to save output profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleSaveProfile();
  };

  const isSaving = saving || configSaving;
  const isLoading = configLoading || profilesQuery.isLoading || profileDetailQuery.isLoading;

  // Tab 1: Profile Selection
  const profilesTab = (
    <div className="max-w-4xl mx-auto">
      <div className="glass-morphism p-8 rounded-xl">
        <header className="flex items-center justify-between mb-6">
          <h2 className="heading-2">Output Profiles</h2>
          <button type="button" className="btn-secondary" title="Create new profile" disabled>
            <Plus size={16} /> New Profile
          </button>
        </header>
        {profilesQuery.isLoading && <p className="body-text-secondary text-center py-8">Loading profiles…</p>}
        {profilesQuery.isError && <p className="text-red-400 text-center py-8">Failed to load profiles.</p>}
        <div className="grid gap-3">
          {profilesQuery.data?.map((profile, index) => {
            const formattedDate = safeFormatDate(profile.updated_at);
            const isActive = selectedProfileId === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                className={`
                  stagger-item text-left p-5 rounded-lg border-2 transition-all duration-300
                  hover-lift
                  ${isActive
                    ? 'border-primary-400 bg-primary-500/10 neon-cyan scale-105'
                    : 'border-dark-border bg-dark-surface hover:border-primary-500/50 hover:bg-dark-elevated'
                  }
                `}
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => {
                  setSelectedProfileId(profile.id);
                  setDirty(false);
                  setStatusMessage("");
                  setErrorMessage("");
                  setPreviewRows([]);
                  setPreviewColumnsState([]);
                  setPreviewErrorMessage("");
                  setPreviewLoading(true);
                }}
                onMouseEnter={() => profileDetailQuery.prefetch(profile.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{profile.name}</h3>
                    <p className="body-text-secondary text-sm mb-2">
                      {profile.description || profile.format || 'No description'}
                    </p>
                    {formattedDate && (
                      <p className="text-xs text-dark-text-tertiary">
                        Updated {formattedDate}
                      </p>
                    )}
                  </div>
                  {isActive && (
                    <div className="ml-4">
                      <span className="px-3 py-1 rounded-full bg-primary-500/20 text-primary-400 text-xs font-medium">
                        Active
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Tab 2: Column Mapping
  const mappingTab = (
    <div className="max-w-7xl mx-auto">
      <div className="glass-morphism p-8 rounded-xl">
        <form className="mapping-form" onSubmit={handleSubmitForm}>
          <header className="flex items-center justify-between mb-6">
            <div>
              <h2 className="heading-2">Column Mapping</h2>
              {selectedProfile && (
                <p className="body-text-secondary mt-1">{selectedProfile.description ?? selectedProfile.name}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" className="btn-secondary" onClick={handleAddRow} disabled={isSaving}>
                <Plus size={16} /> Add Column
              </button>
              <button type="button" className="btn-ghost" disabled>
                <Upload size={16} /> Import
              </button>
              <button type="submit" className="btn-primary neon-cyan" disabled={isSaving}>
                <Save size={16} />
                {isSaving ? " Saving…" : " Save"}
              </button>
            </div>
          </header>
          {isLoading ? (
            <p className="output-status">Loading profile mappings…</p>
          ) : (
            <table className="table-standard">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Mapped</th>
                  <th>Default value</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappingRows.map((row: any, index) => (
                  <tr
                    key={row.id}
                    data-testid="mapping-row"
                    draggable
                    onDragStart={handleRowDragStart(index)}
                    onDragOver={handleRowDragOver}
                    onDrop={handleRowDrop(index)}
                    onDragEnd={handleRowDragEnd}
                    className="draggable-row hover-lift transition-all duration-200"
                  >
                    <td>
                      <select
                        className="form-input"
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
                        className="form-input"
                        value={row.mapped}
                        placeholder="Alias or export name"
                        onChange={(event) => handleRowChange(index, "mapped", event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-input"
                        value={row.defaultValue ?? ""}
                        placeholder="Optional constant"
                        onChange={(event) => handleRowChange(index, "defaultValue", event.target.value)}
                      />
                    </td>
                    <td>
                      <select className="form-input" value={row.type} onChange={(event) => handleRowChange(index, "type", event.target.value)}>
                        {COLUMN_TYPES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="mapping-table__cell--checkbox text-center">
                      <input
                        type="checkbox"
                        checked={row.required}
                        onChange={(event) => handleRowChange(index, "required", event.target.checked)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-ghost text-red-500 hover:text-red-400"
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
                    <td colSpan={6}>
                      <p className="output-status">No columns mapped yet. Add a column to get started.</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
          {validationIssues.length > 0 ? (
            <div className="output-status output-status--warning mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30" role="alert">
              <p className="flex items-center gap-2 font-medium">
                <AlertCircle size={14} /> Resolve the following before saving:
              </p>
              <ul className="mt-2 ml-6 list-disc">
                {validationIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {statusMessage ? <p className="output-status output-status--success mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">{statusMessage}</p> : null}
          {errorMessage ? <p className="output-status output-status--error mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">{errorMessage}</p> : null}
        </form>
      </div>
    </div>
  );

  // Tab 3: Preview & Export
  const previewTab = (
    <div className="max-w-7xl mx-auto">
      <div className="glass-morphism p-8 rounded-xl">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h2 className="heading-2">Output Preview</h2>
            <p className="body-text-secondary mt-1">{previewFileLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="body-text-secondary text-sm">Format:</label>
            <select
              className="form-input min-w-[180px]"
              value={format}
              onChange={(event) => handleFormatChange(event.target.value)}
            >
              {formatOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="rounded-lg border-2 border-dark-border overflow-hidden bg-dark-surface/50">
          {previewLoading && (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400 mb-3"></div>
              <p className="body-text-secondary">Loading preview…</p>
            </div>
          )}

          {previewColumns.length === 0 && !previewLoading && (
            <div className="p-12 text-center">
              <AlertCircle size={32} className="mx-auto mb-3 text-dark-text-tertiary" />
              <p className="body-text-secondary">No preview data available.</p>
            </div>
          )}

          {previewColumns.length > 0 && !previewLoading && (
            <div className="overflow-auto max-h-[600px]">
              <table className="table-standard w-full">
                <thead className="sticky top-0 bg-dark-elevated z-10">
                  <tr>
                    {previewColumns.map((column) => (
                      <th key={column} className="px-4 py-3 text-left font-semibold border-b-2 border-primary-500/30">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row: any, index) => (
                    <tr
                      key={`preview-${index}`}
                      className="hover:bg-dark-elevated/50 transition-colors"
                    >
                      {previewColumns.map((column) => {
                        const value = (row as Record<string, unknown>)[column];
                        return (
                          <td key={`${index}-${column}`} className="px-4 py-3 border-b border-dark-border">
                            {renderPreviewValue(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {previewErrorMessage && (
          <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-3">
            <AlertCircle size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-yellow-200 text-sm">{previewErrorMessage}</p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <div className="body-text-secondary text-sm">
            {previewRows.length > 0 && (
              <span>Showing {previewRows.length} sample row{previewRows.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <button
            type="button"
            className="btn-primary neon-cyan flex items-center gap-2"
            disabled={previewColumns.length === 0 || previewLoading}
          >
            <DownloadCloud size={18} />
            <span>Download Sample</span>
          </button>
        </div>
      </div>
    </div>
  );

  const tabs: Tab[] = [
    {
      id: 'profiles',
      label: 'Profiles',
      icon: <FolderOpen size={16} />,
      content: profilesTab,
    },
    {
      id: 'mapping',
      label: 'Column Mapping',
      icon: <List size={16} />,
      content: mappingTab,
    },
    {
      id: 'preview',
      label: 'Preview & Export',
      icon: <Eye size={16} />,
      content: previewTab,
    },
  ];

  return (
    <div className="min-h-screen p-6 animate-fade-in" role="region" aria-label="Output profile setup">
      <TabContainer tabs={tabs} defaultTab="profiles" />
    </div>
  );
}
