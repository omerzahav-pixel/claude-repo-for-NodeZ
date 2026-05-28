import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 3.1 · Fix-up regression tests.
 *
 * Covers:
 *   Issue 1 — double-tap to add node is now a hard no-op (touch + desktop).
 *   Issue 2 — fat invisible edge hit-target (.e2-hit / .edge-hit) renders
 *             with stroke-width 20 and pointer-events stroke.
 *   Issue 3 — EdgeDraw exposes a refresh() entrypoint; 4 .edge-handle
 *             elements appear in #edgeDrawHandles when a node is selected.
 *   Issue 4 — body.dragging .nslice.sel computes filter:none (no orange
 *             drop-shadow during drag).
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

async function seedTwoLinkedNodes(page: Page) {
  await page.evaluate(() => {
    const E = (window as any).__E2E;
    const c = E.current();
    const z = c.zones[0]?.id || "ideas";
    const today = new Date().toISOString();
    E.addNodeRaw({ id: 7101, label: "Alpha", shape: "idea", status: "idea",
                   x: -100, y: 0, zone: z, created: today, modified: today });
    E.addNodeRaw({ id: 7102, label: "Beta",  shape: "idea", status: "idea",
                   x:  100, y: 0, zone: z, created: today, modified: today });
    c.edges.push({ id: 7901, from: 7101, to: 7102, type: "feeds" });
    (window as any).render();
  });
}

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.1 · Issue 1 — double-tap is a no-op", () => {
  test("S3_1.I1.A Desktop double-click on empty canvas does NOT add a node", async ({ page }) => {
    await open(page);
    const before = await page.evaluate(() => (window as any).__E2E.current().nodes.length);
    // Aim well clear of any existing node and any chrome.
    await page.mouse.dblclick(400, 400);
    await page.waitForTimeout(120);
    const after = await page.evaluate(() => (window as any).__E2E.current().nodes.length);
    expect(after).toBe(before);
  });

  test("S3_1.I1.B Synthetic touch dblclick on empty canvas does NOT add a node", async ({ page }) => {
    await open(page);
    const before = await page.evaluate(() => (window as any).__E2E.current().nodes.length);
    // Simulate what the iPad pointerup → MouseEvent('dblclick') would do:
    // dispatch a dblclick directly on cv with a target that isn't a .node.
    await page.evaluate(() => {
      const cv = document.getElementById('cv')!;
      const ev = new MouseEvent('dblclick', { clientX: 500, clientY: 400, bubbles: true, cancelable: true });
      cv.dispatchEvent(ev);
    });
    await page.waitForTimeout(120);
    const after = await page.evaluate(() => (window as any).__E2E.current().nodes.length);
    expect(after).toBe(before);
  });

  test("S3_1.I1.C Double-click on a project node in the vault still opens the roadmap prompt", async ({ page }) => {
    await open(page);
    // Add a project node; vault is the default canvas.
    await page.evaluate(() => {
      const E = (window as any).__E2E;
      const z = E.current().zones[0]?.id || "ideas";
      E.addNodeRaw({ id: 7200, label: "Big project", shape: "project", status: "progress",
                     x: 0, y: 0, zone: z, created: new Date().toISOString(), modified: new Date().toISOString() });
      (window as any).render();
    });
    // Spy: replace uiConfirm with one that records the call.
    await page.evaluate(() => {
      (window as any).__roadmapConfirmCalls = 0;
      const orig = (window as any).uiConfirm;
      (window as any).uiConfirm = async (...args: any[]) => {
        if (String(args[0] || "").toLowerCase().includes("roadmap")) (window as any).__roadmapConfirmCalls++;
        return false; // decline so we don't actually create
      };
    });
    // Dispatch a dblclick on the .node element directly.
    await page.evaluate(() => {
      const nodeEl = document.querySelector('g.node[data-id="7200"]') as SVGGElement | null;
      if (!nodeEl) throw new Error("project node not in DOM");
      const r = nodeEl.getBoundingClientRect();
      const ev = new MouseEvent('dblclick', {
        clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
        bubbles: true, cancelable: true
      });
      // Force target since elementFromPoint may pick the hit-rect parent.
      Object.defineProperty(ev, 'target', { value: nodeEl });
      document.getElementById('cv')!.dispatchEvent(ev);
    });
    await page.waitForTimeout(200);
    const calls = await page.evaluate(() => (window as any).__roadmapConfirmCalls);
    expect(calls).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.1 · Issue 2 — fat edge hit-target", () => {
  test("S3_1.I2.A Every visible edge has a sibling hit-path with stroke 20 and pointer-events:stroke (v1)", async ({ page }) => {
    /* Sprint 4 §05 — edges-v2 is now default-on. Force OFF so this
       test specifically exercises the v1 .edge / .edge-hit path. */
    await open(page, { "edges-v2": false });
    await seedTwoLinkedNodes(page);
    const probe = await page.evaluate(() => {
      const visibles = Array.from(document.querySelectorAll('path.edge[data-edge="7901"]'));
      const hits     = Array.from(document.querySelectorAll('path.edge-hit[data-edge="7901"]'));
      const hit      = hits[0] as SVGPathElement | undefined;
      return {
        visibleCount: visibles.length,
        hitCount: hits.length,
        hitStroke: hit?.getAttribute('stroke'),
        hitWidth:  hit?.getAttribute('stroke-width'),
        hitPe:     hit?.getAttribute('pointer-events')
      };
    });
    expect(probe.visibleCount).toBe(1);
    expect(probe.hitCount).toBe(1);
    expect(probe.hitStroke).toBe('transparent');
    expect(probe.hitWidth).toBe('20');
    expect(probe.hitPe).toBe('stroke');
  });

  test("S3_1.I2.B Same for v2 edges (--edges-v2 on)", async ({ page }) => {
    await open(page, { "edges-v2": true });
    await seedTwoLinkedNodes(page);
    const probe = await page.evaluate(() => {
      const visibles = Array.from(document.querySelectorAll('path.e2[data-edge="7901"]'));
      const hits     = Array.from(document.querySelectorAll('path.e2-hit[data-edge="7901"]'));
      const hit      = hits[0] as SVGPathElement | undefined;
      return {
        visibleCount: visibles.length,
        hitCount: hits.length,
        hitWidth:  hit?.getAttribute('stroke-width'),
        hitPe:     hit?.getAttribute('pointer-events')
      };
    });
    expect(probe.visibleCount).toBe(1);
    expect(probe.hitCount).toBe(1);
    expect(probe.hitWidth).toBe('20');
    expect(probe.hitPe).toBe('stroke');
  });

  test("S3_1.I2.C EdgeControls.select() adds .e2-sel ONLY to the visible path, never the hit-path", async ({ page }) => {
    /* Sprint 4 §05 — edges-v2 is now default-on. Force OFF to exercise
       the v1 .edge path that this test selectors target. */
    await open(page, { "edges-v2": false });
    await seedTwoLinkedNodes(page);
    await page.evaluate(() => (window as any).EdgeControls.select(7901));
    await page.waitForTimeout(100);
    const probe = await page.evaluate(() => ({
      visibleSel: document.querySelectorAll('path.edge.e2-sel[data-edge="7901"]').length,
      hitSel:     document.querySelectorAll('path.edge-hit.e2-sel[data-edge="7901"]').length
    }));
    expect(probe.visibleSel).toBe(1);
    expect(probe.hitSel).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.1 · Issue 3 — edge-draw handles", () => {
  test("S3_1.I3.A EdgeDraw module installs and exposes refresh()", async ({ page }) => {
    await open(page);
    const ok = await page.evaluate(() => typeof (window as any).EdgeDraw?.refresh === 'function');
    expect(ok).toBe(true);
  });

  test("S3_1.I3.B Selecting a node mounts 4 handles in #edgeDrawHandles", async ({ page }) => {
    await open(page);
    await seedTwoLinkedNodes(page);
    // Open the property panel on node 7101 (this also sets sel).
    await page.evaluate(() => {
      const n = (window as any).__E2E.current().nodes.find((x: any) => x.id === 7101);
      (window as any).op(n);
      (window as any).render();
    });
    await page.waitForTimeout(150);
    const probe = await page.evaluate(() => {
      const layer = document.getElementById('edgeDrawHandles');
      const handles = Array.from(layer?.querySelectorAll('.edge-handle') || []);
      return {
        layerExists: !!layer,
        handleCount: handles.length,
        sides: handles.map(h => (h as HTMLElement).dataset.side).sort(),
        fromIds: handles.map(h => (h as HTMLElement).dataset.fromId)
      };
    });
    expect(probe.layerExists).toBe(true);
    expect(probe.handleCount).toBe(4);
    expect(probe.sides).toEqual(['bottom', 'left', 'right', 'top']);
    expect(probe.fromIds.every(id => id === '7101')).toBe(true);
  });

  test("S3_1.I3.C Deselecting a node clears the handles", async ({ page }) => {
    await open(page);
    await seedTwoLinkedNodes(page);
    await page.evaluate(() => {
      const n = (window as any).__E2E.current().nodes.find((x: any) => x.id === 7101);
      (window as any).op(n);
      (window as any).render();
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      (window as any).cp();
      (window as any).render();
    });
    await page.waitForTimeout(100);
    const handleCount = await page.evaluate(() =>
      document.querySelectorAll('#edgeDrawHandles .edge-handle').length
    );
    expect(handleCount).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.1 · Issue 4 — selection glow no longer trails", () => {
  test("S3_1.I4.A body.dragging .nslice.sel computes filter:none (no drop-shadow during drag)", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const E = (window as any).__E2E;
      const z = E.current().zones[0]?.id || "ideas";
      const today = new Date().toISOString();
      E.addNodeRaw({ id: 7301, label: "Drag me", shape: "idea", status: "idea",
                     x: 0, y: 0, zone: z, created: today, modified: today });
      const n = E.current().nodes.find((x: any) => x.id === 7301);
      (window as any).op(n); // selects + opens panel
      (window as any).render();
    });
    await page.waitForTimeout(150);
    // Verify the slice carries .sel class.
    const hadSel = await page.evaluate(() =>
      !!document.querySelector('.nslice.sel[data-nid="7301"]')
    );
    expect(hadSel).toBe(true);
    // Apply body.dragging and read the computed filter on the selected slice.
    const probe = await page.evaluate(() => {
      document.body.classList.add('dragging');
      const sl = document.querySelector('.nslice.sel[data-nid="7301"]') as HTMLElement;
      const cs = getComputedStyle(sl);
      const out = { filter: cs.filter, transition: cs.transition };
      document.body.classList.remove('dragging');
      return out;
    });
    // Filter is `none` or empty (browsers normalise differently).
    expect(probe.filter === 'none' || probe.filter === '').toBe(true);
  });

  test("S3_1.I4.B Static (non-dragging) .nslice.sel keeps its drop-shadow glow", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const E = (window as any).__E2E;
      const z = E.current().zones[0]?.id || "ideas";
      const today = new Date().toISOString();
      E.addNodeRaw({ id: 7401, label: "Static glow", shape: "idea", status: "idea",
                     x: 0, y: 0, zone: z, created: today, modified: today });
      const n = E.current().nodes.find((x: any) => x.id === 7401);
      (window as any).op(n);
      (window as any).render();
    });
    await page.waitForTimeout(150);
    const filter = await page.evaluate(() => {
      const sl = document.querySelector('.nslice.sel[data-nid="7401"]') as HTMLElement;
      return getComputedStyle(sl).filter;
    });
    expect(filter).toContain('drop-shadow');
  });

  test("S3_1.I4.C Selection-ring element count stays at 1 per selected node across renders", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const E = (window as any).__E2E;
      const z = E.current().zones[0]?.id || "ideas";
      const today = new Date().toISOString();
      E.addNodeRaw({ id: 7501, label: "Count check", shape: "idea", status: "idea",
                     x: 0, y: 0, zone: z, created: today, modified: today });
      const n = E.current().nodes.find((x: any) => x.id === 7501);
      (window as any).op(n);
    });
    // Drive 20 renders and count rings each time.
    const counts = await page.evaluate(async () => {
      const out: number[] = [];
      for (let i = 0; i < 20; i++) {
        (window as any).render();
        await new Promise(r => requestAnimationFrame(r));
        out.push(document.querySelectorAll('.nslice[data-nid="7501"] .ring, .nslice[data-nid="7501"] .es-sel-ring').length);
      }
      return out;
    });
    // Every count should be exactly 1 (single ring per render).
    expect(Math.max(...counts)).toBeLessThanOrEqual(1);
    expect(counts.every(c => c === 1)).toBe(true);
  });
});
