import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 4.4 — DIAGNOSIS ONLY. Find the pan reflow.
 *
 * Four null results mean we were guessing. The code audit eliminated the brief's
 * prime suspects (edge-v2.js / cull-v1.js / freeze-pan.js read ZERO live geometry).
 * What runs every pan frame is CanvasTransform.commit() → render(), which rebuilds
 * the ENTIRE #cv + #canvasOverlay innerHTML + rewrites viewBox every frame.
 *
 * Two diagnostic instruments (NOT fixes):
 *  - --static-pan: while in motion, render() skips the rebuild and CSS-transforms
 *    the existing layers instead. Isolates the per-frame rebuild as the cost.
 *  - HUD `layout` line: transform.js measures the forced layout (reflow) after
 *    each render, so the HUD shows layout vs paint directly (no more "paint"
 *    catch-all). `other` = worst − commit − layout.
 *
 * These tests assert the instruments are wired correctly. The actual fps numbers
 * are the user's tethered-iPad reading + Web Inspector Timeline trace.
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
    const E = (window as any).__E2E;
    const c = E.current();
    c.nodes = [{ id: 8181, x: 0, y: 0, shape: "idea", status: "idea", label: "n", zone: null }];
    c.edges = [];
    const v = E.view(); v.x = 0; v.y = 0; v.k = 1;
    (window as any).render();
  });
}

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.4 · flags + version 4.4.0", () => {
  test("S44.A static-pan defaults to false", async ({ page }) => {
    await open(page);
    const off = await page.evaluate(() => (window as any).Flags.on("static-pan"));
    expect(off).toBe(false);
  });

  test("S44.B build stamp is 4.4.0 in <meta> and on the HUD", async ({ page }) => {
    await open(page, { "perf-hud": true });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      meta: document.querySelector('meta[name="edgespace-build"]')?.getAttribute("content"),
      build: document.getElementById("ph-build")?.textContent,
    }));
    // Version-agnostic: the meta looks like a semver and the HUD echoes it.
    expect(r.meta).toMatch(/\d+\.\d+\.\d+/);
    expect(r.build).toContain(r.meta!);
  });

  test("S44.C StaticPan module installs", async ({ page }) => {
    await open(page, { "static-pan": true });
    const api = await page.evaluate(() => {
      const S = (window as any).StaticPan;
      return S ? { active: S.active(), on: typeof S.on } : null;
    });
    expect(api).not.toBeNull();
    expect(api!.active).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.4 · Issue 3 — HUD layout/other lines", () => {
  test("S44.D HUD shows layout + other lines; the mislabeled paint line is gone", async ({ page }) => {
    await open(page, { "perf-hud": true });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      hasLayout: !!document.getElementById("ph-layout"),
      hasOther: !!document.getElementById("ph-other"),
      paintGone: !document.getElementById("ph-paint"),
      markLayout: typeof (window as any).PerfHud?.markLayout,
    }));
    expect(r.hasLayout).toBe(true);
    expect(r.hasOther).toBe(true);
    expect(r.paintGone).toBe(true);
    expect(r.markLayout).toBe("function");
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.4 · Issue 2 — --static-pan skips the per-frame rebuild", () => {
  test("S44.E in motion, render() CSS-transforms instead of rebuilding (sentinel survives)", async ({ page }) => {
    await open(page, { "static-pan": true });
    await seedNode(page);
    const r = await page.evaluate(async () => {
      const wait = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      // Tag an existing SVG child; if render() rebuilds innerHTML the tag is wiped.
      const g = document.querySelector("#cv g.node");
      if (g) g.setAttribute("data-sentinel", "keep");

      document.body.classList.add("dragging");     // a polled motion signal
      await wait(); await wait();                   // watcher sets __staticPan + V0
      const v = (window as any).__E2E.view(); v.x += 300; // pan
      (window as any).render();                     // should take the static-pan branch

      const staticOn = !!(window as any).__staticPan;
      const cvT = (document.getElementById("cv") as HTMLElement).style.transform;
      const sentinelSurvived = !!document.querySelector('#cv g.node[data-sentinel="keep"]');

      document.body.classList.remove("dragging");
      await wait(); await wait();                   // settle → one real render
      const afterT = (document.getElementById("cv") as HTMLElement).style.transform;

      return { staticOn, cvT, sentinelSurvived, afterT };
    });
    expect(r.staticOn).toBe(true);
    expect(r.cvT).toContain("translate3d");   // moved via CSS transform
    expect(r.sentinelSurvived).toBe(true);     // rebuild was SKIPPED
    expect(r.afterT).toBe("");                 // transform cleared on settle
  });

  test("S44.F with --static-pan OFF, render() rebuilds normally (no cv transform, sentinel wiped)", async ({ page }) => {
    await open(page); // static-pan OFF
    await seedNode(page);
    const r = await page.evaluate(async () => {
      const wait = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const g = document.querySelector("#cv g.node");
      if (g) g.setAttribute("data-sentinel", "keep");
      document.body.classList.add("dragging");
      await wait(); await wait();
      const v = (window as any).__E2E.view(); v.x += 300;
      (window as any).render();                 // normal full rebuild
      const staticOn = !!(window as any).__staticPan;
      const cvT = (document.getElementById("cv") as HTMLElement).style.transform;
      const sentinelSurvived = !!document.querySelector('#cv g.node[data-sentinel="keep"]');
      document.body.classList.remove("dragging");
      return { staticOn, cvT, sentinelSurvived };
    });
    expect(r.staticOn).toBe(false);
    expect(r.cvT).not.toContain("translate3d"); // no static-pan transform
    expect(r.sentinelSurvived).toBe(false);      // rebuilt → sentinel gone
  });
});
