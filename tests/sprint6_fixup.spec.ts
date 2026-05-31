import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Sprint 6 (batch 2, part 1) — node containment + More-button fix.
 *
 * Shipped this part: Issue 3 (note body + formula clamped to the card, fade cue,
 * no text outside / off-screen) and Issue 6 (the "Open More menu" button — it
 * anchored to the hidden top-toolbar #moreBtn and opened off-screen; now it
 * centres when that anchor is gone).
 *
 * Deferred (larger work, own pass): Issue 1 (full node anatomy), Issue 2 (vendor
 * + lazy-load KaTeX off the CDN), Issues 4/5 (view/edit + save/roadmap), Issue 7
 * (hide/isolate edges).
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

test.describe("Sprint 6 · node containment + More", () => {
  test("S6.A build stamp is a semantic version", async ({ page }) => {
    await open(page, { "perf-hud": true });
    await page.waitForTimeout(300);
    const meta = await page.evaluate(() => document.querySelector('meta[name="edgespace-build"]')?.getAttribute("content"));
    // Version moves every sprint (7.0.0 now) — assert the shape, not a literal.
    expect(meta).toMatch(/\d+\.\d+\.\d+/);
  });

  test("S6.3 note body is clamped (overflow hidden) with a fade mask + wrap", async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => {
      const ov = document.getElementById("canvasOverlay")!;
      const nb = document.createElement("div");
      nb.className = "note-body";
      ov.appendChild(nb);
      const cs = getComputedStyle(nb);
      const out = { overflow: cs.overflowY, wrap: cs.overflowWrap, mask: cs.maskImage || (cs as any).webkitMaskImage || "" };
      ov.removeChild(nb);
      return out;
    });
    expect(r.overflow).toBe("hidden");
    expect(r.wrap).toContain("anywhere");
    expect(r.mask).toContain("gradient");
  });

  test("S6.3b formula body is contained (overflow hidden, max-width)", async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => {
      const ov = document.getElementById("canvasOverlay")!;
      const f = document.createElement("div");
      f.className = "fnode";
      ov.appendChild(f);
      const cs = getComputedStyle(f);
      const out = { overflow: cs.overflowX, maxw: cs.maxWidth };
      ov.removeChild(f);
      return out;
    });
    expect(r.overflow).toBe("hidden");
    expect(r.maxw).toMatch(/100%|px/);
  });

  test("S6.6 toggleMore opens the More menu (centred) instead of doing nothing", async ({ page }) => {
    await open(page, { "nav-v2": true, "toolbar-migrated": true });
    const r = await page.evaluate(() => {
      const more = document.getElementById("more");
      if (!more || typeof (window as any).toggleMore !== "function") return { ok: false };
      (window as any).toggleMore();
      return {
        ok: true,
        on: more.classList.contains("on"),
        // with the old top-toolbar #moreBtn hidden under toolbar-migrated, the
        // menu centres itself rather than anchoring off-screen.
        left: more.style.left,
        transform: more.style.transform,
      };
    });
    expect(r.ok).toBe(true);
    expect(r.on).toBe(true);
    expect(r.left === "50%" || (r.transform || "").includes("translate")).toBe(true);
  });
});
