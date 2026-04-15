import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 5 P1 · Item #2 — live preview + autosave for the property panel.
 *
 * Design intent:
 *   - Typed input (label, notes, rationale, url, tags, etc.) no longer
 *     needs a Save click: each keystroke re-renders the canvas + sidebar
 *     (live preview), and the full state persists after a 200ms debounce.
 *   - Selects + checkboxes commit immediately (no debounce).
 *   - One undo-snapshot per panel session — Ctrl+Z walks back to before
 *     the panel opened, not one keystroke at a time.
 *   - Focus stays inside the active textarea/input during typing (the
 *     panel innerHTML is NOT rebuilt on each keystroke).
 *   - Close button flushes any pending debounce before the panel closes.
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
  await page.waitForTimeout(400); // let post-load zF() settle
}

/** Seed one node + open its property panel. */
async function seedAndOpen(page: Page, seed?: Record<string, any>) {
  const id = await page.evaluate((s) => {
    const E = (window as any).__E2E;
    const cur = E.current();
    const id = Math.max(0, ...cur.nodes.map((n: any) => n.id)) + 1;
    E.addNodeRaw({ id, x: 0, y: 0, shape: "idea", label: "start", status: "idea", zone: (cur.zones[0]?.id) || "inbox", ...s });
    (window as any).op((window as any).__E2E.current().nodes.find((n: any) => n.id === id));
    return id;
  }, seed || {});
  await page.waitForSelector("#pn", { state: "visible", timeout: 5_000 });
  return id;
}

test.describe("Phase 5 P1 · Live preview + autosave", () => {
  test("5.2.1 typing in label updates the rendered node label live (no Save click)", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedAndOpen(page);
    // Type into the label field — every keystroke should re-render the canvas.
    const input = page.locator("#f_label");
    await input.fill("");
    await input.type("Live preview!");
    // Label renders into the per-node overlay slice (.nslice[data-nid]) —
    // g.node[data-id] is just the invisible hit target. textContent of the
    // slice's SVG walks both the label <text> and the richContent block.
    const rendered = await page.evaluate((nid) => {
      const slice = document.querySelector(`.nslice[data-nid="${nid}"]`);
      return slice ? (slice as Element).textContent : null;
    }, id);
    expect(rendered).toContain("Live preview");
  });

  test("5.2.2 typing in notes persists after 200ms debounce (reload survives)", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedAndOpen(page);
    await page.locator("#f_notes").fill("debounce persisted text");
    // Wait past the 200ms debounce — autosave should fire sv().
    await page.waitForTimeout(350);
    // Reload the page; open the same node; notes field should retain the text.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("svg#cv", { state: "attached" });
    await page.waitForFunction(() => !!(window as any).__E2E);
    await page.waitForTimeout(400);
    const persisted = await page.evaluate((nid) => {
      const n = (window as any).__E2E.current().nodes.find((x: any) => x.id === nid);
      return n?.notes ?? null;
    }, id);
    expect(persisted).toBe("debounce persisted text");
  });

  test("5.2.3 close button flushes pending debounce before clearing selection", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedAndOpen(page);
    // Type, then call cp() BEFORE 200ms elapses. (.pn-close X is mobile-only
    // under media query, so call cp() directly — same code path the "Close"
    // toolbar button invokes.)
    await page.locator("#f_notes").fill("flushed on close");
    await page.evaluate(() => (window as any).cp());
    await expect(page.locator("#pn")).toBeHidden();
    // aFlush() synchronously mutates node.notes via applyFn before firing sv().
    // Verify the in-memory state immediately — proves the flush path ran.
    const memoryState = await page.evaluate((nid) => {
      const n = (window as any).__E2E.current().nodes.find((x: any) => x.id === nid);
      return n?.notes ?? null;
    }, id);
    expect(memoryState).toBe("flushed on close");
    // Give WebKit's IndexedDB transaction time to commit before we nav away.
    // sv() is async and aFlush() fires-and-forgets it; on WebKit the reload
    // can arrive before the IDB write settles.
    await page.waitForTimeout(250);
    // Reload to prove it hit IndexedDB, not just memory.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("svg#cv", { state: "attached" });
    await page.waitForFunction(() => !!(window as any).__E2E);
    await page.waitForTimeout(400);
    const persisted = await page.evaluate((nid) => {
      const n = (window as any).__E2E.current().nodes.find((x: any) => x.id === nid);
      return n?.notes ?? null;
    }, id);
    expect(persisted).toBe("flushed on close");
  });

  test("5.2.4 typing keeps focus inside the textarea (panel not rebuilt per keystroke)", async ({ page }) => {
    await openCleanApp(page);
    await seedAndOpen(page);
    const ta = page.locator("#f_notes");
    await ta.focus();
    await page.keyboard.type("abc");
    // After typing, the focused element must still be #f_notes.
    const focusedId = await page.evaluate(() => document.activeElement?.id ?? null);
    expect(focusedId).toBe("f_notes");
    // And its value should contain what we typed.
    const val = await ta.inputValue();
    expect(val).toContain("abc");
  });

  test("5.2.5 changing shape select rebuilds the panel with shape-specific fields", async ({ page }) => {
    await openCleanApp(page);
    await seedAndOpen(page, { shape: "idea", notes: "body text" });
    // Baseline: #f_notes exists, #f_rationale exists (idea shape shows rationale).
    await expect(page.locator("#f_rationale")).toHaveCount(1);
    // Switch shape to 'note' — onchange fires aField(immediate) + op(sel).
    await page.locator("#f_shape").selectOption("note");
    // Panel rebuilds: rationale field is hidden for notes; notes textarea gains min-height.
    await expect(page.locator("#f_rationale")).toHaveCount(0);
    const noteTa = page.locator("#f_notes");
    await expect(noteTa).toBeVisible();
    const minH = await noteTa.evaluate((el) => getComputedStyle(el).minHeight);
    expect(parseInt(minH)).toBeGreaterThanOrEqual(140);
  });

  test("5.2.6 multi-keystroke edit produces a SINGLE undo snapshot per panel session", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedAndOpen(page, { label: "orig" });
    // Type many characters — each keystroke calls aField() which gates sn()
    // via autosaveSnapped, so only the FIRST keystroke should push to hist.
    const input = page.locator("#f_label");
    await input.fill("");
    await input.type("typed-many-chars");
    // Close to flush + reset autosaveSnapped.
    await page.evaluate(() => (window as any).cp());
    // Call un() directly (Ctrl+Z is suppressed when an INPUT/TEXTAREA has focus
    // so the test doesn't rely on keyboard dispatch — we're testing the snap
    // count, not the keyboard wiring).
    await page.evaluate(() => (window as any).un());
    const label = await page.evaluate((nid) => {
      const n = (window as any).__E2E.current().nodes.find((x: any) => x.id === nid);
      return n?.label ?? null;
    }, id);
    expect(label).toBe("orig");
  });
});
