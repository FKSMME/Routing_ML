import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  OperationStep,
  RoutingGroupCreateResponse,
  RoutingGroupDetail,
  RoutingGroupListResponse,
} from "@app-types/routing";
import { useRoutingGroups } from "@hooks/useRoutingGroups";
import { useRoutingStore } from "@store/routingStore";
import { useWorkspaceStore } from "@store/workspaceStore";

const deterministicTimestamp = "2025-10-01T09:00:00.000Z";
const baseItemCode = "ITEM-001";

const createRoutingGroupMock = vi.hoisted(() => vi.fn());
const fetchRoutingGroupMock = vi.hoisted(() => vi.fn());
const listRoutingGroupsMock = vi.hoisted(() => vi.fn());
const postUiAuditMock = vi.hoisted(() => vi.fn());

vi.mock("@lib/apiClient", () => ({
  __esModule: true,
  createRoutingGroup: createRoutingGroupMock,
  fetchRoutingGroup: fetchRoutingGroupMock,
  listRoutingGroups: listRoutingGroupsMock,
  postUiAudit: postUiAuditMock,
}));

const writeSnapshotMock = vi.hoisted(() =>
  vi.fn(async <TState>(state: TState) => ({
    id: "snapshot-0001",
    createdAt: deterministicTimestamp,
    state,
  })),
);
const enqueueAuditEntryMock = vi.hoisted(() =>
  vi.fn(async (entry: Record<string, unknown>) => ({
    id: "audit-0001",
    action: entry.action as string,
    level: (entry.level as string | undefined) ?? "info",
    message: entry.message as string | undefined,
    context: entry.context as Record<string, unknown> | undefined,
    createdAt: deterministicTimestamp,
  })),
);
const readLatestSnapshotMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@lib/persistence", () => ({
  __esModule: true,
  writeRoutingWorkspaceSnapshot: writeSnapshotMock,
  enqueueAuditEntry: enqueueAuditEntryMock,
  readLatestRoutingWorkspaceSnapshot: readLatestSnapshotMock,
}));

const storeBlueprint = (() => {
  const state = useRoutingStore.getState();
  return {
    ...state,
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
    productTabs: [] as typeof state.productTabs,
    recommendations: [] as typeof state.recommendations,
    timeline: [] as typeof state.timeline,
    history: { past: [], future: [] } as typeof state.history,
    lastSuccessfulTimeline: {} as typeof state.lastSuccessfulTimeline,
    validationErrors: [] as typeof state.validationErrors,
    sourceItemCodes: [] as typeof state.sourceItemCodes,
  };
})();

const createInitialState = () => ({
  ...storeBlueprint,
  productTabs: [],
  recommendations: [],
  timeline: [],
  history: { past: [], future: [] },
  lastSuccessfulTimeline: {},
  validationErrors: [],
  sourceItemCodes: [],
  activeItemId: null,
  activeProductId: null,
  activeGroupId: null,
  activeGroupName: null,
  activeGroupVersion: undefined,
  lastSavedAt: undefined,
  dirty: false,
  erpRequired: false,
  saving: false,
  loading: false,
});

const workspaceBlueprint = (() => {
  const state = useWorkspaceStore.getState();
  return {
    ...state,
    itemSearch: { ...state.itemSearch, itemCodes: [...state.itemSearch.itemCodes] },
    featureWeights: {
      profile: state.featureWeights.profile,
      manualWeights: { ...state.featureWeights.manualWeights },
      availableProfiles: state.featureWeights.availableProfiles.map((profile) => ({ ...profile })),
    },
    exportProfile: { ...state.exportProfile, formats: [...state.exportProfile.formats] },
    workspaceOptions: {
      ...state.workspaceOptions,
      data: {
        ...state.workspaceOptions.data,
        standard: [...state.workspaceOptions.data.standard],
        similarity: [...state.workspaceOptions.data.similarity],
        columnMappings: state.workspaceOptions.data.columnMappings.map((row) => ({ ...row })),
      },
    },
    referenceMatrixColumns: [...state.referenceMatrixColumns],
    outputMappings: state.outputMappings.map((row) => ({ ...row })),
  };
})();

const createWorkspaceInitialState = () => ({
  ...workspaceBlueprint,
  itemSearch: { ...workspaceBlueprint.itemSearch, itemCodes: [...workspaceBlueprint.itemSearch.itemCodes] },
  featureWeights: {
    profile: workspaceBlueprint.featureWeights.profile,
    manualWeights: { ...workspaceBlueprint.featureWeights.manualWeights },
    availableProfiles: workspaceBlueprint.featureWeights.availableProfiles.map((profile) => ({ ...profile })),
  },
  exportProfile: { ...workspaceBlueprint.exportProfile, formats: [...workspaceBlueprint.exportProfile.formats] },
  workspaceOptions: {
    ...workspaceBlueprint.workspaceOptions,
    data: {
      ...workspaceBlueprint.workspaceOptions.data,
      standard: [...workspaceBlueprint.workspaceOptions.data.standard],
      similarity: [...workspaceBlueprint.workspaceOptions.data.similarity],
      columnMappings: workspaceBlueprint.workspaceOptions.data.columnMappings.map((row) => ({ ...row })),
    },
  },
  referenceMatrixColumns: [...workspaceBlueprint.referenceMatrixColumns],
  outputMappings: workspaceBlueprint.outputMappings.map((row) => ({ ...row })),
});

const createTimelineStep = (seq: number, processCode: string) => ({
  id: `step-${seq}`,
  seq,
  processCode,
  description: `${processCode} operation`,
  setupTime: seq,
  runTime: seq * 2,
  waitTime: 0,
  itemCode: baseItemCode,
  candidateId: null,
  positionX: (seq - 1) * 240,
});

const seedTimeline = () => {
  const stepA = createTimelineStep(1, "CUT");
  const stepB = createTimelineStep(2, "WELD");
  useRoutingStore.setState((state) => ({
    ...state,
    activeProductId: baseItemCode,
    activeItemId: baseItemCode,
    timeline: [
      { ...stepA },
      { ...stepB },
    ],
    productTabs: [
      {
        id: baseItemCode,
        productCode: baseItemCode,
        productName: baseItemCode,
        candidateId: "cand-1",
        timeline: [
          { ...stepA },
          { ...stepB },
        ],
      },
    ],
    lastSuccessfulTimeline: {
      [baseItemCode]: [
        { ...stepA },
        { ...stepB },
      ],
    },
    sourceItemCodes: [baseItemCode],
    dirty: false,
  }));
  return { stepA, stepB };
};

const seedCreateResponse: RoutingGroupCreateResponse = {
  group_id: "grp-0001",
  version: 1,
  owner: "planner01",
  updated_at: deterministicTimestamp,
};

const seedGroupDetail: RoutingGroupDetail = {
  group_id: "grp-0001",
  group_name: "Alpha Group",
  item_codes: [baseItemCode],
  step_count: 2,
  version: 2,
  updated_at: deterministicTimestamp,
  owner: "planner01",
  erp_required: true,
  metadata: { source: "deterministic" },
  steps: [
    {
      seq: 1,
      process_code: "CUT",
      description: "CUT operation",
      duration_min: 12,
      setup_time: 4,
      wait_time: 1,
    },
    {
      seq: 2,
      process_code: "WELD",
      description: "WELD operation",
      duration_min: 25,
      setup_time: 6,
      wait_time: 2,
    },
  ],
};

const seedListResponse: RoutingGroupListResponse = {
  items: [
    {
      group_id: "grp-0001",
      group_name: "Alpha Group",
      item_codes: [baseItemCode],
      step_count: 2,
      version: 2,
      updated_at: deterministicTimestamp,
    },
  ],
  pagination: { limit: 20, offset: 0, total: 1 },
};

const seedOperation = (seq: number, code: string): OperationStep => ({
  PROC_SEQ: seq,
  PROC_CD: code,
  PROC_DESC: `${code} operation`,
  SETUP_TIME: seq,
  RUN_TIME: seq * 2,
  WAIT_TIME: seq / 2,
});

const resetStore = () => {
  useRoutingStore.setState(createInitialState(), true);
};

const resetWorkspaceStore = () => {
  useWorkspaceStore.setState(createWorkspaceInitialState(), true);
};

describe("Routing group end-to-end flows", () => {
  beforeEach(() => {
    resetStore();
    resetWorkspaceStore();
    vi.clearAllMocks();
    createRoutingGroupMock.mockResolvedValue(seedCreateResponse);
    fetchRoutingGroupMock.mockResolvedValue(seedGroupDetail);
    listRoutingGroupsMock.mockResolvedValue(seedListResponse);
    postUiAuditMock.mockResolvedValue(undefined);
  });

  it("supports drag/drop operations with undo/redo history", () => {
    seedTimeline();
    const { insertOperation, moveStep, removeStep, undo, redo } = useRoutingStore.getState();

    act(() => {
      insertOperation(
        {
          itemCode: baseItemCode,
          candidateId: null,
          operation: seedOperation(3, "PAINT"),
        },
        1,
      );
    });

    let state = useRoutingStore.getState();
    expect(state.timeline.map((step) => step.processCode)).toEqual(["CUT", "PAINT", "WELD"]);
    expect(state.timeline.every((step, index) => step.seq === index + 1)).toBe(true);
    expect(state.dirty).toBe(true);

    act(() => {
      moveStep(state.timeline[0].id, 2);
    });
    state = useRoutingStore.getState();
    expect(state.timeline.map((step) => step.processCode)).toEqual(["PAINT", "WELD", "CUT"]);
    expect(state.history.past.length).toBeGreaterThanOrEqual(2);

    act(() => {
      removeStep(state.timeline[1].id);
    });
    state = useRoutingStore.getState();
    expect(state.timeline.map((step) => step.processCode)).toEqual(["PAINT", "CUT"]);
    expect(state.history.past.length).toBeGreaterThanOrEqual(3);

    act(() => {
      undo();
    });
    state = useRoutingStore.getState();
    expect(state.timeline.map((step) => step.processCode)).toEqual(["PAINT", "WELD", "CUT"]);

    act(() => {
      redo();
    });
    state = useRoutingStore.getState();
    expect(state.timeline.map((step) => step.processCode)).toEqual(["PAINT", "CUT"]);
  });

  it("caps undo/redo stacks and clears redo history on branching edits", () => {
    seedTimeline();
    const { insertOperation, undo, redo } = useRoutingStore.getState();

    act(() => {
      for (let index = 0; index < 55; index += 1) {
        const code = `GEN-${index.toString().padStart(2, "0")}`;
        const timelineLength = useRoutingStore.getState().timeline.length;
        insertOperation(
          {
            itemCode: baseItemCode,
            candidateId: null,
            operation: seedOperation(index + 3, code),
          },
          timelineLength,
        );
      }
    });

    let state = useRoutingStore.getState();
    expect(state.timeline.length).toBeGreaterThan(2);
    expect(state.history.past.length).toBeLessThanOrEqual(50);
    expect(state.history.future).toHaveLength(0);
    expect(state.history.past[state.history.past.length - 1]?.reason).toBe("insert-operation");

    act(() => {
      undo();
      undo();
    });

    state = useRoutingStore.getState();
    expect(state.history.future.length).toBeGreaterThanOrEqual(2);
    expect(state.history.future[0]?.reason).toBe("undo");
    expect(state.history.future[0]?.steps.length).toBeGreaterThan(0);

    act(() => {
      redo();
    });

    state = useRoutingStore.getState();
    expect(state.history.past.length).toBeLessThanOrEqual(50);

    act(() => {
      insertOperation(
        {
          itemCode: baseItemCode,
          candidateId: null,
          operation: seedOperation(200, "FINAL"),
        },
        useRoutingStore.getState().timeline.length,
      );
    });

    state = useRoutingStore.getState();
    expect(state.timeline[state.timeline.length - 1]?.processCode).toBe("FINAL");
    expect(state.history.future).toHaveLength(0);
    expect(state.history.past[state.history.past.length - 1]?.reason).toBe("insert-operation");
  });

  it("saves routing groups through the API and resets dirty state", async () => {
    seedTimeline();
    const { result } = renderHook(() => useRoutingGroups());
    const metadata = { note: "deterministic" };

    let response;
    await act(async () => {
      response = await result.current.saveGroup({ groupName: "Alpha Group", metadata });
    });

    expect(response).toEqual({ ok: true, message: "Group saved successfully.", response: seedCreateResponse });
    expect(createRoutingGroupMock).toHaveBeenCalledTimes(1);
    expect(postUiAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ui.routing.save",
        payload: expect.objectContaining({ group_id: seedCreateResponse.group_id, step_count: 2, erp_required: false }),
      }),
    );

    const payload = createRoutingGroupMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      groupName: "Alpha Group",
      itemCodes: [baseItemCode],
      erpRequired: false,
      metadata,
    });
    expect(payload.steps.map((step: { process_code: string }) => step.process_code)).toEqual(["CUT", "WELD"]);

    const state = useRoutingStore.getState();
    expect(state.activeGroupId).toBe(seedCreateResponse.group_id);
    expect(state.dirty).toBe(false);
    expect(state.lastSavedAt).toBe(deterministicTimestamp);
  });

  const metadataPermutations = [
    {
      label: "default metadata without workspace mappings",
      metadataArg: undefined as Record<string, unknown> | null | undefined,
      mappings: [],
      assert: (metadata: Record<string, unknown>) => {
        expect(metadata).toMatchObject({ source: "codex-ui" });
        expect(metadata).not.toHaveProperty("output_mappings");
      },
    },
    {
      label: "explicit metadata merged with workspace mappings",
      metadataArg: { note: "permutation-a" } as Record<string, unknown> | null | undefined,
      mappings: [
        { id: "map-1", source: "SEQ", mapped: "seq_out", type: "number", required: true },
        { id: "map-2", source: "DESC", mapped: "desc_out", type: "string", required: false },
      ],
      assert: (metadata: Record<string, unknown>) => {
        const payload = metadata as Record<string, unknown> & {
          output_mappings?: Array<Record<string, unknown>>;
          output_mapping_count?: number;
        };
        expect(payload).toMatchObject({ note: "permutation-a", output_mapping_count: 2 });
        expect(payload.output_mappings).toEqual([
          { source: "SEQ", mapped: "seq_out", type: "number", required: true },
          { source: "DESC", mapped: "desc_out", type: "string", required: false },
        ]);
      },
    },
    {
      label: "null metadata falls back to default while including mappings",
      metadataArg: null as Record<string, unknown> | null | undefined,
      mappings: [
        { id: "map-9", source: "WAIT", mapped: "wait_time", type: "number", required: false },
      ],
      assert: (metadata: Record<string, unknown>) => {
        const payload = metadata as Record<string, unknown> & {
          output_mappings?: Array<Record<string, unknown>>;
          output_mapping_count?: number;
        };
        expect(payload).toMatchObject({ source: "codex-ui", output_mapping_count: 1 });
        expect(payload.output_mappings).toEqual([
          { source: "WAIT", mapped: "wait_time", type: "number", required: false },
        ]);
      },
    },
  ];

  it.each(metadataPermutations)(
    "prepares save payload metadata permutations (%s)",
    async ({ label, metadataArg, mappings, assert }) => {
      seedTimeline();

      act(() => {
        useWorkspaceStore.getState().setOutputMappings(mappings);
      });

      const { result } = renderHook(() => useRoutingGroups());
      const args: { groupName: string; metadata?: Record<string, unknown> | null } = {
        groupName: `Permutation - ${label}`,
      };
      if (metadataArg !== undefined) {
        args.metadata = metadataArg;
      }

      await act(async () => {
        await result.current.saveGroup(args);
      });

      const payload = createRoutingGroupMock.mock.calls[0]?.[0] as {
        metadata: Record<string, unknown>;
      };

      expect(payload).toBeDefined();
      assert(payload.metadata);
    },
  );

  it.each([
    { label: "disabled", toggle: false },
    { label: "enabled", toggle: true },
  ])("aligns ERP toggle state in API and audit payload (%s)", async ({ label, toggle }) => {
    seedTimeline();

    act(() => {
      useWorkspaceStore.getState().setErpInterfaceEnabled(toggle);
    });

    const { result } = renderHook(() => useRoutingGroups());
    await act(async () => {
      await result.current.saveGroup({ groupName: `ERP ${label}` });
    });

    const payload = createRoutingGroupMock.mock.calls[0]?.[0] as {
      erpRequired: boolean;
    };
    const auditPayload = postUiAuditMock.mock.calls[0]?.[0]?.payload as { erp_required?: boolean } | undefined;

    expect(payload.erpRequired).toBe(toggle);
    expect(auditPayload?.erp_required).toBe(toggle);
    expect(useRoutingStore.getState().erpRequired).toBe(toggle);
    expect(useWorkspaceStore.getState().erpInterfaceEnabled).toBe(toggle);
  });

  it("maintains history integrity across undo/redo, ERP toggle, and save", async () => {
    seedTimeline();
    const { insertOperation, moveStep, undo, redo, setERPRequired } = useRoutingStore.getState();

    act(() => {
      setERPRequired(true);
    });

    act(() => {
      insertOperation(
        {
          itemCode: baseItemCode,
          candidateId: null,
          operation: seedOperation(3, "PAINT"),
        },
        1,
      );
    });

    let state = useRoutingStore.getState();
    expect(state.erpRequired).toBe(true);
    expect(state.dirty).toBe(true);
    expect(state.history.past).toHaveLength(1);
    expect(state.history.past[0]?.reason).toBe("insert-operation");
    expect(state.timeline.map((step) => step.processCode)).toEqual(["CUT", "PAINT", "WELD"]);

    const insertedStepId = state.timeline[1]?.id;
    expect(insertedStepId).toBeDefined();

    act(() => {
      moveStep(insertedStepId!, 2);
    });

    state = useRoutingStore.getState();
    expect(state.timeline.map((step) => step.processCode)).toEqual(["CUT", "WELD", "PAINT"]);
    expect(state.history.past).toHaveLength(2);
    expect(state.history.past[1]?.reason).toBe("reorder-step");

    act(() => {
      undo();
    });

    state = useRoutingStore.getState();
    expect(state.timeline.map((step) => step.processCode)).toEqual(["CUT", "PAINT", "WELD"]);
    expect(state.history.future[0]?.reason).toBe("undo");
    expect(state.erpRequired).toBe(true);

    act(() => {
      redo();
    });

    state = useRoutingStore.getState();
    expect(state.timeline.map((step) => step.processCode)).toEqual(["CUT", "WELD", "PAINT"]);
    expect(state.history.future).toHaveLength(0);

    const { result } = renderHook(() => useRoutingGroups());
    await act(async () => {
      await result.current.saveGroup({ groupName: "Workspace History" });
    });

    expect(createRoutingGroupMock).toHaveBeenCalledTimes(1);
    const payload = createRoutingGroupMock.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      groupName: "Workspace History",
      erpRequired: true,
    });
    expect(payload.steps.map((step: { process_code: string }) => step.process_code)).toEqual([
      "CUT",
      "WELD",
      "PAINT",
    ]);

    const auditPayload = postUiAuditMock.mock.calls[0]?.[0]?.payload as { erp_required?: boolean; step_count?: number } | undefined;
    expect(auditPayload?.erp_required).toBe(true);
    expect(auditPayload?.step_count).toBe(3);

    state = useRoutingStore.getState();
    expect(state.dirty).toBe(false);
    expect(state.lastSavedAt).toBe(deterministicTimestamp);
    expect(state.lastSuccessfulTimeline[baseItemCode]?.map((step) => step.processCode)).toEqual([
      "CUT",
      "WELD",
      "PAINT",
    ]);
  });

  it("loads routing groups and clears dirty state", async () => {
    seedTimeline();
    const { result } = renderHook(() => useRoutingGroups());

    let loadResult;
    await act(async () => {
      loadResult = await result.current.loadGroup(seedGroupDetail.group_id);
    });

    expect(loadResult).toEqual({ ok: true, message: "Loaded group 'Alpha Group'.", detail: seedGroupDetail });
    expect(fetchRoutingGroupMock).toHaveBeenCalledWith(seedGroupDetail.group_id);
    expect(postUiAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ui.routing.load",
        payload: expect.objectContaining({ group_id: seedGroupDetail.group_id, item_count: 1 }),
      }),
    );

    const state = useRoutingStore.getState();
    expect(state.timeline.map((step) => step.processCode)).toEqual(["CUT", "WELD"]);
    expect(state.erpRequired).toBe(true);
    expect(state.dirty).toBe(false);
    expect(state.activeGroupId).toBe(seedGroupDetail.group_id);
  });

  it("fetches routing group summaries with deterministic pagination", async () => {
    const { result } = renderHook(() => useRoutingGroups());
    let list;
    await act(async () => {
      list = await result.current.fetchGroups({ limit: 10, offset: 0 });
    });

    expect(list).toEqual(seedListResponse);
    expect(listRoutingGroupsMock).toHaveBeenCalledWith({ limit: 10, offset: 0 });
  });

  it("rolls back to last success snapshot when save fails", async () => {
    seedTimeline();

    act(() => {
      const store = useRoutingStore.getState();
      store.captureLastSuccess();
      const firstStepId = store.timeline[0].id;
      store.moveStep(firstStepId, 1);
    });

    const baseline = useRoutingStore.getState().lastSuccessfulTimeline[baseItemCode].map((step) => step.processCode);

    const conflictError = Object.assign(new Error("conflict"), {
      isAxiosError: true,
      response: { data: { detail: "conflict" } },
    });
    createRoutingGroupMock.mockRejectedValueOnce(conflictError);

    const { result } = renderHook(() => useRoutingGroups());
    let saveResult;
    await act(async () => {
      saveResult = await result.current.saveGroup({ groupName: "Conflict" });
    });

    expect(saveResult).toEqual({ ok: false, message: "conflict" });
    const state = useRoutingStore.getState();
    expect(state.timeline.map((step) => step.processCode)).toEqual(baseline);
    expect(state.dirty).toBe(false);
    expect(state.validationErrors).toContain("conflict");
  });
});
