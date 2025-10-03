import { createStore, del, get, keys, set } from "idb-keyval";

// import { postRoutingSnapshotsBatch } from "../apiClient";

const WORKSPACE_DB_NAME = "routing_workspace";
const SNAPSHOT_STORE_NAME = "snapshots";
const WORKSPACE_FACETS_STORE_NAME = "workspace_facets";
const AUDIT_STORE_NAME = "audit_queue";

const MAX_SNAPSHOTS = 5;
const MAX_WORKSPACE_FACET_SNAPSHOTS = 5;
const MAX_AUDIT_ENTRIES = 50;
const SNAPSHOT_VERSION = 1;
const WORKSPACE_FACETS_VERSION = 1;

type StoreHandle = ReturnType<typeof createStore>;

type MaybeStoreHandle = StoreHandle | null;

type IndexedDbAwareGlobal = typeof globalThis & { indexedDB?: IDBFactory };

const isIndexedDbAvailable = (): boolean =>
  typeof globalThis !== "undefined" && Boolean((globalThis as IndexedDbAwareGlobal).indexedDB);

let snapshotStoreHandle: MaybeStoreHandle = null;
let auditStoreHandle: MaybeStoreHandle = null;
let workspaceFacetsStoreHandle: MaybeStoreHandle = null;

const ensureSnapshotStore = (): MaybeStoreHandle => {
  if (!isIndexedDbAvailable()) {
    return null;
  }
  if (!snapshotStoreHandle) {
    snapshotStoreHandle = createStore(WORKSPACE_DB_NAME, SNAPSHOT_STORE_NAME);
  }
  return snapshotStoreHandle;
};

const ensureAuditStore = (): MaybeStoreHandle => {
  if (!isIndexedDbAvailable()) {
    return null;
  }
  if (!auditStoreHandle) {
    auditStoreHandle = createStore(WORKSPACE_DB_NAME, AUDIT_STORE_NAME);
  }
  return auditStoreHandle;
};

const ensureWorkspaceFacetsStore = (): MaybeStoreHandle => {
  if (!isIndexedDbAvailable()) {
    return null;
  }
  if (!workspaceFacetsStoreHandle) {
    workspaceFacetsStoreHandle = createStore(WORKSPACE_DB_NAME, WORKSPACE_FACETS_STORE_NAME);
  }
  return workspaceFacetsStoreHandle;
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const pruneStore = async (store: MaybeStoreHandle, maxEntries: number) => {
  if (!store) {
    return;
  }
  const storeKeys = await keys(store);
  if (storeKeys.length <= maxEntries) {
    return;
  }
  const sortedKeys = storeKeys
    .map((key) => String(key))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const keysToRemove = sortedKeys.slice(0, Math.max(0, sortedKeys.length - maxEntries));
  await Promise.all(keysToRemove.map((key) => del(key, store)));
};

export interface RoutingWorkspaceSnapshot<TState = unknown> {
  id: string;
  createdAt: string;
  state: TState;
  reason?: string;
  version?: number;
  persisted?: boolean;
  syncedAt?: string | null;
}

export interface AuditQueueEntry {
  id: string;
  action: string;
  level: "info" | "error";
  message?: string;
  context?: Record<string, unknown>;
  createdAt: string;
  persisted?: boolean;
  syncedAt?: string | null;
}

export interface AuditQueueInput {
  action: string;
  level?: "info" | "error";
  message?: string;
  context?: Record<string, unknown>;
}

export type WorkspaceLayoutMode = "desktop" | "tablet" | "mobile";

export type WorkspaceNavigationKey =
  | "master-data"
  | "routing"
  | "algorithm"
  | "data-output"
  | "training-status"
  | "options";

export interface WorkspaceFacetState {
  layout: WorkspaceLayoutMode;
  activeMenu: WorkspaceNavigationKey;
  itemSearch: {
    itemCodes: string[];
    topK: number;
    threshold: number;
    lastRequestedAt?: string;
  };
  featureWeights: {
    profile: string | null;
    manualWeights: Record<string, number>;
    availableProfiles: { name: string; description?: string }[];
  };
  exportProfile: {
    formats: string[];
    destination: "local" | "clipboard" | "server";
    withVisualization: boolean;
    lastSyncAt?: string;
  };
  erpInterfaceEnabled: boolean;
  auditTrail: AuditQueueEntry[];
}

export interface WorkspaceFacetsSnapshot {
  id: string;
  createdAt: string;
  state: WorkspaceFacetState;
  version?: number;
  persisted?: boolean;
}

export interface SnapshotWriteOptions {
  reason?: string;
}

export async function writeRoutingWorkspaceSnapshot<TState>(
  state: TState,
  options?: SnapshotWriteOptions,
): Promise<RoutingWorkspaceSnapshot<TState>> {
  const snapshot: RoutingWorkspaceSnapshot<TState> = {
    id: createId(),
    createdAt: new Date().toISOString(),
    state,
    reason: options?.reason,
    version: SNAPSHOT_VERSION,
    syncedAt: null,
  };
  const store = ensureSnapshotStore();
  if (!store) {
    return { ...snapshot, persisted: false };
  }
  await set(snapshot.id, snapshot, store);
  await pruneStore(store, MAX_SNAPSHOTS);
  requestFlush("snapshot");
  return { ...snapshot, persisted: true };
}

export async function readLatestRoutingWorkspaceSnapshot<TState>(): Promise<
  RoutingWorkspaceSnapshot<TState> | undefined
> {
  const store = ensureSnapshotStore();
  if (!store) {
    return undefined;
  }
  const storeKeys = await keys(store);
  if (storeKeys.length === 0) {
    return undefined;
  }
  const sortedKeys = storeKeys
    .map((key) => String(key))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const latestKey = sortedKeys[sortedKeys.length - 1];
  const snapshot = (await get(latestKey, store)) as RoutingWorkspaceSnapshot<TState> | undefined;
  if (!snapshot) {
    return undefined;
  }
  return { ...snapshot, persisted: true };
}

export async function writeWorkspaceFacetsSnapshot(
  state: WorkspaceFacetState,
): Promise<WorkspaceFacetsSnapshot> {
  const snapshot: WorkspaceFacetsSnapshot = {
    id: createId(),
    createdAt: new Date().toISOString(),
    state,
    version: WORKSPACE_FACETS_VERSION,
  };
  const store = ensureWorkspaceFacetsStore();
  if (!store) {
    return { ...snapshot, persisted: false };
  }
  await set(snapshot.id, snapshot, store);
  await pruneStore(store, MAX_WORKSPACE_FACET_SNAPSHOTS);
  return { ...snapshot, persisted: true };
}

export async function readLatestWorkspaceFacetsSnapshot(): Promise<
  WorkspaceFacetsSnapshot | undefined
> {
  const store = ensureWorkspaceFacetsStore();
  if (!store) {
    return undefined;
  }
  const storeKeys = await keys(store);
  if (storeKeys.length === 0) {
    return undefined;
  }
  const sortedKeys = storeKeys
    .map((key) => String(key))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const latestKey = sortedKeys[sortedKeys.length - 1];
  const snapshot = (await get(latestKey, store)) as WorkspaceFacetsSnapshot | undefined;
  if (!snapshot) {
    return undefined;
  }
  return { ...snapshot, persisted: true };
}

export async function enqueueAuditEntry(input: AuditQueueInput): Promise<AuditQueueEntry> {
  const entry: AuditQueueEntry = {
    id: createId(),
    action: input.action,
    level: input.level ?? "info",
    message: input.message,
    context: input.context,
    createdAt: new Date().toISOString(),
    syncedAt: null,
  };
  const store = ensureAuditStore();
  if (!store) {
    return { ...entry, persisted: false };
  }
  await set(entry.id, entry, store);
  await pruneStore(store, MAX_AUDIT_ENTRIES);
  requestFlush("audit");
  return { ...entry, persisted: true };
}

export async function readAuditEntries(): Promise<AuditQueueEntry[]> {
  const store = ensureAuditStore();
  if (!store) {
    return [];
  }
  const storeKeys = await keys(store);
  if (storeKeys.length === 0) {
    return [];
  }
  const sortedKeys = storeKeys
    .map((key) => String(key))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const entries = await Promise.all(sortedKeys.map((key) => get(key, store)));
  return entries.filter(Boolean).map((entry) => ({ ...(entry as AuditQueueEntry), persisted: true }));
}

export async function clearRoutingWorkspaceSnapshots(): Promise<void> {
  const store = ensureSnapshotStore();
  if (!store) {
    return;
  }
  const storeKeys = await keys(store);
  await Promise.all(storeKeys.map((key) => del(key, store)));
}

export async function clearWorkspaceFacetsSnapshots(): Promise<void> {
  const store = ensureWorkspaceFacetsStore();
  if (!store) {
    return;
  }
  const storeKeys = await keys(store);
  await Promise.all(storeKeys.map((key) => del(key, store)));
}

const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;
const MIN_FLUSH_DELAY_MS = 1_000;

type FlushTrigger =
  | "manual"
  | "snapshot"
  | "audit"
  | "scheduled"
  | "online"
  | "init";

interface RoutingSnapshotPayload {
  id: string;
  created_at: string;
  reason?: string;
  version?: number;
  state: unknown;
}

interface RoutingAuditPayload {
  id: string;
  action: string;
  level: "info" | "error";
  message?: string;
  context?: Record<string, unknown>;
  created_at: string;
}

export interface RoutingGroupSyncUpdate {
  groupId: string;
  version: number;
  dirty: boolean;
  updatedAt?: string;
  snapshotId?: string | null;
}

export interface RoutingPersistenceFlushResult {
  acceptedSnapshotIds: string[];
  acceptedAuditIds: string[];
  updatedGroups: RoutingGroupSyncUpdate[];
}

type FlushListener = (result: RoutingPersistenceFlushResult) => void;

let flushListeners: Set<FlushListener> | null = null;
let autoFlushEnabled = false;
let scheduledFlush: ReturnType<typeof setTimeout> | undefined;
let scheduledReason: FlushTrigger | null = null;
let lastScheduledDelayMs: number | null = null;
let backoffAttempt = 0;
let flushInFlight = false;
let connectivityListenerRegistered = false;

const getNavigator = (): Navigator | undefined =>
  typeof navigator !== "undefined" ? navigator : undefined;

const isOnline = (): boolean => {
  const nav = getNavigator();
  if (!nav || typeof nav.onLine === "undefined") {
    return true;
  }
  return Boolean(nav.onLine);
};

const ensureListenerSet = () => {
  if (connectivityListenerRegistered) {
    return;
  }
  const globalTarget = globalThis as typeof globalThis & {
    addEventListener?: (type: string, listener: EventListener) => void;
  };
  const handler: EventListener = () => {
    backoffAttempt = 0;
    requestFlush("online");
  };
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("online", handler);
    connectivityListenerRegistered = true;
    return;
  }
  if (typeof globalTarget.addEventListener === "function") {
    try {
      globalTarget.addEventListener("online", handler);
      connectivityListenerRegistered = true;
    } catch {
      // ignore - non browser environment
    }
  }
};

const notifyFlushListeners = (result: RoutingPersistenceFlushResult) => {
  if (!flushListeners || flushListeners.size === 0) {
    return;
  }
  flushListeners.forEach((listener) => {
    try {
      listener(result);
    } catch (error) {
      console.error("routing.persistence.flush-listener.error", error);
    }
  });
};

const collectSnapshotsForFlush = async (): Promise<RoutingSnapshotPayload[]> => {
  const store = ensureSnapshotStore();
  if (!store) {
    return [];
  }
  const snapshotKeys = await keys(store);
  if (snapshotKeys.length === 0) {
    return [];
  }
  const records = await Promise.all(snapshotKeys.map((key) => get(String(key), store)));
  return records
    .filter(Boolean)
    .map((entry) => entry as RoutingWorkspaceSnapshot)
    .filter((entry) => !entry.syncedAt)
    .map((entry) => ({
      id: entry.id,
      created_at: entry.createdAt,
      reason: entry.reason,
      version: entry.version,
      state: entry.state,
    }));
};

const collectAuditsForFlush = async (): Promise<RoutingAuditPayload[]> => {
  const store = ensureAuditStore();
  if (!store) {
    return [];
  }
  const auditKeys = await keys(store);
  if (auditKeys.length === 0) {
    return [];
  }
  const records = await Promise.all(auditKeys.map((key) => get(String(key), store)));
  return records
    .filter(Boolean)
    .map((entry) => entry as AuditQueueEntry)
    .filter((entry) => !entry.syncedAt)
    .map((entry) => ({
      id: entry.id,
      action: entry.action,
      level: entry.level,
      message: entry.message,
      context: entry.context,
      created_at: entry.createdAt,
    }));
};

const markSnapshotsSynced = async (ids: string[], timestamp: string): Promise<void> => {
  if (ids.length === 0) {
    return;
  }
  const store = ensureSnapshotStore();
  if (!store) {
    return;
  }
  await Promise.all(
    ids.map(async (id) => {
      const snapshot = (await get(id, store)) as RoutingWorkspaceSnapshot | undefined;
      if (!snapshot) {
        return;
      }
      await set(id, { ...snapshot, syncedAt: timestamp }, store);
    }),
  );
};

const removeAuditEntries = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) {
    return;
  }
  const store = ensureAuditStore();
  if (!store) {
    return;
  }
  await Promise.all(ids.map((id) => del(id, store)));
};

const resetBackoff = () => {
  backoffAttempt = 0;
};

const scheduleFlush = (delayMs: number, reason: FlushTrigger) => {
  if (scheduledFlush) {
    clearTimeout(scheduledFlush);
  }
  scheduledReason = reason;
  lastScheduledDelayMs = delayMs;
  scheduledFlush = setTimeout(() => {
    scheduledFlush = undefined;
    scheduledReason = null;
    void flushRoutingPersistence("scheduled");
  }, delayMs);
};

const handleFlushFailure = (reason: FlushTrigger) => {
  backoffAttempt += 1;
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, backoffAttempt - 1), MAX_BACKOFF_MS);
  scheduleFlush(delay, reason);
};

const prepareFlushPayload = async () => {
  const [snapshots, audits] = await Promise.all([
    collectSnapshotsForFlush(),
    collectAuditsForFlush(),
  ]);
  return { snapshots, audits };
};

export const flushRoutingPersistence = async (
  trigger: FlushTrigger = "manual",
): Promise<RoutingPersistenceFlushResult | null> => {
  if (flushInFlight) {
    return null;
  }
  if (!autoFlushEnabled && trigger !== "manual") {
    return null;
  }
  if (!isOnline()) {
    return null;
  }
  flushInFlight = true;
  try {
    const { snapshots, audits } = await prepareFlushPayload();
    if (snapshots.length === 0 && audits.length === 0) {
      resetBackoff();
      return null;
    }
    // API function removed - routing snapshots feature not used
    const response = {} as any;
    // const response =
    //   (await postRoutingSnapshotsBatch({
    //     snapshots,
    //     audits,
    //     source: "routing-workspace",
    //   })) ?? {};
    const timestamp = new Date().toISOString();
    const acceptedSnapshotIds = Array.isArray(response.accepted_snapshot_ids)
      ? response.accepted_snapshot_ids
      : [];
    const acceptedAuditIds = Array.isArray(response.accepted_audit_ids)
      ? response.accepted_audit_ids
      : [];
    await Promise.all([
      markSnapshotsSynced(acceptedSnapshotIds, timestamp),
      removeAuditEntries(acceptedAuditIds),
    ]);
    resetBackoff();
    const result: RoutingPersistenceFlushResult = {
      acceptedSnapshotIds,
      acceptedAuditIds,
      updatedGroups: (response.updated_groups ?? []).map((group) => ({
        groupId: group.group_id,
        version: group.version,
        dirty: group.dirty,
        updatedAt: group.updated_at,
        snapshotId: group.snapshot_id ?? null,
      })),
    };
    notifyFlushListeners(result);
    return result;
  } catch (error) {
    console.error("routing.persistence.flush.error", error);
    handleFlushFailure(trigger);
    return null;
  } finally {
    flushInFlight = false;
  }
};

const requestFlush = (reason: FlushTrigger) => {
  if (!autoFlushEnabled) {
    return;
  }
  if (!isOnline()) {
    return;
  }
  ensureListenerSet();
  scheduleFlush(MIN_FLUSH_DELAY_MS, reason);
};

export const enableRoutingPersistenceFlush = () => {
  if (autoFlushEnabled) {
    return;
  }
  autoFlushEnabled = true;
  ensureListenerSet();
  scheduleFlush(MIN_FLUSH_DELAY_MS, "init");
};

export const subscribeToRoutingPersistenceFlush = (listener: FlushListener): (() => void) => {
  if (!flushListeners) {
    flushListeners = new Set();
  }
  flushListeners.add(listener);
  return () => {
    flushListeners?.delete(listener);
  };
};

export const __internal = {
  isIndexedDbAvailable,
  debug: {
    getBackoffAttempt: () => backoffAttempt,
    getLastScheduledDelay: () => lastScheduledDelayMs,
    getScheduledReason: () => scheduledReason,
    clearScheduledFlush: () => {
      if (scheduledFlush) {
        clearTimeout(scheduledFlush);
      }
      scheduledFlush = undefined;
      scheduledReason = null;
      lastScheduledDelayMs = null;
    },
    disableAutoFlush: () => {
      autoFlushEnabled = false;
    },
    triggerOnline: () => {
      requestFlush("online");
    },
  },
};
