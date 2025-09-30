import { createStore, del, get, keys, set } from "idb-keyval";

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
}

export interface AuditQueueEntry {
  id: string;
  action: string;
  level: "info" | "error";
  message?: string;
  context?: Record<string, unknown>;
  createdAt: string;
  persisted?: boolean;
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
  };
  const store = ensureSnapshotStore();
  if (!store) {
    return { ...snapshot, persisted: false };
  }
  await set(snapshot.id, snapshot, store);
  await pruneStore(store, MAX_SNAPSHOTS);
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
  };
  const store = ensureAuditStore();
  if (!store) {
    return { ...entry, persisted: false };
  }
  await set(entry.id, entry, store);
  await pruneStore(store, MAX_AUDIT_ENTRIES);
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

export const __internal = {
  isIndexedDbAvailable,
};
