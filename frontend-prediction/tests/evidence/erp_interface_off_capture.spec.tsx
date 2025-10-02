import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { RoutingGroupControls } from "@components/RoutingGroupControls";
import { useRoutingStore } from "@store/routingStore";

const fetchWorkspaceSettingsMock = vi.hoisted(() => vi.fn());
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
    render(<RoutingGroupControls />);

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
  });
});
