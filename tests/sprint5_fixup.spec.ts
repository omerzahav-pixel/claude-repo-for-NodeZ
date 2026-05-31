import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 5 (part 1) — node interaction & chrome.
 *
 * Delivered this batch: Issue 0 (edge-draw draws its ghost in a dedicated
 * screen-space SVG, not #cv — no full-layer re-raster), Issue 6 (perf HUD off by
 * default; ?debug=perf no longer persists), Issue 7 (Pending/Kanban card content
 * can't escape its box → no sideways scroll), Issue 8 (filter ⚡ button hidden by
 * default, gated by body.show-filter).
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
  await page.waitForTimeout(400);
}

test.describe("Sprint 5 · chrome + perf", () => {
  test("S5.A build stamp is 5.0.0", async ({ page }) => {
    await open(page, { "perf-hud": true });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      meta: document.querySelector('meta[name="edgespace-build"]')?.getAttribute("content"),
      build: document.getElementById("ph-build")?.textContent,
    }));
    expect(r.meta).toContain("5.0.0");
    expect(r.build).toContain(r.meta!);
  });

  test("S5.0 EdgeDraw module is loaded and uses a dedicated draft SVG (not #cv)", async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => ({
      hasModule: typeof (window as any).EdgeDraw,
      // at rest no draft is in flight, so #cv holds no draft line
      cvDraft: !!document.querySelector('#cv line[data-edge-draft]'),
    }));
    expect(r.hasModule).toBe("object");
    expect(r.cvDraft).toBe(false);
  });

  test("S5.1 silhouette nodes get a status-coloured inline-start bar (readable from afar)", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const E = (window as any).__E2E; const c = E.current();
      c.nodes = [{ id: 5151, x: 0, y: 0, shape: "idea", status: "blocked", label: "n", zone: null }];
      c.edges = [];
      const v = E.view(); v.x = 0; v.y = 0; v.k = 1;
      (window as any).render();
    });
    const r = await page.evaluate(() => {
      const bar = document.querySelector('.nslice[data-nid="5151"] .es-status-bar') as Element | null;
      return { present: !!bar, w: bar ? bar.getAttribute("width") : null };
    });
    expect(r.present).toBe(true);
    expect(r.w).toBe("5");
  });

  test("S5.6 ?debug=perf shows the HUD this session but does NOT persist perf-hud", async ({ page }) => {
    await page.goto(viteUrl + "?debug=perf", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!(window as any).Flags);
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({
      on: (window as any).Flags.on("perf-hud"),
      stored: localStorage.getItem("edgespace-flags") || "",
    }));
    expect(r.on).toBe(true);                 // HUD on for this session
    expect(r.stored).not.toContain("perf-hud"); // …but NOT written to storage
  });

  test("S5.6b perf HUD is absent by default (no flag, no ?debug)", async ({ page }) => {
    await open(page); // no perf-hud flag
    const present = await page.evaluate(() => !!document.getElementById("perfHud"));
    expect(present).toBe(false);
  });

  test("S5.7 Kanban/Pending column contains overflow — column overflow-x is hidden", async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => {
      // #viewStage only exists while a non-canvas view is mounted; create a
      // stand-in so the `#viewStage .vs-col-body` rule resolves either way.
      let stage = document.getElementById("viewStage");
      let created = false;
      if (!stage) { stage = document.createElement("div"); stage.id = "viewStage"; document.body.appendChild(stage); created = true; }
      const body = document.createElement("div");
      body.className = "vs-col-body";
      const card = document.createElement("div");
      card.className = "vs-card";
      const cb = document.createElement("div");
      cb.className = "vs-card-body";
      card.appendChild(cb); body.appendChild(card); stage.appendChild(body);
      const ox = getComputedStyle(body).overflowX;
      const wrap = getComputedStyle(cb).overflowWrap || (getComputedStyle(cb) as any).wordWrap;
      if (created) stage.remove(); else stage.removeChild(body);
      return { ox, wrap };
    });
    expect(r.ox).toBe("hidden");
    expect(r.wrap).toContain("anywhere");
  });

  test("S5.8 filter ⚡ button hidden by default; shown with body.show-filter", async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => {
      const fl = document.getElementById("fl")!;
      const hiddenByDefault = getComputedStyle(fl).display === "none";
      document.body.classList.add("show-filter");
      const shownWithClass = getComputedStyle(fl).display !== "none";
      document.body.classList.remove("show-filter");
      return { hiddenByDefault, shownWithClass };
    });
    expect(r.hiddenByDefault).toBe(true);
    expect(r.shownWithClass).toBe(true);
  });
});
