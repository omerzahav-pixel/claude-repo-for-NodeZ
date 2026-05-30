import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 4.1 — Viewport culling (--cull-v1) regression tests.
 *
 * Sprint 4's tile cache was a flat null result on iPad; the real cost is
 * element count — render() mounts ALL nodes/edges/overlays every frame, even
 * the off-screen ones. This sprint culls both heavy layers (SVG outlines/edges
 * + DOM overlays) to viewport + a one-viewport margin, throttled to ~100ms.
 *
 * Playwright can assert the cull-set MATH and the mount/unmount DOM effect; it
 * cannot feel 50 FPS — that's the real-iPad acceptance test (HUD rendered-count
 * drop + smooth pan). These tests guard the mechanism + the rollback path.
 *
 * Issue 1 — perf HUD publishes window.__renderStats (rendered/visible/culled).
 * Issue 3 — CullV1 module math: viewport intersection, margin, hard-exception
 *           keep set, long edge crossing with both endpoints off-screen;
 *           DOM effect: off-screen nodes unmount under --cull-v1, all mount
 *           with the flag OFF (rollback); overlay LoD < 0.5× moves shapes to
 *           the single #cv layer (.node-lod) and emits zero .nslice overlays.
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

/** Replace the current canvas's nodes with a grid of `cols×rows` nodes spaced
 *  `gap` world-units apart, centred on origin. Returns the node id list. */
async function seedGrid(page: Page, cols: number, rows: number, gap: number) {
  return await page.evaluate(({ cols, rows, gap }) => {
    const E = (window as any).__E2E;
    const c = E.current();
    c.nodes = [];
    c.edges = [];
    const ids: number[] = [];
    let id = 1000;
    const ox = -((cols - 1) * gap) / 2, oy = -((rows - 1) * gap) / 2;
    for (let r = 0; r < rows; r++) {
      for (let cc = 0; cc < cols; cc++) {
        id++;
        ids.push(id);
        c.nodes.push({ id, x: ox + cc * gap, y: oy + r * gap, shape: "idea", status: "idea", label: "n" + id, zone: null });
      }
    }
    const v = E.view(); v.x = 0; v.y = 0; v.k = 1;
    (window as any).render();
    return ids;
  }, { cols, rows, gap });
}

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.1 · Issue 3 — flag + module", () => {
  test("S41.A cull-v1 defaults to false (opt-in, rollback intact)", async ({ page }) => {
    await open(page);
    const off = await page.evaluate(() => (window as any).Flags.on("cull-v1"));
    expect(off).toBe(false);
  });

  test("S41.B CullV1 module present with compute/invalidate/snapshot", async ({ page }) => {
    await open(page);
    const api = await page.evaluate(() => {
      const C = (window as any).CullV1;
      return C ? { compute: typeof C.compute, invalidate: typeof C.invalidate, snapshot: typeof C.snapshot, margin: C.MARGIN_VIEWPORTS } : null;
    });
    expect(api).not.toBeNull();
    expect(api!.compute).toBe("function");
    expect(api!.invalidate).toBe("function");
    expect(api!.snapshot).toBe("function");
    expect(api!.margin).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.1 · Issue 3 — cull-set math (pure CullV1.compute)", () => {
  test("S41.C off-screen node is excluded; on-screen node is included", async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => {
      const C = (window as any).CullV1;
      const nodes = [
        { id: 1, x: 0, y: 0 },             // dead centre — visible
        { id: 2, x: 100000, y: 0 },        // far right — way outside even the margin
      ];
      const view = { x: 0, y: 0, k: 1 };
      const res = C.compute(nodes, [], view, 1280, 800, new Set(), false);
      return { has1: res.nodeSet.has(1), has2: res.nodeSet.has(2), margin: res.margin };
    });
    expect(r.has1).toBe(true);
    expect(r.has2).toBe(false);
    expect(r.margin).toContain("vw");
  });

  test("S41.D hard-exception keep set keeps an off-screen node mounted", async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => {
      const C = (window as any).CullV1;
      const nodes = [{ id: 1, x: 0, y: 0 }, { id: 2, x: 100000, y: 0 }];
      const view = { x: 0, y: 0, k: 1 };
      // id 2 is far off-screen, but passed in `keep` (e.g. the selected node).
      const res = C.compute(nodes, [], view, 1280, 800, new Set([2]), false);
      return { has2: res.nodeSet.has(2) };
    });
    expect(r.has2).toBe(true);
  });

  test("S41.E long edge crossing the viewport stays in-set with BOTH endpoints off-screen", async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => {
      const C = (window as any).CullV1;
      // Two nodes 6 viewport-widths apart on opposite sides; the edge between
      // them crosses the centre screen but neither endpoint is anywhere near it.
      const W = 1280;
      const nodes = [{ id: 1, x: -3 * W, y: 0 }, { id: 2, x: 3 * W, y: 0 }];
      const edges = [{ id: 9, from: 1, to: 2, type: "feeds" }];
      const view = { x: 0, y: 0, k: 1 };
      const res = C.compute(nodes, edges, view, W, 800, new Set(), false);
      return { nA: res.nodeSet.has(1), nB: res.nodeSet.has(2), edge: res.edgeSet.has(9) };
    });
    // Neither endpoint mounts as a node…
    expect(r.nA).toBe(false);
    expect(r.nB).toBe(false);
    // …but the crossing edge must still be drawn.
    expect(r.edge).toBe(true);
  });

  test("S41.F edge with a visible endpoint is in-set even if the other endpoint is far away", async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => {
      const C = (window as any).CullV1;
      const nodes = [{ id: 1, x: 0, y: 0 }, { id: 2, x: 100000, y: 0 }];
      const edges = [{ id: 9, from: 1, to: 2, type: "feeds" }];
      const res = C.compute(nodes, edges, { x: 0, y: 0, k: 1 }, 1280, 800, new Set(), false);
      return { edge: res.edgeSet.has(9), n1: res.nodeSet.has(1), n2: res.nodeSet.has(2) };
    });
    expect(r.n1).toBe(true);
    expect(r.n2).toBe(false);
    expect(r.edge).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.1 · Issue 3 — DOM mount/unmount", () => {
  test("S41.G with --cull-v1 ON a spread-out canvas mounts FEWER g.node than it has", async ({ page }) => {
    await open(page, { "cull-v1": true });
    const ids = await seedGrid(page, 9, 5, 1500); // 45 nodes, 12000×6000 world span
    const counts = await page.evaluate(() => ({
      total: (window as any).__E2E.current().nodes.length,
      mounted: document.querySelectorAll("#cv g.node").length,
    }));
    expect(counts.total).toBe(ids.length);
    expect(counts.total).toBe(45);
    // Centre cluster mounts; the far corners do not.
    expect(counts.mounted).toBeLessThan(counts.total);
    expect(counts.mounted).toBeGreaterThan(0);
  });

  test("S41.H with --cull-v1 OFF the same canvas mounts EVERY node (rollback parity)", async ({ page }) => {
    await open(page); // cull-v1 default OFF
    const ids = await seedGrid(page, 9, 5, 1500);
    const counts = await page.evaluate(() => ({
      total: (window as any).__E2E.current().nodes.length,
      mounted: document.querySelectorAll("#cv g.node").length,
    }));
    // Legacy path: rbush only culls at >=100 nodes, and 45 < 100, so all mount.
    expect(counts.mounted).toBe(counts.total);
    expect(counts.mounted).toBe(ids.length);
  });

  test("S41.I a known centre node mounts and a known far node unmounts under cull", async ({ page }) => {
    await open(page, { "cull-v1": true });
    await page.evaluate(() => {
      const E = (window as any).__E2E;
      const c = E.current();
      c.nodes = [
        { id: 5001, x: 0, y: 0, shape: "idea", status: "idea", label: "centre", zone: null },
        { id: 5002, x: 50000, y: 0, shape: "idea", status: "idea", label: "far", zone: null },
      ];
      c.edges = [];
      const v = E.view(); v.x = 0; v.y = 0; v.k = 1;
      (window as any).render();
    });
    const r = await page.evaluate(() => ({
      centre: !!document.querySelector('#cv g.node[data-id="5001"]'),
      far: !!document.querySelector('#cv g.node[data-id="5002"]'),
    }));
    expect(r.centre).toBe(true);
    expect(r.far).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.1 · Issue 3 — overlay level-of-detail (< 0.5× zoom)", () => {
  test("S41.J below 0.5× zoom shapes move to #cv (.node-lod), zero .nslice overlays", async ({ page }) => {
    await open(page, { "cull-v1": true });
    await page.evaluate(() => {
      const E = (window as any).__E2E;
      const c = E.current();
      c.nodes = [];
      for (let i = 0; i < 10; i++) c.nodes.push({ id: 6000 + i, x: (i - 5) * 30, y: 0, shape: "idea", status: "idea", label: "n", zone: null });
      c.edges = [];
      const v = E.view(); v.x = 0; v.y = 0; v.k = 0.3; // well below the 0.5 LoD line
      (window as any).render();
    });
    const low = await page.evaluate(() => ({
      lod: document.querySelectorAll("#cv g.node-lod").length,
      slices: document.querySelectorAll("#canvasOverlay .nslice").length,
    }));
    expect(low.lod).toBeGreaterThan(0);
    expect(low.slices).toBe(0);

    // …and at >= 0.5× the overlay path is restored (slices present, no .node-lod).
    await page.evaluate(() => {
      const v = (window as any).__E2E.view(); v.k = 1.0;
      (window as any).render();
    });
    const high = await page.evaluate(() => ({
      lod: document.querySelectorAll("#cv g.node-lod").length,
      slices: document.querySelectorAll("#canvasOverlay .nslice").length,
    }));
    expect(high.slices).toBeGreaterThan(0);
    expect(high.lod).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.1 · Issue 1 — perf HUD render stats", () => {
  test("S41.K render() publishes window.__renderStats when stats are on; rendered ≥ visible", async ({ page }) => {
    await open(page, { "cull-v1": true });
    const stats = await page.evaluate(() => {
      (window as any).__RENDER_STATS_ON = true; // the HUD sets this on install
      const E = (window as any).__E2E;
      const c = E.current();
      c.nodes = [];
      for (let i = 0; i < 40; i++) c.nodes.push({ id: 7000 + i, x: (i % 8) * 1500 - 5000, y: Math.floor(i / 8) * 1500 - 3000, shape: "idea", status: "idea", label: "n", zone: null });
      c.edges = [];
      const v = E.view(); v.x = 0; v.y = 0; v.k = 1;
      (window as any).render();
      return (window as any).__renderStats;
    });
    expect(stats).toBeTruthy();
    expect(stats.rendered).toBeTruthy();
    expect(stats.visible).toBeTruthy();
    expect(typeof stats.culled).toBe("string");
    // The whole point: visible ≤ rendered ≤ total, and culling is reflected.
    expect(stats.rendered.nodes).toBeGreaterThanOrEqual(stats.visible.nodes);
    expect(stats.culled.indexOf("ON")).toBe(0);
  });

  test("S41.L culled label reads OFF when --cull-v1 is OFF", async ({ page }) => {
    await open(page); // cull-v1 OFF
    const label = await page.evaluate(() => {
      (window as any).__RENDER_STATS_ON = true;
      (window as any).render();
      return (window as any).__renderStats?.culled;
    });
    expect(label).toBe("OFF");
  });
});
