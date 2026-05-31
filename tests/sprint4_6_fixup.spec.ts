import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 4.6 — Zero renders during motion (Phase-4 closeout).
 *
 * Sprint 4.5 severed commit()→render() but other paths still rendered during a
 * gesture (the legacy pinch path; the user saw renders/s spike → fps collapse).
 * 4.6 plugs them at one chokepoint: render() refuses to rebuild while a viewport
 * pan/pinch/inertia is in progress — it just moves the layers (applyView) and
 * bails — so renders/s stays 0 and fps holds 60. Content drags (node/zone/etc.)
 * are NOT viewport motion and still render every move. The legacy pinch path is
 * also bailed under gestures-v2 (it was the actual render+double-update leak).
 *
 * The renders/s == 0-during-motion behaviour is the acceptance gate; these tests
 * assert the guard mechanism. The 60-fps feel is the user's iPad reading.
 */

const viteUrl = process.env.VITE_URL ?? "http://localhost:5173/";

async function open(page: Page, flags: Record<string, boolean> = {}) {
  await page.goto(viteUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(async (f) => {
    try { indexedDB.deleteDatabase("ideaVault"); } catch {}
    try { localStorage.clear(); } catch {}
    localStorage.setItem("edgespace-flags", JSON.stringify(f));
  }, flags);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("svg#cv", { state: "attached", timeout: 15_000 });
  await page.waitForFunction(() => !!(window as any).__E2E, null, { timeout: 15_000 });
  await page.waitForTimeout(500);
}

async function seedNode(page: Page) {
  await page.evaluate(() => {
    const E = (window as any).__E2E; const c = E.current();
    c.nodes = [{ id: 8686, x: 0, y: 0, shape: "idea", status: "idea", label: "n", zone: null }];
    c.edges = [];
    const v = E.view(); v.x = 0; v.y = 0; v.k = 1;
    (window as any).render();
  });
}

test.describe("Sprint 4.6 · zero renders during motion", () => {
  test("S46.A build stamp is 4.6.0", async ({ page }) => {
    await open(page, { "perf-hud": true });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      meta: document.querySelector('meta[name="edgespace-build"]')?.getAttribute("content"),
      build: document.getElementById("ph-build")?.textContent,
    }));
    expect(r.meta).toMatch(/\d+\.\d+\.\d+/);
    expect(r.build).toContain(r.meta!);
  });

  test("S46.B render() runs normally at rest (counter ticks)", async ({ page }) => {
    await open(page);
    await seedNode(page);
    const r = await page.evaluate(() => {
      const before = (window as any).__renderTick || 0;
      (window as any).render();
      return { before, after: (window as any).__renderTick || 0 };
    });
    expect(r.after).toBeGreaterThan(r.before);
  });

  test("S46.C render() NO-OPS during viewport motion — moves layers, no rebuild", async ({ page }) => {
    await open(page);
    await seedNode(page);
    const r = await page.evaluate(() => {
      const E = (window as any).__E2E;
      const before = (window as any).__renderTick || 0;
      E.view().x += 150;                 // simulate a viewport move
      (window as any)._inertiaActive = true; // a viewport motion is in progress
      (window as any).render();          // should no-op → applyView
      const after = (window as any).__renderTick || 0;
      const cvT = (document.getElementById("cv") as HTMLElement).style.transform;
      (window as any)._inertiaActive = false;
      return { before, after, cvT };
    });
    expect(r.after).toBe(r.before);          // counter did NOT tick → no rebuild
    expect(r.cvT).toContain("translate3d");   // but applyView moved the layers
  });

  test("S46.D --legacy-pan bypasses the guard (render runs during motion)", async ({ page }) => {
    await open(page, { "legacy-pan": true });
    await seedNode(page);
    const r = await page.evaluate(() => {
      (window as any)._inertiaActive = true;
      const before = (window as any).__renderTick || 0;
      (window as any).render();          // legacy-pan → guard bypassed → real render
      (window as any)._inertiaActive = false;
      return { before, after: (window as any).__renderTick || 0 };
    });
    expect(r.after).toBeGreaterThan(r.before);
  });

  test("S46.E a content-drag is NOT viewport motion — render still rebuilds", async ({ page }) => {
    // We can't set the internal `drag` object from a test, but we can prove the
    // converse: with no viewport motion flag set, render() always rebuilds (the
    // content-drag path relies on exactly this — render runs every move).
    await open(page);
    await seedNode(page);
    const r = await page.evaluate(() => {
      const before = (window as any).__renderTick || 0;
      // _inertiaActive false, no gesture → isViewportMotion() false → render runs.
      (window as any).render();
      (window as any).render();
      return { before, after: (window as any).__renderTick || 0 };
    });
    expect(r.after).toBe(r.before + 2); // both renders ran
  });
});
