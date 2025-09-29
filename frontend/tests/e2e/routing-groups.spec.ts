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

vi.mock("@lib/indexedDb", () => ({
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

describe("Routing group end-to-end flows", () => {
  beforeEach(() => {
    resetStore();
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

  it("includes ERP toggle state in the save payload", async () => {
    seedTimeline();
    act(() => {
      useRoutingStore.getState().setERPRequired(true);
    });

    const { result } = renderHook(() => useRoutingGroups());
    await act(async () => {
      await result.current.saveGroup({ groupName: "ERP Enabled" });
    });

    const payload = createRoutingGroupMock.mock.calls.at(-1)?.[0];
    expect(payload?.erpRequired).toBe(true);
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
