import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 5 P2 · Auto-fit + smart placement + empty states.
 *
 * Three bundled polish items:
 *   1. Empty-state overlay — visible on a truly blank canvas, hides once
 *      the first node or zone is added.
 *   2. Smart placement — addC() uses findFreeSpot() to avoid stacking
 *      nodes when the user taps "+ Add" multiple times.
 *   3. Auto-fit after large paste-patch — zF() fires when a patch adds
 *      >= 10 nodes so the user sees all imported content immediately.
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

test.describe("Phase 5 P2 · Auto-fit + smart placement + empty states", () => {

  // ── Empty state ──────────────────────────────────────────────────────

  test("5P2.ES1 empty-state overlay is visible on a blank canvas", async ({ page }) => {
    await openCleanApp(page);
    // Clear to guarantee empty
    await page.evaluate(() => { const c = (window as any).__E2E.current(); c.nodes = []; c.edges = []; c.zones = []; (window as any).render(); });
    await page.waitForTimeout(200);
    const visible = await page.evaluate(() =>
      document.getElementById("emptyState")?.classList.contains("on")
    );
    expect(visible).toBe(true);
  });

  test("5P2.ES2 empty-state CTA button calls addC and creates a node", async ({ page }) => {
    await openCleanApp(page);
    await page.evaluate(() => { const c = (window as any).__E2E.current(); c.nodes = []; c.edges = []; c.zones = []; (window as any).render(); });
    await page.waitForTimeout(200);
    await page.click("#es-add");
    await page.waitForTimeout(300);
    const count = await page.evaluate(() => (window as any).__E2E.current().nodes.length);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("5P2.ES3 empty-state hides after first node is added", async ({ page }) => {
    await openCleanApp(page);
    await page.evaluate(() => { const c = (window as any).__E2E.current(); c.nodes = []; c.edges = []; c.zones = []; (window as any).render(); });
    await page.waitForTimeout(200);
    // Add a node via code
    await page.evaluate(() => { (window as any).addC(); });
    await page.waitForTimeout(200);
    const visible = await page.evaluate(() =>
      document.getElementById("emptyState")?.classList.contains("on")
    );
    expect(visible).toBe(false);
  });

  test("5P2.ES4 empty-state i18n: Hebrew toggle translates title", async ({ page }) => {
    await openCleanApp(page);
    await page.evaluate(() => { const c = (window as any).__E2E.current(); c.nodes = []; c.edges = []; c.zones = []; (window as any).render(); });
    await page.waitForTimeout(200);
    await page.evaluate(() => { (window as any).toggleHebrew(); });
    await page.waitForTimeout(200);
    const title = await page.evaluate(() =>
      document.getElementById("es-title")?.textContent
    );
    expect(title).toContain("ריק");
  });

  // ── Smart placement ──────────────────────────────────────────────────

  test("5P2.SP1 two consecutive addC calls produce non-overlapping nodes", async ({ page }) => {
    await openCleanApp(page);
    await page.evaluate(() => { const c = (window as any).__E2E.current(); c.nodes = []; c.edges = []; c.zones = []; (window as any).render(); });
    await page.waitForTimeout(200);
    await page.evaluate(() => { (window as any).addC(); (window as any).addC(); });
    await page.waitForTimeout(200);
    const nodes = await page.evaluate(() => (window as any).__E2E.current().nodes);
    expect(nodes.length).toBe(2);
    const dx = Math.abs(nodes[0].x - nodes[1].x);
    const dy = Math.abs(nodes[0].y - nodes[1].y);
    // At least one axis must differ by >= 120 (the SPACING constant)
    expect(Math.max(dx, dy)).toBeGreaterThanOrEqual(119);
  });

  test("5P2.SP2 findFreeSpot returns center when canvas is empty", async ({ page }) => {
    await openCleanApp(page);
    await page.evaluate(() => { const c = (window as any).__E2E.current(); c.nodes = []; c.edges = []; c.zones = []; (window as any).render(); });
    await page.waitForTimeout(200);
    const spot = await page.evaluate(() => (window as any).findFreeSpot(500, 300));
    expect(spot.x).toBe(500);
    expect(spot.y).toBe(300);
  });

  // ── Auto-fit after large patch ───────────────────────────────────────

  test("5P2.AF1 auto-fit fires after applying a patch with >= 10 nodes", async ({ page }) => {
    await openCleanApp(page);
    await page.evaluate(() => { const c = (window as any).__E2E.current(); c.nodes = []; c.edges = []; c.zones = []; (window as any).render(); });
    await page.waitForTimeout(200);
    // Record view before
    const viewBefore = await page.evaluate(() => ({ ...((window as any).__E2E.view()) }));
    // Build a 12-node patch
    const nodes = Array.from({ length: 12 }, (_, i) => ({
      id: 9000 + i, label: `N${i}`, notes: "", tags: "", rationale: "",
      shape: "idea", status: "idea", url: "", docUrl: "", originId: null,
      childCanvas: null, confidence: null, latex: "", color: null,
      compact: false, x: 200 * i, y: 100 * i, zone: "zone1",
      created: "2026-04-16"
    }));
    const patch = JSON.stringify({
      canvasId: "vault", useCurrentCanvas: true,
      zones: [{ id: "zone1", name: "Test", x: 0, y: 0, w: 3000, h: 2000, color: "#444", locked: false }],
      nodes
    });
    // Show patch modal and apply
    await page.evaluate(() => { (window as any).showPatch(); });
    await page.waitForTimeout(200);
    await page.evaluate((p) => {
      (document.getElementById("pt") as HTMLTextAreaElement).value = p;
    }, patch);
    await page.evaluate(() => { (window as any).applyPatch(); });
    await page.waitForTimeout(500);
    // View should have changed (zF re-centers)
    const viewAfter = await page.evaluate(() => ({ ...((window as any).__E2E.view()) }));
    const changed = viewAfter.x !== viewBefore.x || viewAfter.y !== viewBefore.y || viewAfter.k !== viewBefore.k;
    expect(changed).toBe(true);
  });
});
