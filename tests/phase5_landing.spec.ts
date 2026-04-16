import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 5 P2 · Landing screen + recent workspaces.
 *
 * On first load, if >= 2 workspaces exist the app shows a landing
 * overlay listing all workspaces with color stripes and node counts.
 * Single-workspace installs skip the landing entirely.
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

/** Create a second workspace so landing will show on next load */
async function ensureTwoWorkspaces(page: Page) {
  await page.evaluate(async () => {
    const w = window as any;
    const list = await w.listWorkspaces();
    if (!list.includes("test-ws")) {
      list.push("test-ws");
      await w.saveWorkspaces(list);
    }
  });
}

test.describe("Phase 5 P2 · Landing screen + recent workspaces", () => {

  test("5P2.LD1 landing does NOT show with only 1 workspace", async ({ page }) => {
    await openCleanApp(page);
    await page.waitForTimeout(300);
    const visible = await page.evaluate(() =>
      document.getElementById("landing")?.classList.contains("on")
    );
    expect(visible).toBe(false);
  });

  test("5P2.LD2 landing shows when >= 2 workspaces exist", async ({ page }) => {
    await openCleanApp(page);
    await ensureTwoWorkspaces(page);
    // Reload to trigger landing on boot
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("svg#cv", { state: "attached", timeout: 15_000 });
    await page.waitForFunction(() => !!(window as any).__E2E, null, { timeout: 15_000 });
    await page.waitForTimeout(600);
    const visible = await page.evaluate(() =>
      document.getElementById("landing")?.classList.contains("on")
    );
    expect(visible).toBe(true);
  });

  test("5P2.LD3 landing lists all workspaces with color stripes", async ({ page }) => {
    await openCleanApp(page);
    await ensureTwoWorkspaces(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("svg#cv", { state: "attached", timeout: 15_000 });
    await page.waitForFunction(() => !!(window as any).__E2E, null, { timeout: 15_000 });
    await page.waitForTimeout(600);
    const cards = await page.evaluate(() => {
      const els = document.querySelectorAll("#ld-list .ld-card");
      return Array.from(els).map(el => ({
        ws: el.getAttribute("data-ws"),
        hasStripe: !!el.querySelector(".ld-stripe"),
        stripeBg: (el.querySelector(".ld-stripe") as HTMLElement)?.style.background || "",
      }));
    });
    expect(cards.length).toBeGreaterThanOrEqual(2);
    for (const c of cards) {
      expect(c.hasStripe).toBe(true);
      expect(c.stripeBg).toBeTruthy();
    }
  });

  test("5P2.LD4 current workspace card is highlighted", async ({ page }) => {
    await openCleanApp(page);
    await ensureTwoWorkspaces(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("svg#cv", { state: "attached", timeout: 15_000 });
    await page.waitForFunction(() => !!(window as any).__E2E, null, { timeout: 15_000 });
    await page.waitForTimeout(600);
    const curCards = await page.evaluate(() =>
      document.querySelectorAll("#ld-list .ld-card.cur").length
    );
    expect(curCards).toBe(1);
  });

  test("5P2.LD5 clicking 'Continue with current' dismisses landing", async ({ page }) => {
    await openCleanApp(page);
    await ensureTwoWorkspaces(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("svg#cv", { state: "attached", timeout: 15_000 });
    await page.waitForFunction(() => !!(window as any).__E2E, null, { timeout: 15_000 });
    await page.waitForTimeout(600);
    await page.click("#ld-skip");
    await page.waitForTimeout(200);
    const visible = await page.evaluate(() =>
      document.getElementById("landing")?.classList.contains("on")
    );
    expect(visible).toBe(false);
  });

  test("5P2.LD6 clicking a workspace card switches to it and closes landing", async ({ page }) => {
    await openCleanApp(page);
    await ensureTwoWorkspaces(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("svg#cv", { state: "attached", timeout: 15_000 });
    await page.waitForFunction(() => !!(window as any).__E2E, null, { timeout: 15_000 });
    await page.waitForTimeout(600);
    // Click the non-current card
    await page.evaluate(() => {
      const cards = document.querySelectorAll("#ld-list .ld-card:not(.cur)");
      if (cards.length > 0) (cards[0] as HTMLElement).click();
    });
    await page.waitForTimeout(800);
    const visible = await page.evaluate(() =>
      document.getElementById("landing")?.classList.contains("on")
    );
    expect(visible).toBe(false);
  });

  test("5P2.LD7 showLanding can be called manually and populates cards", async ({ page }) => {
    await openCleanApp(page);
    await ensureTwoWorkspaces(page);
    await page.evaluate(async () => { await (window as any).showLanding(); });
    await page.waitForTimeout(300);
    const count = await page.evaluate(() =>
      document.querySelectorAll("#ld-list .ld-card").length
    );
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
