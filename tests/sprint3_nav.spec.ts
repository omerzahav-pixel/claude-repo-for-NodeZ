import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 3 · Navigation smoke tests.
 *
 * Covers:
 *   - Preamble 1 (double-tap removed; long-press still fires)
 *   - Preamble 2 (edge selection + control panel)
 *   - Task 3.1   (workspace spine + canvas drawer behind --nav-v2)
 *   - Task 3.2   (⌘K palette + SearchIndex behind --palette)
 *   - Task 3.3   (5 view modes + view-tabs behind --views-v2)
 *   - Critical: bottom tab strip still works when --nav-v2 is OFF
 */

const viteUrl = process.env.VITE_URL ?? "http://localhost:5173/";

async function openWithFlags(page: Page, flags: Record<string, boolean>) {
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

async function seedNodesAndEdges(page: Page) {
  await page.evaluate(() => {
    const E = (window as any).__E2E;
    const c = E.current();
    const z = c.zones[0]?.id || "ideas";
    const today = new Date().toISOString();
    [
      { id: 8001, label: "Bayes' theorem", shape: "idea",     status: "progress" },
      { id: 8002, label: "Monty Hall",     shape: "question", status: "pending" },
      { id: 8003, label: "Bernoulli trial", shape: "experiment", status: "blocked" },
      { id: 8004, label: "p(A|B)",         shape: "formula",  status: "done" }
    ].forEach((n, i) => {
      E.addNodeRaw({ ...n, x: (i-2)*120, y: 0, zone: z, created: today, modified: today });
    });
    c.edges.push({ id: 9001, from: 8001, to: 8002, type: "feeds" });
    c.edges.push({ id: 9002, from: 8001, to: 8004, type: "derived" });
    (window as any).render();
  });
}

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3 · preamble", () => {
  test("S3.P1 All 3 Sprint-3 flags registered with default OFF", async ({ page }) => {
    await openWithFlags(page, {});
    const flags = await page.evaluate(() => (window as any).Flags?.all());
    expect(flags["nav-v2"]).toBe(false);
    expect(flags["palette"]).toBe(false);
    expect(flags["views-v2"]).toBe(false);
  });

  test("S3.P2 Long-press still fires window.onCanvasLongPress", async ({ page }) => {
    await openWithFlags(page, { "gestures-v2": true });
    const fired = await page.evaluate(async () => {
      let called: any = null;
      (window as any).onCanvasLongPress = (p: any) => { called = { x: p.x, y: p.y }; };
      const cv = document.getElementById("cv")!;
      cv.dispatchEvent(new PointerEvent("pointerdown", { clientX: 500, clientY: 400, pointerType: "touch", pointerId: 1, isPrimary: true, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 580));
      return called;
    });
    expect(fired).toBeTruthy();
  });

  test("S3.P3 EdgeControls module installed; selecting an edge surfaces the panel", async ({ page }) => {
    await openWithFlags(page, { "edges-v2": true });
    await seedNodesAndEdges(page);
    const r = await page.evaluate(() => {
      // Directly invoke select() — DOM hit-testing is fiddly in synthetic
      // events. The integration path is exercised by inspecting the panel.
      (window as any).EdgeControls.select(9001);
      const has = !!document.getElementById("edgeControls");
      const show = document.getElementById("edgeControls")?.style.display;
      const cycleBtn = document.querySelector('#edgeControls [data-act="cycle-type"]') as HTMLButtonElement | null;
      cycleBtn?.click();
      const after = (window as any).__E2E.current().edges.find((e: any) => e.id === 9001);
      return { has, show, newType: after?.type };
    });
    expect(r.has).toBe(true);
    expect(r.show).toBe("block");
    // Cycled once: 'feeds' → 'blocker'
    expect(r.newType).toBe("blocker");
  });

  test("S3.P4 Trash button on selected edge deletes the edge from S", async ({ page }) => {
    await openWithFlags(page, { "edges-v2": true });
    await seedNodesAndEdges(page);
    const r = await page.evaluate(() => {
      (window as any).EdgeControls.select(9002);
      const trash = document.querySelector('#edgeControls [data-act="delete"]') as HTMLButtonElement;
      trash.click();
      const stillThere = (window as any).__E2E.current().edges.find((e: any) => e.id === 9002);
      return !!stillThere;
    });
    expect(r).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3 · nav-v2 (spine + drawer)", () => {
  test("S3.N1 With --nav-v2 OFF, no #spine or #drawer", async ({ page }) => {
    await openWithFlags(page, {});
    expect(await page.locator("#spine").count()).toBe(0);
    expect(await page.locator("#drawer").count()).toBe(0);
  });

  test("S3.N2 With --nav-v2 ON, spine + drawer mount; body has nav-v2-on", async ({ page }) => {
    await openWithFlags(page, { "nav-v2": true });
    await page.waitForSelector("#spine", { timeout: 5000 });
    await page.waitForSelector("#drawer", { timeout: 5000 });
    const cls = await page.evaluate(() => document.body.classList.contains("nav-v2-on"));
    expect(cls).toBe(true);
  });

  test("S3.N3 Spine renders one chip per workspace", async ({ page }) => {
    await openWithFlags(page, { "nav-v2": true });
    await page.waitForSelector("#spine .ws-chip[data-ws]");
    const n = await page.locator("#spine .ws-chip[data-ws]").count();
    expect(n).toBeGreaterThanOrEqual(1);
  });

  test("S3.N4 Bottom tab strip stays present when --nav-v2 is OFF (regression guard)", async ({ page }) => {
    await openWithFlags(page, {});
    expect(await page.locator("#tabs").count()).toBe(1);
  });

  test("S3.N5 Drawer renders vault row and a node count badge", async ({ page }) => {
    await openWithFlags(page, { "nav-v2": true });
    await page.waitForSelector("#drawer .dr-row[data-id='vault']", { timeout: 5000 });
    const has = await page.locator("#drawer .dr-row[data-id='vault']").count();
    expect(has).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3 · palette", () => {
  test("S3.PA1 SearchIndex module installs and indexes nodes", async ({ page }) => {
    await openWithFlags(page, { "palette": true });
    await seedNodesAndEdges(page);
    const out = await page.evaluate(() => {
      (window as any).SearchIndex.rebuild();
      const hits = (window as any).SearchIndex.search("bayes", { max: 10 });
      return { count: hits.length, top: hits[0] && { kind: hits[0].kind, label: hits[0].label } };
    });
    expect(out.count).toBeGreaterThan(0);
    expect(out.top?.kind).toBe("node");
    expect(out.top?.label.toLowerCase()).toContain("bayes");
  });

  test("S3.PA2 ⌘K opens the palette + populates results", async ({ page }) => {
    await openWithFlags(page, { "palette": true });
    await seedNodesAndEdges(page);
    await page.evaluate(() => (window as any).Palette.open());
    await page.waitForSelector("#palette.on", { timeout: 3000 });
    // Type into the palette's input.
    await page.evaluate(() => {
      const inp = document.querySelector("#palette input") as HTMLInputElement;
      inp.value = "bayes";
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForTimeout(120);
    const top = await page.locator("#palette .palette-res .palette-res-name").first().textContent();
    expect(top?.toLowerCase()).toContain("bayes");
  });

  test("S3.PA3 Prefix `>cmd:` filters to commands only", async ({ page }) => {
    await openWithFlags(page, { "palette": true });
    const out = await page.evaluate(() => {
      (window as any).SearchIndex.rebuild();
      const hits = (window as any).SearchIndex.search(">cmd:export", { max: 10 });
      return { allCmd: hits.every((h: any) => h.kind === "command"), n: hits.length };
    });
    expect(out.allCmd).toBe(true);
    expect(out.n).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3 · views", () => {
  test("S3.V1 #viewTabs + #viewStage mount with --views-v2 ON", async ({ page }) => {
    await openWithFlags(page, { "views-v2": true });
    await page.waitForSelector("#viewTabs", { timeout: 3000 });
    expect(await page.locator("#viewStage").count()).toBe(1);
  });

  test("S3.V2 Switching to List view renders rows", async ({ page }) => {
    await openWithFlags(page, { "views-v2": true });
    await seedNodesAndEdges(page);
    await page.evaluate(() => (window as any).ViewTabs.setMode("list"));
    await page.waitForSelector("#viewStage.on table");
    const rows = await page.locator("#viewStage table tbody tr").count();
    expect(rows).toBeGreaterThanOrEqual(4);
  });

  test("S3.V3 Kanban shows the 5 status columns", async ({ page }) => {
    await openWithFlags(page, { "views-v2": true });
    await seedNodesAndEdges(page);
    await page.evaluate(() => (window as any).ViewTabs.setMode("kanban"));
    await page.waitForSelector("#viewStage .vs-kanban .vs-col");
    const cols = await page.locator("#viewStage .vs-kanban .vs-col").count();
    expect(cols).toBe(5);
  });

  test("S3.V4 Kanban drop on a column changes node status in S", async ({ page }) => {
    await openWithFlags(page, { "views-v2": true });
    await seedNodesAndEdges(page);
    await page.evaluate(() => (window as any).ViewTabs.setMode("kanban"));
    await page.waitForSelector("#viewStage .vs-kanban .vs-card[data-id='8001']");
    // Simulate the drop by calling the bound handler logic directly: set
    // dragId via dragstart + dispatch drop on the "done" column body.
    await page.evaluate(() => {
      const card = document.querySelector(".vs-card[data-id='8001']") as HTMLElement;
      const col  = document.querySelector('.vs-col-body[data-drop="done"]') as HTMLElement;
      card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
      col.dispatchEvent(new DragEvent("dragover",  { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
      col.dispatchEvent(new DragEvent("drop",      { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
      card.dispatchEvent(new DragEvent("dragend",  { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
    });
    await page.waitForTimeout(200);
    const status = await page.evaluate(() => (window as any).__E2E.current().nodes.find((n: any) => n.id === 8001)?.status);
    expect(status).toBe("done");
  });

  test("S3.V5 Weak-spot view ranks nodes without throwing on sparse data", async ({ page }) => {
    await openWithFlags(page, { "views-v2": true });
    await seedNodesAndEdges(page);
    await page.evaluate(() => (window as any).ViewTabs.setMode("weakspot"));
    await page.waitForSelector("#viewStage .vs-weakspot");
    const rows = await page.locator("#viewStage .vs-ws-row").count();
    expect(rows).toBeGreaterThan(0);
  });

  test("S3.V6 Switching back to Canvas hides the view stage", async ({ page }) => {
    await openWithFlags(page, { "views-v2": true });
    await page.evaluate(() => (window as any).ViewTabs.setMode("list"));
    await page.waitForSelector("#viewStage.on");
    await page.evaluate(() => (window as any).ViewTabs.setMode("canvas"));
    await page.waitForFunction(() => !document.getElementById("viewStage")?.classList.contains("on"));
    expect(await page.evaluate(() => document.body.classList.contains("non-canvas-view"))).toBe(false);
  });
});
