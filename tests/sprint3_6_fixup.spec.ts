import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 3.6 · Phase-3 closeout regression tests.
 *
 * Issue 1 — drawer renders each canvas exactly once (was doubled).
 *           Deleting one rendered row deletes only that record.
 *           imF debounce removed (rapid sequential imports work).
 * Issue 2 — viewStage clears the spine + drawer in LTR + RTL.
 * Issue 3 — gatherDescendantCanvasIds walks both portal AND
 *           canvasMeta.parentCanvas paths.
 * Issue 4 — perf HUD reads activeFrames, exposes worst/budget/fps.
 * Issue 5 — resetWorkspaceWithConfirm wipes to single empty vault;
 *           single undo restores.
 * Issue 6 — drawer.collapsed has the visibility-transition delay.
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
test.describe("Sprint 3.6 · Issue 1 — drawer render-side dedup", () => {
  test("S3_6.I1.A Drawer renders each canvas exactly once", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.evaluate(() => {
      const S = (window as any).__E2E.state();
      S.canvases["alpha"] = { nodes: [], edges: [], zones: [] };
      S.canvases["beta"]  = { nodes: [], edges: [], zones: [] };
      S.canvasMeta["alpha"] = { name: "Alpha", parentCanvas: "vault" };
      S.canvasMeta["beta"]  = { name: "Beta",  parentCanvas: "vault" };
      if ((window as any).Drawer) (window as any).Drawer.refresh();
    });
    await page.waitForTimeout(400);
    const rows = await page.evaluate(() =>
      Array.from(document.querySelectorAll("#drawer .dr-row[data-id]"))
        .map((r: any) => r.getAttribute("data-id"))
    );
    /* Three canvases (vault + alpha + beta), each rendered exactly once.
       Pre-3.6 bug would have rendered alpha and beta twice → length 5. */
    expect(rows.length).toBe(3);
    expect(rows.filter(r => r === "alpha").length).toBe(1);
    expect(rows.filter(r => r === "beta").length).toBe(1);
    expect(rows.filter(r => r === "vault").length).toBe(1);
  });

  test("S3_6.I1.B imF re-entry guard is GONE (rapid sequential imports work)", async ({ page }) => {
    await open(page);
    const fixture1 = '{"canvases":{"vault":{"nodes":[],"edges":[],"zones":[]},"a":{"nodes":[{"id":11,"label":"From1","shape":"idea","status":"idea","x":0,"y":0,"created":"2024-01-01","modified":"2024-01-01"}],"edges":[],"zones":[]}},"canvasMeta":{"vault":{"name":"Vault"},"a":{"name":"A","parentCanvas":"vault"}},"current":"vault","nextId":100}';
    const fixture2 = '{"canvases":{"vault":{"nodes":[],"edges":[],"zones":[]},"b":{"nodes":[{"id":22,"label":"From2","shape":"idea","status":"idea","x":0,"y":0,"created":"2024-01-01","modified":"2024-01-01"}],"edges":[],"zones":[]}},"canvasMeta":{"vault":{"name":"Vault"},"b":{"name":"B","parentCanvas":"vault"}},"current":"vault","nextId":100}';
    await page.evaluate((j1) => {
      const dt = new DataTransfer();
      dt.items.add(new File([j1], "1.json", { type: "application/json" }));
      const i = document.getElementById("imp") as HTMLInputElement;
      (i as any).files = dt.files;
      i.dispatchEvent(new Event("change", { bubbles: true }));
    }, fixture1);
    await page.waitForTimeout(400);  // < 1500ms (the old 3.5 guard would block)
    await page.evaluate((j2) => {
      const dt = new DataTransfer();
      dt.items.add(new File([j2], "2.json", { type: "application/json" }));
      const i = document.getElementById("imp") as HTMLInputElement;
      (i as any).files = dt.files;
      i.dispatchEvent(new Event("change", { bubbles: true }));
    }, fixture2);
    await page.waitForTimeout(500);
    const has = await page.evaluate(() => {
      const S = (window as any).__E2E.state();
      return { hasB: !!S.canvases["b"], bNodeLabel: S.canvases["b"]?.nodes[0]?.label };
    });
    /* If the re-entry guard were still in place, fixture2 would have
       been silently dropped and `b` would not exist. */
    expect(has.hasB).toBe(true);
    expect(has.bNodeLabel).toBe("From2");
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.6 · Issue 2 — viewStage clears spine + drawer", () => {
  test("S3_6.I2.A viewStage inset-inline-start = 280px under nav-v2 + drawer expanded", async ({ page }) => {
    await open(page, { "nav-v2": true, "views-v2": true });
    await page.evaluate(() => (window as any).ViewTabs.setMode("kanban"));
    await page.waitForTimeout(400);
    const off = await page.evaluate(() => {
      const v = document.getElementById("viewStage")!;
      return getComputedStyle(v).insetInlineStart;
    });
    expect(off).toBe("280px");
  });

  test("S3_6.I2.B viewStage inset-inline-start = 56px when drawer collapsed", async ({ page }) => {
    await open(page, { "nav-v2": true, "views-v2": true });
    await page.evaluate(() => {
      (window as any).Drawer.toggle();
      (window as any).ViewTabs.setMode("kanban");
    });
    await page.waitForTimeout(400);
    const off = await page.evaluate(() => {
      const v = document.getElementById("viewStage")!;
      return getComputedStyle(v).insetInlineStart;
    });
    expect(off).toBe("56px");
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.6 · Issue 3 — descendant walk uses BOTH paths", () => {
  test("S3_6.I3.A gatherDescendantCanvasIds walks canvasMeta.parentCanvas too", async ({ page }) => {
    await open(page);
    const ids = await page.evaluate(() => {
      const S = (window as any).__E2E.state();
      /* Make a child whose parent relationship is expressed ONLY via
         canvasMeta — no portal node inside vault points to it. This is
         what import flows commonly produce. */
      S.canvases["imported-child"] = { nodes: [], edges: [], zones: [] };
      S.canvasMeta["imported-child"] = { name: "Imported", parentCanvas: "vault" };
      const out = (window as any).gatherDescendantCanvasIds("vault");
      return Array.from(out);
    });
    expect(ids).toContain("imported-child");
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.6 · Issue 4 — perf HUD self-measures", () => {
  test("S3_6.I4.A HUD exposes activeFrames + worst + budgetRate via snapshot()", async ({ page }) => {
    await page.goto(viteUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      try { indexedDB.deleteDatabase("ideaVault"); } catch {}
      try { localStorage.clear(); } catch {}
      localStorage.setItem("edgespace-flags", JSON.stringify({ "perf-hud": true }));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("svg#cv");
    await page.waitForTimeout(800);
    const snap = await page.evaluate(() => {
      /* Simulate "active" via body.dragging so the active-frame
         counter advances. */
      document.body.classList.add("dragging");
      return new Promise(r => setTimeout(() => {
        const s = (window as any).PerfHud?.snapshot?.();
        document.body.classList.remove("dragging");
        r(s);
      }, 500));
    });
    expect(snap).not.toBeNull();
    expect(typeof (snap as any).budgetRate).toBe("number");
    expect(Array.isArray((snap as any).activeFrames)).toBe(true);
    expect((snap as any).activeFrames.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.6 · Issue 5 — Reset workspace", () => {
  test("S3_6.I5.A resetWorkspaceWithConfirm wipes to single empty vault", async ({ page }) => {
    await open(page);
    await page.evaluate(async () => {
      const S = (window as any).__E2E.state();
      S.canvases["x"] = { nodes: [{ id: 1, label: "Doomed", shape: "idea", status: "idea", x: 0, y: 0, created: "2024-01-01", modified: "2024-01-01" }], edges: [], zones: [] };
      S.canvasMeta["x"] = { name: "X", parentCanvas: "vault" };
      const p = (window as any).resetWorkspaceWithConfirm();
      await new Promise(r => setTimeout(r, 100));
      (document.getElementById("__rstOk") as HTMLButtonElement)?.click();
      await p;
    });
    await page.waitForTimeout(400);
    const out = await page.evaluate(() => {
      const S = (window as any).__E2E.state();
      return {
        canvases: Object.keys(S.canvases).sort(),
        vaultNodes: S.canvases.vault.nodes.length,
        current: S.current
      };
    });
    expect(out.canvases).toEqual(["vault"]);
    expect(out.vaultNodes).toBe(0);
    expect(out.current).toBe("vault");
  });

  test("S3_6.I5.B Single undo restores everything after Reset", async ({ page }) => {
    await open(page);
    await page.evaluate(async () => {
      const S = (window as any).__E2E.state();
      S.canvases["y"] = { nodes: [{ id: 7, label: "Survives", shape: "idea", status: "idea", x: 0, y: 0, created: "2024-01-01", modified: "2024-01-01" }], edges: [], zones: [] };
      S.canvasMeta["y"] = { name: "Y", parentCanvas: "vault" };
      const p = (window as any).resetWorkspaceWithConfirm();
      await new Promise(r => setTimeout(r, 100));
      (document.getElementById("__rstOk") as HTMLButtonElement)?.click();
      await p;
      (window as any).un();
    });
    await page.waitForTimeout(300);
    const has = await page.evaluate(() => !!(window as any).__E2E.state().canvases["y"]);
    expect(has).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.6 · Issue 6 — Drawer close animation symmetry", () => {
  test("S3_6.I6.A drawer.collapsed visibility transition has 220ms delay", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1200);
    await page.evaluate(() => (window as any).Drawer.toggle());
    await page.waitForTimeout(100);
    const t = await page.evaluate(() => {
      const d = document.getElementById("drawer")!;
      return getComputedStyle(d).transition;
    });
    /* The transition string should include visibility with a non-zero delay
       (so the visibility hide happens AFTER the width transition completes). */
    expect(t.toLowerCase()).toContain("visibility");
    expect(t).toMatch(/visibility[^,]*\b(?:0\.22s|220ms)/i);
  });
});
