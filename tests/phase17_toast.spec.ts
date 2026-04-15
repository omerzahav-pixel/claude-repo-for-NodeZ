import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Phase 1.7 · Item #8 — remove v1 #bootLog banner, add bottom-right toast.
 *
 *   - The old full-width green-monospace init banner (#bootLog) no longer
 *     exists in the DOM at any point in the boot sequence.
 *   - On boot, a subtle bottom-right toast appears ("Loaded …") and
 *     auto-dismisses within ~1.5s.
 *   - toast(msg, {kind:'ok'|'err'}) API is available on window and
 *     places a .ts child inside #toast that fades in then out.
 */

const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const viteUrl = process.env.VITE_URL ?? "http://localhost:5173/";

declare global {
  interface Window {
    toast?: (msg: string, opts?: { kind?: string; ms?: number }) => void;
  }
}

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
}

test.describe("Phase 1.7 · Item #8 · toast + no boot banner", () => {
  test("1.7.9 #bootLog banner never appears during boot", async ({ page }) => {
    // Install the MutationObserver BEFORE navigation via addInitScript so it's
    // active from the very first script. If any code had re-created the v1
    // bootLog (green monospace banner across the viewport top), the observer
    // would latch it even if it's removed later in the same tick.
    await page.addInitScript(() => {
      (window as any).__bootLogSeen = false;
      const install = () => {
        const mo = new MutationObserver(() => {
          if (document.getElementById("bootLog")) {
            (window as any).__bootLogSeen = true;
          }
        });
        mo.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });
      };
      // documentElement exists immediately; install right away.
      install();
    });
    await page.goto(viteUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#addBtn", { state: "visible", timeout: 15_000 });
    // Let load() finish and any boot toast appear.
    await page.waitForTimeout(500);
    const seen = await page.evaluate(() => (window as any).__bootLogSeen);
    expect(seen).toBe(false);
    await expect(page.locator("#bootLog")).toHaveCount(0);
  });

  test("1.7.10 toast() API adds a .ts child, auto-dismisses within ~1.5s", async ({ page }) => {
    await openApp(page);
    // On ipad-safari load() completes after openApp returns, so the boot
    // toast can appear under our feet. Wait for it first, then for it to
    // fully clear, THEN fire our own — otherwise .last() can race.
    await page.waitForFunction(
      () => !!document.querySelector("#toast .ts"),
      null,
      { timeout: 5_000 }
    );
    await page.waitForFunction(
      () => !document.querySelector("#toast .ts"),
      null,
      { timeout: 4_000 }
    );
    await page.evaluate(() => window.toast!("Hello 1710", { kind: "ok", ms: 600 }));
    const toastEl = page.locator('#toast .ts:has-text("Hello 1710")');
    await toastEl.waitFor({ state: "visible", timeout: 2_000 });
    await expect(toastEl).toHaveClass(/ok/);
    // Auto-dismiss — the .ts element disappears within its ms + fade window.
    await page.waitForFunction(
      () => !Array.from(document.querySelectorAll("#toast .ts")).some(
        (n) => n.textContent === "Hello 1710"
      ),
      null,
      { timeout: 2_500 }
    );
  });

  test("1.7.11 toast err variant has red border", async ({ page }) => {
    await openApp(page);
    // Wait for the boot toast cycle to complete (appear → dismiss) so our
    // err toast isn't confused with it.
    await page.waitForFunction(
      () => !!document.querySelector("#toast .ts"),
      null,
      { timeout: 5_000 }
    );
    await page.waitForFunction(
      () => !document.querySelector("#toast .ts"),
      null,
      { timeout: 4_000 }
    );
    await page.evaluate(() => window.toast!("Boom 1711", { kind: "err", ms: 1500 }));
    const el = page.locator('#toast .ts.err:has-text("Boom 1711")');
    await expect(el).toBeVisible();
    const borderColor = await el.evaluate(
      (n) => getComputedStyle(n).borderColor || getComputedStyle(n).borderTopColor
    );
    // --block is #d96b5a → rgb(217, 107, 90).
    expect(borderColor.replace(/\s+/g, "")).toMatch(/rgb\(217,107,90\)|#d96b5a/i);
  });

  test("1.7.12 Boot-path toast appears on initial load (Loaded…)", async ({ page }) => {
    // No IDB reset — this is the public boot path.
    await page.goto(viteUrl, { waitUntil: "domcontentloaded" });
    // The bootLog must never show, AND a toast should briefly appear.
    const host = page.locator("#toast");
    // Wait up to 3s for the toast host to have a child.
    await page.waitForFunction(
      () => !!document.querySelector("#toast .ts"),
      null,
      { timeout: 5_000 }
    );
    const text = await page.locator("#toast .ts").first().innerText();
    expect(text.toLowerCase()).toMatch(/loaded|load failed/);
    // And the old banner must be absent.
    await expect(page.locator("#bootLog")).toHaveCount(0);
  });
});
