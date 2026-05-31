import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 4.2 — Paint, not transform.
 *
 * The HUD proved the bottleneck: during pan, commit (transform write) ~2.4ms
 * but worst ~200ms — the gap is PAINT. The cost is the per-node freshness halo
 * (an always-on `es-halo-pulse` CSS animation) plus selection/edge filters,
 * none of which iOS Safari GPU-composites. Culling can't help when the whole
 * canvas is on-screen (nothing off-screen to cull).
 *
 * Issue 1 — perf HUD gains `paint` (worst−commit) and `fx` (ON/OFF) lines.
 * Issue 2 — --no-fx kills the halo + all canvas filters (diagnostic by removal).
 * Issue 3 Path A — --fx-motion drops fx only while the canvas is in motion via a
 *                  read-only GestureV2 poll (body.fx-suppressed), restored on settle.
 *
 * Playwright asserts the wiring + the CSS suppression effect; it cannot feel the
 * paint win — that's the user's tethered-iPad HUD reading (paint < 16ms, fps ≥ 50).
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

/** Seed one fresh node (created today) so silhouettes.js renders an .es-halo. */
async function seedHaloNode(page: Page) {
  await page.evaluate(() => {
    const E = (window as any).__E2E;
    const c = E.current();
    const today = new Date().toISOString().slice(0, 10);
    c.nodes = [{ id: 4242, x: 0, y: 0, shape: "idea", status: "idea", label: "fresh", zone: null, created: today }];
    c.edges = [];
    const v = E.view(); v.x = 0; v.y = 0; v.k = 1;
    (window as any).render();
  });
}

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.2 · flags", () => {
  test("S42.A no-fx and fx-motion default to false (opt-in)", async ({ page }) => {
    await open(page);
    const f = await page.evaluate(() => ({
      noFx: (window as any).Flags.on("no-fx"),
      fxMotion: (window as any).Flags.on("fx-motion"),
    }));
    expect(f.noFx).toBe(false);
    expect(f.fxMotion).toBe(false);
  });

  test("S42.B FxControl installs and reports flag state", async ({ page }) => {
    await open(page, { "fx-motion": true });
    const api = await page.evaluate(() => {
      const F = (window as any).FxControl;
      return F ? { noFx: F.noFx(), motion: F.motion() } : null;
    });
    expect(api).not.toBeNull();
    expect(api!.motion).toBe(true);
    expect(api!.noFx).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.2 · Issue 2 — --no-fx suppression", () => {
  test("S42.C --no-fx adds body.no-fx and the freshness halo computes display:none", async ({ page }) => {
    await open(page, { "no-fx": true });
    await seedHaloNode(page);
    const r = await page.evaluate(() => {
      const halo = document.querySelector(".es-halo") as Element | null;
      return {
        bodyHasNoFx: document.body.classList.contains("no-fx"),
        haloPresent: !!halo,
        haloDisplay: halo ? getComputedStyle(halo).display : "NO-HALO",
      };
    });
    expect(r.bodyHasNoFx).toBe(true);
    expect(r.haloPresent).toBe(true);
    expect(r.haloDisplay).toBe("none");
  });

  test("S42.D without --no-fx the halo is rendered (display NOT none)", async ({ page }) => {
    await open(page); // no-fx OFF
    await seedHaloNode(page);
    const r = await page.evaluate(() => {
      const halo = document.querySelector(".es-halo") as Element | null;
      return {
        bodyHasNoFx: document.body.classList.contains("no-fx"),
        haloPresent: !!halo,
        haloDisplay: halo ? getComputedStyle(halo).display : "NO-HALO",
      };
    });
    expect(r.bodyHasNoFx).toBe(false);
    expect(r.haloPresent).toBe(true);
    expect(r.haloDisplay).not.toBe("none");
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.2 · Issue 3 Path A — --fx-motion drops fx in motion", () => {
  test("S42.E motion toggles body.fx-suppressed; settle restores it", async ({ page }) => {
    await open(page, { "fx-motion": true });
    const r = await page.evaluate(async () => {
      const wait = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      // body.dragging is one of the motion signals the watcher polls.
      document.body.classList.add("dragging");
      await wait();
      const during = document.body.classList.contains("fx-suppressed");
      document.body.classList.remove("dragging");
      await wait();
      const after = document.body.classList.contains("fx-suppressed");
      return { during, after };
    });
    expect(r.during).toBe(true);
    expect(r.after).toBe(false);
  });

  test("S42.F while suppressed the halo is hidden; on settle it returns", async ({ page }) => {
    await open(page, { "fx-motion": true });
    await seedHaloNode(page);
    const r = await page.evaluate(async () => {
      const wait = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const halo = () => document.querySelector(".es-halo") as Element | null;
      document.body.classList.add("dragging");
      await wait();
      const moving = halo() ? getComputedStyle(halo()!).display : "NO-HALO";
      document.body.classList.remove("dragging");
      await wait();
      const settled = halo() ? getComputedStyle(halo()!).display : "NO-HALO";
      return { moving, settled };
    });
    expect(r.moving).toBe("none");      // hidden during motion
    expect(r.settled).not.toBe("none"); // full fidelity at rest
  });

  test("S42.G with --fx-motion OFF, body.dragging does NOT suppress fx (no watcher)", async ({ page }) => {
    await open(page); // fx-motion OFF
    const r = await page.evaluate(async () => {
      const wait = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      document.body.classList.add("dragging");
      await wait();
      const v = document.body.classList.contains("fx-suppressed");
      document.body.classList.remove("dragging");
      return v;
    });
    expect(r).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 4.2 · Issue 1 — HUD paint + fx lines", () => {
  // Sprint 4.4 note: the perf-breakdown line was renamed ph-paint → ph-layout
  // (worst−commit "paint" was mislabeled; layout is now measured directly).
  // This test now checks the breakdown line exists + the fx line reads OFF.
  test("S42.H HUD shows the perf breakdown + fx lines; fx reads OFF under --no-fx", async ({ page }) => {
    await open(page, { "perf-hud": true, "no-fx": true });
    await page.waitForTimeout(350);
    const r = await page.evaluate(() => {
      const layout = document.getElementById("ph-layout");
      const fx = document.getElementById("ph-fx");
      return { hasLayout: !!layout, hasFx: !!fx, fxText: fx ? fx.textContent || "" : "" };
    });
    expect(r.hasLayout).toBe(true);
    expect(r.hasFx).toBe(true);
    expect(r.fxText).toContain("OFF");
  });

  test("S42.I fx line reads 'drops in motion' under --fx-motion", async ({ page }) => {
    await open(page, { "perf-hud": true, "fx-motion": true });
    await page.waitForTimeout(350);
    const fxText = await page.evaluate(() => document.getElementById("ph-fx")?.textContent || "");
    expect(fxText).toContain("drops in motion");
  });

  test("S42.J fx line reads plain ON with neither flag", async ({ page }) => {
    await open(page, { "perf-hud": true });
    await page.waitForTimeout(350);
    const fxText = await page.evaluate(() => document.getElementById("ph-fx")?.textContent || "");
    expect(fxText).toContain("ON");
    expect(fxText).not.toContain("OFF");
    expect(fxText).not.toContain("motion");
  });
});
