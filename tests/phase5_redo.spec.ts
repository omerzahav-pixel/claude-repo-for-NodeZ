import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 5 P2 · Redo.
 *
 * Design intent:
 *   - Undo already landed pre-Phase-5 via `un()` popping `hist`.
 *   - Redo mirrors it: `re()` pops `redoStack`, pushes current state
 *     back to `hist`, restores. Ctrl+Y / Ctrl+Shift+Z trigger it.
 *   - Any fresh mutation (sn()) clears redoStack — a classic branching
 *     history, not a list you can walk sideways.
 *   - Toolbar ↶/↷ buttons disable when their stack is empty. Visible
 *     feedback so the user knows nothing-to-undo without tapping.
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
  await page.waitForTimeout(400);
}

/** Count nodes in the current canvas. */
async function nodeCount(page: Page) {
  return page.evaluate(() => (window as any).__E2E.current().nodes.length);
}

test.describe("Phase 5 P2 · Redo", () => {
  test("5P2.R1 redo button starts disabled with empty stack", async ({ page }) => {
    await openCleanApp(page);
    const disabled = await page.evaluate(() => (document.getElementById("redoBtn") as HTMLButtonElement).disabled);
    expect(disabled).toBe(true);
  });

  test("5P2.R2 after addNode → undo → redo, node reappears", async ({ page }) => {
    await openCleanApp(page);
    const before = await nodeCount(page);
    // Drive the app's addC() which calls sn() internally.
    await page.evaluate(() => (window as any).addC());
    const added = await nodeCount(page);
    expect(added).toBe(before + 1);
    // Undo — node removed, redoStack now has one entry.
    await page.evaluate(() => (window as any).un());
    expect(await nodeCount(page)).toBe(before);
    const redoDisabled = await page.evaluate(() => (document.getElementById("redoBtn") as HTMLButtonElement).disabled);
    expect(redoDisabled).toBe(false);
    // Redo — node comes back.
    await page.evaluate(() => (window as any).re());
    expect(await nodeCount(page)).toBe(before + 1);
  });

  test("5P2.R3 new action after undo clears redo stack (no branching walk)", async ({ page }) => {
    await openCleanApp(page);
    const before = await nodeCount(page);
    await page.evaluate(() => (window as any).addC());
    await page.evaluate(() => (window as any).un());
    // redoStack has one entry — verify.
    let redoDisabled = await page.evaluate(() => (document.getElementById("redoBtn") as HTMLButtonElement).disabled);
    expect(redoDisabled).toBe(false);
    // Fresh mutation invalidates redo history.
    await page.evaluate(() => (window as any).addC());
    redoDisabled = await page.evaluate(() => (document.getElementById("redoBtn") as HTMLButtonElement).disabled);
    expect(redoDisabled).toBe(true);
  });

  test("5P2.R4 Ctrl+Y triggers redo", async ({ page }) => {
    await openCleanApp(page);
    const before = await nodeCount(page);
    await page.evaluate(() => (window as any).addC());
    await page.evaluate(() => (window as any).un());
    expect(await nodeCount(page)).toBe(before);
    // Keyboard shortcut — activeElement must not be an input for the handler.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
    await page.keyboard.down("Control");
    await page.keyboard.press("y");
    await page.keyboard.up("Control");
    await page.waitForTimeout(100);
    expect(await nodeCount(page)).toBe(before + 1);
  });

  test("5P2.R5 Ctrl+Shift+Z also triggers redo", async ({ page }) => {
    await openCleanApp(page);
    const before = await nodeCount(page);
    await page.evaluate(() => (window as any).addC());
    await page.evaluate(() => (window as any).un());
    expect(await nodeCount(page)).toBe(before);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
    await page.keyboard.down("Control");
    await page.keyboard.down("Shift");
    await page.keyboard.press("z");
    await page.keyboard.up("Shift");
    await page.keyboard.up("Control");
    await page.waitForTimeout(100);
    expect(await nodeCount(page)).toBe(before + 1);
  });

  test("5P2.R6 undo button also reflects empty-stack disabled state", async ({ page }) => {
    await openCleanApp(page);
    const undoDisabled = await page.evaluate(() => (document.getElementById("undoBtn") as HTMLButtonElement).disabled);
    expect(undoDisabled).toBe(true);
    // After a mutation, undo becomes enabled.
    await page.evaluate(() => (window as any).addC());
    const enabled = await page.evaluate(() => (document.getElementById("undoBtn") as HTMLButtonElement).disabled);
    expect(enabled).toBe(false);
  });
});
