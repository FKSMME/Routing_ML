import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { RoutingGroupControls } from "@components/RoutingGroupControls";
import { useRoutingStore } from "@store/routingStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const fetchWorkspaceSettingsMock = vi.hoisted(() => vi.fn());
const fetchWorkflowConfigMock = vi.hoisted(() => vi.fn());
const createRoutingGroupMock = vi.hoisted(() => vi.fn());
const fetchRoutingGroupMock = vi.hoisted(() => vi.fn());
const listRoutingGroupsMock = vi.hoisted(() => vi.fn());
const postUiAuditMock = vi.hoisted(() => vi.fn());
const writeSnapshotMock = vi.hoisted(() => vi.fn());
const enqueueAuditEntryMock = vi.hoisted(() => vi.fn());
const readLatestSnapshotMock = vi.hoisted(() => vi.fn());
const saveRoutingSelectorMock = vi.hoisted(() =>
  vi.fn(() => ({
    exportProfile: { formats: ["csv"], destination: "server", withVisualization: false },
    erpInterfaceEnabled: false,
    columnMappings: [],
  })),
);

vi.mock("@lib/apiClient", () => ({
  __esModule: true,
  fetchWorkspaceSettings: fetchWorkspaceSettingsMock,
  fetchWorkflowConfig: fetchWorkflowConfigMock,
  createRoutingGroup: createRoutingGroupMock,
  fetchRoutingGroup: fetchRoutingGroupMock,
  listRoutingGroups: listRoutingGroupsMock,
  postUiAudit: postUiAuditMock,
}));

vi.mock("@lib/indexedDb", () => ({
  __esModule: true,
  writeRoutingWorkspaceSnapshot: writeSnapshotMock,
  enqueueAuditEntry: enqueueAuditEntryMock,
  readLatestRoutingWorkspaceSnapshot: readLatestSnapshotMock,
}));

vi.mock("@store/workspaceStore", () => {
  const store = { saveRouting: saveRoutingSelectorMock };
  const useWorkspaceStore: any = (selector?: unknown) => {
    if (typeof selector === "function") {
      return (selector as (state: typeof store) => unknown)(store);
    }
    return store;
  };

  useWorkspaceStore.getState = () => store;
  useWorkspaceStore.setState = () => undefined;

  return {
    useWorkspaceStore,
  };
});

const deterministicTimestamp = "2025-09-30T02:45:00.000Z";
const evidenceDate = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const evidenceDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..", "deliverables", "onboarding_evidence");

const writeEvidence = (suffix: "ui" | "network", data: Record<string, unknown>) => {
  mkdirSync(evidenceDir, { recursive: true });
  const filePath = resolve(evidenceDir, `erp_interface_off_${evidenceDate}.${suffix}.json`);
  const payload = {
    capturedAt: new Date().toISOString(),
    ...data,
  };
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  return filePath;
};

const renderWithClient = (ui: ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
};

describe("ERP disabled routing save evidence capture", () => {
  const baseStoreState = useRoutingStore.getState();

  const resetStore = () =>
    useRoutingStore.setState(
      () => ({
        ...baseStoreState,
        loading: false,
        saving: false,
        dirty: false,
        erpRequired: false,
        activeItemId: null,
        activeProductId: null,
        activeGroupId: null,
        activeGroupName: null,
        activeGroupVersion: undefined,
        lastSavedAt: undefined,
        productTabs: [],
        recommendations: [],
        timeline: [],
        history: { past: [], future: [] },
        lastSuccessfulTimeline: {},
        validationErrors: [],
        sourceItemCodes: [],
      }),
      true,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    saveRoutingSelectorMock.mockReturnValue({
      exportProfile: { formats: ["csv"], destination: "server", withVisualization: false },
      erpInterfaceEnabled: false,
      columnMappings: [],
    });
    resetStore();

    const timelineStep = {
      id: "step-erp-off-001",
      seq: 1,
      processCode: "MILL",
      description: "Milling operation",
      setupTime: 8,
      runTime: 15,
      waitTime: 2,
      itemCode: "ITEM-OFF",
      candidateId: null,
      positionX: 0,
    } as const;

    useRoutingStore.setState((state) => ({
      ...state,
      activeProductId: "ITEM-OFF",
      activeItemId: "ITEM-OFF",
      timeline: [timelineStep],
      productTabs: [
        {
          id: "ITEM-OFF",
          productCode: "ITEM-OFF",
          productName: "ITEM-OFF",
          candidateId: null,
          timeline: [timelineStep],
        },
      ],
      lastSuccessfulTimeline: {
        "ITEM-OFF": [timelineStep],
      },
      sourceItemCodes: ["ITEM-OFF"],
      dirty: false,
    }));

    fetchWorkspaceSettingsMock.mockResolvedValue({
      options: { erp_interface: false },
      export: { erp_interface_enabled: false },
    });
    fetchWorkflowConfigMock.mockResolvedValue({
      graph: { nodes: [], edges: [], design_refs: [], last_saved: deterministicTimestamp },
      trainer: { similarity_threshold: 0.8, trim_std_enabled: true, trim_lower_percent: 0.05, trim_upper_percent: 0.95 },
      predictor: {
        similarity_high_threshold: 0.85,
        max_routing_variants: 5,
        trim_std_enabled: true,
        trim_lower_percent: 0.05,
        trim_upper_percent: 0.95,
      },
      sql: {
        output_columns: [],
        column_aliases: {},
        available_columns: [],
        profiles: [],
        active_profile: null,
        exclusive_column_groups: [],
        key_columns: [],
        training_output_mapping: {},
      },
      data_source: {
        offline_dataset_path: null,
        default_table: "dbo.BI_ITEM_INFO_VIEW",
        backup_paths: [],
        table_profiles: [],
        column_overrides: {},
        allow_gui_override: true,
        shading_palette: {},
        blueprint_switches: [],
        version_hint: null,
      },
      export: {
        enable_cache_save: false,
        enable_excel: true,
        enable_csv: true,
        enable_txt: false,
        enable_parquet: false,
        enable_json: true,
        enable_database_export: false,
        database_target_table: "dbo.ROUTING_MASTER",
        erp_interface_enabled: false,
        erp_protocol: null,
        erp_endpoint: null,
        default_encoding: "utf-8",
        export_directory: "/tmp",
        compress_on_save: false,
      },
      visualization: {
        tensorboard_projector_dir: "",
        projector_enabled: false,
        projector_metadata_columns: [],
        neo4j_enabled: false,
        neo4j_browser_url: null,
        neo4j_workspace: null,
        publish_service_enabled: false,
        publish_notes: null,
      },
      updated_at: deterministicTimestamp,
    });
    createRoutingGroupMock.mockResolvedValue({
      group_id: "grp-erp-off-001",
      owner: "qa-operator",
      version: 5,
      updated_at: deterministicTimestamp,
    });
    listRoutingGroupsMock.mockResolvedValue({
      items: [],
      pagination: { limit: 20, offset: 0, total: 0 },
    });
    postUiAuditMock.mockResolvedValue(undefined);
    fetchRoutingGroupMock.mockResolvedValue(undefined);
    enqueueAuditEntryMock.mockResolvedValue(undefined);
    writeSnapshotMock.mockResolvedValue({ id: "snapshot-erp-off", createdAt: deterministicTimestamp });
    readLatestSnapshotMock.mockResolvedValue(undefined);
  });

it("captures routing save confirmation details when ERP is disabled", async () => {
  const { queryClient } = renderWithClient(<RoutingGroupControls />);

    const interfaceButton = await screen.findByRole("button", { name: /INTERFACE/i });
    expect(interfaceButton).toBeDisabled();

    const offBadge = await screen.findByText("옵션 OFF");
    expect(offBadge).toBeInTheDocument();

    const saveButton = await screen.findByRole("button", { name: "저장 (CSV × SERVER)" });

    const groupNameInput = screen.getByLabelText("그룹 이름");
    fireEvent.change(groupNameInput, { target: { value: "ERP Disabled Group" } });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(createRoutingGroupMock).toHaveBeenCalledTimes(1);
    });

    const statusMessage = await screen.findByText("Group saved successfully.");
    expect(statusMessage).toHaveClass("form-status--success");

    const payload = createRoutingGroupMock.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;

    writeEvidence("ui", {
      erpRequired: useRoutingStore.getState().erpRequired,
      interfaceButtonDisabled: interfaceButton.hasAttribute("disabled"),
      interfaceButtonLabel: interfaceButton.textContent?.replace(/\s+/g, " ").trim() ?? "",
      timelineStepCount: useRoutingStore.getState().timeline.length,
      statusText: statusMessage.textContent?.replace(/\s+/g, " ").trim() ?? "",
      statusVariant: "success",
    });

  writeEvidence("network", {
    requestPayload: payload ?? null,
    auditTrail: postUiAuditMock.mock.calls.map((call) => call[0]),
  });

  queryClient.clear();
});
});
