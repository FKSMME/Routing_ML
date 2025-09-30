import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

const { createRoutingStore } = await import("../../src/store/routingStore");
const {
  readLatestRoutingWorkspaceSnapshot,
  readAuditEntries,
} = await import("../../src/lib/persistence/indexedDbPersistence");

const predictionFixture = {
  items: [
    {
      ITEM_CD: "ITEM-001",
      CANDIDATE_ID: "CAND-1",
      generated_at: "2025-10-03T09:00:00.000Z",
      operations: [
        {
          PROC_SEQ: 1,
          PROC_CD: "CUT",
          PROC_DESC: "Cutting",
          SETUP_TIME: 4,
          RUN_TIME: 12,
          WAIT_TIME: 1,
        },
        {
          PROC_SEQ: 2,
          PROC_CD: "GRIND",
          PROC_DESC: "Grinding",
          SETUP_TIME: 5,
          RUN_TIME: 18,
          WAIT_TIME: 0,
        },
        {
          PROC_SEQ: 3,
          PROC_CD: "POLISH",
          PROC_DESC: "Polishing",
          SETUP_TIME: 3,
          RUN_TIME: 15,
          WAIT_TIME: 2,
        },
      ],
    },
  ],
  candidates: [],
  metrics: {
    requested_items: 1,
    returned_routings: 1,
    returned_candidates: 0,
    threshold: 0.3,
    generated_at: "2025-10-03T09:00:00.000Z",
    feature_weights: {
      profiles: [{ name: "default", description: "Default" }],
    },
  },
};

const SNAPSHOT_WAIT_MS = 31_000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const qaLogDir = resolve(__dirname, "../../..", "logs", "qa");

const ensureCrypto = () => {
  if (!globalThis.crypto) {
    Object.assign(globalThis, {
      crypto: {
        randomUUID: () => `uuid-${Math.random().toString(16).slice(2)}-${Date.now().toString(36)}`,
      },
    });
  }
};

const ensureIndexedDb = () => {
  if (!("indexedDB" in globalThis)) {
    Object.assign(globalThis, {
      indexedDB: {},
    });
  }
};

const flushAsyncPersistence = async () => {
  await Promise.resolve();
  await vi.runAllTimersAsync();
  await Promise.resolve();
};

describe("indexeddb autosave evidence", () => {
  beforeEach(() => {
    stores.clear();
    vi.useFakeTimers();
    ensureCrypto();
    ensureIndexedDb();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as Record<string, unknown>).indexedDB;
  });

  it("captures autosave snapshot and restore flow", async () => {
    const initialStore = createRoutingStore();
    initialStore.getState().loadRecommendations(predictionFixture);

    const titlesBeforeEdit = initialStore
      .getState()
      .timeline.map((step) => step.processCode);

    const firstStepId = initialStore.getState().timeline[0]?.id;
    expect(firstStepId).toBeTruthy();
    initialStore.getState().removeStep(firstStepId!);

    const titlesAfterEdit = initialStore
      .getState()
      .timeline.map((step) => step.processCode);

    await vi.advanceTimersByTimeAsync(SNAPSHOT_WAIT_MS);
    await flushAsyncPersistence();

    const latestSnapshot = await readLatestRoutingWorkspaceSnapshot();
    expect(latestSnapshot).toBeDefined();
    expect(latestSnapshot?.state.timeline).toHaveLength(2);

    const auditEntriesBeforeReload = await readAuditEntries();
    const auditActionsBeforeReload = auditEntriesBeforeReload.map((entry) => entry.action);
    expect(auditActionsBeforeReload).toContain("routing.snapshot.save");

    const reloadedStore = createRoutingStore();
    await flushAsyncPersistence();
    const reloadedState = reloadedStore.getState();

    const titlesAfterReload = reloadedState.timeline.map((step) => step.processCode);
    expect(titlesAfterReload).toEqual(titlesAfterEdit);

    const auditEntriesAfterReload = await readAuditEntries();
    const auditActionsAfterReload = auditEntriesAfterReload.map((entry) => entry.action);
    expect(auditActionsAfterReload).toContain("routing.snapshot.restore");

    mkdirSync(qaLogDir, { recursive: true });
    const evidenceDate = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const logPath = resolve(qaLogDir, `indexeddb_autosave_restore_${evidenceDate}.md`);

    const logTimestamp = new Date().toISOString();
    const logLines = [
      `# IndexedDB Autosave QA Log (${logTimestamp})`,
      "",
      "## Summary",
      "- Verified routing store autosave writes snapshots via `frontend/src/lib/persistence/indexedDbPersistence.ts`.",
      "- Confirmed audit queue records save and restore actions when snapshots are read on new store instances.",
      "",
      "## Timeline Titles",
      `- Before edit: ${JSON.stringify(titlesBeforeEdit)}`,
      `- After edit: ${JSON.stringify(titlesAfterEdit)}`,
      `- After reload: ${JSON.stringify(titlesAfterReload)}`,
      "",
      "## Snapshot Store (latest entry)",
      "```json",
      JSON.stringify(latestSnapshot, null, 2),
      "```",
      "",
      "## Audit Queue (entries)",
      "```json",
      JSON.stringify(auditEntriesAfterReload, null, 2),
      "```",
      "",
      "## Execution",
      "- Command: `npm run test -- --run frontend/tests/evidence/indexeddb_autosave_capture.test.ts`",
    ];

    writeFileSync(logPath, `${logLines.join("\n")}\n`, "utf-8");
  });
});
