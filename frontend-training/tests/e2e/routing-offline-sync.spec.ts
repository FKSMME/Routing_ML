import { act } from "@testing-library/react";
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

const postRoutingSnapshotsBatchMock = vi.hoisted(() => vi.fn());

vi.mock("@lib/apiClient", () => ({
  __esModule: true,
  postRoutingSnapshotsBatch: postRoutingSnapshotsBatchMock,
}));

const ensureCrypto = () => {
  if (!globalThis.crypto) {
    Object.assign(globalThis, {
      crypto: {
        randomUUID: () => `uuid-${Math.random().toString(16).slice(2)}-${Date.now().toString(36)}`,
      },
    });
  }
};

const {
  __internal,
  enqueueAuditEntry,
  writeRoutingWorkspaceSnapshot,
} = await import("@lib/persistence");

const { createRoutingStore } = await import("@store/routingStore");

describe("routing persistence online flush integration", () => {
  beforeEach(() => {
    stores.clear();
    vi.useFakeTimers();
    ensureCrypto();
    Object.assign(globalThis, { indexedDB: {} });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { onLine: false },
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

  it("propagates server updates after regaining connectivity", async () => {
    const store = createRoutingStore();

    act(() => {
      store.setState({
        activeGroupId: "group-1",
        activeGroupVersion: 2,
        dirty: true,
        lastSavedAt: "2025-10-05T00:00:00.000Z",
      });
    });

    const snapshot = await writeRoutingWorkspaceSnapshot({
      activeGroupId: "group-1",
      activeGroupVersion: 2,
      dirty: true,
    });
    await enqueueAuditEntry({ action: "routing.snapshot.save" });

    postRoutingSnapshotsBatchMock.mockResolvedValueOnce({
      accepted_snapshot_ids: [snapshot.id],
      accepted_audit_ids: [],
      updated_groups: [
        {
          group_id: "group-1",
          version: 3,
          dirty: false,
          updated_at: "2025-10-06T01:00:00.000Z",
          snapshot_id: snapshot.id,
        },
      ],
    });

    (globalThis.navigator as Navigator & { onLine: boolean }).onLine = true;
    __internal.debug.triggerOnline();

    await vi.runAllTimersAsync();

    const payload = postRoutingSnapshotsBatchMock.mock.calls.at(-1)?.[0];
    expect(payload.snapshots).not.toBeUndefined();
    expect(payload.snapshots).not.toHaveLength(0);
    expect(payload.snapshots[0].id).toBeTruthy();

    const state = store.getState();
    expect(state.dirty).toBe(false);
    expect(state.activeGroupVersion).toBe(3);
    expect(state.lastSavedAt).toBe("2025-10-06T01:00:00.000Z");
  });
});

