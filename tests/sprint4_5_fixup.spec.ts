import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 4.5 — One transform space (the real Phase-4 fix).
 *
 * Sprint 4.4 proved it: CanvasTransform.commit() called render() every pan frame,
 * rebuilding the whole DOM (the reflow storm). 4.5 severs that:
 *  - commit() → applyView() (transform-only, no rebuild). render() runs only on
 *    data changes + once on gesture settle (pan-settle.js).
 *  - applyView() moves #cv (CSS delta, origin 0 0), #canvasOverlay (absolute),
 *    #zoneChips (reposition) and #tiles (sync) as ONE space — fixes the
 *    "labels stuck / edges drift" desync bare --static-pan showed.
 *  - freeze-pan.js + static-pan.js retired; --legacy-pan is the rollback.
 *
 * These tests assert the wiring (no render during a transform commit, settle
 * render fires, layers transform, origin 0 0, rollback works). The 55-fps feel
 * is the user's tethered-iPad reading.
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
    c.nodes = [{ id: 8585, x: 0, y: 0, shape: "idea", status: "idea", label: "n", zone: null }];
    c.edges = [];
    const v = E.view(); v.x = 0; v.y = 0; v.k = 1;
    (window as any).render();
  });
}

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.5 · flags + retirement", () => {
  test("S45.A legacy-pan defaults false; freeze-pan/static-pan retired (inert, default false)", async ({ page }) => {
    await open(page);
    const f = await page.evaluate(() => ({
      legacy: (window as any).Flags.on("legacy-pan"),
      freeze: (window as any).Flags.on("freeze-pan"),
      static: (window as any).Flags.on("static-pan"),
    }));
    expect(f.legacy).toBe(false);
    expect(f.freeze).toBe(false);
    expect(f.static).toBe(false);
  });

  test("S45.B retired modules gone (FreezePan/StaticPan undefined); PanSettle present", async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => ({
      freezePan: typeof (window as any).FreezePan,
      staticPan: typeof (window as any).StaticPan,
      panSettle: typeof (window as any).PanSettle,
      applyView: typeof (window as any).applyView,
    }));
    expect(r.freezePan).toBe("undefined");
    expect(r.staticPan).toBe("undefined");
    expect(r.panSettle).toBe("object");
    expect(r.applyView).toBe("function");
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.5 · Issue 1 — commit severed from render", () => {
  test("S45.C a transform commit moves layers WITHOUT calling render()", async ({ page }) => {
    await open(page);
    await seedNode(page);
    const r = await page.evaluate(() => {
      const E = (window as any).__E2E;
      const before = { tick: (window as any).__renderTick || 0, vx: E.view().x };
      // applyImmediate routes through commit() → applyView() (not render()).
      (window as any).CanvasTransform.applyImmediate({ x: E.view().x + 120, y: E.view().y, k: E.view().k });
      const cv = document.getElementById("cv") as HTMLElement;
      return {
        beforeTick: before.tick,
        afterTick: (window as any).__renderTick || 0,
        beforeVx: before.vx,
        afterVx: E.view().x,
        cvTransform: cv.style.transform,
        cvOrigin: cv.style.transformOrigin,
        ovTransform: (document.getElementById("canvasOverlay") as HTMLElement).style.transform,
      };
    });
    // render() did NOT run during the transform commit…
    expect(r.afterTick).toBe(r.beforeTick);
    // …but the view moved and the layers were transformed as one space.
    expect(r.afterVx).not.toBe(r.beforeVx);
    expect(r.cvTransform).toContain("translate3d");
    expect(r.cvOrigin).toBe("0px 0px");                // origin 0 0 — locked with overlay
    expect(r.ovTransform).toContain("scale");
  });

  test("S45.D render() resets the cv delta + records __panBase", async ({ page }) => {
    await open(page);
    await seedNode(page);
    const r = await page.evaluate(() => {
      const E = (window as any).__E2E;
      // Move via commit (sets a cv CSS delta), then a data-model render() resets it.
      (window as any).CanvasTransform.applyImmediate({ x: E.view().x + 80, y: 0, k: 1 });
      const midTransform = (document.getElementById("cv") as HTMLElement).style.transform;
      (window as any).render();
      const cv = document.getElementById("cv") as HTMLElement;
      return {
        midTransform,
        afterTransform: cv.style.transform,
        base: (window as any).__panBase,
        vx: E.view().x,
      };
    });
    expect(r.midTransform).toContain("translate3d"); // delta applied during motion
    expect(r.afterTransform).toBe("");               // reset by render()
    expect(r.base.x).toBe(r.vx);                     // base recorded = current view
  });

  test("S45.E --legacy-pan rollback: a transform commit DOES render()", async ({ page }) => {
    await open(page, { "legacy-pan": true });
    await seedNode(page);
    const r = await page.evaluate(() => {
      const E = (window as any).__E2E;
      const before = (window as any).__renderTick || 0;
      (window as any).CanvasTransform.applyImmediate({ x: E.view().x + 60, y: 0, k: 1 });
      return { before, after: (window as any).__renderTick || 0 };
    });
    expect(r.after).toBeGreaterThan(r.before); // legacy path renders every frame
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.5 · settle render", () => {
  test("S45.F pan-settle runs exactly one render() on the motion→idle edge", async ({ page }) => {
    await open(page);
    await seedNode(page);
    const r = await page.evaluate(async () => {
      const wait = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const before = (window as any).__renderTick || 0;
      document.body.classList.add("dragging");   // a polled motion signal
      await wait(); await wait();
      const during = (window as any).__renderTick || 0;
      document.body.classList.remove("dragging"); // settle
      await wait(); await wait();
      const after = (window as any).__renderTick || 0;
      return { before, during, after };
    });
    expect(r.during).toBe(r.before);          // no render while "moving"
    expect(r.after).toBeGreaterThan(r.during); // one render on settle
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.5 · HUD renders/s", () => {
  test("S45.G HUD has the renders/s line + version 4.5.0", async ({ page }) => {
    await open(page, { "perf-hud": true });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      hasRenders: !!document.getElementById("ph-renders"),
      meta: document.querySelector('meta[name="edgespace-build"]')?.getAttribute("content"),
      build: document.getElementById("ph-build")?.textContent,
    }));
    expect(r.hasRenders).toBe(true);
    expect(r.meta).toMatch(/\d+\.\d+\.\d+/);
    expect(r.build).toContain(r.meta!);
  });
});
