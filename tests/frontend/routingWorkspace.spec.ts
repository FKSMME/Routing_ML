import { expect, test } from "../playwrightTest";

test.describe("Routing workspace layout", () => {
  test("aligns to the themed 20/60/20 columns", async ({ page }) => {
    await page.goto("/");

    const grid = page.getByTestId("routing-workspace-grid");
    await expect(grid).toBeVisible();
    await expect(grid).toHaveScreenshot("routing-workspace.png");

    const ratios = await grid.evaluate((node) => {
      const columns = Array.from(node.children) as HTMLElement[];
      const widths = columns.map((column) => column.getBoundingClientRect().width);
      const total = widths.reduce((acc, width) => acc + width, 0) || 1;
      return widths.map((width) => Math.round((width / total) * 100));
    });

    expect(ratios).toHaveLength(3);
    expect(ratios[0]).toBeGreaterThanOrEqual(19);
    expect(ratios[0]).toBeLessThanOrEqual(21);
    expect(ratios[1]).toBeGreaterThanOrEqual(59);
    expect(ratios[1]).toBeLessThanOrEqual(61);
    expect(ratios[2]).toBeGreaterThanOrEqual(19);
    expect(ratios[2]).toBeLessThanOrEqual(21);
  });
});
