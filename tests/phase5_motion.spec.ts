import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 5 P1 · Item #4 — smooth motion on open/close.
 *
 * Design intent:
 *   - #pn (property panel) fades in 220ms ease-out + slides 6px up;
 *     closes 140ms ease-in. visibility is held at `visible` through
 *     the close fade so the panel stays on-screen while opacity
 *     animates to 0, then flips to `hidden`.
 *   - #modal fades its backdrop 180ms; inner .mc scales from 0.98
 *     with an 8px translate-in.
 *   - Honours prefers-reduced-motion (transitions nulled out).
 *
 * These tests assert the CSS is wired up — non-zero transition
 * duration on opacity/transform — rather than trying to time
 * mid-fade opacity (which is inherently flaky across CI speeds).
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

async function seedNode(page: Page) {
  return page.evaluate(() => {
    const E = (window as any).__E2E;
    const cur = E.current();
    const id = Math.max(0, ...cur.nodes.map((n: any) => n.id)) + 1;
    E.addNodeRaw({ id, x: 0, y: 0, shape: "idea", label: "mot", status: "idea", zone: (cur.zones[0]?.id) || "inbox" });
    return id;
  });
}

test.describe("Phase 5 P1 · Smooth motion on open/close", () => {
  test("5.4.1 panel toggles the .on class on op() / cp()", async ({ page }) => {
    await openCleanApp(page);
    const id = await seedNode(page);
    // op(n) adds .on.
    await page.evaluate((nid) => {
      const n = (window as any).__E2E.current().nodes.find((x: any) => x.id === nid);
      (window as any).op(n);
    }, id);
    const onAfterOpen = await page.evaluate(() => document.getElementById("pn")?.classList.contains("on"));
    expect(onAfterOpen).toBe(true);
    // cp() removes .on.
    await page.evaluate(() => (window as any).cp());
    const onAfterClose = await page.evaluate(() => document.getElementById("pn")?.classList.contains("on"));
    expect(onAfterClose).toBe(false);
  });

  test("5.4.2 #pn CSS transitions opacity (non-zero duration)", async ({ page }) => {
    await openCleanApp(page);
    const dur = await page.evaluate(() => {
      const el = document.getElementById("pn")!;
      const cs = getComputedStyle(el);
      // transition-property / transition-duration are comma-lists; we look
      // for an opacity entry with a non-zero duration.
      const props = cs.transitionProperty.split(",").map(s => s.trim());
      const durs = cs.transitionDuration.split(",").map(s => s.trim());
      const i = props.indexOf("opacity");
      if (i === -1) return null;
      return durs[i] || null;
    });
    expect(dur).toBeTruthy();
    expect(dur).not.toBe("0s");
    // Parse "0.14s" / "140ms" → > 0ms.
    const ms = dur!.endsWith("ms") ? parseFloat(dur!) : parseFloat(dur!) * 1000;
    expect(ms).toBeGreaterThan(0);
  });

  test("5.4.3 #modal backdrop transitions opacity (non-zero duration)", async ({ page }) => {
    await openCleanApp(page);
    const dur = await page.evaluate(() => {
      const el = document.getElementById("modal")!;
      const cs = getComputedStyle(el);
      const props = cs.transitionProperty.split(",").map(s => s.trim());
      const durs = cs.transitionDuration.split(",").map(s => s.trim());
      const i = props.indexOf("opacity");
      if (i === -1) return null;
      return durs[i] || null;
    });
    expect(dur).toBeTruthy();
    const ms = dur!.endsWith("ms") ? parseFloat(dur!) : parseFloat(dur!) * 1000;
    expect(ms).toBeGreaterThan(0);
  });

  test("5.4.4 #modal .mc transforms on open (scale-up wired)", async ({ page }) => {
    await openCleanApp(page);
    // Open modal via showPatch() so .mc exists.
    await page.evaluate(() => (window as any).showPatch());
    // Wait past the modal transition so transform is settled. Phase 6
    // bumped the open transition to 240ms; pad to 280 for slow runners.
    await page.waitForTimeout(280);
    const xf = await page.evaluate(() => {
      const mc = document.querySelector("#modal .mc") as HTMLElement | null;
      if (!mc) return null;
      return getComputedStyle(mc).transform;
    });
    // Open state: transform:none (or matrix identity). Closed state would
    // be matrix(0.98, 0, 0, 0.98, 0, 8) or similar.
    expect(xf === "none" || xf?.includes("matrix(1")).toBeTruthy();
    await page.evaluate(() => (window as any).closeModal());
  });
});
