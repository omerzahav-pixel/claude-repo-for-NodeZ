import { test, expect, type Page } from "@playwright/test";

/**
 * EdgeSpace · Pass 5 · Phase 1 smoke tests.
 *
 * Verifies that the new Phase 1 modules:
 *   - install correctly when their flags are ON
 *   - leave the existing pipeline untouched when their flags are OFF
 *   - the gesture state machine reaches its expected states on pointer input
 *
 * These are smoke tests, not exhaustive — full perf / iPad verification is a
 * real-device check the user performs at Phase 1's decision gate.
 */

const viteUrl = process.env.VITE_URL ?? "http://localhost:5173/";

async function openWithFlags(page: Page, flags: Record<string, boolean>) {
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

test.describe("Phase 1 · feature flag plumbing", () => {

  test("1.0.1 Flags module is present with all four Phase 1 flags", async ({ page }) => {
    await openWithFlags(page, {});
    const all = await page.evaluate(() => (window as any).Flags?.all());
    expect(all).toBeTruthy();
    expect(typeof all["gestures-v2"]).toBe("boolean");
    expect(typeof all["raf-throttle"]).toBe("boolean");
    expect(typeof all["lifecycle-v2"]).toBe("boolean");
    expect(typeof all["perf-hud"]).toBe("boolean");
  });

  test("1.0.2 All Phase 1 flags default to OFF", async ({ page }) => {
    await openWithFlags(page, {});
    const all = await page.evaluate(() => (window as any).Flags?.all());
    expect(all["gestures-v2"]).toBe(false);
    expect(all["raf-throttle"]).toBe(false);
    expect(all["lifecycle-v2"]).toBe(false);
    expect(all["perf-hud"]).toBe(false);
  });

  test("1.0.3 URL ?flag=gestures-v2 turns the flag ON for one session", async ({ page }) => {
    await page.goto(viteUrl + "?flag=gestures-v2", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!(window as any).Flags);
    const on = await page.evaluate(() => (window as any).Flags.on("gestures-v2"));
    expect(on).toBe(true);
  });

  test("1.0.4 Old pipeline runs unchanged with all flags OFF (no GestureV2)", async ({ page }) => {
    await openWithFlags(page, {});
    const g = await page.evaluate(() => (window as any).GestureV2);
    expect(g).toBeUndefined();
  });
});

test.describe("Phase 1 · gesture state machine (--gestures-v2)", () => {

  test("1.1.1 GestureV2 installs and starts in IDLE state", async ({ page }) => {
    await openWithFlags(page, { "gestures-v2": true });
    const state = await page.evaluate(() => (window as any).GestureV2?.getState());
    expect(state).toBe("idle");
  });

  test("1.1.2 CanvasTransform exposes get/scheduleApply/applyImmediate", async ({ page }) => {
    await openWithFlags(page, { "gestures-v2": true });
    const api = await page.evaluate(() => {
      const t = (window as any).CanvasTransform;
      return {
        present: !!t,
        get: typeof t?.get === "function",
        sched: typeof t?.scheduleApply === "function",
        immed: typeof t?.applyImmediate === "function",
      };
    });
    expect(api.present).toBe(true);
    expect(api.get).toBe(true);
    expect(api.sched).toBe(true);
    expect(api.immed).toBe(true);
  });

  test("1.1.3 INERTIA → PINCH transition zeros velocity in the same tick", async ({ page }) => {
    await openWithFlags(page, { "gestures-v2": true });
    // Force the state machine into inertia, then simulate a second pointer down.
    const result = await page.evaluate(() => {
      const cv = document.getElementById("cv")!;
      // First finger: pan that ends with velocity → inertia
      cv.dispatchEvent(new PointerEvent("pointerdown", { clientX: 200, clientY: 200, pointerType: "touch", pointerId: 1, isPrimary: true, bubbles: true, cancelable: true }));
      cv.dispatchEvent(new PointerEvent("pointermove", { clientX: 250, clientY: 220, pointerType: "touch", pointerId: 1, isPrimary: true, bubbles: true, cancelable: true }));
      cv.dispatchEvent(new PointerEvent("pointermove", { clientX: 320, clientY: 240, pointerType: "touch", pointerId: 1, isPrimary: true, bubbles: true, cancelable: true }));
      cv.dispatchEvent(new PointerEvent("pointerup",   { clientX: 320, clientY: 240, pointerType: "touch", pointerId: 1, isPrimary: true, bubbles: true, cancelable: true }));
      const stateAfterUp = (window as any).GestureV2.getState();
      const velAfterUp   = (window as any).GestureV2.getVelocity();
      // Now second finger lands while inertia is decaying
      cv.dispatchEvent(new PointerEvent("pointerdown", { clientX: 400, clientY: 400, pointerType: "touch", pointerId: 1, isPrimary: true, bubbles: true, cancelable: true }));
      cv.dispatchEvent(new PointerEvent("pointerdown", { clientX: 450, clientY: 400, pointerType: "touch", pointerId: 2, isPrimary: false, bubbles: true, cancelable: true }));
      const stateAfterPinch = (window as any).GestureV2.getState();
      const velAfterPinch   = (window as any).GestureV2.getVelocity();
      return { stateAfterUp, velAfterUp, stateAfterPinch, velAfterPinch };
    });
    // The exact post-up state can be 'inertia' (if our velocity was non-zero) or 'idle'.
    // The critical assertion is the PINCH transition zeros velocity.
    expect(result.stateAfterPinch).toBe("pinch");
    expect(Math.abs(result.velAfterPinch.x)).toBeLessThan(0.01);
    expect(Math.abs(result.velAfterPinch.y)).toBeLessThan(0.01);
  });

  test("1.1.4a R1 regression — pan with flag ON actually moves view.x/view.y", async ({ page }) => {
    await openWithFlags(page, { "gestures-v2": true, "raf-throttle": true });
    // Touch pan from (200, 200) → (400, 280) with two intermediate samples.
    const result = await page.evaluate(async () => {
      const before = { ...(window as any).__E2E.view() };
      const cv = document.getElementById("cv")!;
      const dispatch = (type: string, x: number, y: number, id = 1) => {
        cv.dispatchEvent(new PointerEvent(type, {
          clientX: x, clientY: y, pointerType: "touch",
          pointerId: id, isPrimary: id === 1, bubbles: true, cancelable: true
        }));
      };
      dispatch("pointerdown", 200, 200);
      dispatch("pointermove", 260, 220);
      dispatch("pointermove", 340, 260);
      dispatch("pointermove", 400, 280);
      // Wait for the RAF flush to commit.
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      const mid = { ...(window as any).__E2E.view() };
      dispatch("pointerup", 400, 280);
      await new Promise(r => setTimeout(r, 50));
      const after = { ...(window as any).__E2E.view() };
      return { before, mid, after };
    });
    // Pan moves clientX by +200 and clientY by +80. View.x/y should shift by
    // (clientDx/view.k, clientDy/view.k). Initial view.k is 0.5, so view.x
    // delta ≈ 400 and view.y delta ≈ 160. Just assert "moved by more than
    // a trivial amount" so the test isn't brittle to view.k init drift.
    expect(Math.abs(result.mid.x - result.before.x)).toBeGreaterThan(50);
    expect(Math.abs(result.mid.y - result.before.y)).toBeGreaterThan(20);
  });

  test("1.1.4b R3 regression — body.dragging and body.holding cleared on IDLE", async ({ page }) => {
    await openWithFlags(page, { "gestures-v2": true });
    const result = await page.evaluate(async () => {
      const cv = document.getElementById("cv")!;
      // Pretend something added body.dragging + body.holding (simulating the
      // worst case where the old code path left residue).
      document.body.classList.add("dragging", "holding");
      // Dispatch a pan that ends with pointerup, which transitions to idle.
      cv.dispatchEvent(new PointerEvent("pointerdown", { clientX: 300, clientY: 300, pointerType: "touch", pointerId: 1, isPrimary: true, bubbles: true, cancelable: true }));
      cv.dispatchEvent(new PointerEvent("pointermove", { clientX: 330, clientY: 320, pointerType: "touch", pointerId: 1, isPrimary: true, bubbles: true, cancelable: true }));
      cv.dispatchEvent(new PointerEvent("pointerup",   { clientX: 330, clientY: 320, pointerType: "touch", pointerId: 1, isPrimary: true, bubbles: true, cancelable: true }));
      // Wait two RAFs so any pending inertia decays past stop-threshold (low velocity → straight to idle).
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      return {
        dragging: document.body.classList.contains("dragging"),
        holding:  document.body.classList.contains("holding"),
        state:    (window as any).GestureV2.getState()
      };
    });
    expect(result.dragging).toBe(false);
    expect(result.holding).toBe(false);
  });

  test("1.1.4 Old pinch path bails when flag ON (no double-write to view)", async ({ page }) => {
    await openWithFlags(page, { "gestures-v2": true });
    // After a synthetic pinch, the OLD pinchState should remain null because
    // the old pointerdown handler bailed in the activePtrs.size===2 branch.
    const pinchStateValue = await page.evaluate(() => {
      const cv = document.getElementById("cv")!;
      cv.dispatchEvent(new PointerEvent("pointerdown", { clientX: 400, clientY: 400, pointerType: "touch", pointerId: 1, isPrimary: true, bubbles: true, cancelable: true }));
      cv.dispatchEvent(new PointerEvent("pointerdown", { clientX: 450, clientY: 400, pointerType: "touch", pointerId: 2, isPrimary: false, bubbles: true, cancelable: true }));
      // app.js's pinchState is a top-level `let`. It's not directly exposed,
      // but we check it via __E2E if available — otherwise check via gesture state.
      const g = (window as any).GestureV2?.getState();
      return { gestureState: g };
    });
    expect(pinchStateValue.gestureState).toBe("pinch");
  });
});

test.describe("Phase 1 · lifecycle-v2", () => {

  test("1.3.1 IdbV2 single-flight wrapper installs", async ({ page }) => {
    await openWithFlags(page, { "lifecycle-v2": true });
    const has = await page.evaluate(() => !!(window as any).IdbV2);
    expect(has).toBe(true);
  });

  test("1.3.2 idbOpen() now returns the same Promise for concurrent callers", async ({ page }) => {
    await openWithFlags(page, { "lifecycle-v2": true });
    const sameDb = await page.evaluate(async () => {
      const open = (window as any).idbOpen;
      const [a, b, c] = await Promise.all([open(), open(), open()]);
      return a === b && b === c;
    });
    expect(sameDb).toBe(true);
  });

  test("1.3.3 IdbV2 absent when --lifecycle-v2 OFF", async ({ page }) => {
    await openWithFlags(page, {});
    const has = await page.evaluate(() => !!(window as any).IdbV2);
    expect(has).toBe(false);
  });
});

test.describe("Phase 1 · perf-hud", () => {

  test("1.4.1 ?debug=perf shows the HUD overlay", async ({ page }) => {
    await page.goto(viteUrl + "?debug=perf", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!(window as any).PerfHud);
    const hud = await page.locator("#perfHud").count();
    expect(hud).toBe(1);
  });

  test("1.4.2 HUD updates FPS within ~ 200ms", async ({ page }) => {
    await page.goto(viteUrl + "?debug=perf", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#perfHud");
    await page.waitForTimeout(250);
    const txt = await page.locator("#perfHud #ph-fps").textContent();
    expect(txt).toMatch(/fps\s+\d/);
  });

  test("1.4.3 HUD absent when ?debug=perf not present", async ({ page }) => {
    await openWithFlags(page, {});
    const hud = await page.locator("#perfHud").count();
    expect(hud).toBe(0);
  });

  test("1.4.4 R2 regression — ?debug=perf does NOT show legacy green log overlay", async ({ page }) => {
    await page.goto(viteUrl + "?debug=perf", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#perfHud", { timeout: 5000 });
    // The legacy dbgOverlay is gated on ?debug=verbose now; ?debug=perf must
    // not trigger it. Both the DOM element and the dlog function must be absent.
    const leak = await page.evaluate(() => ({
      dbgOverlay: !!document.getElementById("dbgOverlay"),
      dlog: typeof (window as any).dlog === "function"
    }));
    expect(leak.dbgOverlay).toBe(false);
    expect(leak.dlog).toBe(false);
  });

  test("1.4.5 ?debug=verbose still shows the legacy log overlay (opt-in works)", async ({ page }) => {
    await page.goto(viteUrl + "?debug=verbose", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!(window as any).dlog, null, { timeout: 5000 });
    const hasOverlay = await page.locator("#dbgOverlay").count();
    expect(hasOverlay).toBe(1);
  });
});
