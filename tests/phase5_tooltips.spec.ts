import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 5 P2 · Tooltips pass.
 *
 * Design intent:
 *   - Every toolbar button + sidebar toggle gets a `title=` attribute
 *     with a clear one-line hint.
 *   - Static title attributes in index.html are the English baseline so
 *     the browser shows them before JS runs. On boot (and every Hebrew
 *     toggle) refreshUiText() overrides them with the current language's
 *     string from the T[lang] table.
 *   - This is primarily a desktop UX signal — iPad Safari/Chrome do not
 *     surface title hints on tap — but on desktop it's the difference
 *     between "what does ⌇ do" and "oh, dim edges".
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

// The set of toolbar / sidebar elements that MUST carry a tooltip.
const TOOLTIP_IDS = [
  "wsSel",
  "heBtn",
  "addBtn",
  "zoneBtn",
  "sr",
  "fitBtn",
  "undoBtn",
  "redoBtn",
  "dimEdgesBtn",
  "patchBtn",
  "importBtn",
  "moreBtn",
  "lgBtn",
];

test.describe("Phase 5 P2 · Tooltips pass", () => {
  test("5P2.TT1 every toolbar + sidebar element carries a non-empty title", async ({ page }) => {
    await openCleanApp(page);
    const missing = await page.evaluate((ids) => {
      return ids.filter((id) => {
        const el = document.getElementById(id);
        if (!el) return true;
        return !(el.getAttribute("title") || "").trim();
      });
    }, TOOLTIP_IDS);
    expect(missing).toEqual([]);
  });

  test("5P2.TT2 sidebar toggle spans also carry titles", async ({ page }) => {
    await openCleanApp(page);
    const titles = await page.evaluate(() => {
      const togs = Array.from(document.querySelectorAll("#sb .sbhead .sbtog")) as HTMLElement[];
      return togs.map((el) => (el.getAttribute("title") || "").trim());
    });
    expect(titles.length).toBeGreaterThanOrEqual(3);
    for (const t of titles) expect(t.length).toBeGreaterThan(0);
  });

  test("5P2.TT3 default language: titles are English", async ({ page }) => {
    await openCleanApp(page);
    const title = await page.evaluate(() => document.getElementById("fitBtn")?.getAttribute("title"));
    // Default language is English; the English string starts with "Fit".
    expect(title).toMatch(/Fit/);
  });

  test("5P2.TT4 Hebrew mode: titles update to Hebrew after toggleHebrew()", async ({ page }) => {
    await openCleanApp(page);
    await page.evaluate(() => (window as any).toggleHebrew());
    await page.waitForTimeout(100);
    const title = await page.evaluate(() => document.getElementById("fitBtn")?.getAttribute("title"));
    // Hebrew string contains the verb for "fit / adapt display": התאם
    expect(title).toContain("התאם");
  });

  test("5P2.TT5 toggling back to English restores English titles", async ({ page }) => {
    await openCleanApp(page);
    await page.evaluate(() => (window as any).toggleHebrew());
    await page.waitForTimeout(100);
    await page.evaluate(() => (window as any).toggleHebrew());
    await page.waitForTimeout(100);
    const title = await page.evaluate(() => document.getElementById("fitBtn")?.getAttribute("title"));
    expect(title).toMatch(/Fit/);
  });

  test("5P2.TT6 redo tooltip advertises both shortcut variants", async ({ page }) => {
    await openCleanApp(page);
    const title = await page.evaluate(() => document.getElementById("redoBtn")?.getAttribute("title"));
    // After Phase 5 P2 redo landing, the title should mention Ctrl+Y or
    // Ctrl+Shift+Z — ideally both since both shortcuts fire redo.
    expect(title).toMatch(/Ctrl\+Y/i);
    expect(title).toMatch(/Ctrl\+Shift\+Z/i);
  });
});
