import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Phase 1.7 · Item #7 — in-app dark-themed dialog replaces native
 * prompt/confirm/alert. iOS Safari renders system dialogs in light mode
 * even when the host app is dark, which is visually off-brand. These
 * tests verify:
 *
 *   - No native `prompt()` / `confirm()` / `alert()` fires from any
 *     user-triggered path — the dark-themed #dlg renders instead.
 *   - Dialog dismisses on Esc, Cancel, and outside-click.
 *   - Prompt input value flows through to state when submitted.
 *   - danger:true confirm uses the .dn (block-red) button styling.
 *
 * State introspection uses the window.__E2E hook already wired by app.js.
 */

const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const viteUrl = process.env.VITE_URL ?? "http://localhost:5173/";

declare global {
  interface Window {
    __E2E?: any;
    uiPrompt: (title: string, defaultValue?: string, opts?: any) => Promise<string | null>;
    uiConfirm: (message: string, opts?: any) => Promise<boolean>;
    uiNotice: (message: string, opts?: any) => Promise<void>;
    __uiNative?: { prompt?: any; confirm?: any; alert?: any };
    newWorkspace?: () => Promise<void>;
    addZoneCenter?: () => void;
  }
}

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
    () => !!window.__E2E && typeof window.uiPrompt === "function",
    null,
    { timeout: 15_000 }
  );
  await page.evaluate(() => document.getElementById("bootLog")?.remove());
}

// Shim native dialogs so any accidental call throws (test would fail). We also
// bind a dialog listener just in case Playwright intercepts before the shim.
async function trapNativeDialogs(page: Page) {
  const fired: string[] = [];
  page.on("dialog", async (d) => {
    fired.push(d.type() + ":" + d.message());
    await d.dismiss();
  });
  await page.evaluate(() => {
    const native = {
      prompt: window.prompt,
      confirm: window.confirm,
      alert: window.alert,
    };
    (window as any).__uiNative = native;
    (window as any).__nativeCalls = [];
    window.prompt = ((m: string) => {
      (window as any).__nativeCalls.push("prompt:" + m);
      return null;
    }) as any;
    window.confirm = ((m: string) => {
      (window as any).__nativeCalls.push("confirm:" + m);
      return false;
    }) as any;
    window.alert = ((m: string) => {
      (window as any).__nativeCalls.push("alert:" + m);
    }) as any;
  });
  return { fired, nativeCalls: async () => await page.evaluate(() => (window as any).__nativeCalls) };
}

test.describe("Phase 1.7 · Item #7 · in-app dialog", () => {
  test("1.7.1 uiPrompt renders #dlg with title + input, resolves to typed value", async ({ page }) => {
    await openCleanApp(page);
    await trapNativeDialogs(page);

    const resultPromise = page.evaluate(() =>
      window.uiPrompt("Test title", "default-val", { hint: "Some hint" })
    );
    await page.waitForSelector("#dlg.on", { state: "visible", timeout: 2_000 });
    // Title + hint + input are all present.
    await expect(page.locator("#dlg h3")).toHaveText("Test title");
    await expect(page.locator("#dlg p").first()).toHaveText("Some hint");
    const input = page.locator("#dlg input[type=text]");
    await expect(input).toBeVisible();
    // Default value pre-populated, and focused+selected on open.
    await expect(input).toHaveValue("default-val");
    // Overwrite and submit with Enter.
    await input.fill("hello world");
    await input.press("Enter");
    const result = await resultPromise;
    expect(result).toBe("hello world");
    // Dialog cleared from DOM.
    await expect(page.locator("#dlg")).not.toHaveClass(/on/);
  });

  test("1.7.2 uiPrompt Esc cancels → null", async ({ page }) => {
    await openCleanApp(page);
    await trapNativeDialogs(page);
    const resultPromise = page.evaluate(() => window.uiPrompt("T", "x"));
    await page.waitForSelector("#dlg.on", { state: "visible" });
    await page.keyboard.press("Escape");
    const result = await resultPromise;
    expect(result).toBeNull();
    await expect(page.locator("#dlg")).not.toHaveClass(/on/);
  });

  test("1.7.3 uiPrompt outside-click cancels → null", async ({ page }) => {
    await openCleanApp(page);
    await trapNativeDialogs(page);
    const resultPromise = page.evaluate(() => window.uiPrompt("T", "x"));
    await page.waitForSelector("#dlg.on", { state: "visible" });
    // Click the overlay itself at a point OUTSIDE the .dc box.
    await page.evaluate(() => {
      const dlg = document.getElementById("dlg")!;
      const evt = new PointerEvent("pointerdown", { bubbles: true });
      Object.defineProperty(evt, "target", { value: dlg });
      dlg.dispatchEvent(evt);
    });
    const result = await resultPromise;
    expect(result).toBeNull();
  });

  test("1.7.4 uiConfirm OK → true, Cancel → false; danger=true uses .dn button", async ({ page }) => {
    await openCleanApp(page);
    await trapNativeDialogs(page);

    // danger:true shows .dn button.
    const okPromise = page.evaluate(() =>
      window.uiConfirm("Really delete?", { title: "Delete", danger: true, okLabel: "Delete" })
    );
    await page.waitForSelector("#dlg.on", { state: "visible" });
    await expect(page.locator("#dlg button.dn")).toBeVisible();
    await expect(page.locator("#dlg button.dn")).toHaveText("Delete");
    await page.locator("#dlg button.dn").click();
    expect(await okPromise).toBe(true);

    // Plain confirm, clicking Cancel → false.
    const cancelPromise = page.evaluate(() => window.uiConfirm("Proceed?"));
    await page.waitForSelector("#dlg.on", { state: "visible" });
    await expect(page.locator("#dlg button.pr")).toBeVisible();
    await page.locator("#dlg button[data-ui-cancel]").click();
    expect(await cancelPromise).toBe(false);
  });

  test("1.7.5 uiNotice renders with OK button, resolves on click", async ({ page }) => {
    await openCleanApp(page);
    await trapNativeDialogs(page);
    const resultPromise = page.evaluate(() => window.uiNotice("Something happened.", { title: "Info" }));
    await page.waitForSelector("#dlg.on", { state: "visible" });
    await expect(page.locator("#dlg h3")).toHaveText("Info");
    await expect(page.locator("#dlg .dmsg")).toHaveText("Something happened.");
    await page.locator("#dlg button.pr").click();
    await resultPromise;
    await expect(page.locator("#dlg")).not.toHaveClass(/on/);
  });

  test("1.7.6 +WS toolbar button does NOT fire native prompt — uses in-app dialog", async ({ page }) => {
    await openCleanApp(page);
    const trap = await trapNativeDialogs(page);

    // Kick off newWorkspace — the toolbar "+ WS" button wires to this.
    const p = page.evaluate(() => window.newWorkspace!());
    // Custom dialog should appear.
    await page.waitForSelector("#dlg.on", { state: "visible", timeout: 2_000 });
    // Cancel it out so the call resolves.
    await page.keyboard.press("Escape");
    await p;

    // No native prompt/confirm/alert was invoked at any point.
    const native = await trap.nativeCalls();
    expect(native).toEqual([]);
    expect(trap.fired).toEqual([]);
  });

  test("1.7.7 + Zone toolbar button does NOT fire native prompt — uses in-app dialog", async ({ page }) => {
    await openCleanApp(page);
    const trap = await trapNativeDialogs(page);

    // addZoneCenter() is the "+ Zone" toolbar button's onclick.
    const p = page.evaluate(() => window.addZoneCenter!());
    await page.waitForSelector("#dlg.on", { state: "visible", timeout: 2_000 });
    // Submit with a zone name via Enter.
    await page.locator("#dlg input[type=text]").fill("My Zone");
    await page.keyboard.press("Enter");
    await p;

    const native = await trap.nativeCalls();
    expect(native).toEqual([]);
    expect(trap.fired).toEqual([]);

    // New zone landed in state under its typed name.
    const zoneNames = await page.evaluate(() =>
      window.__E2E!.current().zones.map((z: any) => z.name)
    );
    expect(zoneNames).toContain("My Zone");
  });

  test("1.7.8 XSS-safe: <script> in title/message renders as text, not executed", async ({ page }) => {
    await openCleanApp(page);
    await trapNativeDialogs(page);

    let popupFired = false;
    page.on("dialog", () => {
      popupFired = true;
    });

    const p = page.evaluate(() =>
      window.uiNotice('<script>window.__pwned=true</script><img src=x onerror=alert(1)>', {
        title: "<b>bold</b>",
      })
    );
    await page.waitForSelector("#dlg.on", { state: "visible" });

    const pwned = await page.evaluate(() => (window as any).__pwned === true);
    expect(pwned).toBe(false);
    expect(popupFired).toBe(false);

    // h3 has no nested <b> — the tag was escaped.
    const h3Html = await page.locator("#dlg h3").innerHTML();
    expect(h3Html).toContain("&lt;b&gt;");
    expect(h3Html).not.toContain("<b>");

    await page.locator("#dlg button.pr").click();
    await p;
  });
});
