import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 7 (part 1) — node anatomy done right (Issue 1).
 *
 * The headline fix that missed in Sprint 5 AND 6: the node title rendered as an
 * SVG label BELOW the rectangle, and glyph nodes had no in-card content. Now every
 * non-note/formula node renders a content CARD — title (bold) + body (clamped +
 * fade) INSIDE the rectangle, status stripe on the inline-start edge, NO label
 * below. Project nodes get a richer metadata block (sub-canvas + node count).
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
  await page.waitForTimeout(400);
}

test.describe("Sprint 7 · node anatomy", () => {
  test("S7.A build stamp is 7.0.0", async ({ page }) => {
    await open(page, { "perf-hud": true });
    await page.waitForTimeout(300);
    const meta = await page.evaluate(() => document.querySelector('meta[name="edgespace-build"]')?.getAttribute("content"));
    expect(meta).toContain("7.0.0");
  });

  test("S7.1 title + body render INSIDE the card; NO label below the node", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const E = (window as any).__E2E; const c = E.current();
      c.nodes = [{ id: 7001, x: 0, y: 0, shape: "experiment", status: "progress", label: "create signal bot per strategy", notes: "spin up one bot per strategy", zone: null }];
      c.edges = [];
      const v = E.view(); v.x = 0; v.y = 0; v.k = 1.2;
      (window as any).render();
    });
    const r = await page.evaluate(() => {
      const sl = document.querySelector('.nslice[data-nid="7001"]');
      return {
        title: sl?.querySelector(".ncard-title")?.textContent || "",
        hasBody: !!sl?.querySelector(".ncard-body"),
        belowLabel: !!sl?.querySelector("svg text"), // any SVG label below the rect?
      };
    });
    expect(r.title).toContain("signal bot");   // title is INSIDE the card
    expect(r.hasBody).toBe(true);              // body is INSIDE the card
    expect(r.belowLabel).toBe(false);          // and there's NO label below the node
  });

  test("S7.1b project node shows a richer metadata block (sub-canvas + node count)", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const E = (window as any).__E2E; const S = E.state();
      S.canvases["pc7"] = { nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 0 }], edges: [], zones: [] };
      const c = E.current();
      c.nodes = [{ id: 7002, x: 0, y: 0, shape: "project", status: "idea", label: "Algo Execution", notes: "exec layer", childCanvas: "pc7", zone: null }];
      c.edges = [];
      const v = E.view(); v.x = 0; v.y = 0; v.k = 1;
      (window as any).render();
    });
    const meta = await page.evaluate(() => document.querySelector('.nslice[data-nid="7002"] .ncard-meta')?.textContent || "");
    expect(meta).toContain("SUB-CANVAS");
    expect(meta).toContain("NODES");
  });

  // Issue 2 — info-panel fits a short viewport: body scrolls, footer (Save/Close/
  // Copy/Pull) stays on-screen, and the formula preview is contained (scrolls
  // horizontally instead of escaping the panel to the right).
  test("S7.2 info-panel body scrolls + footer buttons stay in view on a short viewport", async ({ page }) => {
    await open(page);
    await page.setViewportSize({ width: 900, height: 560 });
    await page.waitForFunction(() => !!(window as any).katex, null, { timeout: 15_000 });
    await page.evaluate(() => {
      const E = (window as any).__E2E; const c = E.current();
      c.nodes = [{
        id: 9001, x: 0, y: 0, shape: "formula", status: "progress",
        label: "Kelly fraction with a deliberately wide title for overflow",
        latex: "f^{*}=\\dfrac{p\\,(b+1)-1}{b}=\\dfrac{p}{a}-\\dfrac{q}{b}\\quad\\text{where}\\quad q=1-p",
        notes: "Bet a fixed fraction of bankroll equal to the edge over the odds. ".repeat(8),
        rationale: "Maximises long-run log growth. ".repeat(4),
        url: "https://example.com/kelly", tags: "sizing", confidence: 4, zone: null,
      }];
      c.edges = [];
      (window as any).panelDetailsOpen = true;
      (window as any).op(c.nodes[0]);
    });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const pn = document.getElementById("pn");
      const body = pn?.querySelector(".pn-body") as HTMLElement | null;
      const foot = pn?.querySelector(".pn-foot") as HTMLElement | null;
      const prev = document.getElementById("latexPreview") as HTMLElement | null;
      const btns = [...(foot?.querySelectorAll("button") || [])].map((b) => {
        const rc = b.getBoundingClientRect();
        return rc.bottom <= window.innerHeight + 1 && rc.top >= 0;
      });
      return {
        bodyScrolls: body ? body.scrollHeight > body.clientHeight + 2 : false,
        footInView: foot ? foot.getBoundingClientRect().bottom <= window.innerHeight + 1 : false,
        allBtnsInView: btns.length > 0 && btns.every(Boolean),
        previewContained: prev ? getComputedStyle(prev).overflowX === "auto" : false,
      };
    });
    expect(r.bodyScrolls).toBe(true);     // content overflows → body scrolls
    expect(r.footInView).toBe(true);      // footer is within the viewport
    expect(r.allBtnsInView).toBe(true);   // every action button is reachable
    expect(r.previewContained).toBe(true);// formula scrolls, doesn't escape
  });

  // Issue 3 — the More menu actually OPENS on-screen (Sprint 6 fix: centre it
  // when the legacy #moreBtn anchor is hidden under --toolbar-migrated).
  test("S7.3 More menu opens and lands inside the viewport", async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as any).toggleMore());
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
      const m = document.getElementById("more");
      if (!m || !m.classList.contains("on")) return { on: false, inView: false };
      const rc = m.getBoundingClientRect();
      const inView = rc.width > 0 && rc.height > 0 && rc.left >= 0 && rc.top >= 0
        && rc.right <= window.innerWidth + 1 && rc.bottom <= window.innerHeight + 1;
      return { on: true, inView };
    });
    expect(r.on).toBe(true);
    expect(r.inView).toBe(true);
  });
});
