import { createStore, del, get, keys, set } from "idb-keyval";

const SNAPSHOT_STORE = createStore("routing_workspace", "snapshots");
const AUDIT_STORE = createStore("routing_workspace", "audit_queue");

const MAX_SNAPSHOTS = 5;
const MAX_AUDIT_ENTRIES = 50;

type StoreHandle = ReturnType<typeof createStore>;

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const pruneStore = async (store: StoreHandle, maxEntries: number) => {
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
}

export interface AuditQueueEntry {
  id: string;
  action: string;
  level: "info" | "error";
  message?: string;
  context?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditQueueInput {
  action: string;
  level?: "info" | "error";
  message?: string;
  context?: Record<string, unknown>;
}

export async function writeRoutingWorkspaceSnapshot<TState>(
  state: TState,
): Promise<RoutingWorkspaceSnapshot<TState>> {
  const snapshot: RoutingWorkspaceSnapshot<TState> = {
    id: createId(),
    createdAt: new Date().toISOString(),
    state,
  };
  await set(snapshot.id, snapshot, SNAPSHOT_STORE);
  await pruneStore(SNAPSHOT_STORE, MAX_SNAPSHOTS);
  return snapshot;
}

export async function readLatestRoutingWorkspaceSnapshot<TState>(): Promise<
  RoutingWorkspaceSnapshot<TState> | undefined
> {
  const storeKeys = await keys(SNAPSHOT_STORE);
  if (storeKeys.length === 0) {
    return undefined;
  }
  const sortedKeys = storeKeys
    .map((key) => String(key))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const latestKey = sortedKeys[sortedKeys.length - 1];
  const snapshot = await get(latestKey, SNAPSHOT_STORE);
  return snapshot as RoutingWorkspaceSnapshot<TState> | undefined;
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
  await set(entry.id, entry, AUDIT_STORE);
  await pruneStore(AUDIT_STORE, MAX_AUDIT_ENTRIES);
  return entry;
}

export async function readAuditEntries(): Promise<AuditQueueEntry[]> {
  const storeKeys = await keys(AUDIT_STORE);
  if (storeKeys.length === 0) {
    return [];
  }
  const sortedKeys = storeKeys
    .map((key) => String(key))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const entries = await Promise.all(sortedKeys.map((key) => get(key, AUDIT_STORE)));
  return entries.filter(Boolean) as AuditQueueEntry[];
}

