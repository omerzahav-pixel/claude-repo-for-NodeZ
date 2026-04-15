import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Phase 1.7 · Item #9 — consistent panel open/close for Legend + More.
 *
 *   - Tapping the `?` button opens the Legend; tapping it again CLOSES it
 *     (was: only × inside the panel closed it — broken toggle).
 *   - Clicking outside the Legend closes it.
 *   - Pressing Escape closes the Legend and the More menu.
 *   - The More menu already had outside-click close but Escape did not
 *     close it; verify Escape now does.
 */

const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const viteUrl = process.env.VITE_URL ?? "http://localhost:5173/";

async function openApp(page: Page) {
  await page.goto(viteUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    try {
      indexedDB.deleteDatabase("ideaVault");
    } catch {}
    try {
      localStorage.clear();
    } catch {}
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("svg#cv", { state: "attached", timeout: 15_000 });
  await page.waitForSelector("#addBtn", { state: "visible", timeout: 15_000 });
  // Dismiss the boot toast so it doesn't interfere with click-outside tests.
  await page.waitForFunction(() => !document.querySelector("#toast .ts"), null, {
    timeout: 5_000,
  });
}

test.describe("Phase 1.7 · Item #9 · panel toggle / outside-click / Esc", () => {
  test("1.7.13 ? button toggles Legend open AND closed", async ({ page }) => {
    await openApp(page);
    const lg = page.locator("#lg");
    const btn = page.locator("#lgBtn");
    // Starts closed.
    await expect(lg).not.toHaveClass(/on/);
    // Open with first tap.
    await btn.click();
    await expect(lg).toHaveClass(/on/);
    // Close with second tap (new behavior — used to require × click).
    await btn.click();
    await expect(lg).not.toHaveClass(/on/);
    // Third tap opens again.
    await btn.click();
    await expect(lg).toHaveClass(/on/);
  });

  test("1.7.14 Clicking outside closes the Legend", async ({ page }) => {
    await openApp(page);
    const lg = page.locator("#lg");
    await page.locator("#lgBtn").click();
    await expect(lg).toHaveClass(/on/);
    // Click on the canvas background (outside the #lg panel + #lgBtn button).
    // Use a specific offset far from the toolbar + sidebar + legend.
    await page.mouse.click(400, 400);
    await expect(lg).not.toHaveClass(/on/);
  });

  test("1.7.15 Escape closes the Legend", async ({ page }) => {
    await openApp(page);
    const lg = page.locator("#lg");
    await page.locator("#lgBtn").click();
    await expect(lg).toHaveClass(/on/);
    await page.keyboard.press("Escape");
    await expect(lg).not.toHaveClass(/on/);
  });

  test("1.7.16 Escape closes the More menu", async ({ page }) => {
    await openApp(page);
    const more = page.locator("#more");
    await page.locator("#moreBtn").click();
    await expect(more).toHaveClass(/on/);
    await page.keyboard.press("Escape");
    await expect(more).not.toHaveClass(/on/);
  });

  test("1.7.17 × tog span still closes the Legend (regression guard)", async ({ page }) => {
    await openApp(page);
    const lg = page.locator("#lg");
    await page.locator("#lgBtn").click();
    await expect(lg).toHaveClass(/on/);
    await page.locator("#lg .tog").click();
    await expect(lg).not.toHaveClass(/on/);
  });
});
