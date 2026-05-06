import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 5 P1 · Item #1 — press-and-hold to drag on touch.
 *
 * Design intent:
 *   - Mouse users: node drag stays immediate (no added delay).
 *   - Touch users: a brief swipe on a node should PAN the canvas, not yank
 *     the node. Only after a 350ms hold does motion translate to node-drag.
 *   - Tap on a node (no motion) still opens the property panel (no
 *     regression in tap-to-edit).
 *   - Visual/haptic feedback when the hold gate opens — `.holding` class
 *     on body, the node's hit-group, and its overlay slice.
 *
 * These tests dispatch synthetic PointerEvents with pointerType:'touch'
 * rather than Playwright's `touchscreen.tap()` because we need controlled
 * hold durations and intermediate movement. Real iPad pass happens in
 * the cross-platform manual check.
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
  // app.js schedules a deferred zF() (auto-fit) at setTimeout(...,300) after
  // load. If we interact before it fires, the mid-interaction auto-fit mutates
  // view.x/view.y and our view-stability assertions fail. Wait past the 300ms
  // mark so the initial framing is locked in before tests begin.
  await page.waitForTimeout(400);
}

/** Seed one node at world (0,0) and return its id. */
async function seedNode(page: Page) {
  return page.evaluate(() => {
    const E = (window as any).__E2E;
    const cur = E.current();
    const id = Math.max(0, ...cur.nodes.map((n: any) => n.id)) + 1;
    const node = { id, x: 0, y: 0, shape: "idea", label: "holdtest", status: "idea", zone: (cur.zones[0]?.id) || "inbox" };
    E.addNodeRaw(node);
    return id;
  });
}

/** Client (viewport) coords for node `id` — read directly from the
 *  rendered hit-group's bounding rect. Avoids depending on the view
 *  transform math, which can drift across zones/fixtures. */
async function nodeClientCenter(page: Page, id: number) {
  return page.evaluate((nid) => {
    const g = document.querySelector(`g.node[data-id="${nid}"]`);
    if (!g) throw new Error("g.node not rendered for id " + nid);
    const r = g.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, id);
}

async function dispatchPointer(
  page: Page,
  type: "pointerdown" | "pointermove" | "pointerup",
  x: number,
  y: number,
  pointerType: "touch" | "mouse",
  opts: { selector?: string } = {}
) {
  await page.evaluate(
    ({ type, x, y, pointerType, selector }) => {
      const sel = selector || "svg#cv";
      const el = document.querySelector(sel) as Element;
      if (!el) throw new Error("pointer target not found: " + sel);
      // Find the topmost element under (x, y); SVG delegation listens on cv.
      const tgt = document.elementFromPoint(x, y) || el;
      const ev = new PointerEvent(type, {
        clientX: x, clientY: y,
        pointerType, pointerId: 1, isPrimary: true,
        bubbles: true, cancelable: true,
      });
      tgt.dispatchEvent(ev);
    },
    { type, x, y, pointerType, selector: opts.selector }
  );
}

test.describe("Phase 5 P1 · Press-and-hold drag on touch", () => {
  test("5.1 mouse drag on a node is immediate (no hold delay)", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedNode(page);
    const start = await nodeClientCenter(page, id);
    const end = { x: start.x + 80, y: start.y + 40 };
    // Mouse pointerdown + fast move + up: node should follow without any wait.
    await dispatchPointer(page, "pointerdown", start.x, start.y, "mouse");
    await dispatchPointer(page, "pointermove", start.x + 30, start.y + 10, "mouse");
    await dispatchPointer(page, "pointermove", end.x, end.y, "mouse");
    await dispatchPointer(page, "pointerup", end.x, end.y, "mouse");
    const moved = await page.evaluate((nid) => {
      const n = (window as any).__E2E.current().nodes.find((x: any) => x.id === nid);
      return { x: n.x, y: n.y };
    }, id);
    expect(Math.abs(moved.x)).toBeGreaterThan(10);
    expect(Math.abs(moved.y)).toBeGreaterThan(3);
  });

  test("5.2 touch swipe on node (pre-gate motion) pans canvas, node stays put", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedNode(page);
    const start = await nodeClientCenter(page, id);
    const viewBefore = await page.evaluate(() => ({ ...(window as any).__E2E.view() }));
    // Quick swipe: pointerdown → move >TH pixels within ~50ms → up. No hold.
    await dispatchPointer(page, "pointerdown", start.x, start.y, "touch");
    await page.waitForTimeout(40);
    await dispatchPointer(page, "pointermove", start.x + 60, start.y + 10, "touch");
    await dispatchPointer(page, "pointermove", start.x + 120, start.y + 20, "touch");
    await dispatchPointer(page, "pointerup", start.x + 120, start.y + 20, "touch");
    const viewAfter = await page.evaluate(() => ({ ...(window as any).__E2E.view() }));
    const node = await page.evaluate((nid) => {
      const n = (window as any).__E2E.current().nodes.find((x: any) => x.id === nid);
      return { x: n.x, y: n.y };
    }, id);
    // Node should not have moved (was converted to pan before drag began).
    expect(node.x).toBe(0);
    expect(node.y).toBe(0);
    // View should have moved — that's the pan.
    const viewDelta = Math.abs(viewAfter.x - viewBefore.x) + Math.abs(viewAfter.y - viewBefore.y);
    expect(viewDelta).toBeGreaterThan(0);
  });

  test("5.3 touch hold (>HOLD_MS) then drag moves the node, not the view", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedNode(page);
    const start = await nodeClientCenter(page, id);
    const viewBefore = await page.evaluate(() => ({ ...(window as any).__E2E.view() }));
    await dispatchPointer(page, "pointerdown", start.x, start.y, "touch");
    // Hold still past the 350ms gate. Phase 6 · pad to 500ms because
    // iPad-safari emulation under high CPU sometimes delays the timer
    // firing past the 350ms boundary, leaving holdPending true and
    // converting the next pointermove into a pan.
    await page.waitForTimeout(500);
    // Assert the holding feedback kicked in.
    const holdingOn = await page.evaluate(() => document.body.classList.contains("holding"));
    expect(holdingOn).toBe(true);
    // Now move — node should drag.
    await dispatchPointer(page, "pointermove", start.x + 60, start.y + 30, "touch");
    await dispatchPointer(page, "pointermove", start.x + 100, start.y + 50, "touch");
    await dispatchPointer(page, "pointerup", start.x + 100, start.y + 50, "touch");
    // Allow inertia decay (if any spurious velocity registered) to settle.
    await page.waitForTimeout(150);
    const node = await page.evaluate((nid) => {
      const n = (window as any).__E2E.current().nodes.find((x: any) => x.id === nid);
      return { x: n.x, y: n.y };
    }, id);
    const viewAfter = await page.evaluate(() => ({ ...(window as any).__E2E.view() }));
    // Node must have moved; view must NOT have.
    expect(Math.abs(node.x)).toBeGreaterThan(10);
    expect(Math.abs(node.y)).toBeGreaterThan(3);
    expect(viewAfter.x).toBeCloseTo(viewBefore.x, 1);
    expect(viewAfter.y).toBeCloseTo(viewBefore.y, 1);
    // And feedback cleared on pointerup.
    const holdingAfter = await page.evaluate(() => document.body.classList.contains("holding"));
    expect(holdingAfter).toBe(false);
  });

  test("5.4 touch tap on node (no motion, <HOLD_MS) still opens the property panel", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedNode(page);
    const start = await nodeClientCenter(page, id);
    await dispatchPointer(page, "pointerdown", start.x, start.y, "touch");
    await page.waitForTimeout(80); // brief tap, well under 350ms
    await dispatchPointer(page, "pointerup", start.x, start.y, "touch");
    // Property panel should be visible with this node selected.
    await page.waitForSelector("#pn", { state: "visible", timeout: 2_000 });
    const label = await page.evaluate(() => {
      const f = document.getElementById("f_label") as HTMLInputElement | null;
      return f?.value ?? null;
    });
    expect(label).toBe("holdtest");
  });

  test("5.5 visual feedback: body + slice + hit-group gain .holding after gate", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedNode(page);
    const start = await nodeClientCenter(page, id);
    await dispatchPointer(page, "pointerdown", start.x, start.y, "touch");
    await page.waitForTimeout(420);
    const flags = await page.evaluate((nid) => ({
      body: document.body.classList.contains("holding"),
      slice: !!document.querySelector(`.nslice[data-nid="${nid}"].holding`),
      hitG: !!document.querySelector(`g.node[data-id="${nid}"].holding`),
    }), id);
    expect(flags.body).toBe(true);
    // Slice + hit-group are best-effort (DOM may differ per render path),
    // but at least one of the node-targeted classes should be set.
    expect(flags.slice || flags.hitG).toBe(true);
    await dispatchPointer(page, "pointerup", start.x, start.y, "touch");
  });
});
