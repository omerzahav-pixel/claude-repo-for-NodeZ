import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 5 P2 · Expandable description field.
 *
 * Design intent:
 *   - Textareas in the property panel auto-grow to fit their content up
 *     to 50% of viewport height; beyond that they scroll inside.
 *     Rationale: on iPad, the tiny fixed 64-pixel textarea was awkward
 *     for typing a real description.
 *   - Every textarea label gets a ⇱ expand button that opens the same
 *     field inside the modal overlay at 60vh tall for focused writing.
 *     Typing in the expanded textarea updates the node in real time
 *     (same aField() path); closing syncs the panel textarea.
 *   - CSS resize:none on the panel textareas — height is managed by
 *     aGrow().
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

/** Seed a node with enough initial notes to force auto-grow past 64px. */
async function seedNodeWithNotes(page: Page, notes: string) {
  return page.evaluate((n) => {
    const E = (window as any).__E2E;
    const cur = E.current();
    const id = Math.max(0, ...cur.nodes.map((x: any) => x.id)) + 1;
    E.addNodeRaw({ id, x: 0, y: 0, shape: "idea", label: "exp", status: "idea", notes: n, zone: (cur.zones[0]?.id) || "inbox" });
    return id;
  }, notes);
}

async function nodeClientCenter(page: Page, id: number) {
  return page.evaluate((nid) => {
    const g = document.querySelector(`g.node[data-id="${nid}"]`);
    if (!g) throw new Error("g.node not rendered for id " + nid);
    const r = g.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, id);
}

test.describe("Phase 5 P2 · Expandable description field", () => {
  test("5P2.E1 empty notes textarea starts at min-height (not bigger)", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedNodeWithNotes(page, "");
    const c = await nodeClientCenter(page, id);
    await page.mouse.click(c.x, c.y);
    await page.waitForSelector("#pn.on", { state: "visible", timeout: 2_000 });
    const h = await page.evaluate(() => {
      const ta = document.getElementById("f_notes") as HTMLTextAreaElement;
      return ta ? ta.getBoundingClientRect().height : null;
    });
    expect(h).not.toBeNull();
    // Empty textarea: aGrow() sets height to scrollHeight which respects
    // min-height (64px). Some UA rendering variance is fine — just assert
    // it's at the floor, not 200px tall.
    expect(h!).toBeGreaterThan(30);
    expect(h!).toBeLessThan(120);
  });

  test("5P2.E2 long notes auto-grow beyond min-height on panel open", async ({ page }) => {
    await openCleanApp(page);
    // 20 lines should clearly exceed the 64px floor.
    const longNotes = Array.from({ length: 20 }, (_, i) => `line ${i + 1} of a long body`).join("\n");
    const id = await seedNodeWithNotes(page, longNotes);
    const c = await nodeClientCenter(page, id);
    await page.mouse.click(c.x, c.y);
    await page.waitForSelector("#pn.on", { state: "visible", timeout: 2_000 });
    const h = await page.evaluate(() => {
      const ta = document.getElementById("f_notes") as HTMLTextAreaElement;
      return ta ? ta.getBoundingClientRect().height : null;
    });
    expect(h).not.toBeNull();
    expect(h!).toBeGreaterThan(180);
    // And capped at 50vh — so not taller than half the viewport.
    const cap = await page.evaluate(() => Math.round(window.innerHeight * 0.5) + 4);
    expect(h!).toBeLessThan(cap);
  });

  test("5P2.E3 typing makes textarea grow on each keystroke", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedNodeWithNotes(page, "");
    const c = await nodeClientCenter(page, id);
    await page.mouse.click(c.x, c.y);
    await page.waitForSelector("#pn.on", { state: "visible", timeout: 2_000 });
    const before = await page.evaluate(() => {
      const ta = document.getElementById("f_notes") as HTMLTextAreaElement;
      return ta.getBoundingClientRect().height;
    });
    // Type 10 lines of text via keyboard — slow enough to trigger inputs.
    const ta = page.locator("#f_notes");
    await ta.focus();
    for (let i = 0; i < 10; i++) {
      await ta.type(`row ${i}`);
      await page.keyboard.press("Enter");
    }
    const after = await page.evaluate(() => {
      const ta = document.getElementById("f_notes") as HTMLTextAreaElement;
      return ta.getBoundingClientRect().height;
    });
    expect(after).toBeGreaterThan(before);
  });

  test("5P2.E4 expand button opens modal with node's current notes pre-filled", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedNodeWithNotes(page, "pre-existing body text");
    const c = await nodeClientCenter(page, id);
    await page.mouse.click(c.x, c.y);
    await page.waitForSelector("#pn.on", { state: "visible", timeout: 2_000 });
    // The notes label has a .flabel wrapper + .expandBtn.
    const btn = page.locator("label.flabel:has(#f_notes) .expandBtn, label.flabel .expandBtn").first();
    // Fallback: the first expandBtn near f_notes
    await page.evaluate(() => {
      const lbl = document.querySelector(`label.flabel + textarea#f_notes`)?.previousElementSibling as HTMLElement | null;
      const b = lbl?.querySelector(".expandBtn") as HTMLButtonElement | null;
      if (b) b.click();
    });
    await page.waitForSelector("#modal.on #ef_body", { state: "visible", timeout: 2_000 });
    const val = await page.evaluate(() => (document.getElementById("ef_body") as HTMLTextAreaElement).value);
    expect(val).toBe("pre-existing body text");
  });

  test("5P2.E5 typing inside expand modal updates node; close syncs panel textarea", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedNodeWithNotes(page, "start");
    const c = await nodeClientCenter(page, id);
    await page.mouse.click(c.x, c.y);
    await page.waitForSelector("#pn.on", { state: "visible", timeout: 2_000 });
    // Open expand modal via the JS path.
    await page.evaluate(() => (window as any).expandField("f_notes", "notes", "Notes"));
    await page.waitForSelector("#modal.on #ef_body", { state: "visible", timeout: 2_000 });
    const efBody = page.locator("#ef_body");
    await efBody.focus();
    await efBody.fill("totally new body written in expand view");
    // Wait past autosave debounce so aField commits and sel mutates.
    await page.waitForTimeout(300);
    const nodeNotes = await page.evaluate((nid) => {
      const E = (window as any).__E2E;
      return E.current().nodes.find((n: any) => n.id === nid).notes;
    }, id);
    expect(nodeNotes).toBe("totally new body written in expand view");
    // Close expand; panel textarea should re-sync with the new value.
    await page.evaluate(() => (window as any).closeExpanded("f_notes", "notes"));
    await page.waitForTimeout(200); // let modal close settle
    const panelVal = await page.evaluate(() => (document.getElementById("f_notes") as HTMLTextAreaElement).value);
    expect(panelVal).toBe("totally new body written in expand view");
  });

  test("5P2.E6 every panel textarea carries the expand button", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedNodeWithNotes(page, "");
    const c = await nodeClientCenter(page, id);
    await page.mouse.click(c.x, c.y);
    await page.waitForSelector("#pn.on", { state: "visible", timeout: 2_000 });
    // Open the Details section so f_rationale renders.
    await page.evaluate(() => {
      const d = document.querySelector("#pn details.pn-more") as HTMLDetailsElement | null;
      if (d) d.open = true;
    });
    await page.waitForTimeout(100);
    const count = await page.locator("#pn .expandBtn").count();
    // Non-formula/non-note default shape: f_notes + f_rationale = 2.
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
