import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 5 P2 · Paste-patch size sanity.
 *
 * Design intent:
 *   - applyPatch() used to JSON.parse whatever was in #pt and dive straight
 *     into applyPatchSingle() without any size check. A pathologically
 *     large paste (20MB of text; or a 5000-node patch) would freeze the
 *     main thread for seconds during parse + render storm.
 *   - Guard is two-tier: bytes-first (cheap, before parse), nodes-second
 *     (after parse). At each tier there's a WARN (uiConfirm, allow
 *     override) and a MAX (uiNotice, outright reject).
 *   - Constants:
 *       PATCH_WARN_BYTES = 500KB, PATCH_MAX_BYTES = 10MB,
 *       PATCH_WARN_NODES = 200,   PATCH_MAX_NODES = 2000.
 *   - Normal 5–50-node Claude patches must waveform through with no
 *     confirmation prompt.
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

async function openPatchModal(page: Page) {
  await page.evaluate(() => (window as any).showPatch());
  await page.waitForSelector("#modal.on #pt", { state: "visible", timeout: 5_000 });
}

async function nodeCount(page: Page) {
  return page.evaluate(() => (window as any).__E2E.current().nodes.length);
}

test.describe("Phase 5 P2 · Paste-patch size sanity", () => {
  test("5P2.PS1 constants exposed and have the expected thresholds", async ({ page }) => {
    await openCleanApp(page);
    const consts = await page.evaluate(() => ({
      maxBytes: (window as any).PATCH_MAX_BYTES,
      warnBytes: (window as any).PATCH_WARN_BYTES,
      maxNodes: (window as any).PATCH_MAX_NODES,
      warnNodes: (window as any).PATCH_WARN_NODES,
    }));
    expect(consts.maxBytes).toBe(10 * 1024 * 1024);
    expect(consts.warnBytes).toBe(500 * 1024);
    expect(consts.maxNodes).toBe(2000);
    expect(consts.warnNodes).toBe(200);
  });

  test("5P2.PS2 small patch (1 node) applies with no warning dialog", async ({ page }) => {
    await openCleanApp(page);
    const before = await nodeCount(page);
    await openPatchModal(page);
    await page.evaluate(() => {
      (document.getElementById("pt") as HTMLTextAreaElement).value =
        JSON.stringify({ canvasId: "vault", nodes: [{ label: "Hello" }], edges: [] });
    });
    // Fire apply and wait for the modal to close (success path, no uiConfirm).
    await page.evaluate(() => (window as any).applyPatch());
    await page.waitForFunction(
      () => !document.getElementById("modal")?.classList.contains("on"),
      null,
      { timeout: 3_000 }
    );
    expect(await nodeCount(page)).toBe(before + 1);
  });

  test("5P2.PS3 oversize paste (>MAX_BYTES) is refused with uiNotice and no nodes added", async ({ page }) => {
    await openCleanApp(page);
    const before = await nodeCount(page);
    await openPatchModal(page);
    // Craft an over-MAX blob without actually allocating 10MB per keystroke.
    await page.evaluate(() => {
      const MAX = (window as any).PATCH_MAX_BYTES as number;
      // "a".repeat is the fastest way to grow — one allocation.
      (document.getElementById("pt") as HTMLTextAreaElement).value = "a".repeat(MAX + 10);
    });
    const resultPromise = page.evaluate(() => (window as any).applyPatch());
    // Phase 2 added extra <link>/<script> tags on page load; the dialog
    // sometimes opens just past the old 5s budget on slow runners. Bumping
    // to 10s gives slack without masking actual regressions.
    await page.waitForSelector("#dlg.on", { state: "visible", timeout: 10_000 });
    await expect(page.locator("#dlg h3")).toHaveText("Patch too large");
    await page.locator("#dlg button.pr").click();
    await resultPromise;
    // No nodes added — the guard short-circuited before JSON.parse.
    expect(await nodeCount(page)).toBe(before);
  });

  test("5P2.PS4 warn-size paste (>WARN_BYTES, <MAX_BYTES) prompts uiConfirm; Cancel → no change", async ({ page }) => {
    await openCleanApp(page);
    const before = await nodeCount(page);
    await openPatchModal(page);
    await page.evaluate(() => {
      const WARN = (window as any).PATCH_WARN_BYTES as number;
      // Pad with whitespace inside a valid JSON array so the bytes trip the
      // size guard. Content doesn't matter — we expect Cancel before parse.
      const payload = JSON.stringify({ canvasId: "vault", nodes: [{ label: "x" }], edges: [] });
      const pad = " ".repeat(WARN + 1000);
      (document.getElementById("pt") as HTMLTextAreaElement).value = payload + pad;
    });
    const resultPromise = page.evaluate(() => (window as any).applyPatch());
    // Phase 2 added extra <link>/<script> tags on page load; the dialog
    // sometimes opens just past the old 5s budget on slow runners. Bumping
    // to 10s gives slack without masking actual regressions.
    await page.waitForSelector("#dlg.on", { state: "visible", timeout: 10_000 });
    await expect(page.locator("#dlg h3")).toHaveText("Large patch");
    // Cancel — no nodes added.
    await page.locator("#dlg button[data-ui-cancel]").click();
    await resultPromise;
    expect(await nodeCount(page)).toBe(before);
  });

  test("5P2.PS5 warn-size paste + Apply anyway → patch applies normally", async ({ page }) => {
    await openCleanApp(page);
    const before = await nodeCount(page);
    await openPatchModal(page);
    await page.evaluate(() => {
      const WARN = (window as any).PATCH_WARN_BYTES as number;
      const payload = JSON.stringify({ canvasId: "vault", nodes: [{ label: "BigNote" }], edges: [] });
      const pad = " ".repeat(WARN + 1000);
      (document.getElementById("pt") as HTMLTextAreaElement).value = payload + pad;
    });
    const resultPromise = page.evaluate(() => (window as any).applyPatch());
    // Phase 2 added extra <link>/<script> tags on page load; the dialog
    // sometimes opens just past the old 5s budget on slow runners. Bumping
    // to 10s gives slack without masking actual regressions.
    await page.waitForSelector("#dlg.on", { state: "visible", timeout: 10_000 });
    // Click the primary button (Apply anyway).
    await page.locator("#dlg button.pr").click();
    await resultPromise;
    expect(await nodeCount(page)).toBe(before + 1);
  });

  test("5P2.PS6 too many nodes (>MAX_NODES) is refused with uiNotice", async ({ page }) => {
    await openCleanApp(page);
    const before = await nodeCount(page);
    await openPatchModal(page);
    // Build a patch with MAX_NODES+1 nodes but kept under WARN_BYTES via short labels.
    await page.evaluate(() => {
      const MAX = (window as any).PATCH_MAX_NODES as number;
      const nodes = Array.from({ length: MAX + 1 }, (_, i) => ({ label: "n" + i }));
      (document.getElementById("pt") as HTMLTextAreaElement).value = JSON.stringify({
        canvasId: "vault", nodes, edges: []
      });
    });
    const resultPromise = page.evaluate(() => (window as any).applyPatch());
    // Phase 2 added extra <link>/<script> tags on page load; the dialog
    // sometimes opens just past the old 5s budget on slow runners. Bumping
    // to 10s gives slack without masking actual regressions.
    await page.waitForSelector("#dlg.on", { state: "visible", timeout: 10_000 });
    await expect(page.locator("#dlg h3")).toHaveText("Too many nodes");
    await page.locator("#dlg button.pr").click();
    await resultPromise;
    expect(await nodeCount(page)).toBe(before);
  });

  test("5P2.PS7 patchNodeCount aggregates across raw.patches[]", async ({ page }) => {
    await openCleanApp(page);
    const totals = await page.evaluate(() => {
      const fn = (window as any).patchNodeCount;
      return {
        single: fn({ nodes: [{}, {}, {}] }),
        multi: fn({ patches: [{ nodes: [{}, {}] }, { nodes: [{}] }, { nodes: [] }] }),
        empty: fn({}),
      };
    });
    expect(totals.single).toBe(3);
    expect(totals.multi).toBe(3);
    expect(totals.empty).toBe(0);
  });
});
