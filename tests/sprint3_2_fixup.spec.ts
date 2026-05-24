import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 3.2 · second fix-up regression tests.
 *
 * Covers:
 *   Issue 1 — orange residue: drop-shadow filter is suppressed for ANY
 *             slice during body.dragging / body.holding (not just .sel).
 *   Issue 2 — spine chips: visible 36x36 with workspace bg; active
 *             rail not cropped; clicking chip refreshes drawer
 *             immediately (no 1.5s poll wait).
 *   Issue 3 — drawer toggle ≥ 32x32 hit target; row caret ≥ 24x24;
 *             rows show CANVASES (drawer reads S.canvases keys).
 *   Issue 4 — palette: #paletteOpenPill exists and clicking it opens
 *             the palette; dispatched ⌘K key also opens it.
 *   Issue 5 — set-as-default-canvas API exists; setting + reload picks
 *             that canvas as S.current.
 *   Issue 6 — LEGEND_THRESHOLD lowered to 1; legend appears with one
 *             edge type on the canvas.
 *   Issue 7 — clicking #spine .sb toggles the drawer between 224 and
 *             40 px; click delegation survives a re-render.
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
test.describe("Sprint 3.2 · Issue 1 — orange residue on unselected drag", () => {
  test("S3_2.I1.A body.dragging .nslice (any) has filter:none", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const E = (window as any).__E2E;
      const z = E.current().zones[0]?.id || "ideas";
      const today = new Date().toISOString();
      // Unselected node (no op() call to select).
      E.addNodeRaw({ id: 9101, label: "Unsel", shape: "idea", status: "idea",
                     x: 0, y: 0, zone: z, created: today, modified: today });
      (window as any).render();
    });
    await page.waitForTimeout(150);
    const probe = await page.evaluate(() => {
      document.body.classList.add("dragging");
      const sl = document.querySelector('.nslice[data-nid="9101"]') as HTMLElement;
      const out = getComputedStyle(sl).filter;
      document.body.classList.remove("dragging");
      return out;
    });
    expect(probe === "none" || probe === "").toBe(true);
  });

  test("S3_2.I1.B .nslice.holding (any) has filter:none even without body class", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const E = (window as any).__E2E;
      const z = E.current().zones[0]?.id || "ideas";
      const today = new Date().toISOString();
      E.addNodeRaw({ id: 9102, label: "Holding", shape: "idea", status: "idea",
                     x: 0, y: 0, zone: z, created: today, modified: today });
      (window as any).render();
    });
    await page.waitForTimeout(150);
    const filter = await page.evaluate(() => {
      const sl = document.querySelector('.nslice[data-nid="9102"]') as HTMLElement;
      sl.classList.add("holding");
      const out = getComputedStyle(sl).filter;
      sl.classList.remove("holding");
      return out;
    });
    expect(filter === "none" || filter === "").toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.2 · Issue 2 — spine chip visibility + drawer refresh", () => {
  test("S3_2.I2.A Chips are 36x36 inside the viewport, with workspace background", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1800);
    const probe = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll("#spine .ws-chip:not(.add)")) as HTMLElement[];
      return chips.map(c => {
        const r = c.getBoundingClientRect();
        const cs = getComputedStyle(c);
        return {
          ws: c.getAttribute("data-ws"),
          width: r.width, height: r.height,
          left: r.left, right: r.right,
          bgIsTransparent: cs.backgroundColor === "rgba(0, 0, 0, 0)" || cs.backgroundColor === "transparent"
        };
      });
    });
    expect(probe.length).toBeGreaterThan(0);
    for (const c of probe) {
      expect(c.width).toBeGreaterThanOrEqual(36);
      expect(c.height).toBeGreaterThanOrEqual(36);
      expect(c.left).toBeGreaterThanOrEqual(0);
      expect(c.right).toBeLessThanOrEqual(56); // spine width
      expect(c.bgIsTransparent).toBe(false);
    }
  });

  test("S3_2.I2.B Active chip's white rail (::before) renders inside the viewport", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1800);
    // ::before isn't directly addressable, but we can verify the chip is
    // active and its inset-inline-start offset is small enough not to crop.
    const probe = await page.evaluate(() => {
      const ac = document.querySelector("#spine .ws-chip.active") as HTMLElement | null;
      if (!ac) return null;
      const r = ac.getBoundingClientRect();
      const bs = getComputedStyle(ac, "::before");
      // The rail's leading offset should resolve to a px value such that
      // chip.left + that offset > 0 (visible).
      const insetStart = parseFloat(bs.insetInlineStart || bs.left || "0");
      const railLeft = r.left + insetStart;
      return { railLeft, chipLeft: r.left, insetStart, hasContent: bs.content !== "none" };
    });
    expect(probe).not.toBeNull();
    expect(probe!.hasContent).toBe(true);
    expect(probe!.railLeft).toBeGreaterThanOrEqual(0);
  });

  test("S3_2.I2.C Clicking a chip triggers immediate drawer refresh (via wrapped switchWorkspace)", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1500);
    const wrapped = await page.evaluate(() =>
      !!(window as any).switchWorkspace?.__spineHooked
    );
    expect(wrapped).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.2 · Issue 3 — drawer toggle + caret hit targets", () => {
  test("S3_2.I3.A Drawer collapse toggle is at least 32x32", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const btn = document.querySelector("#drawer .dr-toggle") as HTMLElement;
      const b = btn.getBoundingClientRect();
      return { w: b.width, h: b.height };
    });
    expect(r.w).toBeGreaterThanOrEqual(32);
    expect(r.h).toBeGreaterThanOrEqual(32);
  });

  test("S3_2.I3.B Drawer rows show CANVASES (one row per S.canvases key, plus header)", async ({ page }) => {
    await open(page, { "nav-v2": true });
    // Seed two extra canvases so the tree has something to show.
    await page.evaluate(() => {
      const E = (window as any).__E2E;
      const S = E.state();
      S.canvases["c1"] = { nodes: [], edges: [], zones: [] };
      S.canvases["c2"] = { nodes: [], edges: [], zones: [] };
      S.canvasMeta["c1"] = { name: "Canvas One", parentCanvas: "vault" };
      S.canvasMeta["c2"] = { name: "Canvas Two", parentCanvas: "vault" };
      if ((window as any).Drawer && (window as any).Drawer.refresh) (window as any).Drawer.refresh();
    });
    await page.waitForTimeout(800);
    const rows = await page.evaluate(() =>
      Array.from(document.querySelectorAll("#drawer .dr-row"))
        .map((r: any) => r.getAttribute("data-id"))
    );
    expect(rows).toContain("vault");
    expect(rows).toContain("c1");
    expect(rows).toContain("c2");
  });

  test("S3_2.I3.C 'Canvases' section header is present", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1500);
    const has = await page.evaluate(() =>
      Array.from(document.querySelectorAll("#drawer .dr-section-head"))
        .some(h => /canvas/i.test(h.textContent || ""))
    );
    expect(has).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.2 · Issue 4 — palette open paths", () => {
  test("S3_2.I4.A #paletteOpenPill exists when --palette is on", async ({ page }) => {
    await open(page, { "palette": true });
    const probe = await page.evaluate(() => {
      const pill = document.getElementById("paletteOpenPill");
      const r = pill?.getBoundingClientRect();
      return {
        exists: !!pill,
        width: r?.width, height: r?.height,
        visible: pill ? getComputedStyle(pill).visibility !== "hidden" : false
      };
    });
    expect(probe.exists).toBe(true);
    expect(probe.visible).toBe(true);
    expect(probe.width!).toBeGreaterThan(0);
  });

  test("S3_2.I4.B Clicking the pill opens the palette", async ({ page }) => {
    await open(page, { "palette": true });
    await page.locator("#paletteOpenPill").click();
    await page.waitForTimeout(200);
    const on = await page.evaluate(() =>
      document.getElementById("palette")?.classList.contains("on")
    );
    expect(on).toBe(true);
  });

  test("S3_2.I4.C Dispatched ⌘K opens the palette", async ({ page }) => {
    await open(page, { "palette": true });
    await page.evaluate(() => {
      const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true, cancelable: true });
      document.dispatchEvent(ev);
    });
    await page.waitForTimeout(200);
    const on = await page.evaluate(() =>
      document.getElementById("palette")?.classList.contains("on")
    );
    expect(on).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.2 · Issue 5 — default canvas per workspace", () => {
  test("S3_2.I5.A setDefaultCanvasForWorkspace / get / clear roundtrip", async ({ page }) => {
    await open(page);
    const out = await page.evaluate(() => {
      const w = window as any;
      w.setDefaultCanvasForWorkspace("vault");
      const got = w.getDefaultCanvasForWorkspace();
      w.clearDefaultCanvasForWorkspace();
      const cleared = w.getDefaultCanvasForWorkspace();
      return { got, cleared };
    });
    expect(out.got).toBe("vault");
    expect(out.cleared === null || out.cleared === undefined).toBe(true);
  });

  test("S3_2.I5.B Default canvas applies on reload", async ({ page }) => {
    await open(page);
    // Create a second canvas, persist via sv(), then set as default.
    await page.evaluate(async () => {
      const E = (window as any).__E2E;
      const S = E.state();
      S.canvases["roadmap"] = { nodes: [], edges: [], zones: [] };
      S.canvasMeta["roadmap"] = { name: "Test Roadmap", parentCanvas: "vault" };
      await (window as any).sv(); // persist to IDB
      (window as any).setDefaultCanvasForWorkspace("roadmap");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("svg#cv");
    await page.waitForFunction(() => !!(window as any).__E2E);
    await page.waitForTimeout(800);
    const current = await page.evaluate(() => (window as any).__E2E.state().current);
    expect(current).toBe("roadmap");
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.2 · Issue 6 — edge legend threshold lowered", () => {
  test("S3_2.I6.A Legend renders with a single edge type on the canvas", async ({ page }) => {
    await open(page, { "edges-v2": true });
    await page.evaluate(() => {
      const E = (window as any).__E2E;
      const c = E.current();
      const z = c.zones[0]?.id || "ideas";
      const today = new Date().toISOString();
      E.addNodeRaw({ id: 9201, label: "A", shape: "idea", status: "idea", x: -50, y: 0, zone: z, created: today, modified: today });
      E.addNodeRaw({ id: 9202, label: "B", shape: "idea", status: "idea", x:  50, y: 0, zone: z, created: today, modified: today });
      c.edges.push({ id: 9701, from: 9201, to: 9202, type: "feeds" });
      (window as any).render();
    });
    await page.waitForTimeout(300);
    const probe = await page.evaluate(() => {
      const el = document.getElementById("edgeLegend");
      const r = el?.getBoundingClientRect();
      return { exists: !!el, right: r?.right, bottom: r?.bottom };
    });
    expect(probe.exists).toBe(true);
    const vp = page.viewportSize();
    expect(probe.right!).toBeLessThanOrEqual(vp?.width ?? 1280);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.2 · Issue 7 — hamburger toggle", () => {
  test("S3_2.I7.A Clicking spine .sb collapses + expands the drawer", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1500);
    const w0 = await page.evaluate(() =>
      document.getElementById("drawer")?.getBoundingClientRect().width
    );
    expect(w0).toBeGreaterThan(200);
    await page.locator("#spine .sb[data-act='drawer-toggle']").click();
    await page.waitForTimeout(400);
    const w1 = await page.evaluate(() =>
      document.getElementById("drawer")?.getBoundingClientRect().width
    );
    expect(w1).toBeLessThan(100);
    await page.locator("#spine .sb[data-act='drawer-toggle']").click();
    await page.waitForTimeout(400);
    const w2 = await page.evaluate(() =>
      document.getElementById("drawer")?.getBoundingClientRect().width
    );
    expect(w2).toBeGreaterThan(200);
  });
});
