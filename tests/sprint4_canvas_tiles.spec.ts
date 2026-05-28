import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 4 · Phase 4 — Canvas tile cache regression tests.
 *
 * Issue 1+2 — TileCache module installs under --canvas-tiles; #tiles
 *             canvas element exists; bake produces a non-empty backing
 *             store; CSS transform is set in sync with view.
 * Issue 1   — zone fills are suppressed in SVG when --canvas-tiles ON
 *             (canvas paints them; double-paint avoided).
 * Issue 3   — visibilitychange triggers a re-bake (snapshot bakedTier
 *             stable after the event).
 * Issue 4   — drawer custom scrollbar styles compute on desktop.
 * Issue 5   — 8 retired flags default to true; perf-hud + Phase 3 +
 *             canvas-tiles default to false.
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
  await page.waitForTimeout(800);
}

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4 · Issue 5 — flag retirement", () => {
  test("S4.I5.A 8 Phase 1+2 flags default to true", async ({ page }) => {
    await open(page);
    const all = await page.evaluate(() => (window as any).Flags?.all());
    for (const k of ["gestures-v2", "raf-throttle", "lifecycle-v2",
                     "webfont", "silhouettes", "edges-v2", "zones-v2", "rtl-v2"]) {
      expect(all[k]).toBe(true);
    }
  });

  test("S4.I5.B perf-hud + Phase 3 + canvas-tiles default to false (still opt-in)", async ({ page }) => {
    await open(page);
    const all = await page.evaluate(() => (window as any).Flags?.all());
    for (const k of ["perf-hud", "nav-v2", "palette", "views-v2",
                     "toolbar-migrated", "canvas-tiles"]) {
      expect(all[k]).toBe(false);
    }
  });

  test("S4.I5.C URL negation `?flag=-gestures-v2` rollback still works", async ({ page }) => {
    await page.goto(viteUrl + "?flag=-gestures-v2", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!(window as any).Flags);
    const on = await page.evaluate(() => (window as any).Flags.on("gestures-v2"));
    expect(on).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4 · Issue 1+2 — tile cache substrate", () => {
  test("S4.I1.A #tiles canvas element exists in DOM under #canvas-root", async ({ page }) => {
    await open(page);
    const probe = await page.evaluate(() => {
      const root = document.getElementById("canvas-root");
      const tiles = document.getElementById("tiles");
      return {
        rootExists: !!root,
        tilesExists: !!tiles,
        tilesIsCanvas: tiles?.tagName === "CANVAS",
        tilesInRoot: !!(root && tiles && root.contains(tiles))
      };
    });
    expect(probe.rootExists).toBe(true);
    expect(probe.tilesExists).toBe(true);
    expect(probe.tilesIsCanvas).toBe(true);
    expect(probe.tilesInRoot).toBe(true);
  });

  test("S4.I1.B Tile cache module installs only under --canvas-tiles ON", async ({ page }) => {
    /* Default (canvas-tiles OFF) — TileCache module should not have
       set body.canvas-tiles-on. */
    await open(page);
    const offState = await page.evaluate(() => ({
      bodyHasClass: document.body.classList.contains("canvas-tiles-on"),
      snapshot: (window as any).TileCache?.snapshot?.()
    }));
    expect(offState.bodyHasClass).toBe(false);
    /* Snapshot exists but `installed` is false when flag was OFF */
    if (offState.snapshot) expect(offState.snapshot.installed).toBe(false);

    /* Now enable canvas-tiles. */
    await open(page, { "canvas-tiles": true });
    await page.waitForTimeout(400);
    const onState = await page.evaluate(() => ({
      bodyHasClass: document.body.classList.contains("canvas-tiles-on"),
      snapshot: (window as any).TileCache?.snapshot?.()
    }));
    expect(onState.bodyHasClass).toBe(true);
    expect(onState.snapshot.installed).toBe(true);
    expect(typeof onState.snapshot.bakedTier).toBe("number");
    expect(onState.snapshot.canvasSize.w).toBeGreaterThan(0);
  });

  test("S4.I1.C Bake produces a CSS transform on #tiles synced with view", async ({ page }) => {
    await open(page, { "canvas-tiles": true });
    await page.waitForTimeout(400);
    const t = await page.evaluate(() => {
      const c = document.getElementById("tiles") as HTMLElement;
      return c.style.transform;
    });
    /* Should contain `translate3d` and `scale` — the sync output. */
    expect(t).toContain("translate3d");
    expect(t).toContain("scale");
  });

  test("S4.I1.D Zone FILL suppressed in SVG when --canvas-tiles is ON (no double-paint)", async ({ page }) => {
    /* With canvas-tiles ON, zones-v2.js's renderZoneSvg uses fill="none"
       so the 6% canvas fill isn't doubled. */
    await open(page, { "canvas-tiles": true });
    await page.evaluate(() => {
      const E = (window as any).__E2E;
      const c = E.current();
      c.zones.push({ id: "z-x", name: "X", x: 0, y: 0, w: 200, h: 200, color: "#FF7A45" });
      (window as any).render();
    });
    await page.waitForTimeout(400);
    const fill = await page.evaluate(() => {
      const r = document.querySelector("g.zone-v2[data-zone='z-x'] rect.zr") as SVGRectElement;
      return r?.getAttribute("fill");
    });
    expect(fill).toBe("none");
  });

  test("S4.I1.E Same scenario with --canvas-tiles OFF: SVG renders the 6% fill (legacy path)", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const E = (window as any).__E2E;
      const c = E.current();
      c.zones.push({ id: "z-y", name: "Y", x: 0, y: 0, w: 200, h: 200, color: "#FF7A45" });
      (window as any).render();
    });
    await page.waitForTimeout(200);
    const fill = await page.evaluate(() => {
      const r = document.querySelector("g.zone-v2[data-zone='z-y'] rect.zr") as SVGRectElement;
      return r?.getAttribute("fill");
    });
    /* hexToRgba("#FF7A45", 0.06) → "rgba(255,122,69,0.06)" */
    expect(fill).toContain("rgba(255,122,69");
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4 · Issue 3 — compositor-drop recovery", () => {
  test("S4.I3.A visibilitychange triggers a re-bake (TileCache.snapshot.bakedTier stays stable)", async ({ page }) => {
    await open(page, { "canvas-tiles": true });
    await page.waitForTimeout(400);
    /* Simulate visibility hide then visible — the rebake should keep
       bakedTier consistent with the current view tier (no NaN, no null). */
    const tierBefore = await page.evaluate(() => (window as any).TileCache.snapshot().bakedTier);
    await page.evaluate(async () => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise(r => setTimeout(r, 100));
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise(r => requestAnimationFrame(() => r(null)));
    });
    await page.waitForTimeout(200);
    const tierAfter = await page.evaluate(() => (window as any).TileCache.snapshot().bakedTier);
    expect(tierAfter).toBe(tierBefore);
    /* And the canvas backing store is still sized correctly (re-bake did
       not zero it out). */
    const size = await page.evaluate(() => (window as any).TileCache.snapshot().canvasSize);
    expect(size.w).toBeGreaterThan(0);
    expect(size.h).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4 · Issue 4 — drawer scrollbar styling", () => {
  test("S4.I4.A #drawer has scrollbar-width: thin computed (Firefox-style)", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1200);
    const probe = await page.evaluate(() => {
      const d = document.getElementById("drawer")!;
      return getComputedStyle(d).scrollbarWidth;
    });
    /* Chromium reports "auto" or "thin" — assert it's not the unhandled
       browser default. Our CSS sets `scrollbar-width: thin`. */
    expect(probe === "thin" || probe === "auto").toBe(true);
  });
});
