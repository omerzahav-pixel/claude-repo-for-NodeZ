import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 5 P1 · Item #3 — progressive node properties.
 *
 * Design intent:
 *   - Primary fields (label, body, shape, status, zone) stay always
 *     visible so the 90% case — rename / jot a thought / change
 *     status — stays one tap away.
 *   - Secondary fields (rationale, url, tags, confidence, color,
 *     compact) tuck behind a <details class="pn-more"> disclosure.
 *   - `panelDetailsOpen` persists open/closed across in-session
 *     rebuilds (shape change, switching selection) so an advanced
 *     edit session keeps its state.
 *   - cp() (close panel) resets the flag → next fresh open is
 *     minimal again.
 *   - Autosave still runs for fields inside Details — the
 *     oninput/onchange handlers don't care about visibility.
 */

const viteUrl = process.env.VITE_URL ?? "http://localhost:5173/";

async function openCleanApp(page: Page) {
  await page.goto(viteUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    try { indexedDB.deleteDatabase("ideaVault"); } catch {}
    try { localStorage.clear(); } catch {}
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("svg#cv", { state: "attached", timeout: 15_000 });
  await page.waitForFunction(() => !!(window as any).__E2E, null, { timeout: 15_000 });
  await page.waitForTimeout(400);
}

async function seedAndOpen(page: Page, seed?: Record<string, any>) {
  const id = await page.evaluate((s) => {
    const E = (window as any).__E2E;
    const cur = E.current();
    const id = Math.max(0, ...cur.nodes.map((n: any) => n.id)) + 1;
    E.addNodeRaw({ id, x: 0, y: 0, shape: "idea", label: "start", status: "idea", zone: (cur.zones[0]?.id) || "inbox", ...s });
    (window as any).op((window as any).__E2E.current().nodes.find((n: any) => n.id === id));
    return id;
  }, seed || {});
  await page.waitForSelector("#pn", { state: "visible", timeout: 5_000 });
  return id;
}

test.describe("Phase 5 P1 · Progressive node properties", () => {
  test("5.3.1 panel opens with Details section collapsed by default", async ({ page }) => {
    await openCleanApp(page);
    await seedAndOpen(page);
    // Primary fields are visible.
    await expect(page.locator("#f_label")).toBeVisible();
    await expect(page.locator("#f_notes")).toBeVisible();
    await expect(page.locator("#f_shape")).toBeVisible();
    await expect(page.locator("#f_zone")).toBeVisible();
    // Details summary exists and is NOT open.
    const details = page.locator("details.pn-more");
    await expect(details).toHaveCount(1);
    const isOpen = await details.evaluate((el) => (el as HTMLDetailsElement).open);
    expect(isOpen).toBe(false);
    // Secondary fields inside Details are hidden while collapsed (Chromium
    // hides <details> children via native disclosure — they exist in DOM
    // but have zero layout box).
    await expect(page.locator("#f_tags")).not.toBeVisible();
    await expect(page.locator("#f_rationale")).not.toBeVisible();
    await expect(page.locator("#f_conf")).not.toBeVisible();
  });

  test("5.3.2 clicking summary expands Details and reveals the fields", async ({ page }) => {
    await openCleanApp(page);
    await seedAndOpen(page);
    await page.locator("details.pn-more summary").click();
    const isOpen = await page.locator("details.pn-more").evaluate((el) => (el as HTMLDetailsElement).open);
    expect(isOpen).toBe(true);
    await expect(page.locator("#f_tags")).toBeVisible();
    await expect(page.locator("#f_rationale")).toBeVisible();
    await expect(page.locator("#f_conf")).toBeVisible();
  });

  test("5.3.3 Details open state persists across shape-change rebuild", async ({ page }) => {
    await openCleanApp(page);
    await seedAndOpen(page);
    await page.locator("details.pn-more summary").click();
    await expect(page.locator("details.pn-more")).toHaveJSProperty("open", true);
    // Switch shape — op(sel) rebuilds the panel; open state should survive.
    await page.locator("#f_shape").selectOption("project");
    // After rebuild, details still open.
    await expect(page.locator("details.pn-more")).toHaveJSProperty("open", true);
    await expect(page.locator("#f_tags")).toBeVisible();
  });

  test("5.3.4 cp() resets state — reopening panel starts with Details collapsed", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedAndOpen(page);
    // Open Details.
    await page.locator("details.pn-more summary").click();
    await expect(page.locator("details.pn-more")).toHaveJSProperty("open", true);
    // Close panel via cp(), then reopen the same node.
    await page.evaluate(() => (window as any).cp());
    await expect(page.locator("#pn")).toBeHidden();
    await page.evaluate((nid) => {
      const n = (window as any).__E2E.current().nodes.find((x: any) => x.id === nid);
      (window as any).op(n);
    }, id);
    await page.waitForSelector("#pn", { state: "visible" });
    await expect(page.locator("details.pn-more")).toHaveJSProperty("open", false);
    await expect(page.locator("#f_tags")).not.toBeVisible();
  });

  test("5.3.5 autosave still fires for fields inside Details (tags input persists)", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedAndOpen(page);
    await page.locator("details.pn-more summary").click();
    await page.locator("#f_tags").fill("alpha, beta");
    // Wait past the 200ms debounce so sv() writes to IDB.
    await page.waitForTimeout(350);
    const tags = await page.evaluate((nid) => {
      const n = (window as any).__E2E.current().nodes.find((x: any) => x.id === nid);
      return n?.tags ?? null;
    }, id);
    expect(tags).toBe("alpha, beta");
  });
});
