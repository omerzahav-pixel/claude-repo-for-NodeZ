import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

/**
 * Phase 1 · Task 1.7 — per-canvas screenshots of both fixtures.
 *
 * Intent: give the user a folder of eyeball-able PNGs after Phase 1
 * completes, one per canvas per fixture per device project. This is *not*
 * a strict pixel-diff regression (toHaveScreenshot) — first-run baseline
 * generation and flake management aren't worth it for a light-touch phase,
 * and the user wants to verify on a real iPad after Phase 1 anyway. We
 * just capture pristine screenshots to ./test-screenshots/phase-1/.
 *
 * Layout on disk:
 *   test-screenshots/phase-1/{project}/{fixture}/{canvasId}.png
 *
 * Running:
 *   npx playwright test tests/phase1_screenshots.spec.ts --project=desktop-chrome --project=ipad-safari
 */

type E2EState = {
  canvases: Record<string, { nodes: any[]; edges: any[]; zones: any[] }>;
  current: string;
  canvasMeta: Record<string, { name?: string }>;
};

declare global {
  interface Window {
    __E2E?: {
      state(): E2EState;
      view(): any;
      current(): { nodes: any[]; edges: any[]; zones: any[] };
      addNodeRaw(node: any): any;
      setCurrentCanvas(id: string): boolean;
    };
  }
}

const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const viteUrl = process.env.VITE_URL ?? "http://localhost:5173/";
const screenshotRoot = path.join(repoRoot, "test-screenshots", "phase-1");

const fixtures = [
  { key: "disc_math", file: "disc_math and probabilty_full.json" },
  { key: "trading_real", file: "TRADING REAL.json" },
];

async function openCleanApp(page: Page) {
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
  await page.waitForFunction(
    () => !!window.__E2E && !!window.__E2E.state().canvases,
    null,
    { timeout: 15_000 }
  );
  await page.evaluate(() => document.getElementById("bootLog")?.remove());
}

// Sanitize a canvas id for use as a filename on Windows/macOS/Linux.
function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
}

for (const fx of fixtures) {
  test(`1.7 Screenshots — ${fx.key}: every canvas captured per project`, async ({
    page,
  }, testInfo) => {
    const projectName = testInfo.project.name;
    const fixturePath = path.join(repoRoot, fx.file);
    expect(
      fs.existsSync(fixturePath),
      `Fixture missing on disk: ${fixturePath}`
    ).toBe(true);

    const outDir = path.join(screenshotRoot, projectName, fx.key);
    fs.mkdirSync(outDir, { recursive: true });

    await openCleanApp(page);
    await page.setInputFiles("#imp", fixturePath);

    // Wait for the import to land — poll until more than the single default
    // canvas exists.
    await expect
      .poll(
        () =>
          page.evaluate(
            () => Object.keys(window.__E2E!.state().canvases).length
          ),
        { timeout: 15_000 }
      )
      .toBeGreaterThan(1);

    const canvases: { id: string; name: string }[] = await page.evaluate(() => {
      const s = window.__E2E!.state();
      return Object.keys(s.canvases).map((id) => ({
        id,
        name: s.canvasMeta?.[id]?.name || id,
      }));
    });

    expect(canvases.length).toBeGreaterThan(0);

    for (const c of canvases) {
      // Switch to each canvas and let the render + fit settle before capture.
      await page.evaluate((cid) => {
        window.__E2E!.setCurrentCanvas(cid);
        // Fit-to-content uses the app's own zF() so we see what a fresh
        // load would show on this canvas. The import path already called
        // zF() once for S.current; call render()+zF() explicitly here so
        // switching canvases also lands on a fitted viewport.
        (window as any).zF?.();
      }, c.id);
      // A small settle window for KaTeX + KaTeX auto-render to finish
      // typesetting. 1.4 wired render() to fire on auto-render load.
      await page.waitForTimeout(300);

      const file = path.join(outDir, `${safeName(c.id)}.png`);
      await page.screenshot({ path: file, fullPage: false });
      // Attach to test report for easy viewing in `playwright show-report`.
      await testInfo.attach(`${fx.key}/${c.id}`, {
        path: file,
        contentType: "image/png",
      });
    }
  });
}
