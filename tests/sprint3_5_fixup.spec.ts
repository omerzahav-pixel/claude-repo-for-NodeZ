import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 3.5 · Phase-3 bug squash regression tests.
 *
 * Issue 1 — import path is 1:1 (no doubling); imF re-entry guard;
 *           dedupeIdenticalCanvases removes byte-equal duplicates.
 * Issue 2 — Tools panel opens on first tap; 200 ms grace period prevents
 *           same-tick close.
 * Issue 3 — collapsed drawer is zero pixels; canvas chrome offset shrinks
 *           from 96 to 56 px.
 * Issue 4 — gesture machine recovers from a 1-second-quiet stale-pointer
 *           leak; perf-HUD exposes a budget-rate badge.
 * Issue 5 — deleteCanvasWithConfirm removes a canvas and clears portal
 *           references; vault is non-deletable.
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
test.describe("Sprint 3.5 · Issue 1 — import doubling", () => {
  test("S3_5.I1.A Single import = 1:1 with source (no duplication)", async ({ page }) => {
    await open(page);
    // Build fixture in current state.
    const fixtureJson = await page.evaluate(() => {
      const E = (window as any).__E2E;
      const S = E.state();
      S.canvases["probability"] = {
        nodes: [
          { id: 5001, label: "A", shape: "idea", status: "idea", x: 0, y: 0, created: "2024-01-01", modified: "2024-01-01" },
          { id: 5002, label: "B", shape: "idea", status: "idea", x: 100, y: 0, created: "2024-01-01", modified: "2024-01-01" }
        ],
        edges: [{ id: 5101, from: 5001, to: 5002, type: "feeds" }],
        zones: [{ id: "core", name: "Core", x: -50, y: -50, w: 200, h: 200, color: "#FF7A45" }]
      };
      S.canvasMeta["probability"] = { name: "Probability", parentCanvas: "vault" };
      return JSON.stringify(S);
    });
    // Wipe and re-open
    await page.evaluate(async () => {
      try { indexedDB.deleteDatabase("ideaVault"); } catch {}
      try { localStorage.clear(); } catch {}
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!(window as any).__E2E);
    await page.waitForTimeout(600);
    // Import the fixture into the fresh state.
    await page.evaluate((json) => {
      const f = new File([json], "x.json", { type: "application/json" });
      const dt = new DataTransfer();
      dt.items.add(f);
      const inp = document.getElementById("imp") as HTMLInputElement;
      (inp as any).files = dt.files;
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    }, fixtureJson);
    await page.waitForTimeout(1200);
    const counts = await page.evaluate(() => {
      const c = (window as any).__E2E.state().canvases["probability"];
      return { nodes: c.nodes.length, edges: c.edges.length, zones: c.zones.length };
    });
    expect(counts).toEqual({ nodes: 2, edges: 1, zones: 1 });
  });

  /* S3_5.I1.B removed in 3.6 — the 1500 ms re-entry guard was a fix for
     the wrong problem (the dup was render-side; see sprint3_6_fixup
     S3_6.I1.A). The guard is gone and rapid sequential imports must
     now succeed (covered by sprint3_6_fixup S3_6.I1.B). */

  /* S3_5.I1.C and .I1.D removed in 3.6 — the dedupeIdenticalCanvases
     function was demoted from auto-mutator to warning-only logger
     (see warnOnDuplicateCanvases in app.js). The dup it was "cleaning
     up" doesn't exist; the user's drawer-double was render-side. */
  test("S3_5.I1.C warnOnDuplicateCanvases NEVER mutates S (warning-only)", async ({ page }) => {
    await open(page);
    const out = await page.evaluate(() => {
      const S = (window as any).__E2E.state();
      const mk = () => ({
        nodes: [{ id: 1, label: "N", shape: "idea", status: "idea", x: 0, y: 0, created: "2024-01-01", modified: "2024-01-01" }],
        edges: [],
        zones: []
      });
      S.canvases["a"] = mk();
      S.canvases["b"] = mk();
      S.canvasMeta["a"] = { name: "Same", parentCanvas: "vault" };
      S.canvasMeta["b"] = { name: "Same", parentCanvas: "vault" };
      (window as any).warnOnDuplicateCanvases();
      return { hasA: !!S.canvases["a"], hasB: !!S.canvases["b"] };
    });
    /* Both stay — warning-only, no deletion. */
    expect(out.hasA).toBe(true);
    expect(out.hasB).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.5 · Issue 2 — Tools panel opens reliably", () => {
  test("S3_5.I2.A Gear chip tap opens the panel + 200ms grace prevents re-close", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1200);
    await page.locator("#spine .sb.tools[data-act='tools-toggle']").click();
    await page.waitForTimeout(50);  // < 200 ms grace
    /* Simulate the rogue same-tick second click that outsideClick used to
       close on. The grace period should swallow it. */
    await page.evaluate(() => {
      document.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(150);
    const on1 = await page.evaluate(() =>
      document.getElementById("toolsPanel")?.classList.contains("on")
    );
    expect(on1).toBe(true);
  });

  test("S3_5.I2.B Spine chips have touch-action: manipulation", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1200);
    const ta = await page.evaluate(() => {
      const c = document.querySelector("#spine .sb.tools") as HTMLElement;
      return getComputedStyle(c).touchAction;
    });
    expect(ta).toContain("manipulation");
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.5 · Issue 3 — collapsed drawer = zero pixels", () => {
  test("S3_5.I3.A Drawer width is 0 when collapsed", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1200);
    await page.evaluate(() => (window as any).Drawer.toggle());
    await page.waitForTimeout(400);
    const w = await page.evaluate(() => {
      const d = document.getElementById("drawer");
      return d?.getBoundingClientRect().width;
    });
    expect(w).toBe(0);
  });

  test("S3_5.I3.B No chevron element in collapsed drawer", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1200);
    await page.evaluate(() => (window as any).Drawer.toggle());
    await page.waitForTimeout(200);
    const inner = await page.evaluate(() =>
      document.getElementById("drawer")?.innerHTML
    );
    expect(inner).toBe("");
  });

  test("S3_5.I3.C Canvas chrome offset shrinks from 96 to 56 px when collapsed", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1200);
    await page.evaluate(() => (window as any).Drawer.toggle());
    await page.waitForTimeout(400);
    const tb = await page.evaluate(() => {
      const e = document.getElementById("tb") as HTMLElement;
      return e ? getComputedStyle(e).insetInlineStart : null;
    });
    /* 56 px spine + 12 px gap = 68 px, not 108 px. */
    expect(tb).toBe("68px");
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.5 · Issue 4 — gesture state + perf HUD", () => {
  test("S3_5.I4.A Quiet-period clean wipes stale activePtrs", async ({ page }) => {
    /* The freshGestureCleanIfQuiet logic is private to gesture.js; we
       can only verify the end-to-end behavior. Synthesize a "stale
       pointer left behind" sequence: pointerdown, no up, wait 1.2 s,
       new pointerdown → GestureV2 state should be IDLE → PAN, not
       PINCH. */
    await open(page, { "gestures-v2": true });
    const result = await page.evaluate(async () => {
      const cv = document.getElementById("cv")!;
      // Stale pointer-down with no up.
      cv.dispatchEvent(new PointerEvent("pointerdown", { clientX: 200, clientY: 200, pointerType: "touch", pointerId: 100, isPrimary: true, bubbles: true, cancelable: true }));
      // Wait > 1 s (QUIET_MS in gesture.js).
      await new Promise(r => setTimeout(r, 1200));
      // Fresh tap should NOT trigger pinch even though activePtrs ostensibly has the stale entry.
      cv.dispatchEvent(new PointerEvent("pointerdown", { clientX: 300, clientY: 300, pointerType: "touch", pointerId: 101, isPrimary: true, bubbles: true, cancelable: true }));
      const state = (window as any).GestureV2?.getState();
      // Clean up — release the active pointer
      cv.dispatchEvent(new PointerEvent("pointerup", { clientX: 300, clientY: 300, pointerType: "touch", pointerId: 101, isPrimary: true, bubbles: true, cancelable: true }));
      return state;
    });
    // State should be pan or idle — definitely not pinch.
    expect(result === "pan" || result === "idle").toBe(true);
  });

  test("S3_5.I4.B Perf HUD budget bar element renders", async ({ page }) => {
    await page.goto(viteUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      try { indexedDB.deleteDatabase("ideaVault"); } catch {}
      try { localStorage.clear(); } catch {}
      localStorage.setItem("edgespace-flags", JSON.stringify({ "perf-hud": true }));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("svg#cv");
    await page.waitForTimeout(800);
    const has = await page.evaluate(() => !!document.getElementById("ph-budget"));
    expect(has).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.5 · Issue 5 — Delete canvas from drawer", () => {
  test("S3_5.I5.A deleteCanvasWithConfirm removes the canvas", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.evaluate(async () => {
      const S = (window as any).__E2E.state();
      S.canvases["doomed"] = { nodes: [], edges: [], zones: [] };
      S.canvasMeta["doomed"] = { name: "Doomed", parentCanvas: "vault" };
      /* Patch the modal interaction: stub out the modal show + click OK
         automatically (no checkbox = no cascade). */
      const m = document.getElementById("modal")!;
      const orig = (window as any).deleteCanvasWithConfirm;
      const p = orig("doomed");
      // After microtask, the OK button exists; click it.
      await new Promise(r => setTimeout(r, 100));
      const ok = document.getElementById("__delOk") as HTMLButtonElement | null;
      if (ok) ok.click();
      await p;
    });
    await page.waitForTimeout(400);
    const has = await page.evaluate(() => !!(window as any).__E2E.state().canvases["doomed"]);
    expect(has).toBe(false);
  });

  test("S3_5.I5.B Delete clears portal references in other canvases", async ({ page }) => {
    await open(page, { "nav-v2": true });
    const refsAfter = await page.evaluate(async () => {
      const S = (window as any).__E2E.state();
      // Vault has a portal node pointing to "child".
      S.canvases["child"] = { nodes: [], edges: [], zones: [] };
      S.canvasMeta["child"] = { name: "Child", parentCanvas: "vault", parentNodeId: 42 };
      S.canvases.vault.nodes.push({ id: 42, label: "portal", shape: "project", status: "idea", x: 0, y: 0, childCanvas: "child", created: "2024-01-01", modified: "2024-01-01" });
      const p = (window as any).deleteCanvasWithConfirm("child");
      await new Promise(r => setTimeout(r, 100));
      const ok = document.getElementById("__delOk") as HTMLButtonElement | null;
      if (ok) ok.click();
      await p;
      const portal = S.canvases.vault.nodes.find((n: any) => n.id === 42);
      return { canvasGone: !S.canvases["child"], portalChildCleared: portal?.childCanvas === null };
    });
    expect(refsAfter.canvasGone).toBe(true);
    expect(refsAfter.portalChildCleared).toBe(true);
  });

  test("S3_5.I5.C Vault is non-deletable from drawer menu", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1200);
    /* Open the drawer-row context menu on vault via dispatching
       contextmenu manually. */
    await page.evaluate(() => {
      const row = document.querySelector('#drawer .dr-row[data-id="vault"]') as HTMLElement;
      const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      Object.defineProperty(ev, "clientX", { value: 200 });
      Object.defineProperty(ev, "clientY", { value: 200 });
      row.dispatchEvent(ev);
    });
    await page.waitForTimeout(200);
    const hasDelete = await page.evaluate(() =>
      !!document.querySelector('#drawerRowMenu button[data-act="delete-canvas"]')
    );
    expect(hasDelete).toBe(false);
  });
});
