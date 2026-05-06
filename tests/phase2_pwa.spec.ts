import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Phase 2 · PWA — manifest + service worker + Apple metas.
 *
 * Lighthouse-ish sanity suite: everything Lighthouse's PWA audit would
 * check, pre-validated in CI so we don't regress the install flow.
 *
 *   2.1 index.html has a manifest link, Apple capable+title metas,
 *       apple-touch-icon, theme-color, PWACompat.
 *   2.2 manifest.webmanifest parses and has the required fields.
 *   2.3 All icons referenced by the manifest resolve.
 *   2.4 sw.js is served and installs (reg.active || reg.installing).
 *   2.5 navigator.storage.persist() runs on boot (we expose it via dbg).
 *
 * Only runs on desktop-chrome + ipad-chrome — WebKit service-worker support
 * in the Playwright harness is flaky, and iPad Safari's behavior matters
 * for the real-device manual check, not for CI.
 */

const viteUrl = process.env.VITE_URL ?? "http://localhost:5173/";

test.describe("Phase 2 · PWA", () => {
  // SW registration in WebKit under Playwright's headless harness is
  // unreliable; skip on ipad-safari. The Apple-meta tests ARE still valid
  // there, but we gate on project name at the describe level for simplicity.
  test.beforeEach(({}, testInfo) => {
    if (testInfo.project.name === "ipad-safari") {
      testInfo.skip(true, "WebKit SW flakiness — verify PWA on real iPad in manual pass");
    }
  });

  test("2.1 index.html has manifest link + Apple metas + PWACompat", async ({ page }) => {
    await page.goto(viteUrl, { waitUntil: "domcontentloaded" });
    // Manifest link.
    const manifestHref = await page.locator('link[rel=manifest]').getAttribute("href");
    expect(manifestHref).toBeTruthy();
    expect(manifestHref).toMatch(/manifest\.webmanifest$/);
    // Apple metas. PWACompat may inject duplicates by reading the manifest;
    // we assert on the FIRST match (our explicit one) since that's the one
    // the browser uses before PWACompat's async script has a chance to run.
    await expect(page.locator('meta[name=apple-mobile-web-app-capable]').first()).toHaveAttribute("content", "yes");
    await expect(page.locator('meta[name=apple-mobile-web-app-status-bar-style]').first()).toHaveAttribute("content", "black-translucent");
    await expect(page.locator('meta[name=apple-mobile-web-app-title]').first()).toHaveAttribute("content", "EdgeSpace");
    // Apple touch icon.
    const appleIcon = await page.locator('link[rel=apple-touch-icon]').first().getAttribute("href");
    expect(appleIcon).toBeTruthy();
    expect(appleIcon).toMatch(/icon-180\.png$/);
    // Theme color.
    await expect(page.locator('meta[name=theme-color]').first()).toHaveAttribute("content", "#0F0F0F");
    // PWACompat script present.
    const pwacompat = await page.locator('script[src*="pwacompat"]').count();
    expect(pwacompat).toBeGreaterThan(0);
  });

  test("2.2 manifest.webmanifest parses with required PWA fields", async ({ page }) => {
    const res = await page.request.get(new URL("manifest.webmanifest", viteUrl).toString());
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBeTruthy();
    expect(m.display).toBe("standalone");
    expect(m.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(m.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(Array.isArray(m.icons)).toBe(true);
    expect(m.icons.length).toBeGreaterThanOrEqual(2);
    // Lighthouse PWA requires 192x192 AND 512x512 icons.
    const sizes = m.icons.map((i: any) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    // At least one maskable icon for Android adaptive.
    const hasMaskable = m.icons.some((i: any) => (i.purpose || "").includes("maskable"));
    expect(hasMaskable).toBe(true);
  });

  test("2.3 every manifest icon reference resolves", async ({ page }) => {
    const res = await page.request.get(new URL("manifest.webmanifest", viteUrl).toString());
    const m = await res.json();
    for (const icon of m.icons) {
      const iconUrl = new URL(icon.src, new URL("manifest.webmanifest", viteUrl)).toString();
      const ir = await page.request.get(iconUrl);
      expect(ir.ok(), `icon ${icon.src} should resolve`).toBe(true);
      expect(ir.headers()["content-type"]).toMatch(/image\/png/);
      const body = await ir.body();
      // Sanity: PNGs start with 89 50 4E 47.
      expect(body[0]).toBe(0x89);
      expect(body[1]).toBe(0x50);
      expect(body[2]).toBe(0x4e);
      expect(body[3]).toBe(0x47);
      // And are not trivially tiny (<500 bytes would mean empty/placeholder).
      expect(body.length).toBeGreaterThan(500);
    }
  });

  test("2.4 service worker registers and becomes active", async ({ page }) => {
    await page.goto(viteUrl, { waitUntil: "load" });
    // Wait for SW to become active. `navigator.serviceWorker.ready` resolves
    // when a SW is controlling the page (or at least the one for the scope).
    const ready = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return { ok: false, reason: "no SW support" };
      try {
        const reg = await navigator.serviceWorker.ready;
        return {
          ok: true,
          scope: reg.scope,
          hasActive: !!reg.active,
          state: reg.active?.state || reg.installing?.state || reg.waiting?.state || "unknown",
        };
      } catch (e: any) {
        return { ok: false, reason: e.message };
      }
    });
    expect(ready.ok, ready.ok ? "" : `SW did not become ready: ${ready.reason}`).toBe(true);
    expect(ready.hasActive).toBe(true);
    expect(ready.state).toMatch(/activated|activating/);
  });

  test("2.5 navigator.storage.persist() is invoked on boot", async ({ page }) => {
    const persistCalls: boolean[] = [];
    await page.addInitScript(() => {
      const orig = navigator.storage?.persist?.bind(navigator.storage);
      if (orig) {
        (navigator.storage as any).persist = async () => {
          (window as any).__persistCalled = true;
          return orig();
        };
      } else {
        (window as any).__persistCalled = "no-api";
      }
    });
    await page.goto(viteUrl, { waitUntil: "load" });
    // Allow the microtask queue to drain.
    await page.waitForTimeout(200);
    const called = await page.evaluate(() => (window as any).__persistCalled);
    // Either called the API, or the browser lacks the API entirely. Both
    // outcomes are acceptable — what we're guarding is "we forgot to call it".
    expect([true, "no-api"]).toContain(called);
  });

  test("2.6 sw.js cache-busts on VERSION bump (structural check only)", async ({ page }) => {
    const res = await page.request.get(new URL("sw.js", viteUrl).toString());
    expect(res.ok()).toBe(true);
    const text = await res.text();
    // VERSION must be a string literal the deploy script (or humans) can bump.
    expect(text).toMatch(/const VERSION\s*=\s*["'][^"']+["']/);
    // skipWaiting + clients.claim are both present so updates land instantly.
    expect(text).toMatch(/skipWaiting\s*\(\)/);
    expect(text).toMatch(/clients\.claim\s*\(\)/);
  });
});

/**
 * 2.7 — sanity check the built `dist/` output matches what's served. Read
 * the local dist/manifest.webmanifest so the test is decoupled from the
 * dev server's static-middleware behavior.
 */
test("2.7 dist/ bundle contains manifest + sw + icons (build output sanity)", async () => {
  const root = resolve(__dirname, "..");
  const distManifest = readFileSync(resolve(root, "dist", "manifest.webmanifest"), "utf-8");
  const m = JSON.parse(distManifest);
  expect(m.name).toBeTruthy();
  for (const icon of m.icons) {
    const p = resolve(root, "dist", icon.src.replace(/^\.\//, ""));
    // existsSync via readFileSync: if file is missing, this throws.
    const body = readFileSync(p);
    expect(body.length).toBeGreaterThan(500);
  }
  const sw = readFileSync(resolve(root, "dist", "sw.js"), "utf-8");
  expect(sw).toMatch(/VERSION/);
});
