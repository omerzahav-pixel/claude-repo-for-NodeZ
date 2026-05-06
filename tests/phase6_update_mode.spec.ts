import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 6 · Update-mode patches.
 *
 * The "mode": "update" patch flag turns EdgeSpace into a living dashboard:
 * a patch with that flag matches existing nodes by label and overwrites
 * fields in place instead of creating duplicates. Edges with the same
 * from+to+type are deduped. Nodes/edges not previously present are still
 * created. Default mode (no flag) keeps the old additive behavior.
 *
 * Coverage:
 *   6.UM.1 unknown labels create new nodes (additive fallback)
 *   6.UM.2 known labels update fields, x/y preserved
 *   6.UM.3 partial-field patches don't clobber omitted fields
 *   6.UM.4 duplicate edges are deduped under update mode
 *   6.UM.5 default mode (no flag) still creates duplicates (regression)
 */

const viteUrl = process.env.VITE_URL ?? "http://localhost:5173/";

async function openCleanApp(page: Page) {
  await page.goto(viteUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    try { indexedDB.deleteDatabase("ideaVault"); } catch {}
    try { localStorage.clear(); } catch {}
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("svg#cv", { state: "attached", timeout: 15_000 });
  await page.waitForFunction(() => !!(window as any).__E2E, null, { timeout: 15_000 });
  await page.waitForTimeout(300);
}

async function applyPatch(page: Page, patch: any) {
  await page.evaluate(async (p) => {
    await (window as any).applyPatchSingle(p);
  }, patch);
  await page.waitForTimeout(200);
}

async function nodes(page: Page) {
  return await page.evaluate(() => {
    const c = (window as any).__E2E.current();
    return (c.nodes as any[]).map((n) => ({ id: n.id, label: n.label, status: n.status, notes: n.notes, x: n.x, y: n.y }));
  });
}

async function edges(page: Page) {
  return await page.evaluate(() => {
    const c = (window as any).__E2E.current();
    return (c.edges as any[]).map((e) => ({ from: e.from, to: e.to, type: e.type }));
  });
}

test.describe("Phase 6 · Update-mode patches", () => {

  test("6.UM.1 unknown labels create new nodes (additive fallback)", async ({ page }) => {
    await openCleanApp(page);
    await applyPatch(page, {
      useCurrentCanvas: true,
      mode: "update",
      nodes: [
        { label: "New Node A", status: "idea", zone: "ideas" },
        { label: "New Node B", status: "progress", zone: "projects" },
      ],
    });
    const ns = await nodes(page);
    expect(ns.find(n => n.label === "New Node A")).toBeTruthy();
    expect(ns.find(n => n.label === "New Node B")).toBeTruthy();
  });

  test("6.UM.2 known labels update fields without creating duplicates", async ({ page }) => {
    await openCleanApp(page);
    // Seed
    await applyPatch(page, {
      useCurrentCanvas: true,
      nodes: [
        { label: "Phase 1", status: "idea", notes: "Original notes" },
      ],
    });
    let ns = await nodes(page);
    expect(ns.filter(n => n.label === "Phase 1")).toHaveLength(1);
    const beforeX = ns[0].x, beforeY = ns[0].y;

    // Update via update-mode
    await applyPatch(page, {
      useCurrentCanvas: true,
      mode: "update",
      nodes: [
        { label: "Phase 1", status: "done", notes: "Updated" },
      ],
    });
    ns = await nodes(page);
    expect(ns.filter(n => n.label === "Phase 1")).toHaveLength(1);
    const updated = ns.find(n => n.label === "Phase 1")!;
    expect(updated.status).toBe("done");
    expect(updated.notes).toBe("Updated");
    // x/y preserved from original placement
    expect(updated.x).toBe(beforeX);
    expect(updated.y).toBe(beforeY);
  });

  test("6.UM.3 partial-field patches don't clobber omitted fields", async ({ page }) => {
    await openCleanApp(page);
    await applyPatch(page, {
      useCurrentCanvas: true,
      nodes: [
        { label: "Task X", status: "idea", notes: "Important context" },
      ],
    });
    // Update only status, omit notes
    await applyPatch(page, {
      useCurrentCanvas: true,
      mode: "update",
      nodes: [
        { label: "Task X", status: "blocked" },
      ],
    });
    const ns = await nodes(page);
    const updated = ns.find(n => n.label === "Task X")!;
    expect(updated.status).toBe("blocked");
    // notes were NOT in the update patch — must be preserved
    expect(updated.notes).toBe("Important context");
  });

  test("6.UM.4 duplicate edges deduped under update mode", async ({ page }) => {
    await openCleanApp(page);
    await applyPatch(page, {
      useCurrentCanvas: true,
      nodes: [
        { label: "A", zone: "ideas" },
        { label: "B", zone: "ideas" },
      ],
      edges: [
        { from: "A", to: "B", type: "feeds" },
      ],
    });
    let es = await edges(page);
    expect(es).toHaveLength(1);
    // Re-apply same edge in update mode
    await applyPatch(page, {
      useCurrentCanvas: true,
      mode: "update",
      edges: [
        { from: "A", to: "B", type: "feeds" },
      ],
    });
    es = await edges(page);
    expect(es).toHaveLength(1);
  });

  test("6.UM.5 default mode (no flag) still creates duplicates", async ({ page }) => {
    await openCleanApp(page);
    await applyPatch(page, {
      useCurrentCanvas: true,
      nodes: [{ label: "DupeMe", status: "idea" }],
    });
    // Re-apply the SAME label without mode → creates duplicate (regression test)
    await applyPatch(page, {
      useCurrentCanvas: true,
      nodes: [{ label: "DupeMe", status: "done" }],
    });
    const ns = await nodes(page);
    expect(ns.filter(n => n.label === "DupeMe")).toHaveLength(2);
  });

});
