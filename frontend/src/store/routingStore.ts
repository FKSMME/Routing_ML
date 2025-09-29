import type { OperationStep, PredictionResponse, RoutingGroupDetail } from "@app-types/routing";
import { create } from "zustand";
import { shallow } from "zustand/shallow";

import {
  enqueueAuditEntry,
  readLatestRoutingWorkspaceSnapshot,
  writeRoutingWorkspaceSnapshot,
} from "../lib/indexedDb";

const MAX_HISTORY = 50;
const NODE_GAP = 240;

type MergeStrategy = "replace" | "append";

type SnapshotReason = "insert-operation" | "reorder-step" | "remove-step" | "undo" | "redo";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export interface TimelineStep {
  id: string;
  seq: number;
  processCode: string;
  description?: string | null;
  setupTime?: number | null;
  runTime?: number | null;
  waitTime?: number | null;
  itemCode?: string | null;
  candidateId?: string | null;
  positionX?: number;
}

export interface DraggableOperationPayload {
  itemCode: string;
  candidateId?: string | null;
  operation: OperationStep;
}

export interface RecommendationBucket {
  itemCode: string;
  candidateId: string | null;
  operations: OperationStep[];
}

interface TimelineSnapshot {
  steps: TimelineStep[];
  reason: SnapshotReason;
  timestamp: string;
}

interface HistoryState {
  past: TimelineSnapshot[];
  future: TimelineSnapshot[];
}

export interface RoutingProductTab {
  id: string;
  productCode: string;
  productName?: string | null;
  candidateId?: string | null;
  timeline: TimelineStep[];
}

type LastSuccessMap = Record<string, TimelineStep[]>;

const SNAPSHOT_DEBOUNCE_MS = 30_000;

interface RoutingWorkspacePersistedState {
  activeProductId: string | null;
  activeItemId: string | null;
  productTabs: RoutingProductTab[];
  timeline: TimelineStep[];
  lastSuccessfulTimeline: LastSuccessMap;
  lastSavedAt?: string;
  dirty: boolean;
}

type PersistedSelectionState = RoutingWorkspacePersistedState;

const cloneTimeline = (steps: TimelineStep[]): TimelineStep[] => steps.map((step) => ({ ...step }));

const cloneSuccessMap = (source: LastSuccessMap): LastSuccessMap =>
  Object.fromEntries(Object.entries(source).map(([key, steps]) => [key, cloneTimeline(steps)]));

const normalizeSequence = (steps: TimelineStep[]): TimelineStep[] =>
  steps.map((step, index) => ({ ...step, seq: index + 1, positionX: index * NODE_GAP }));

const timelinesEqual = (a: TimelineStep[], b: TimelineStep[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    const stepA = a[i];
    const stepB = b[i];
    if (
      stepA.processCode !== stepB.processCode ||
      stepA.description !== stepB.description ||
      stepA.setupTime !== stepB.setupTime ||
      stepA.runTime !== stepB.runTime ||
      stepA.waitTime !== stepB.waitTime ||
      stepA.itemCode !== stepB.itemCode ||
      stepA.candidateId !== stepB.candidateId
    ) {
      return false;
    }
  }
  return true;
};

const computeDirty = (
  timeline: TimelineStep[],
  lastSuccess: LastSuccessMap,
  activeProductId: string | null,
): boolean => {
  if (!activeProductId) {
    return timeline.length > 0;
  }
  const baseline = lastSuccess[activeProductId];
  if (!baseline) {
    return timeline.length > 0;
  }
  return !timelinesEqual(timeline, baseline);
};

const pushHistory = (
  history: HistoryState,
  timeline: TimelineStep[],
  reason: SnapshotReason,
): HistoryState => {
  const snapshot: TimelineSnapshot = {
    steps: cloneTimeline(timeline),
    reason,
    timestamp: new Date().toISOString(),
  };
  const past = [...history.past, snapshot];
  if (past.length > MAX_HISTORY) {
    past.shift();
  }
  return { past, future: [] };
};

const toTimelineStep = (
  operation: OperationStep,
  context: { itemCode?: string | null; candidateId?: string | null },
): TimelineStep => ({
  id: createId(),
  seq: operation.PROC_SEQ ?? 0,
  processCode: operation.PROC_CD,
  description: operation.PROC_DESC ?? null,
  setupTime: operation.SETUP_TIME ?? null,
  runTime: operation.RUN_TIME ?? null,
  waitTime: operation.WAIT_TIME ?? null,
  itemCode: context.itemCode ?? null,
  candidateId: context.candidateId ?? null,
});

const updateTabTimeline = (
  tabs: RoutingProductTab[],
  tabId: string,
  updater: (timeline: TimelineStep[]) => TimelineStep[],
): RoutingProductTab[] =>
  tabs.map((tab) => (tab.id === tabId ? { ...tab, timeline: updater(tab.timeline) } : tab));

const updateLastSuccess = (
  lastSuccess: LastSuccessMap,
  tabId: string,
  timeline: TimelineStep[],
): LastSuccessMap => ({ ...lastSuccess, [tabId]: cloneTimeline(timeline) });

const toPersistedState = (selection: PersistedSelectionState): RoutingWorkspacePersistedState => ({
  activeProductId: selection.activeProductId,
  activeItemId: selection.activeItemId,
  productTabs: selection.productTabs.map((tab) => ({ ...tab, timeline: cloneTimeline(tab.timeline) })),
  timeline: cloneTimeline(selection.timeline),
  lastSuccessfulTimeline: cloneSuccessMap(selection.lastSuccessfulTimeline),
  lastSavedAt: selection.lastSavedAt,
  dirty: selection.dirty,
});

const persistedSelector = (state: RoutingStoreState): PersistedSelectionState => ({
  activeProductId: state.activeProductId,
  activeItemId: state.activeItemId,
  productTabs: state.productTabs,
  timeline: state.timeline,
  lastSuccessfulTimeline: state.lastSuccessfulTimeline,
  lastSavedAt: state.lastSavedAt,
  dirty: state.dirty,
});

export interface RoutingStoreState {
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  erpRequired: boolean;
  activeItemId: string | null;
  activeProductId: string | null;
  activeGroupId: string | null;
  activeGroupName: string | null;
  activeGroupVersion?: number;
  lastSavedAt?: string;
  productTabs: RoutingProductTab[];
  recommendations: RecommendationBucket[];
  timeline: TimelineStep[];
  history: HistoryState;
  lastSuccessfulTimeline: LastSuccessMap;
  validationErrors: string[];
  sourceItemCodes: string[];
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setERPRequired: (enabled: boolean) => void;
  loadRecommendations: (response: PredictionResponse) => void;
  setActiveProduct: (tabId: string) => void;
  insertOperation: (payload: DraggableOperationPayload, index?: number) => void;
  moveStep: (stepId: string, toIndex: number) => void;
  removeStep: (stepId: string) => void;
  clearValidation: () => void;
  setValidationErrors: (errors: string[]) => void;
  pushValidationError: (message: string) => void;
  applyGroup: (detail: RoutingGroupDetail, strategy?: MergeStrategy) => void;
  setActiveGroup: (meta: { id: string; name: string; version?: number; updatedAt?: string } | null) => void;
  setDirty: (dirty: boolean) => void;
  setLastSavedAt: (timestamp?: string) => void;
  captureLastSuccess: () => void;
  rollbackToLastSuccess: () => void;
  undo: () => void;
  redo: () => void;
}

export const useRoutingStore = create<RoutingStoreState>((set) => ({
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
  setLoading: (loading) => set({ loading }),
  setSaving: (saving) => set({ saving }),
  setERPRequired: (enabled) => set({ erpRequired: enabled, dirty: true }),
  loadRecommendations: (response) => {
    const buckets: RecommendationBucket[] = response.items.map((item) => ({
      itemCode: item.ITEM_CD,
      candidateId: item.CANDIDATE_ID ?? null,
      operations: item.operations,
    }));

    const tabs: RoutingProductTab[] = response.items.map((item) => {
      const operations = item.operations ?? [];
      const timeline = normalizeSequence(
        operations.map((operation) =>
          toTimelineStep(operation, { itemCode: item.ITEM_CD, candidateId: item.CANDIDATE_ID ?? null }),
        ),
      );
      return {
        id: item.ITEM_CD,
        productCode: item.ITEM_CD,
        productName: item.ITEM_CD,
        candidateId: item.CANDIDATE_ID ?? null,
        timeline,
      };
    });

    const activeTabId = tabs[0]?.id ?? null;
    const activeTimeline = activeTabId ? cloneTimeline(tabs[0].timeline) : [];
    const successMap: LastSuccessMap = {};
    tabs.forEach((tab) => {
      successMap[tab.id] = cloneTimeline(tab.timeline);
    });

    set({
      recommendations: buckets,
      productTabs: tabs,
      activeProductId: activeTabId,
      activeItemId: activeTabId,
      timeline: activeTimeline,
      history: { past: [], future: [] },
      dirty: false,
      validationErrors: [],
      sourceItemCodes: response.items.map((item) => item.ITEM_CD),
      lastSuccessfulTimeline: successMap,
      activeGroupId: null,
      activeGroupName: null,
      activeGroupVersion: undefined,
      lastSavedAt: undefined,
    });
  },
  setActiveProduct: (tabId) =>
    set((state) => {
      const tab = state.productTabs.find((item) => item.id === tabId);
      if (!tab) {
        return state;
      }
      const timeline = cloneTimeline(tab.timeline);
      return {
        activeProductId: tabId,
        activeItemId: tab.productCode,
        timeline,
        history: { past: [], future: [] },
        dirty: computeDirty(timeline, state.lastSuccessfulTimeline, tabId),
      };
    }),
  insertOperation: (payload, index) =>
    set((state) => {
      const { activeProductId } = state;
      if (!activeProductId) {
        return state;
      }
      const history = pushHistory(state.history, state.timeline, "insert-operation");
      const timeline = [...state.timeline];
      const insertIndex = typeof index === "number" && index >= 0 && index <= timeline.length ? index : timeline.length;
      const newStep = toTimelineStep(payload.operation, {
        itemCode: payload.itemCode,
        candidateId: payload.candidateId ?? null,
      });
      timeline.splice(insertIndex, 0, newStep);
      const normalized = normalizeSequence(timeline);
      const updatedTabs = updateTabTimeline(state.productTabs, activeProductId, () => cloneTimeline(normalized));
      return {
        timeline: normalized,
        productTabs: updatedTabs,
        history,
        dirty: computeDirty(normalized, state.lastSuccessfulTimeline, activeProductId),
      };
    }),
  moveStep: (stepId, toIndex) =>
    set((state) => {
      const { activeProductId } = state;
      if (!activeProductId) {
        return state;
      }
      const fromIndex = state.timeline.findIndex((step) => step.id === stepId);
      if (fromIndex === -1 || fromIndex === toIndex) {
        return state;
      }
      const boundedIndex = Math.max(0, Math.min(toIndex, state.timeline.length - 1));
      const history = pushHistory(state.history, state.timeline, "reorder-step");
      const timeline = [...state.timeline];
      const [step] = timeline.splice(fromIndex, 1);
      timeline.splice(boundedIndex, 0, step);
      const normalized = normalizeSequence(timeline);
      const updatedTabs = updateTabTimeline(state.productTabs, activeProductId, () => cloneTimeline(normalized));
      return {
        timeline: normalized,
        productTabs: updatedTabs,
        history,
        dirty: computeDirty(normalized, state.lastSuccessfulTimeline, activeProductId),
      };
    }),
  removeStep: (stepId) =>
    set((state) => {
      const { activeProductId } = state;
      if (!activeProductId) {
        return state;
      }
      const index = state.timeline.findIndex((step) => step.id === stepId);
      if (index === -1) {
        return state;
      }
      const history = pushHistory(state.history, state.timeline, "remove-step");
      const timeline = [...state.timeline];
      timeline.splice(index, 1);
      const normalized = normalizeSequence(timeline);
      const updatedTabs = updateTabTimeline(state.productTabs, activeProductId, () => cloneTimeline(normalized));
      return {
        timeline: normalized,
        productTabs: updatedTabs,
        history,
        dirty: computeDirty(normalized, state.lastSuccessfulTimeline, activeProductId),
      };
    }),
  clearValidation: () => set({ validationErrors: [] }),
  setValidationErrors: (errors) => set({ validationErrors: [...errors] }),
  pushValidationError: (message) => set((state) => ({ validationErrors: [...state.validationErrors, message] })),
  applyGroup: (detail, strategy = "replace") =>
    set((state) => {
      const baseTimeline = strategy === "append" ? [...state.timeline] : [];
      const converted = detail.steps.map((step) =>
        toTimelineStep(
          {
            PROC_SEQ: step.seq,
            PROC_CD: step.process_code,
            PROC_DESC: step.description ?? undefined,
            SETUP_TIME: step.setup_time ?? undefined,
            RUN_TIME: step.duration_min ?? undefined,
            WAIT_TIME: step.wait_time ?? undefined,
          },
          { itemCode: detail.item_codes[0] ?? state.activeItemId, candidateId: detail.group_id },
        ),
      );
      const timeline = normalizeSequence([...baseTimeline, ...converted]);

      const tabId = detail.item_codes[0] ?? detail.group_id;
      const existing = state.productTabs.find((tab) => tab.id === tabId);
      const updatedTabs = existing
        ? updateTabTimeline(state.productTabs, tabId, () => cloneTimeline(timeline))
        : [
            ...state.productTabs,
            {
              id: tabId,
              productCode: detail.item_codes[0] ?? tabId,
              productName: detail.group_name,
              candidateId: detail.group_id,
              timeline: cloneTimeline(timeline),
            },
          ];

      const successMap = updateLastSuccess(state.lastSuccessfulTimeline, tabId, timeline);

      return {
        productTabs: updatedTabs,
        activeProductId: tabId,
        activeItemId: detail.item_codes[0] ?? tabId,
        timeline,
        history: { past: [], future: [] },
        dirty: false,
        lastSuccessfulTimeline: successMap,
        erpRequired: detail.erp_required,
        activeGroupId: detail.group_id,
        activeGroupName: detail.group_name,
        activeGroupVersion: detail.version,
        lastSavedAt: detail.updated_at,
        validationErrors: [],
        sourceItemCodes: detail.item_codes,
      };
    }),
  setActiveGroup: (meta) =>
    set(() => ({
      activeGroupId: meta?.id ?? null,
      activeGroupName: meta?.name ?? null,
      activeGroupVersion: meta?.version,
      lastSavedAt: meta?.updatedAt,
    })),
  setDirty: (dirty) => set({ dirty }),
  setLastSavedAt: (timestamp) => set({ lastSavedAt: timestamp }),
  captureLastSuccess: () =>
    set((state) => {
      const { activeProductId, timeline } = state;
      if (!activeProductId) {
        return state;
      }
      const successMap = updateLastSuccess(state.lastSuccessfulTimeline, activeProductId, timeline);
      return {
        lastSuccessfulTimeline: successMap,
        dirty: false,
      };
    }),
  rollbackToLastSuccess: () =>
    set((state) => {
      const { activeProductId } = state;
      if (!activeProductId) {
        return state;
      }
      const lastSuccess = state.lastSuccessfulTimeline[activeProductId];
      if (!lastSuccess) {
        return state;
      }
      const restored = cloneTimeline(lastSuccess);
      const updatedTabs = updateTabTimeline(state.productTabs, activeProductId, () => cloneTimeline(restored));
      return {
        timeline: normalizeSequence(restored),
        productTabs: updatedTabs,
        history: { past: [], future: [] },
        dirty: false,
      };
    }),
  undo: () =>
    set((state) => {
      const { activeProductId } = state;
      if (!activeProductId || state.history.past.length === 0) {
        return state;
      }
      const past = [...state.history.past];
      const snapshot = past.pop()!;
      const futureSnapshot: TimelineSnapshot = {
        steps: cloneTimeline(state.timeline),
        reason: "undo",
        timestamp: new Date().toISOString(),
      };
      const future = [futureSnapshot, ...state.history.future];
      if (future.length > MAX_HISTORY) {
        future.pop();
      }
      const timeline = normalizeSequence(cloneTimeline(snapshot.steps));
      const updatedTabs = updateTabTimeline(state.productTabs, activeProductId, () => cloneTimeline(timeline));
      return {
        timeline,
        productTabs: updatedTabs,
        history: { past, future },
        dirty: computeDirty(timeline, state.lastSuccessfulTimeline, activeProductId),
      };
    }),
  redo: () =>
    set((state) => {
      const { activeProductId } = state;
      if (!activeProductId || state.history.future.length === 0) {
        return state;
      }
      const future = [...state.history.future];
      const snapshot = future.shift()!;
      const pastSnapshot: TimelineSnapshot = {
        steps: cloneTimeline(state.timeline),
        reason: "redo",
        timestamp: new Date().toISOString(),
      };
      const past = [...state.history.past, pastSnapshot];
      if (past.length > MAX_HISTORY) {
        past.shift();
      }
      const timeline = normalizeSequence(cloneTimeline(snapshot.steps));
      const updatedTabs = updateTabTimeline(state.productTabs, activeProductId, () => cloneTimeline(timeline));
      return {
        timeline,
        productTabs: updatedTabs,
        history: { past, future },
        dirty: computeDirty(timeline, state.lastSuccessfulTimeline, activeProductId),
      };
    }),
}));

let snapshotTimer: ReturnType<typeof setTimeout> | undefined;

const persistRoutingSnapshot = (state: RoutingWorkspacePersistedState) => {
  void (async () => {
    try {
      const snapshot = await writeRoutingWorkspaceSnapshot(state);
      await enqueueAuditEntry({
        action: "routing.snapshot.save",
        message: "Saved routing workspace snapshot to IndexedDB.",
        context: {
          snapshotId: snapshot.id,
          activeProductId: state.activeProductId,
          dirty: state.dirty,
        },
      });
    } catch (error) {
      console.error("Failed to save routing workspace snapshot", error);
      await enqueueAuditEntry({
        action: "routing.snapshot.save.error",
        level: "error",
        message: error instanceof Error ? error.message : String(error),
        context: {
          activeProductId: state.activeProductId,
        },
      });
    }
  })();
};

const scheduleSnapshotSave = (selection: PersistedSelectionState) => {
  const stateForSave = toPersistedState(selection);
  if (snapshotTimer) {
    clearTimeout(snapshotTimer);
  }
  snapshotTimer = setTimeout(() => {
    snapshotTimer = undefined;
    persistRoutingSnapshot(stateForSave);
  }, SNAPSHOT_DEBOUNCE_MS);
};

let lastPersistedSelection: PersistedSelectionState | null = null;

useRoutingStore.subscribe((state) => {
  const nextSelection = persistedSelector(state);
  if (lastPersistedSelection && shallow(lastPersistedSelection, nextSelection)) {
    return;
  }
  lastPersistedSelection = nextSelection;
  scheduleSnapshotSave(nextSelection);
});

const restoreLatestSnapshot = async () => {
  try {
    const snapshot = await readLatestRoutingWorkspaceSnapshot<RoutingWorkspacePersistedState>();
    if (!snapshot || !snapshot.state) {
      return;
    }
    const persisted = snapshot.state;
    const restoredTabs = (persisted.productTabs ?? []).map((tab) => ({
      ...tab,
      timeline: normalizeSequence(cloneTimeline(tab.timeline ?? [])),
    }));
    let activeProductId = persisted.activeProductId;
    if (!activeProductId || !restoredTabs.some((tab) => tab.id === activeProductId)) {
      activeProductId = restoredTabs[0]?.id ?? null;
    }
    const fallbackTimeline = normalizeSequence(cloneTimeline(persisted.timeline ?? []));
    const activeTimelineSource = activeProductId
      ? restoredTabs.find((tab) => tab.id === activeProductId)?.timeline ?? fallbackTimeline
      : fallbackTimeline;
    const normalizedTimeline = normalizeSequence(cloneTimeline(activeTimelineSource));
    const successMap = persisted.lastSuccessfulTimeline
      ? cloneSuccessMap(persisted.lastSuccessfulTimeline)
      : {};

    useRoutingStore.setState(
      (current) => ({
        ...current,
        activeProductId,
        activeItemId: persisted.activeItemId ?? activeProductId,
        productTabs: restoredTabs,
        timeline: normalizedTimeline,
        history: { past: [], future: [] },
        lastSuccessfulTimeline: successMap,
        lastSavedAt: persisted.lastSavedAt,
        dirty: computeDirty(normalizedTimeline, successMap, activeProductId),
      }),
      false,
    );

    await enqueueAuditEntry({
      action: "routing.snapshot.restore",
      message: "Restored routing workspace snapshot from IndexedDB.",
      context: {
        snapshotId: snapshot.id,
        tabCount: restoredTabs.length,
      },
    });
  } catch (error) {
    console.error("Failed to restore routing workspace snapshot", error);
    await enqueueAuditEntry({
      action: "routing.snapshot.restore.error",
      level: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

void restoreLatestSnapshot();















