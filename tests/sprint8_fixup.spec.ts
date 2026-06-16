import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 8 — web-verification regressions.
 *
 * Issue 1 — the orange error bar + "KaTeX not going through" on the user's web
 * session was the service-worker transition: the robust controllerchange→reload
 * was gated on --lifecycle-v2, but that flag's default-true is applied by
 * flags.js AFTER the inline head script reads localStorage, so the raw read saw
 * `undefined` and bailed — most users got NO auto-reload on deploy. The SW is
 * now registered pre-paint on EVERY visit; reload fires only on a genuine update.
 *
 * Issue 2 — the side drawer/sidebar grouped the active canvas BY ZONE. It now
 * lists the chosen canvas's nodes flat (zones remain regions on the canvas).
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

test.describe("Sprint 8 · web-verification fixes", () => {
  test("S8.A build stamp is 8.0.0", async ({ page }) => {
    await open(page);
    const meta = await page.evaluate(() => document.querySelector('meta[name="edgespace-build"]')?.getAttribute("content"));
    expect(meta).toContain("8.0.0");
  });

  // Issue 1 — the pre-paint SW registration is no longer gated on --lifecycle-v2,
  // so it runs for a default user. _swPrePaintRegistered is set synchronously by
  // the inline head script the moment it registers.
  test("S8.1 SW is registered pre-paint with DEFAULT flags (no lifecycle-v2 gate)", async ({ page }) => {
    await open(page); // default flags — lifecycle-v2 NOT explicitly set
    const flag = await page.evaluate(() => (window as any)._swPrePaintRegistered === true);
    expect(flag).toBe(true);
  });

  // Issue 2 — the desktop #sb sidebar lists nodes flat, with no per-zone .zhdr
  // headers, even when the canvas has zones.
  test("S8.2 #sb sidebar lists nodes flat — no .zhdr zone headers", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const E = (window as any).__E2E; const c = E.current();
      c.zones = c.zones || [];
      c.zones.push({ id: "zz", name: "ZoneZ", x: 0, y: 0, w: 200, h: 200, color: "#FF7A45" });
      c.nodes = [
        { id: 8101, x: 0, y: 0, shape: "idea", status: "idea", label: "alpha", zone: "zz" },
        { id: 8102, x: 50, y: 0, shape: "idea", status: "idea", label: "beta", zone: null },
      ];
      c.edges = [];
      (window as any).renderSB();
    });
    const probe = await page.evaluate(() => {
      const body = document.getElementById("sbbody");
      return {
        present: !!body,
        zhdr: body ? body.querySelectorAll(".zhdr").length : -1,
        items: body ? body.querySelectorAll(".item").length : -1,
      };
    });
    expect(probe.present).toBe(true);
    expect(probe.zhdr).toBe(0);            // no per-zone grouping headers
    expect(probe.items).toBeGreaterThanOrEqual(2); // both nodes listed flat
  });
});
