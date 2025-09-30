import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stores = new Map<string, Map<string, unknown>>();

interface StoreHandle {
  dbName: string;
  storeName: string;
}

const resolveStore = (handle: StoreHandle): Map<string, unknown> => {
  const key = `${handle.dbName}:${handle.storeName}`;
  if (!stores.has(key)) {
    stores.set(key, new Map());
  }
  return stores.get(key)!;
};

vi.mock("idb-keyval", () => ({
  createStore: (dbName: string, storeName: string) => ({ dbName, storeName }),
  set: async (key: string, value: unknown, store: StoreHandle) => {
    resolveStore(store).set(key, value);
  },
  get: async (key: string, store: StoreHandle) => resolveStore(store).get(key),
  del: async (key: string, store: StoreHandle) => {
    resolveStore(store).delete(key);
  },
  keys: async (store: StoreHandle) => Array.from(resolveStore(store).keys()),
}));

const postRoutingSnapshotsBatchMock = vi.fn();

vi.mock("@lib/apiClient", async (original) => {
  const actual = await original();
  return {
    ...actual,
    postRoutingSnapshotsBatch: postRoutingSnapshotsBatchMock,
  };
});

const {
  __internal,
  enableRoutingPersistenceFlush,
  enqueueAuditEntry,
  flushRoutingPersistence,
  readAuditEntries,
  readLatestRoutingWorkspaceSnapshot,
  writeRoutingWorkspaceSnapshot,
} = await import("@lib/persistence");

const ensureCrypto = () => {
  if (!globalThis.crypto) {
    Object.assign(globalThis, {
      crypto: {
        randomUUID: () => `uuid-${Math.random().toString(16).slice(2)}-${Date.now().toString(36)}`,
      },
    });
  }
};

describe("routing persistence flush", () => {
  beforeEach(() => {
    stores.clear();
    vi.useFakeTimers();
    ensureCrypto();
    Object.assign(globalThis, { indexedDB: {} });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { onLine: true },
    });
    postRoutingSnapshotsBatchMock.mockReset();
    __internal.debug.clearScheduledFlush();
    __internal.debug.disableAutoFlush();
  });

  afterEach(async () => {
    __internal.debug.clearScheduledFlush();
    __internal.debug.disableAutoFlush();
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    delete (globalThis as Record<string, unknown>).indexedDB;
    delete (globalThis as Record<string, unknown>).navigator;
    delete (globalThis as Record<string, unknown>).crypto;
  });

  it("flushes queued snapshots and audits", async () => {
    enableRoutingPersistenceFlush();

    const snapshot = await writeRoutingWorkspaceSnapshot({
      activeGroupId: "group-1",
      dirty: true,
    });
    const auditEntry = await enqueueAuditEntry({ action: "routing.snapshot.save" });

    postRoutingSnapshotsBatchMock.mockResolvedValueOnce({
      accepted_snapshot_ids: [snapshot.id],
      accepted_audit_ids: [auditEntry.id],
      updated_groups: [],
    });

    await flushRoutingPersistence("manual");

    expect(postRoutingSnapshotsBatchMock).toHaveBeenCalledTimes(1);
    const payload = postRoutingSnapshotsBatchMock.mock.calls[0]?.[0];
    expect(payload.snapshots).toHaveLength(1);
    expect(payload.snapshots[0]).toMatchObject({ id: snapshot.id });
    expect(payload.audits).toHaveLength(1);
    expect(payload.audits[0].id).toBe(auditEntry.id);

    const latest = await readLatestRoutingWorkspaceSnapshot();
    expect(latest?.syncedAt).toBeTruthy();
    const audits = await readAuditEntries();
    expect(audits).toEqual([]);
  });

  it("applies exponential backoff when flush fails", async () => {
    enableRoutingPersistenceFlush();

    postRoutingSnapshotsBatchMock.mockRejectedValueOnce(new Error("server unavailable"));

    await writeRoutingWorkspaceSnapshot({ activeGroupId: "group-1", dirty: false });

    await flushRoutingPersistence("manual");

    expect(__internal.debug.getBackoffAttempt()).toBe(1);
    expect(__internal.debug.getLastScheduledDelay()).toBeGreaterThanOrEqual(2000);
  });
});

