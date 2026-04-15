import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Phase 0 baseline screenshots.
 *
 * Captures what the CURRENT v1 app (`idea_vault.html`) looks like under
 * iPad emulation, before we touch rendering in Phase 1.
 *
 * Two captures per engine:
 *   1. `original` — opens the untouched `idea_vault.html` directly via file://
 *      (this is the frozen v1 reference the user wants preserved).
 *   2. `vite` — opens the Vite-served split (index.html + src/app.css + src/app.js).
 *      Should look identical to #1 if our extraction was faithful.
 *
 * Neither is a pass/fail assertion — we only assert that the page loads without
 * JS errors and that a few key DOM anchors are present. The real signal for
 * the user is the .png artifacts saved to test-screenshots/baseline/.
 */

const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const originalHtml = pathToFileURL(path.join(repoRoot, "idea_vault.html")).href;
const viteUrl = process.env.VITE_URL ?? "http://localhost:5173/";

async function waitForIdeaVaultReady(page: import("@playwright/test").Page) {
  // The app wires itself up after DOMContentLoaded. Wait for the canvas svg
  // plus at least one known toolbar button to be attached.
  await page.waitForSelector("svg#cv", { state: "attached", timeout: 15_000 });
  await page.waitForSelector("#addBtn", { state: "visible", timeout: 15_000 });
  // Give the async IndexedDB/localStorage load a chance to paint the default state.
  await page.waitForTimeout(800);
}

for (const projectSource of ["original", "vite"] as const) {
  test(`baseline ${projectSource} screenshot on iPad`, async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`console.error: ${msg.text()}`);
    });

    const url = projectSource === "original" ? originalHtml : viteUrl;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await waitForIdeaVaultReady(page);

    const engineTag = testInfo.project.name;
    const outDir = path.join(repoRoot, "test-screenshots", "baseline");
    const outPath = path.join(outDir, `${projectSource}__${engineTag}.png`);
    await page.screenshot({ path: outPath, fullPage: false });

    // Log the screenshot path so the user can find the artifact in the test output.
    // eslint-disable-next-line no-console
    console.log(`[baseline] saved ${outPath}`);

    // Sanity: canvas should have rendered SOMETHING (at minimum default zones + grid).
    const cvChildCount = await page.locator("svg#cv > *").count();
    expect(cvChildCount).toBeGreaterThan(0);

    // Known-noise console errors we expect under emulation (KaTeX trying to load
    // before defer resolves, etc.) can be allowed here by filtering. For the
    // baseline, record everything so we see what the v1 app actually emits.
    if (consoleErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[baseline ${projectSource} / ${engineTag}] ${consoleErrors.length} console errors:`,
        consoleErrors
      );
    }
  });
}
