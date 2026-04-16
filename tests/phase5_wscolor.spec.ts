import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 5 P2 · Workspace color coding.
 *
 * Design intent:
 *   - Each workspace name hashes to a stable HSL hue so the same name
 *     always gets the same color across devices, with no per-workspace
 *     color picker or storage migration required.
 *   - The current workspace's color surfaces in two places:
 *       1. A thick (3px) left-edge stripe on the #wsSel element.
 *       2. The option text color inside the dropdown, so every listed
 *          workspace carries its hue even when the dropdown is closed
 *          (the collapsed option reflects the selected option's color).
 *   - Switching workspaces must re-run rebuildWsDropdown so the stripe
 *     changes in lock-step with the active workspace.
 *   - Padding-left shrinks by 2px when the stripe thickens to 3px, so
 *     the text baseline doesn't jump right on workspace switch.
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

test.describe("Phase 5 P2 · Workspace color coding", () => {
  test("5P2.W1 #wsSel has a non-empty border-left-color after load", async ({ page }) => {
    await openCleanApp(page);
    const borderLeftColor = await page.evaluate(() => {
      const sel = document.getElementById("wsSel") as HTMLSelectElement;
      return getComputedStyle(sel).borderLeftColor;
    });
    // computed color is either rgb(...) or rgba(...) — just assert it's not empty/transparent.
    expect(borderLeftColor).toMatch(/^rgba?\(/);
    expect(borderLeftColor).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("5P2.W2 #wsSel border-left-width is 3px (stripe thickness)", async ({ page }) => {
    await openCleanApp(page);
    const width = await page.evaluate(() => {
      const sel = document.getElementById("wsSel") as HTMLSelectElement;
      return getComputedStyle(sel).borderLeftWidth;
    });
    expect(width).toBe("3px");
  });

  test("5P2.W3 each option carries its own inline color style", async ({ page }) => {
    await openCleanApp(page);
    const optionColors = await page.evaluate(() => {
      const sel = document.getElementById("wsSel") as HTMLSelectElement;
      return Array.from(sel.options).map(o => ({ value: o.value, color: o.style.color }));
    });
    expect(optionColors.length).toBeGreaterThan(0);
    for (const o of optionColors) {
      // The style getter normalizes hsl() to rgb() — assert any non-empty
      // color string comes back. Empty string would mean no inline color
      // was rendered into the option.
      expect(o.color).toMatch(/^rgb\(/);
    }
  });

  test("5P2.W4 switching workspaces updates the stripe color deterministically", async ({ page }) => {
    await openCleanApp(page);
    // Capture the initial stripe color on the default workspace.
    const c1 = await page.evaluate(() => getComputedStyle(document.getElementById("wsSel") as HTMLElement).borderLeftColor);
    // Create a second workspace with a distinctive name whose hash will differ.
    await page.evaluate(async () => {
      const list = await (window as any).listWorkspaces?.() ?? ["workspace"];
      if (!list.includes("zebra-xx")) list.push("zebra-xx");
      await (window as any).saveWorkspaces(list);
      await (window as any).switchWorkspace("zebra-xx");
    });
    await page.waitForTimeout(200);
    const c2 = await page.evaluate(() => getComputedStyle(document.getElementById("wsSel") as HTMLElement).borderLeftColor);
    expect(c2).not.toBe(c1);
    // Determinism — switch back and ensure the original color is restored.
    await page.evaluate(async () => {
      await (window as any).switchWorkspace("workspace");
    });
    await page.waitForTimeout(200);
    const c3 = await page.evaluate(() => getComputedStyle(document.getElementById("wsSel") as HTMLElement).borderLeftColor);
    expect(c3).toBe(c1);
  });

  test("5P2.W5 wsColor helper is stable — same input always returns same hue", async ({ page }) => {
    await openCleanApp(page);
    const pairs = await page.evaluate(() => {
      const fn = (window as any).wsColor as (s: string) => string;
      return [
        [fn("workspace"), fn("workspace")],
        [fn("alpha"), fn("alpha")],
        [fn("zebra"), fn("zebra")],
      ];
    });
    for (const [a, b] of pairs) {
      expect(a).toBe(b);
    }
  });

  test("5P2.W6 text position does not jump when stripe thickens (padding-left compensated)", async ({ page }) => {
    await openCleanApp(page);
    // With border-left:3px and padding-left:10px the content edge sits at 13px,
    // which matches the pre-stripe 1px+12px layout. Verify both values are
    // present so future CSS shifts don't silently break alignment.
    const { blw, pl } = await page.evaluate(() => {
      const sel = document.getElementById("wsSel") as HTMLElement;
      const s = getComputedStyle(sel);
      return { blw: s.borderLeftWidth, pl: s.paddingLeft };
    });
    expect(blw).toBe("3px");
    expect(pl).toBe("10px");
  });
});
