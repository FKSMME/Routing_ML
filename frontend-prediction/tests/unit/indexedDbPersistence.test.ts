import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __internal,
  enqueueAuditEntry,
  readAuditEntries,
  readLatestRoutingWorkspaceSnapshot,
  writeRoutingWorkspaceSnapshot,
} from "@lib/persistence";

type IndexedDbAwareGlobal = typeof globalThis & { indexedDB?: IDBFactory };

const globalRef = globalThis as IndexedDbAwareGlobal;
const originalIndexedDb = globalRef.indexedDB;

describe("indexedDbPersistence fallback behaviour", () => {
  beforeEach(() => {
    globalRef.indexedDB = undefined;
  });

  afterEach(() => {
    globalRef.indexedDB = originalIndexedDb;
  });

  afterAll(() => {
    globalRef.indexedDB = originalIndexedDb;
  });

  it("reports unavailable IndexedDB when browser support is missing", () => {
    expect(__internal.isIndexedDbAvailable()).toBe(false);
  });

  it("returns persisted=false when snapshots cannot be stored", async () => {
    const snapshot = await writeRoutingWorkspaceSnapshot({ value: 1 });
    expect(snapshot.persisted).toBe(false);
    const restored = await readLatestRoutingWorkspaceSnapshot<{ value: number }>();
    expect(restored).toBeUndefined();
  });

  it("returns persisted=false for audit queue writes when IndexedDB is unavailable", async () => {
    const entry = await enqueueAuditEntry({ action: "test.action", level: "info" });
    expect(entry.persisted).toBe(false);
    const entries = await readAuditEntries();
    expect(entries).toEqual([]);
  });
});
