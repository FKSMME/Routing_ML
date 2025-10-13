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

const deterministicTimestamp = "2025-09-29T09:30:00.000Z";
const evidenceDate = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const evidenceDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..", "deliverables", "onboarding_evidence");

const writeEvidence = (suffix: "ui" | "network", data: Record<string, unknown>) => {
  mkdirSync(evidenceDir, { recursive: true });
  const filePath = resolve(evidenceDir, `erp_interface_on_${evidenceDate}.${suffix}.json`);
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

describe("ERP interface evidence capture", () => {
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
    resetStore();

    const timelineStep = {
      id: "step-erp-001",
      seq: 1,
      processCode: "CUT",
      description: "CUT operation",
      setupTime: 5,
      runTime: 20,
      waitTime: 0,
      itemCode: "ITEM-ERP",
      candidateId: null,
      positionX: 0,
    } as const;

    useRoutingStore.setState((state) => ({
      ...state,
      activeProductId: "ITEM-ERP",
      activeItemId: "ITEM-ERP",
      timeline: [timelineStep],
      productTabs: [
        {
          id: "ITEM-ERP",
          productCode: "ITEM-ERP",
          productName: "ITEM-ERP",
          candidateId: null,
          timeline: [timelineStep],
        },
      ],
      lastSuccessfulTimeline: {
        "ITEM-ERP": [timelineStep],
      },
      sourceItemCodes: ["ITEM-ERP"],
      dirty: false,
    }));

    fetchWorkspaceSettingsMock.mockResolvedValue({
      options: { erp_interface: true },
      export: { erp_interface_enabled: true },
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
        enable_database_export: true,
        database_target_table: "dbo.ROUTING_MASTER",
        erp_interface_enabled: true,
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
      group_id: "grp-erp-001",
      owner: "qa-operator",
      version: 2,
      updated_at: deterministicTimestamp,
    });
    listRoutingGroupsMock.mockResolvedValue({
      items: [],
      pagination: { limit: 20, offset: 0, total: 0 },
    });
    postUiAuditMock.mockResolvedValue(undefined);
    fetchRoutingGroupMock.mockResolvedValue(undefined);
    enqueueAuditEntryMock.mockResolvedValue(undefined);
    writeSnapshotMock.mockResolvedValue({ id: "snapshot-erp", createdAt: deterministicTimestamp });
    readLatestSnapshotMock.mockResolvedValue(undefined);
  });

  it("captures interface activation state and payload when ERP is enabled", async () => {
    const { queryClient } = renderWithClient(<RoutingGroupControls />);

    const interfaceButton = await screen.findByRole("button", { name: "INTERFACE" });

    await waitFor(() => {
      expect(interfaceButton.hasAttribute("disabled")).toBe(false);
    });

    const badge = screen.queryByText("옵션 OFF");
    expect(badge).toBeNull();

    writeEvidence("ui", {
      erpRequired: true,
      interfaceButtonEnabled: !interfaceButton.hasAttribute("disabled"),
      interfaceButtonLabel: interfaceButton.textContent?.trim() ?? "",
      timelineStepCount: useRoutingStore.getState().timeline.length,
    });

    const groupNameInput = screen.getByLabelText("그룹 이름");
    fireEvent.change(groupNameInput, { target: { value: "ERP Enabled Group" } });

    fireEvent.click(interfaceButton);

    await waitFor(() => {
      expect(createRoutingGroupMock).toHaveBeenCalledTimes(1);
    });

    const payload = createRoutingGroupMock.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
    expect(payload).toBeTruthy();
    expect(payload?.erpRequired).toBe(true);

    writeEvidence("network", {
      requestPayload: payload ?? null,
      auditTrail: postUiAuditMock.mock.calls.map((call) => call[0]),
    });

    queryClient.clear();
  });
});
