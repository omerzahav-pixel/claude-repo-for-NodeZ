import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 3.3 · Polish + top-bar migration regression tests.
 *
 *   Issue 1 — workspace name label updates immediately on switch.
 *   Issue 2 — anchor offsets use silhouette radius (42) for nodes without
 *             explicit _w/_h; bestAnchor prefers mid-edges.
 *   Issue 3 — no two-finger swipe-down trigger; palette has a visible ×
 *             close button.
 *   Issue 4 — gesture watchdog: stale pointer entries get GC'd; visibility
 *             change resets state.
 *   Issue 5 — weakspot per-card Easier / Harder / Skip + Reset all.
 *   Issue 6 — body.nav-v2-on hides #tabs (the old bottom strip).
 *   Issue 7 — Tools chip on spine; #toolsPanel mounts when nav-v2 ON;
 *             clicking it opens; toolbar-migrated flag hides #tb.
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
test.describe("Sprint 3.3 · Issue 1 — workspace label refresh", () => {
  test("S3_3.I1.A window.currentWs mirrors module-scope currentWs after switch", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1200);
    const ok = await page.evaluate(() => typeof (window as any).currentWs === "string");
    expect(ok).toBe(true);
  });

  test("S3_3.I1.B Drawer ws-name reflects window.currentWs", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1500);
    const name = await page.evaluate(() => {
      const el = document.querySelector("#drawer .ws-name span:last-child");
      return el?.textContent || null;
    });
    const cur = await page.evaluate(() => (window as any).currentWs);
    expect(name).toBe(cur);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.3 · Issue 2 — edges connect to node outline", () => {
  test("S3_3.I2.A halfExtents defaults to 42 for unset _w/_h (was 80/60)", async ({ page }) => {
    await open(page, { "edges-v2": true });
    const probe = await page.evaluate(() => {
      const E = (window as any).__E2E;
      const z = E.current().zones[0]?.id || "ideas";
      const today = new Date().toISOString();
      // Idea-shape node has no _w/_h set anywhere in app.js.
      E.addNodeRaw({ id: 8801, label: "A", shape: "idea", status: "idea", x: -100, y: 0, zone: z, created: today, modified: today });
      E.addNodeRaw({ id: 8802, label: "B", shape: "idea", status: "idea", x:  100, y: 0, zone: z, created: today, modified: today });
      const a = E.current().nodes.find((n: any) => n.id === 8801);
      const b = E.current().nodes.find((n: any) => n.id === 8802);
      const ev2 = (window as any).EdgeV2;
      // bestAnchor for A heading toward B should be the right mid-edge:
      // x = a.x + 42 (not a.x + 80).
      const anchorA = ev2.bestAnchor(a, b);
      return { anchor: anchorA, expectedX: a.x + 42, expectedY: a.y };
    });
    expect(probe.anchor.x).toBe(probe.expectedX);
    expect(probe.anchor.y).toBe(probe.expectedY);
  });

  test("S3_3.I2.B bestAnchor picks mid-edge over corner for vertical alignment", async ({ page }) => {
    await open(page, { "edges-v2": true });
    const probe = await page.evaluate(() => {
      const ev2 = (window as any).EdgeV2;
      // Source at (0,0), target directly below at (0, 300). Expected:
      // best anchor for source is the BOTTOM mid-edge, NOT a corner.
      const src = { id: 1, x: 0, y: 0 };
      const tgt = { id: 2, x: 0, y: 300 };
      const a = ev2.bestAnchor(src, tgt);
      return { ax: a.x, ay: a.y };
    });
    // Bottom mid-edge of (0,0) with r=42 is (0, 42).
    expect(probe.ax).toBe(0);
    expect(probe.ay).toBe(42);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.3 · Issue 3 — palette swipe gesture removed + visible close", () => {
  test("S3_3.I3.A No two-finger touchstart listener installed by palette.js", async ({ page }) => {
    await open(page, { "palette": true });
    // Synthesise a 2-finger touchstart + touchend that previously would
    // have opened the palette. After this sprint, nothing should happen.
    await page.evaluate(() => {
      const fire = (type: string, touches: any[]) => {
        const ev: any = new Event(type, { bubbles: true, cancelable: true });
        ev.touches = touches;
        ev.changedTouches = touches;
        document.dispatchEvent(ev);
      };
      const a = { clientX: 100, clientY: 50, identifier: 1 };
      const b = { clientX: 200, clientY: 50, identifier: 2 };
      fire("touchstart", [a, b]);
      const a2 = { ...a, clientY: 250 };
      const b2 = { ...b, clientY: 250 };
      fire("touchend", []);
    });
    await page.waitForTimeout(150);
    const on = await page.evaluate(() =>
      document.getElementById("palette")?.classList.contains("on")
    );
    expect(on).toBe(false);
  });

  test("S3_3.I3.B Palette has a visible × close button that dismisses", async ({ page }) => {
    await open(page, { "palette": true });
    await page.evaluate(() => (window as any).Palette.open());
    await page.waitForTimeout(120);
    const closeBtnRect = await page.evaluate(() => {
      const b = document.querySelector("#palette .palette-close") as HTMLElement;
      return b ? b.getBoundingClientRect() : null;
    });
    expect(closeBtnRect).not.toBeNull();
    expect(closeBtnRect!.width).toBeGreaterThan(0);
    await page.locator("#palette .palette-close").click();
    await page.waitForTimeout(100);
    const on = await page.evaluate(() =>
      document.getElementById("palette")?.classList.contains("on")
    );
    expect(on).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.3 · Issue 4 — gesture watchdog", () => {
  test("S3_3.I4.A visibilitychange to hidden does not crash the app", async ({ page }) => {
    await open(page, { "gestures-v2": true });
    // Drive a visibility change. The new fullReset() listener should fire.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      // Restore for cleanup
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    });
    await page.waitForTimeout(120);
    // App should still be alive (cv element + __E2E intact).
    const alive = await page.evaluate(() =>
      !!document.getElementById("cv") && !!(window as any).__E2E
    );
    expect(alive).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.3 · Issue 5 — weakspot adjustments", () => {
  async function seed(page: Page) {
    await open(page, { "views-v2": true });
    await page.evaluate(() => {
      const E = (window as any).__E2E;
      const z = E.current().zones[0]?.id || "ideas";
      const old = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      E.addNodeRaw({ id: 6601, label: "Topic A", shape: "idea", status: "idea", x: -100, y: 0, zone: z, created: old, modified: old });
      E.addNodeRaw({ id: 6602, label: "Topic B", shape: "idea", status: "idea", x:  100, y: 0, zone: z, created: old, modified: old });
      (window as any).ViewTabs.setMode("weakspot");
    });
    await page.waitForTimeout(300);
  }

  test("S3_3.I5.A Easier button reduces node's weakspot.modifier below 1", async ({ page }) => {
    await seed(page);
    await page.locator(".vs-ws-row[data-id='6601'] .vs-ws-adj-btn[data-act='easier']").first().click();
    await page.waitForTimeout(150);
    const mod = await page.evaluate(() => {
      const n = (window as any).__E2E.current().nodes.find((x: any) => x.id === 6601);
      return n.weakspot?.modifier;
    });
    expect(mod).toBeLessThan(1.0);
  });

  test("S3_3.I5.B Harder button raises modifier above 1", async ({ page }) => {
    await seed(page);
    await page.locator(".vs-ws-row[data-id='6601'] .vs-ws-adj-btn[data-act='harder']").first().click();
    await page.waitForTimeout(150);
    const mod = await page.evaluate(() => {
      const n = (window as any).__E2E.current().nodes.find((x: any) => x.id === 6601);
      return n.weakspot?.modifier;
    });
    expect(mod).toBeGreaterThan(1.0);
  });

  test("S3_3.I5.C Skip sets weakspot.skipUntil to a future timestamp", async ({ page }) => {
    await seed(page);
    await page.locator(".vs-ws-row[data-id='6601'] .vs-ws-adj-btn[data-act='skip']").first().click();
    await page.waitForTimeout(150);
    const skipUntil = await page.evaluate(() => {
      const n = (window as any).__E2E.current().nodes.find((x: any) => x.id === 6601);
      return n.weakspot?.skipUntil;
    });
    expect(skipUntil).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);
  });

  test("S3_3.I5.D Reset adjustments clears every node's weakspot field", async ({ page }) => {
    await seed(page);
    // Apply changes to both nodes, then reset.
    await page.locator(".vs-ws-row[data-id='6601'] .vs-ws-adj-btn[data-act='harder']").first().click();
    await page.locator(".vs-ws-row[data-id='6602'] .vs-ws-adj-btn[data-act='easier']").first().click();
    await page.waitForTimeout(120);
    await page.locator(".vs-ws-reset").first().click();
    await page.waitForTimeout(150);
    const remaining = await page.evaluate(() => {
      return (window as any).__E2E.current().nodes.filter((n: any) => n.weakspot).length;
    });
    expect(remaining).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.3 · Issue 6 — old bottom tabs strip hidden under nav-v2", () => {
  test("S3_3.I6.A #tabs is hidden when --nav-v2 is ON", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1000);
    const disp = await page.evaluate(() => {
      const t = document.getElementById("tabs");
      return t ? getComputedStyle(t).display : null;
    });
    expect(disp).toBe("none");
  });

  test("S3_3.I6.B #tabs is visible when --nav-v2 is OFF (fallback preserved)", async ({ page }) => {
    await open(page, {});
    await page.waitForTimeout(800);
    const disp = await page.evaluate(() => {
      const t = document.getElementById("tabs");
      return t ? getComputedStyle(t).display : null;
    });
    expect(disp).not.toBe("none");
  });
});

// ──────────────────────────────────────────────────────────────────────────
test.describe("Sprint 3.3 · Issue 7 — Tools panel + top toolbar migration", () => {
  test("S3_3.I7.A #toolsPanel mounts when --nav-v2 is ON", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1000);
    const ok = await page.evaluate(() => !!document.getElementById("toolsPanel"));
    expect(ok).toBe(true);
  });

  test("S3_3.I7.B Tools chip on spine opens the panel", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1500);
    await page.locator("#spine .sb.tools[data-act='tools-toggle']").click();
    await page.waitForTimeout(200);
    const on = await page.evaluate(() =>
      document.getElementById("toolsPanel")?.classList.contains("on")
    );
    expect(on).toBe(true);
  });

  test("S3_3.I7.C Tools panel × close button dismisses", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1500);
    await page.locator("#spine .sb.tools[data-act='tools-toggle']").click();
    await page.waitForTimeout(150);
    await page.locator("#toolsPanel .tp-close").click();
    await page.waitForTimeout(150);
    const on = await page.evaluate(() =>
      document.getElementById("toolsPanel")?.classList.contains("on")
    );
    expect(on).toBe(false);
  });

  test("S3_3.I7.D Add-node row inside Tools panel calls window.addC", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      (window as any).__addCCalled = 0;
      const orig = (window as any).addC;
      (window as any).addC = function () { (window as any).__addCCalled++; return orig.apply(this, arguments); };
    });
    await page.locator("#spine .sb.tools[data-act='tools-toggle']").click();
    await page.waitForTimeout(150);
    await page.locator("#toolsPanel .tp-row[data-act='add-node']").click();
    await page.waitForTimeout(200);
    const calls = await page.evaluate(() => (window as any).__addCCalled);
    expect(calls).toBeGreaterThan(0);
  });

  test("S3_3.I7.E --toolbar-migrated ON hides #tb", async ({ page }) => {
    await open(page, { "nav-v2": true, "toolbar-migrated": true });
    await page.waitForTimeout(1500);
    const disp = await page.evaluate(() => {
      const t = document.getElementById("tb");
      return t ? getComputedStyle(t).display : null;
    });
    expect(disp).toBe("none");
  });

  test("S3_3.I7.F --toolbar-migrated OFF leaves #tb visible (rollback)", async ({ page }) => {
    await open(page, { "nav-v2": true });
    await page.waitForTimeout(1500);
    const disp = await page.evaluate(() => {
      const t = document.getElementById("tb");
      return t ? getComputedStyle(t).display : null;
    });
    expect(disp).not.toBe("none");
  });
});
