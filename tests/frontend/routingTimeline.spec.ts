import { test, expect } from "@playwright/test";
import type { Route } from "@playwright/test";
import type { PredictionResponse } from "../../frontend/src/types/routing";
import type { WorkflowConfigResponse } from "../../frontend/src/types/workflow";

const predictionFixture: PredictionResponse = {
  items: [
    {
      ITEM_CD: "ITEM-001",
      CANDIDATE_ID: "CAND-1",
      generated_at: new Date().toISOString(),
      operations: Array.from({ length: 12 }).map((_, index) => ({
        PROC_SEQ: index + 1,
        PROC_CD: `PROC-${(index + 1).toString().padStart(3, "0")}`,
        PROC_DESC: `Operation ${(index + 1).toString().padStart(2, "0")}`,
        SETUP_TIME: 4 + index,
        RUN_TIME: 10 + index * 2,
        WAIT_TIME: index % 3,
      })),
    },
  ],
  candidates: [],
  metrics: {
    requested_items: 1,
    returned_routings: 1,
    returned_candidates: 0,
    threshold: 0.3,
    generated_at: new Date().toISOString(),
    feature_weights: {
      profiles: [{ name: "default", description: "Default" }],
    },
  },
};

const workflowFixture: WorkflowConfigResponse = {
  graph: {
    nodes: [
      {
        id: "predictor",
        label: "Predictor",
        type: "module",
        category: "runtime",
        status: "ready",
        position: { x: 0, y: 0 },
        settings: {},
        metrics: {},
        doc_refs: [],
      },
    ],
    edges: [],
    design_refs: [],
    last_saved: new Date().toISOString(),
  },
  trainer: {
    similarity_threshold: 0.8,
    trim_std_enabled: true,
    trim_lower_percent: 0.05,
    trim_upper_percent: 0.95,
  },
  predictor: {
    similarity_high_threshold: 0.85,
    max_routing_variants: 5,
    trim_std_enabled: true,
    trim_lower_percent: 0.05,
    trim_upper_percent: 0.95,
  },
  sql: {
    output_columns: [],
    column_aliases: {},
    available_columns: [],
    profiles: [],
    active_profile: null,
    exclusive_column_groups: [],
    key_columns: [],
    training_output_mapping: {},
  },
  data_source: {
    access_path: "",
    default_table: "",
    backup_paths: [],
    table_profiles: [],
    column_overrides: {},
    allow_gui_override: false,
    blueprint_switches: [],
    shading_palette: {},
  },
  export: {
    enable_cache_save: false,
    enable_excel: true,
    enable_csv: true,
    enable_txt: false,
    enable_parquet: false,
    enable_json: true,
    erp_interface_enabled: false,
    erp_protocol: null,
    erp_endpoint: null,
    default_encoding: "utf-8",
    export_directory: "/tmp",
    compress_on_save: false,
  },
  visualization: {
    tensorboard_projector_dir: "",
    projector_enabled: false,
    projector_metadata_columns: [],
    neo4j_enabled: false,
    neo4j_browser_url: null,
    neo4j_workspace: null,
    publish_service_enabled: false,
    publish_notes: null,
  },
  updated_at: new Date().toISOString(),
};

const fulfillJson = (route: Route, payload: unknown) => {
  route.fulfill({
    status: 200,
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
    },
  });
};

test.describe("routing timeline interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/predict", (route) => fulfillJson(route, predictionFixture));
    await page.route("**/api/workflow/graph", (route) => fulfillJson(route, workflowFixture));
    await page.route("**/api/**", (route) => {
      fulfillJson(route, {});
    });

    await page.goto("/");
    await page.getByRole("button", { name: "라우팅 생성" }).click();
    await page.waitForResponse((response) => response.url().includes("/api/predict") && response.status() === 200);
    await expect(page.getByTestId("timeline-view-tab")).toBeVisible();
    await expect(page.getByTestId("routing-canvas-scroll")).toBeVisible();
  });

  test("syncs scroll offsets with viewport movement", async ({ page }) => {
    const scrollArea = page.getByTestId("routing-canvas-scroll");
    const viewport = page.locator(".timeline-flow__canvas .react-flow__viewport");

    const initialTransform = await viewport.evaluate((element) => element.getAttribute("style") ?? "");

    await scrollArea.evaluate((element) => {
      element.scrollLeft = 360;
      element.scrollTop = 120;
      element.dispatchEvent(new Event("scroll"));
    });

    await expect.poll(async () => viewport.evaluate((element) => element.getAttribute("style") ?? "")).not.toBe(
      initialTransform,
    );
    await expect.poll(async () => scrollArea.evaluate((element) => Math.round(element.scrollLeft))).toBe(360);
    await expect.poll(async () => scrollArea.evaluate((element) => Math.round(element.scrollTop))).toBe(120);

    const before = await scrollArea.evaluate((element) => element.scrollLeft);
    const box = await scrollArea.boundingBox();
    if (!box) {
      throw new Error("Unable to determine canvas position");
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 180, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();

    await expect.poll(async () => scrollArea.evaluate((element) => Math.round(element.scrollLeft))).not.toBe(
      Math.round(before),
    );
  });

  test("toggles between timeline and recommendation views", async ({ page }) => {
    const timelineTab = page.getByTestId("timeline-view-tab");
    const recommendationsTab = page.getByTestId("recommendations-view-tab");
    const canvasLocator = page.locator('[data-testid="routing-canvas-scroll"]');

    await expect(recommendationsTab).toBeEnabled();

    await recommendationsTab.click();
    await expect(page.getByTestId("recommendations-panel")).toBeVisible();
    await expect(canvasLocator).toHaveCount(0);
    await expect(page.getByTestId("recommendations-list").locator("li")).toHaveCount(predictionFixture.items[0].operations.length);

    await timelineTab.click();
    await expect(canvasLocator).toBeVisible();
    await expect(page.getByTestId("recommendations-panel")).toHaveCount(0);
  });
});
