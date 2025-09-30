import { expect, test, type Page } from "../../playwrightTest";

interface PredictionResponse {
  items: Array<{
    ITEM_CD: string;
    CANDIDATE_ID: string | null;
    operations: Array<{
      PROC_SEQ: number;
      PROC_CD: string;
      PROC_DESC: string;
      SETUP_TIME: number;
      RUN_TIME: number;
      WAIT_TIME: number;
    }>;
  }>;
  candidates: unknown[];
  metrics: Record<string, unknown>;
}

const MOCK_PREDICTION: PredictionResponse = {
  items: [
    {
      ITEM_CD: "ITEM-100",
      CANDIDATE_ID: "cand-1",
      operations: [
        {
          PROC_SEQ: 1,
          PROC_CD: "CUT-100",
          PROC_DESC: "절단",
          SETUP_TIME: 5,
          RUN_TIME: 12,
          WAIT_TIME: 3,
        },
        {
          PROC_SEQ: 2,
          PROC_CD: "WELD-200",
          PROC_DESC: "용접",
          SETUP_TIME: 7,
          RUN_TIME: 20,
          WAIT_TIME: 4,
        },
        {
          PROC_SEQ: 3,
          PROC_CD: "PACK-300",
          PROC_DESC: "포장",
          SETUP_TIME: 4,
          RUN_TIME: 10,
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
    generated_at: "2025-10-03T09:00:00.000Z",
    threshold: 0.62,
  },
};

async function setupMobileWorkspace(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.endsWith("/predict") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_PREDICTION),
      });
      return;
    }

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.goto("/");

  const input = page.getByPlaceholder("ITEM-001\nITEM-002");
  await input.fill("ITEM-100");
  await page.getByRole("button", { name: "추천 실행" }).click();

  await expect(page.getByRole("heading", { name: "Routing Canvas" })).toBeVisible();
  await expect(page.locator(".candidate-block").first()).toBeVisible();
  await expect(page.locator(".timeline-node")).toHaveCount(3);
}

test.describe("모바일 라우팅 워크스페이스", () => {
  test.beforeEach(async ({ page }) => {
    await setupMobileWorkspace(page);
  });

  test("supports drag, undo, and redo interactions", async ({ page }) => {
    const timelineNodes = page.locator(".timeline-node");
    await expect(timelineNodes).toHaveCount(3);

    await page.locator(".timeline-node__remove").last().click();
    await expect(timelineNodes).toHaveCount(2);

    const candidate = page.locator(".candidate-block", { hasText: "PACK-300" });
    await candidate.dragTo(page.getByTestId("routing-canvas-scroll"), {
      sourcePosition: { x: 20, y: 20 },
      targetPosition: { x: 220, y: 140 },
    });

    await expect(timelineNodes).toHaveCount(3);
    await expect(page.locator(".timeline-node__title").last()).toHaveText(/PACK-300/);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(timelineNodes).toHaveCount(2);

    await page.getByRole("button", { name: "Redo" }).click();
    await expect(timelineNodes).toHaveCount(3);
  });

  test("allows horizontal canvas scrolling on touch layouts", async ({ page }) => {
    const canvas = page.getByTestId("routing-canvas-scroll");
    const candidate = page.locator(".candidate-block", { hasText: "PACK-300" });

    for (let index = 0; index < 4; index += 1) {
      await candidate.dragTo(canvas, {
        sourcePosition: { x: 20, y: 20 },
        targetPosition: { x: 260, y: 140 },
      });
    }

    await expect.poll(async () => {
      return canvas.evaluate((node) => Math.round(node.scrollWidth - node.clientWidth));
    }).toBeGreaterThan(0);

    const scrolledLeft = await canvas.evaluate((node) => {
      node.scrollTo({ left: node.scrollWidth, behavior: "auto" });
      return node.scrollLeft;
    });

    expect(scrolledLeft).toBeGreaterThan(0);
  });

  test("restores cached timeline state when API requests fail", async ({ page }) => {
    await page.locator(".timeline-node__remove").last().click();
    await expect(page.locator(".timeline-node")).toHaveCount(2);

    await page.getByRole("button", { name: "ERP 인터페이스 필요 여부 토글" }).click();

    await page.evaluate(async () => {
      const { useRoutingStore } = await import("/src/store/routingStore.ts");
      const { writeRoutingWorkspaceSnapshot } = await import(
        "/src/lib/persistence/indexedDbPersistence.ts"
      );

      const cloneSteps = (steps: any[]) => steps.map((step) => ({ ...step }));
      const state = useRoutingStore.getState();
      const productTabs = state.productTabs.map((tab) => ({
        ...tab,
        timeline: cloneSteps(tab.timeline),
      }));
      const lastSuccess = Object.fromEntries(
        Object.entries(state.lastSuccessfulTimeline).map(([key, steps]) => [
          key,
          cloneSteps(steps as any[]),
        ]),
      );

      await writeRoutingWorkspaceSnapshot({
        activeProductId: state.activeProductId,
        activeItemId: state.activeItemId,
        productTabs,
        timeline: cloneSteps(state.timeline),
        lastSuccessfulTimeline: lastSuccess,
        lastSavedAt: state.lastSavedAt,
        dirty: state.dirty,
      });
    });

    await page.route("**/api/predict", (route) => route.abort());
    await page.reload();

    await expect(page.locator(".timeline-node")).toHaveCount(2);

    const snapshotMeta = await page.evaluate(async () => {
      const { readLatestRoutingWorkspaceSnapshot } = await import(
        "/src/lib/persistence/indexedDbPersistence.ts"
      );
      const snapshot = await readLatestRoutingWorkspaceSnapshot();
      return {
        persisted: snapshot?.persisted ?? false,
        steps: snapshot?.state?.timeline?.length ?? 0,
      };
    });

    expect(snapshotMeta.persisted).toBe(true);
    expect(snapshotMeta.steps).toBeGreaterThanOrEqual(2);
  });
});
