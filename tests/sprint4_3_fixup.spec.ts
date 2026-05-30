import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 4.3 — Freeze-frame pan (Phase-4 closeout).
 *
 * Three null results (tile cache, culling, no-fx) + the HUD's commit-vs-worst
 * gap proved the bottleneck is PAINT: iOS re-rasters the vector layer every
 * transform frame, and CanvasTransform calls render() every pan frame. The fix:
 * render simple state-coloured circles WHILE in motion (cheap paint), rich
 * silhouettes at rest.
 *
 * Issue 0 — visible build stamp (meta + HUD `build` line).
 * Issue 1 — freshness pulse animation removed (no perpetual animation).
 * Issue 2 — --simple-nodes: circle + state colour, no silhouette/halo.
 * freeze-pan — --freeze-pan: simple during motion (window.__inMotion), rich at rest.
 *
 * The `r="26"` simple circle is unique to the simple-node branch, so its
 * presence/absence in a node's <svg.nshape> cleanly distinguishes simple vs rich.
 * Playwright asserts the wiring; the 50-fps win is the user's iPad measurement.
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

/** Seed one fresh 'project' node (a star silhouette when rich) at origin. */
async function seedProject(page: Page) {
  await page.evaluate(() => {
    const E = (window as any).__E2E;
    const c = E.current();
    c.nodes = [{ id: 7777, x: 0, y: 0, shape: "project", status: "blocked", label: "P", zone: null,
                 created: new Date().toISOString().slice(0, 10), modified: new Date().toISOString() }];
    c.edges = [];
    const v = E.view(); v.x = 0; v.y = 0; v.k = 1;
    (window as any).render();
  });
}

/** Read the inner SVG markup of node 7777's shape group. */
async function nshapeHtml(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const el = document.querySelector('.nslice[data-nid="7777"] .nshape') as Element | null;
    return el ? el.innerHTML : "NONE";
  });
}

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.3 · flags + Issue 0 version stamp", () => {
  test("S43.A simple-nodes and freeze-pan default to false", async ({ page }) => {
    await open(page);
    const f = await page.evaluate(() => ({
      simple: (window as any).Flags.on("simple-nodes"),
      freeze: (window as any).Flags.on("freeze-pan"),
    }));
    expect(f.simple).toBe(false);
    expect(f.freeze).toBe(false);
  });

  test("S43.B build stamp present in <meta> and on the HUD", async ({ page }) => {
    await open(page, { "perf-hud": true });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="edgespace-build"]');
      const buildEl = document.getElementById("ph-build");
      return {
        metaContent: meta ? meta.getAttribute("content") : null,
        buildText: buildEl ? buildEl.textContent : null,
      };
    });
    expect(r.metaContent).toContain("4.3.0");
    expect(r.buildText).toContain("4.3.0");
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.3 · Issue 1 — no perpetual pulse animation", () => {
  test("S43.C the freshness halo has animation-name: none (pulse removed)", async ({ page }) => {
    await open(page); // rich mode, fresh node → halo renders
    await seedProject(page);
    const anim = await page.evaluate(() => {
      const halo = document.querySelector(".es-halo-pulse") || document.querySelector(".es-halo");
      return halo ? getComputedStyle(halo).animationName : "NO-HALO";
    });
    // Either the halo is present with no animation, or (simple/none) absent.
    expect(anim === "none" || anim === "NO-HALO" || anim === "").toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.3 · Issue 2 — --simple-nodes", () => {
  test("S43.D --simple-nodes renders a state-coloured circle (r=26), not a silhouette", async ({ page }) => {
    await open(page, { "simple-nodes": true });
    await seedProject(page);
    const html = await nshapeHtml(page);
    expect(html).not.toBe("NONE");
    expect(html).toContain('r="26"');                 // simple circle
    expect(html).toContain("#d96b5a");                 // blocked state colour (SC.blocked)
  });

  test("S43.E without --simple-nodes the project node is a rich silhouette (no r=26 circle)", async ({ page }) => {
    await open(page);
    await seedProject(page);
    const html = await nshapeHtml(page);
    expect(html).not.toBe("NONE");
    expect(html).not.toContain('r="26"');             // a silhouette, not the simple circle
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.3 · freeze-pan — simple in motion, rich at rest", () => {
  test("S43.F FreezePan installs; window.__inMotion drives simple rendering", async ({ page }) => {
    await open(page, { "freeze-pan": true });
    await seedProject(page);

    const rest = await nshapeHtml(page);

    // Enter motion (body.dragging is one of the polled motion signals); the
    // watcher flips __inMotion and forces a re-render.
    await page.evaluate(async () => {
      const wait = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      document.body.classList.add("dragging");
      await wait(); await wait();
    });
    const moving = await nshapeHtml(page);
    const inMotion = await page.evaluate(() => !!(window as any).__inMotion);

    // Settle.
    await page.evaluate(async () => {
      const wait = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      document.body.classList.remove("dragging");
      await wait(); await wait();
    });
    const settled = await nshapeHtml(page);

    expect(rest).not.toContain('r="26"');   // rich at rest
    expect(inMotion).toBe(true);
    expect(moving).toContain('r="26"');      // simple while moving
    expect(settled).not.toContain('r="26"'); // rich again on settle
  });

  test("S43.G with --freeze-pan OFF, motion does NOT simplify (no watcher)", async ({ page }) => {
    await open(page); // freeze-pan OFF
    await seedProject(page);
    const moving = await page.evaluate(async () => {
      const wait = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      document.body.classList.add("dragging");
      await wait(); await wait();
      (window as any).render();
      const el = document.querySelector('.nslice[data-nid="7777"] .nshape') as Element | null;
      const html = el ? el.innerHTML : "NONE";
      document.body.classList.remove("dragging");
      return { html, inMotion: !!(window as any).__inMotion };
    });
    expect(moving.inMotion).toBe(false);
    expect(moving.html).not.toContain('r="26"'); // still rich — freeze-pan off
  });
});
