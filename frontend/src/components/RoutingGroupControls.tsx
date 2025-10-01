import type { RoutingGroupSummary, TimelineStepMetadata } from "@app-types/routing";
import { useRoutingGroups } from "@hooks/useRoutingGroups";
import { useWorkflowConfig } from "@hooks/useWorkflowConfig";
import { fetchWorkspaceSettings, postUiAudit, triggerRoutingInterface } from "@lib/apiClient";
import { useRoutingStore } from "@store/routingStore";
import { type OutputMappingRow, useWorkspaceStore } from "@store/workspaceStore";
import { Download, Play, Save, Settings, Upload } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import axios from "axios";

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--surface-overlay)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backdropFilter: "blur(6px)",
  zIndex: 1000,
};

const modalCardStyle: CSSProperties = {
  width: "min(420px, 90vw)",
  borderRadius: "var(--layout-radius)",
  background: "var(--surface-card)",
  boxShadow: "var(--shadow-focus)",
  border: "1px solid var(--border-strong)",
  padding: "1.5rem",
  color: "var(--text-primary)",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const modalHeadingStyle: CSSProperties = {
  fontFamily: "var(--font-family)",
  color: "var(--text-heading)",
  fontSize: "1.1rem",
  fontWeight: 600,
  margin: 0,
};

const modalBodyStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.95rem",
  lineHeight: 1.5,
};

const modalActionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.75rem",
};

function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "취소",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const headingId = useId();
  useEffect(() => {
    if (!open) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div style={modalOverlayStyle} role="presentation" onClick={() => onCancel()}>
      <div
        style={modalCardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-live="assertive"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={headingId} style={modalHeadingStyle}>
          {title}
        </h3>
        <p style={modalBodyStyle}>{description}</p>
        <div style={modalActionsStyle}>
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "처리 중..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const FILE_FORMATS = ["CSV", "XML", "JSON", "Excel", "ACCESS"] as const;
type FileFormat = (typeof FILE_FORMATS)[number];
type Destination = "local" | "clipboard" | "server";

export const ROUTING_SAVE_CONTROL_IDS = {
  primary: "routing-save-primary",
  localShortcut: "routing-save-local",
  clipboardShortcut: "routing-save-clipboard",
  interface: "routing-trigger-interface",
} as const;

interface RoutingGroupControlsProps {
  variant?: "panel" | "embedded";
}

const DESTINATION_OPTIONS: Array<{ value: Destination; label: string }> = [
  { value: "server", label: "Server" },
  { value: "local", label: "Local" },
  { value: "clipboard", label: "Clipboard" },
];

const COLUMN_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date/Time" },
];

const FORMAT_CAPABILITIES: Record<FileFormat, { local: boolean; clipboard: boolean; extension: string; mime: string }> = {
  CSV: { local: true, clipboard: true, extension: "csv", mime: "text/csv;charset=utf-8" },
  XML: { local: true, clipboard: true, extension: "xml", mime: "application/xml;charset=utf-8" },
  JSON: { local: true, clipboard: true, extension: "json", mime: "application/json" },
  Excel: { local: true, clipboard: false, extension: "xls", mime: "application/vnd.ms-excel" },
  ACCESS: { local: false, clipboard: false, extension: "accdb", mime: "application/octet-stream" },
};

const NEWLINE = "\n";
const CSV_BOM = String.fromCharCode(0xfeff);

const sanitizeFileName = (value: string) => {
  const fallback = "routing-group";
  const trimmed = value.trim();
  const cleaned = trimmed.replace(/[^a-zA-Z0-9_.-]+/g, "_");
  return cleaned.length > 0 ? cleaned.slice(0, 80) : fallback;
};

const csvEscape = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const xmlEscape = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const cloneTimelineMetadata = (metadata?: TimelineStepMetadata | null): TimelineStepMetadata | null => {
  if (!metadata) {
    return null;
  }
  const sqlValues = metadata.sqlValues ? { ...metadata.sqlValues } : undefined;
  const extra = metadata.extra ? { ...metadata.extra } : undefined;
  return {
    ...metadata,
    sqlValues,
    extra,
  };
};

const createLocalMappingRow = (initial?: Partial<OutputMappingRow>): OutputMappingRow => ({
  id: initial?.id ?? "",
  source: initial?.source ?? "",
  mapped: initial?.mapped ?? initial?.source ?? "",
  type: initial?.type ?? "string",
  required: initial?.required ?? false,
});

export function RoutingGroupControls({ variant = "panel" }: RoutingGroupControlsProps = {}) {
  const [groupName, setGroupName] = useState("");
  const [groups, setGroups] = useState<RoutingGroupSummary[]>([]);
  const [listing, setListing] = useState(false);
  const [status, setStatus] = useState<{ variant: "success" | "error" | "info"; text: string } | null>(null);
  const [format, setFormat] = useState<FileFormat>("CSV");
  const [destination, setDestination] = useState<Destination>("server");
  const [loadId, setLoadId] = useState("");
  const [exporting, setExporting] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | "server" | "interface">(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const { data: workflowConfig } = useWorkflowConfig();
  const mappingRows = useWorkspaceStore((state) => state.outputMappings);
  const setOutputMappings = useWorkspaceStore((state) => state.setOutputMappings);
  const updateOutputMappings = useWorkspaceStore((state) => state.updateOutputMappings);
  const reorderOutputMappings = useWorkspaceStore((state) => state.reorderOutputMappings);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  const saving = useRoutingStore((state) => state.saving);
  const timeline = useRoutingStore((state) => state.timeline);
  const timelineLength = timeline.length;
  const erpRequired = useRoutingStore((state) => state.erpRequired);
  const setERPRequired = useRoutingStore((state) => state.setERPRequired);
  const sourceItemCodes = useRoutingStore((state) => state.sourceItemCodes);
  const activeGroupName = useRoutingStore((state) => state.activeGroupName);

  const { saveGroup, loadGroup, fetchGroups } = useRoutingGroups();

  const refreshGroups = useCallback(async () => {
    setListing(true);
    try {
      const response = await fetchGroups({ limit: 20, offset: 0 });
      setGroups(response.items);
    } catch (error) {
      console.error("Failed to fetch routing groups", error);
      setStatus({ variant: "error", text: "그룹 목록을 불러오는 데 실패했습니다." });
    } finally {
      setListing(false);
    }
  }, [fetchGroups]);

  useEffect(() => {
    void refreshGroups();
  }, [refreshGroups]);

  useEffect(() => {
    let cancelled = false;
    async function syncErpOption() {
      try {
        const settings = await fetchWorkspaceSettings();
        if (cancelled) return;
        const erpEnabled = Boolean(
          (settings.options?.erp_interface as boolean | undefined) ??
            (settings.export?.erp_interface_enabled as boolean | undefined),
        );
        setERPRequired(erpEnabled);
      } catch (error) {
        console.warn("Failed to load ERP interface option", error);
      }
    }
    void syncErpOption();
    return () => {
      cancelled = true;
    };
  }, [setERPRequired]);

  useEffect(() => {
    if (!workflowConfig?.sql) {
      return;
    }
    const profiles = workflowConfig.sql.profiles ?? [];
    const activeName = workflowConfig.sql.active_profile || profiles[0]?.name || null;
    setSelectedProfile((prev) => prev ?? activeName);
  }, [workflowConfig?.sql]);

  useEffect(() => {
    if (!selectedProfile || !workflowConfig?.sql) {
      return;
    }
    if (mappingRows.length > 0) {
      return;
    }
    const profile = workflowConfig.sql.profiles.find((item) => item.name === selectedProfile);
    if (!profile) {
      return;
    }
    const rows = Object.entries(profile.mapping ?? {}).map(([source, target]) =>
      createLocalMappingRow({ source, mapped: target }),
    );
    if (rows.length > 0) {
      setOutputMappings(rows);
    }
  }, [selectedProfile, workflowConfig?.sql, mappingRows.length, setOutputMappings]);

  const collectItemCodes = useCallback((): string[] => {
    const codes = new Set<string>();
    timeline.forEach((step) => {
      if (step.itemCode) {
        codes.add(step.itemCode);
      }
    });
    sourceItemCodes.forEach((code) => codes.add(code));
    return Array.from(codes);
  }, [timeline, sourceItemCodes]);

  const handleProfileSelect = useCallback(
    (profileName: string) => {
      const normalized = profileName || null;
      setSelectedProfile(normalized);
      if (!workflowConfig?.sql || !normalized) {
        return;
      }
      const profile = workflowConfig.sql.profiles.find((item) => item.name === normalized);
      if (!profile) {
        return;
      }
    const rows = Object.entries(profile.mapping ?? {}).map(([source, target]) =>
      createLocalMappingRow({ source, mapped: target }),
    );
      setOutputMappings(rows);
    },
    [setOutputMappings, workflowConfig?.sql],
  );

  const handleMappingRowChange = useCallback(
    (id: string, patch: Partial<OutputMappingRow>) => {
      updateOutputMappings((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    },
    [updateOutputMappings],
  );

  const handleRemoveMappingRow = useCallback(
    (id: string) => {
      updateOutputMappings((rows) => rows.filter((row) => row.id !== id));
    },
    [updateOutputMappings],
  );

  const handleAddMappingRow = useCallback(() => {
    const defaultSource =
      workflowConfig?.sql?.available_columns?.[0] ?? workflowConfig?.sql?.output_columns?.[0] ?? "";
    updateOutputMappings((rows) => [
      ...rows,
      createLocalMappingRow({ source: defaultSource, mapped: defaultSource }),
    ]);
  }, [updateOutputMappings, workflowConfig?.sql]);

  const handleMoveMappingRow = useCallback(
    (fromIndex: number, delta: number) => {
      const toIndex = fromIndex + delta;
      reorderOutputMappings(fromIndex, toIndex);
    },
    [reorderOutputMappings],
  );

  const availableColumns = useMemo(() => {
    const candidates = workflowConfig?.sql?.available_columns ?? workflowConfig?.sql?.output_columns ?? [];
    return candidates;
  }, [workflowConfig?.sql]);

  const profileOptions = useMemo(() => {
    return (workflowConfig?.sql?.profiles ?? []).map((profile) => ({
      value: profile.name,
      label: profile.description ? `${profile.name} · ${profile.description}` : profile.name,
    }));
  }, [workflowConfig?.sql]);

  const buildExportDataset = useCallback(() => {
    const normalizedName = groupName.trim() || activeGroupName || "routing-group";
    const generatedAt = new Date().toISOString();
    const aliasMap = workflowConfig?.sql?.column_aliases ?? {};
    const defaultColumns = workflowConfig?.sql?.output_columns ?? [];
    const effectiveMappings =
      mappingRows.length > 0
        ? mappingRows
        : defaultColumns.map((column) => createLocalMappingRow({ source: column, mapped: column }));
    const normalizedMappings = effectiveMappings
      .map((mapping) => ({
        source: mapping.source.trim(),
        target: (mapping.mapped ?? mapping.source).trim(),
        type: mapping.type,
        required: mapping.required,
      }))
      .filter((mapping) => mapping.source !== "" && mapping.target !== "");
    const fallbackColumns = [
      "ITEM_CD",
      "CANDIDATE_ID",
      "PROC_SEQ",
      "PROC_CD",
      "JOB_NM",
      "SETUP_TIME",
      "RUN_TIME",
      "WAIT_TIME",
    ];
    const targetColumnCandidates = normalizedMappings.length > 0
      ? normalizedMappings.map((mapping) => mapping.target)
      : defaultColumns;
    const targetColumns = Array.from(
      new Set(
        (targetColumnCandidates.length > 0 ? targetColumnCandidates : fallbackColumns)
          .map((column) => column.trim())
          .filter(Boolean),
      ),
    );
    if (targetColumns.length === 0) {
      targetColumns.push(...fallbackColumns);
    }
    const rows: Array<Record<string, unknown>> = [];
    const steps = timeline.map((step, index) => {
      const metadata = cloneTimelineMetadata(step.metadata);
      const seq = index + 1;
      const summary = {
        seq,
        process_code: step.processCode,
        description: step.description ?? null,
        duration_min: step.runTime ?? metadata?.machineHours ?? null,
        setup_time: step.setupTime ?? metadata?.actualSetupTime ?? null,
        wait_time: step.waitTime ?? metadata?.queueTime ?? null,
        run_time: step.runTime ?? metadata?.actualRunTime ?? metadata?.machineHours ?? null,
        queue_time: metadata?.queueTime ?? null,
        move_time: metadata?.moveTime ?? null,
        item_code: step.itemCode ?? null,
        candidate_id: step.candidateId ?? null,
        metadata,
      };
      const sources: Record<string, unknown> = {};
      const register = (key: string, value: unknown) => {
        if (value === undefined || value === null || value === "") {
          return;
        }
        if (!(key in sources)) {
          sources[key] = value;
        }
      };
      register("SEQ", seq);
      register("PROC_SEQ", seq);
      register("PROC_CD", step.processCode);
      register("PROC_DESC", step.description ?? null);
      register("ITEM_CD", step.itemCode ?? null);
      register("CANDIDATE_ID", step.candidateId ?? null);
      if (step.setupTime != null) register("SETUP_TIME", step.setupTime);
      if (step.runTime != null) register("RUN_TIME", step.runTime);
      if (step.waitTime != null) register("WAIT_TIME", step.waitTime);
      if (metadata) {
        register("ROUTING_SET_CODE", metadata.routingSetCode ?? null);
        register("ROUTING_VARIANT", metadata.variantCode ?? null);
        register("PRIMARY_ROUTING_CODE", metadata.primaryRoutingCode ?? null);
        register("SECONDARY_ROUTING_CODE", metadata.secondaryRoutingCode ?? null);
        register("BRANCH_CODE", metadata.branchCode ?? null);
        register("BRANCH_LABEL", metadata.branchLabel ?? null);
        register("BRANCH_PATH", metadata.branchPath ?? null);
        register("QUEUE_TIME", metadata.queueTime ?? null);
        register("MOVE_TIME", metadata.moveTime ?? null);
        register("MACH_WORKED_HOURS", metadata.machineHours ?? null);
        register("ACT_SETUP_TIME", metadata.actualSetupTime ?? null);
        register("ACT_RUN_TIME", metadata.actualRunTime ?? null);
        register("MFG_LT", metadata.leadTime ?? null);
        register("RUN_TIME_QTY", metadata.runTimeQuantity ?? null);
        register("RUN_TIME_UNIT", metadata.runTimeUnit ?? null);
        register("INSIDE_FLAG", metadata.insideFlag ?? null);
        register("RES_CD", metadata.resourceCode ?? null);
        register("RES_DIS", metadata.resourceName ?? null);
        register("TIME_UNIT", metadata.timeUnit ?? null);
        register("MILESTONE_FLG", metadata.milestoneFlag ?? null);
        register("INSP_FLG", metadata.inspectionFlag ?? null);
        if (metadata.sqlValues) {
          Object.entries(metadata.sqlValues).forEach(([key, value]) => {
            if (!(key in sources)) {
              sources[key] = value;
            }
          });
        }
        if (metadata.extra) {
          Object.entries(metadata.extra).forEach(([key, value]) => {
            if (!(key in sources)) {
              sources[key] = value;
            }
          });
        }
      }
      const resolveValue = (column: string): unknown => {
        const direct =
          sources[column] ?? sources[column.toUpperCase()] ?? sources[column.toLowerCase()];
        if (direct !== undefined) {
          return direct;
        }
        const aliasKey =
          aliasMap[column] ?? aliasMap[column.toUpperCase()] ?? aliasMap[column.toLowerCase()];
        if (aliasKey) {
          return (
            sources[aliasKey] ??
            sources[aliasKey.toUpperCase()] ??
            sources[aliasKey.toLowerCase()] ??
            null
          );
        }
        return null;
      };
      const row: Record<string, unknown> = {};
      targetColumns.forEach((column) => {
        row[column] = resolveValue(column);
      });
      rows.push(row);
      return summary;
    });
    return {
      groupName: normalizedName,
      generatedAt,
      steps,
      itemCodes: collectItemCodes(),
      erpRequired,
      rows,
      columns: targetColumns,
      profile: selectedProfile,
      mappings: normalizedMappings,
    };
  }, [
    groupName,
    activeGroupName,
    workflowConfig?.sql,
    mappingRows,
    timeline,
    collectItemCodes,
    erpRequired,
    selectedProfile,
  ]);

  const buildExportContent = useCallback(
    (targetFormat: FileFormat, dataset: ReturnType<typeof buildExportDataset>) => {
      const columns = dataset.columns ?? [];
      switch (targetFormat) {
        case "CSV": {
          const header = columns.join(",");
          const lines = dataset.rows.map((row) =>
            columns.map((column) => csvEscape(row[column])).join(","),
          );
          const content = CSV_BOM + [header, ...lines].join(NEWLINE);
          return { content, extension: FORMAT_CAPABILITIES.CSV.extension, mime: FORMAT_CAPABILITIES.CSV.mime };
        }
        case "JSON": {
          const content = JSON.stringify(
            {
              group: dataset.groupName,
              generated_at: dataset.generatedAt,
              erp_required: dataset.erpRequired,
              item_codes: dataset.itemCodes,
              columns,
              rows: dataset.rows,
              steps: dataset.steps,
              profile: dataset.profile,
              mappings: dataset.mappings,
            },
            null,
            2,
          );
          return { content, extension: FORMAT_CAPABILITIES.JSON.extension, mime: FORMAT_CAPABILITIES.JSON.mime };
        }
        case "XML": {
          const rows = dataset.rows
            .map((row, index) => {
              const cells = columns
                .map((column) => `    <${column}>${xmlEscape(row[column])}</${column}>`)
                .join(NEWLINE);
              return [`  <row index="${index + 1}">`, cells, "  </row>"].join(NEWLINE);
            })
            .join(NEWLINE);
          const content =
            `<?xml version="1.0" encoding="UTF-8"?>
` +
            `<routingGroup name="${xmlEscape(dataset.groupName)}" generated="${dataset.generatedAt}" erpRequired="${dataset.erpRequired}">
` +
            `${rows}${NEWLINE}</routingGroup>`;
          return { content, extension: FORMAT_CAPABILITIES.XML.extension, mime: FORMAT_CAPABILITIES.XML.mime };
        }
        case "Excel": {
          const header = `<tr>${columns.map((column) => `<th>${xmlEscape(column)}</th>`).join("")}</tr>`;
          const rows = dataset.rows
            .map(
              (row) =>
                `<tr>${columns.map((column) => `<td>${xmlEscape(row[column])}</td>`).join("")}</tr>`,
            )
            .join("");
          const content =
            '<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body>' +
            `<table border="1">${header}${rows}</table>` +
            '</body></html>';
          return { content, extension: FORMAT_CAPABILITIES.Excel.extension, mime: FORMAT_CAPABILITIES.Excel.mime };
        }
        case "ACCESS":
        default:
          throw new Error("Unsupported export format for direct download.");
      }
    },
    [],
  );

  const executeServerSave = useCallback(
    async ({
      groupNameOverride,
      metadata,
      reason,
    }: {
      groupNameOverride?: string;
      metadata?: Record<string, unknown>;
      reason?: string;
    }): Promise<boolean> => {
      const targetName = (groupNameOverride ?? groupName).trim();
      if (!targetName) {
        setStatus({ variant: "error", text: "그룹 이름을 입력해 주세요." });
        return false;
      }
      if (timelineLength === 0) {
        setStatus({ variant: "error", text: "타임라인에 단계를 추가해 주세요." });
        return false;
      }

      const dataset = buildExportDataset();
      const metadataPayload = {
        format,
        destination: "server" as const,
        item_codes: dataset.itemCodes,
        step_count: dataset.steps.length,
        ...metadata,
      };

      setStatus(null);
      const result = await saveGroup({ groupName: targetName, metadata: metadataPayload });
      if (!result.ok) {
        setStatus({ variant: "error", text: result.message });
        return false;
      }

      setGroupName(targetName);
      void refreshGroups();

      if (!erpRequired || !result.response) {
        setStatus({ variant: "success", text: result.message });
        return true;
      }

      try {
        const interfaceResponse = await triggerRoutingInterface({
          groupId: result.response.group_id,
          reason: reason ?? "save",
        });
        const parts: string[] = [];
        if (interfaceResponse.message) {
          parts.push(interfaceResponse.message);
        }
        if (interfaceResponse.erp_path) {
          parts.push(`ERP 파일: ${interfaceResponse.erp_path}`);
        }
        const interfaceStatus = parts.length > 0 ? parts.join(" · ") : "ERP 인터페이스가 완료되었습니다.";
        setStatus({ variant: "success", text: `${result.message} ${interfaceStatus}`.trim() });
        return true;
      } catch (error) {
        let message = "ERP 인터페이스 요청에 실패했습니다.";
        if (axios.isAxiosError(error)) {
          const detail = error.response?.data?.detail;
          if (typeof detail === "string") {
            message = `ERP 인터페이스 요청에 실패했습니다: ${detail}`;
          } else if (detail) {
            message = `ERP 인터페이스 요청에 실패했습니다: ${JSON.stringify(detail)}`;
          } else if (error.message) {
            message = `ERP 인터페이스 요청에 실패했습니다: ${error.message}`;
          }
        } else if (error instanceof Error) {
          message = `ERP 인터페이스 요청에 실패했습니다: ${error.message}`;
        }
        setStatus({ variant: "error", text: message });
        return false;
      }
    },
    [
      buildExportDataset,
      format,
      groupName,
      refreshGroups,
      saveGroup,
      timelineLength,
      erpRequired,
      setGroupName,
      setStatus,
      triggerRoutingInterface,
    ],
  );

  const handleServerSave = useCallback(
    async (overrides?: { groupName?: string; metadata?: Record<string, unknown> }) => {
      const triggerReason =
        overrides?.metadata && typeof overrides.metadata.trigger === "string"
          ? String(overrides.metadata.trigger)
          : "save";
      return executeServerSave({
        groupNameOverride: overrides?.groupName,
        metadata: overrides?.metadata ?? undefined,
        reason: triggerReason,
      });
    },
    [executeServerSave],
  );

  const performInterface = useCallback(async () => {
    if (!erpRequired) {
      setStatus({ variant: "info", text: "옵션 메뉴에서 ERP 인터페이스를 활성화해 주세요." });
      return false;
    }
    const ok = await executeServerSave({ metadata: { trigger: "interface" }, reason: "interface" });
    if (ok) {
      postUiAudit({
        action: "ui.routing.interface",
        username: "codex",
        payload: {
          format,
          step_count: timelineLength,
        },
      }).catch(() => undefined);
    }
    return ok;
  }, [erpRequired, executeServerSave, format, timelineLength]);

  const capability = FORMAT_CAPABILITIES[format];
  const localSupported = capability.local;
  const clipboardSupported = capability.clipboard;
  const disabledSave = saving || exporting || timelineLength === 0;

  const formatLabel = useMemo(() => `${format} × ${destination.toUpperCase()}`, [format, destination]);

  const confirmationContent = useMemo(() => {
    if (pendingAction === "server") {
      return {
        title: "ERP 저장을 진행할까요?",
        description: `선택한 설정(${formatLabel})으로 서버에 저장하면 ERP 인터페이스용 데이터가 갱신됩니다. 계속 진행하시겠습니까?`,
        confirmLabel: "ERP로 저장",
      } as const;
    }
    if (pendingAction === "interface") {
      return {
        title: "ERP 인터페이스 전송",
        description: "ERP 인터페이스로 즉시 전송합니다. 최근 저장 내용을 기준으로 라우팅이 배포됩니다.",
        confirmLabel: "인터페이스 실행",
      } as const;
    }
    return null;
  }, [formatLabel, pendingAction]);

  const dismissConfirmation = useCallback(() => {
    if (confirmBusy) {
      return;
    }
    setPendingAction(null);
  }, [confirmBusy]);

  const confirmPendingAction = useCallback(async () => {
    if (!pendingAction) {
      return;
    }
    setConfirmBusy(true);
    try {
      if (pendingAction === "server") {
        await handleServerSave();
      } else {
        await performInterface();
      }
    } finally {
      setConfirmBusy(false);
      setPendingAction(null);
    }
  }, [handleServerSave, pendingAction, performInterface]);

  const handleLoad = async (groupId: string) => {
    const result = await loadGroup(groupId);
    setStatus({ variant: result.ok ? "success" : "error", text: result.message });
    if (result.ok) {
      setGroupName(result.detail?.group_name ?? groupName);
    }
  };

  const handleManualLoad = async () => {
    const trimmed = loadId.trim();
    if (!trimmed) {
      setStatus({ variant: "error", text: "불러올 그룹 ID를 입력해 주세요." });
      return;
    }
    await handleLoad(trimmed);
  };

  const handleFormatSelect = (next: FileFormat) => {
    setFormat(next);
    if (next === "ACCESS") {
      setDestination("server");
      return;
    }
    if (!FORMAT_CAPABILITIES[next].local && destination === "local") {
      setDestination("server");
    }
    if (!FORMAT_CAPABILITIES[next].clipboard && destination === "clipboard") {
      setDestination("server");
    }
  };

  const isDestinationDisabled = (value: Destination) => {
    if (format === "ACCESS" && value !== "server") {
      return true;
    }
    if (value === "local" && !localSupported) {
      return true;
    }
    if (value === "clipboard" && !clipboardSupported) {
      return true;
    }
    return false;
  };

  const handleLocalExport = async (): Promise<boolean> => {
    if (!localSupported) {
      setStatus({ variant: "info", text: `${format} 형식은 로컬 저장을 지원하지 않습니다.` });
      return false;
    }
    if (timelineLength === 0) {
      setStatus({ variant: "error", text: "타임라인에 단계를 추가해 주세요." });
      return false;
    }
    try {
      setExporting(true);
      setStatus(null);
      const dataset = buildExportDataset();
      const { content, extension, mime } = buildExportContent(format === "ACCESS" ? "CSV" : format, dataset);
      const fileBase = sanitizeFileName(dataset.groupName);
      const stamp = dataset.generatedAt.replace(/[:.]/g, "-");
      const fileName = `${fileBase}-${stamp}.${extension}`;
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatus({ variant: "success", text: `${fileName} 로 저장했습니다.` });
      postUiAudit({
        action: "ui.routing.export.local",
        username: "codex",
        payload: {
          format,
          destination: "local",
          file_name: fileName,
          step_count: dataset.steps.length,
        },
      }).catch(() => undefined);
      return true;
    } catch (error) {
      console.error("Local export failed", error);
      setStatus({ variant: "error", text: "로컬 저장에 실패했습니다." });
      return false;
    } finally {
      setExporting(false);
    }
  };

  const handleClipboardExport = async (): Promise<boolean> => {
    if (!clipboardSupported) {
      setStatus({ variant: "info", text: `${format} 형식은 클립보드 복사를 지원하지 않습니다.` });
      return false;
    }
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setStatus({ variant: "error", text: "이 브라우저에서는 클립보드 복사를 지원하지 않습니다." });
      return false;
    }
    if (timelineLength === 0) {
      setStatus({ variant: "error", text: "타임라인에 단계를 추가해 주세요." });
      return false;
    }
    try {
      setExporting(true);
      setStatus(null);
      const dataset = buildExportDataset();
      const targetFormat = format === "Excel" ? "CSV" : format;
      const { content } = buildExportContent(targetFormat, dataset);
      await navigator.clipboard.writeText(content);
      setStatus({ variant: "success", text: `${format} 데이터를 클립보드에 복사했습니다.` });
      postUiAudit({
        action: "ui.routing.export.clipboard",
        username: "codex",
        payload: {
          format,
          step_count: dataset.steps.length,
        },
      }).catch(() => undefined);
      return true;
    } catch (error) {
      console.error("Clipboard export failed", error);
      setStatus({ variant: "error", text: "클립보드 복사에 실패했습니다." });
      return false;
    } finally {
      setExporting(false);
    }
  };

  const handleSave = async () => {
    if (destination === "local") {
      await handleLocalExport();
      return;
    }
    if (destination === "clipboard") {
      await handleClipboardExport();
      return;
    }
    if (format === "ACCESS" && !erpRequired) {
      setStatus({ variant: "info", text: "ACCESS 저장은 ERP 인터페이스 옵션을 ON 해야 합니다." });
      return;
    }
    if (destination === "server" && (erpRequired || format === "ACCESS")) {
      setPendingAction("server");
      return;
    }
    await handleServerSave();
  };

  const handleInterface = () => {
    if (!erpRequired) {
      setStatus({ variant: "info", text: "옵션 메뉴에서 ERP 인터페이스를 활성화해 주세요." });
      return;
    }
    setPendingAction("interface");
  };

  const content = (
    <div className="routing-save-panel__content">
      <div className="form-field">
        <label htmlFor="routing-group-name">그룹 이름</label>
        <input
          id="routing-group-name"
          type="text"
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
          placeholder="예: PRECISION-LINE-A"
        />
      </div>

      <button type="button" className="primary-button" onClick={handleSave} disabled={disabledSave}>
        <Save size={16} />
        {saving || exporting ? "처리 중..." : "저장"}
      </button>

      <p
        style={{
          marginTop: "0.25rem",
          fontSize: "0.85rem",
          color: "var(--text-muted)",
        }}
      >
        선택한 형식·위치: {formatLabel}
      </p>

      <div className="form-field">
        <label>저장 형식</label>
        <div className="save-options">
          {FILE_FORMATS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleFormatSelect(value)}
              className={`save-options__chip${format === value ? " is-active" : ""}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="form-field">
        <label>저장 위치</label>
        <div className="destination-toggle">
          {DESTINATION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                if (isDestinationDisabled(option.value)) {
                  setStatus({ variant: "info", text: `${format} 형식은 ${option.label} 저장을 지원하지 않습니다.` });
                  return;
                }
                setDestination(option.value);
              }}
              className={`destination-toggle__chip${destination === option.value ? " is-active" : ""}`}
              disabled={isDestinationDisabled(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="routing-sql-profile">SQL 출력 프로파일</label>
        <div className="profile-select">
          <select
            id="routing-sql-profile"
            value={selectedProfile ?? ""}
            onChange={(event) => handleProfileSelect(event.target.value)}
            disabled={profileOptions.length === 0}
          >
            <option value="">프로파일 선택</option>
            {profileOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="button" className="secondary-button" onClick={() => handleAddMappingRow()}>
            매핑 추가
          </button>
        </div>
        {profileOptions.length === 0 ? (
          <p className="empty-hint" style={{ marginTop: "0.35rem" }}>
            저장된 프로파일이 없습니다. 매핑 추가 버튼으로 직접 구성하세요.
          </p>
        ) : null}
      </div>

      <div className="form-field">
        <label>컬럼 매핑</label>
        {mappingRows.length === 0 ? (
          <p className="empty-hint">
            출력할 컬럼을 설정해 주세요. 프로파일을 선택하거나 “매핑 추가” 버튼으로 직접 구성할 수 있습니다.
          </p>
        ) : (
          <div className="mapping-table">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "32%" }}>소스 컬럼</th>
                  <th style={{ width: "32%" }}>대상 컬럼</th>
                  <th style={{ width: "16%" }}>타입</th>
                  <th style={{ width: "8%" }}>필수</th>
                  <th style={{ width: "12%" }} aria-label="행 작업">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {mappingRows.map((row, index) => {
                  const sourceValue = row.source ?? "";
                  const sourceOptions = availableColumns.includes(sourceValue)
                    ? availableColumns
                    : [sourceValue, ...availableColumns];
                  return (
                    <tr key={row.id}>
                      <td>
                        <select
                          value={sourceValue}
                          onChange={(event) => handleMappingRowChange(row.id, { source: event.target.value })}
                        >
                          {sourceOptions.map((column) => (
                            <option key={column} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.mapped ?? ""}
                          onChange={(event) => handleMappingRowChange(row.id, { mapped: event.target.value })}
                          placeholder={sourceValue}
                        />
                      </td>
                      <td>
                        <select
                          value={row.type || "string"}
                          onChange={(event) => handleMappingRowChange(row.id, { type: event.target.value })}
                        >
                          {COLUMN_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(row.required)}
                          onChange={(event) => handleMappingRowChange(row.id, { required: event.target.checked })}
                        />
                      </td>
                      <td className="mapping-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => handleMoveMappingRow(index, -1)}
                          disabled={index === 0}
                          aria-label="위로 이동"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => handleMoveMappingRow(index, 1)}
                          disabled={index === mappingRows.length - 1}
                          aria-label="아래로 이동"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="icon-button icon-button--danger"
                          onClick={() => handleRemoveMappingRow(row.id)}
                          aria-label="행 삭제"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button
        id={ROUTING_SAVE_CONTROL_IDS.primary}
        type="button"
        className="primary-button"
        onClick={handleSave}
        disabled={disabledSave}
      >
        <Save size={16} />
        {saving || exporting ? "처리 중..." : `저장 (${formatLabel})`}
      </button>

      <div className="save-shortcuts">
        <span
          style={{
            display: "block",
            marginBottom: "0.4rem",
            fontSize: "0.85rem",
            color: "var(--text-muted)",
          }}
        >
          빠른 다운로드 / 업로드
        </span>
        <button
          id={ROUTING_SAVE_CONTROL_IDS.localShortcut}
          type="button"
          className="save-shortcuts__btn"
          onClick={() => void handleLocalExport()}
          disabled={disabledSave || destination !== "local" || !localSupported}
        >
          <Download size={14} /> 로컬 저장
        </button>
        <button
          id={ROUTING_SAVE_CONTROL_IDS.clipboardShortcut}
          type="button"
          className="save-shortcuts__btn"
          onClick={() => void handleClipboardExport()}
          disabled={disabledSave || destination !== "clipboard" || !clipboardSupported}
        >
          <Upload size={14} /> 클립보드
        </button>
      </div>

      <button
        id={ROUTING_SAVE_CONTROL_IDS.interface}
        type="button"
        className="interface-button"
        onClick={() => void handleInterface()}
        disabled={!erpRequired || disabledSave}
      >
        <Settings size={16} /> INTERFACE
        {!erpRequired ? <span className="interface-button__badge">옵션 OFF</span> : null}
      </button>

      <div className="form-divider" aria-hidden />

      <div className="form-field">
        <label htmlFor="routing-load-id">그룹 ID 불러오기</label>
        <div className="input-with-button">
          <input
            id="routing-load-id"
            type="text"
            value={loadId}
            onChange={(event) => setLoadId(event.target.value)}
            placeholder="UUID 또는 별칭"
          />
          <button type="button" onClick={() => void handleManualLoad()} disabled={saving}>
            불러오기
          </button>
        </div>
      </div>

      {status ? <div className={`form-status form-status--${status.variant}`}>{status.text}</div> : null}

      <div className="group-list">
        <div className="group-list__header">
          <h3>최근 저장 그룹</h3>
          <button type="button" onClick={() => void refreshGroups()} disabled={listing}>
            {listing ? "불러오는 중..." : "새로고침"}
          </button>
        </div>
        {groups.length === 0 ? (
          <p className="group-list__empty">저장된 그룹이 없습니다.</p>
        ) : (
          <ul>
            {groups.map((group) => (
              <li key={group.group_id} className="group-list__item">
                <div className="group-list__meta">
                  <strong>{group.group_name}</strong>
                  <span className="group-list__id">ID: {group.group_id}</span>
                  <span>단계 {group.step_count} · 버전 {group.version}</span>
                  <span className="group-list__time">{new Date(group.updated_at).toLocaleString()}</span>
                </div>
                <button type="button" onClick={() => void handleLoad(group.group_id)} disabled={saving}>
                  불러오기
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="routing-save-panel__footnote">
        <Play size={14} /> ERP 인터페이스는 옵션 메뉴에서 활성화한 후 사용할 수 있습니다.
      </footer>
    </div>
  );

  const confirmationModal = (
    <ConfirmationModal
      open={Boolean(confirmationContent)}
      title={confirmationContent?.title ?? ""}
      description={confirmationContent?.description ?? ""}
      confirmLabel={confirmationContent?.confirmLabel ?? "확인"}
      busy={confirmBusy}
      onCancel={dismissConfirmation}
      onConfirm={() => void confirmPendingAction()}
    />
  );

  if (variant === "panel") {
    return (
      <section className="panel-card interactive-card routing-save-panel">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">그룹 저장 및 인터페이스</h2>
            <p className="panel-subtitle">Recommended routing을 그룹으로 저장하고 ERP 인터페이스 옵션을 관리합니다.</p>
          </div>
        </header>
        {content}
        {confirmationModal}
      </section>
    );
  }

  return (
    <div className="routing-save-panel routing-save-panel--embedded">
      {content}
      {confirmationModal}
    </div>
  );
}
