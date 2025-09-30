import type { Route } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ROUTING_SAVE_CONTROL_IDS } from "../../frontend/src/components/RoutingGroupControls";

const predictionFixture = {
  items: [
    {
      ITEM_CD: "ERP-001",
      CANDIDATE_ID: "CAND-ERP",
      generated_at: new Date().toISOString(),
      operations: [
        {
          PROC_SEQ: 1,
          PROC_CD: "CUTTING",
          PROC_DESC: "Initial cut",
          SETUP_TIME: 3,
          RUN_TIME: 12,
          WAIT_TIME: 1,
        },
      ],
    },
  ],
  candidates: [],
  metrics: {
    requested_items: 1,
    returned_routings: 1,
    returned_candidates: 0,
    threshold: 0.5,
    generated_at: new Date().toISOString(),
  },
};

const workspaceSettings = {
  export: {
    erp_interface_enabled: true,
    enable_csv: true,
    enable_excel: false,
    enable_json: true,
    enable_txt: false,
    enable_parquet: false,
    default_encoding: "utf-8",
    export_directory: "/tmp",
    compress_on_save: false,
  },
};

const workflowGraph = {
  nodes: [],
  edges: [],
  design_refs: [],
  last_saved: new Date().toISOString(),
};

const fulfillJson = async (route: Route, payload: unknown, status = 200) => {
  await route.fulfill({
    status,
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
    },
  });
};

test.describe("routing ERP interface flow", () => {
  test("calls ERP interface endpoint after saving when enabled", async ({ page }) => {
    let interfaceCalls = 0;
    let lastInterfacePayload: Record<string, unknown> | null = null;
    let lastSavePayload: Record<string, unknown> | null = null;

    await page.route("**/api/settings/workspace", (route) => fulfillJson(route, workspaceSettings));
    await page.route("**/api/predict", (route) => fulfillJson(route, predictionFixture));
    await page.route("**/api/workflow/graph", (route) => fulfillJson(route, workflowGraph));
    await page.route("**/api/routing/groups", async (route) => {
      if (route.request().method() === "POST") {
        lastSavePayload = route.request().postDataJSON() as Record<string, unknown>;
        await fulfillJson(route, {
          group_id: "grp-test-erp",
          version: 1,
          owner: "qa_user",
          updated_at: new Date().toISOString(),
        });
        return;
      }
      await fulfillJson(route, {
        items: [],
        pagination: { limit: 20, offset: 0, total: 0 },
      });
    });
    await page.route("**/api/routing/interface", async (route) => {
      interfaceCalls += 1;
      lastInterfacePayload = route.request().postDataJSON() as Record<string, unknown>;
      await fulfillJson(route, {
        group_id: "grp-test-erp",
        exported_files: ["/tmp/routing_erp_20250101.json"],
        erp_path: "/tmp/routing_erp_20250101.json",
        message: "ERP 내보내기 완료: /tmp/routing_erp_20250101.json",
      });
    });
    await page.route("**/api/**", (route) => fulfillJson(route, {}));

    await page.goto("/");
    await page.getByRole("button", { name: "라우팅 생성" }).click();
    await page.waitForResponse((response) => response.url().includes("/api/predict") && response.status() === 200);

    await page.getByLabel("그룹 이름").fill("ERP Test Group");
    await page.locator(`#${ROUTING_SAVE_CONTROL_IDS.primary}`).click();
    await page.getByRole("button", { name: "ERP로 저장" }).click();

    await expect.poll(() => interfaceCalls).toBe(1);
    const statusMessage = page.locator(".form-status");
    await expect(statusMessage).toBeVisible();
    await expect(statusMessage).toHaveText(/ERP/);

    expect(lastSavePayload?.erp_required).toBe(true);
    expect(lastInterfacePayload?.group_id).toBe("grp-test-erp");
  });
});
