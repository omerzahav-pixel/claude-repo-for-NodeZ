/* =============================================================================
 * EdgeSpace · Phase 1 · Canvas transform — single source of truth
 *
 * Wraps the existing `view` object (window.view, declared in app.js) so the
 * new gesture state machine writes through one chokepoint. Two paths:
 *
 *   - applyTransformImmediate(t)  · writes view + calls render() right now
 *   - scheduleApply(t)            · writes view + queues a RAF flush so multiple
 *                                   touchmoves within a frame coalesce to one
 *                                   commit (paired with --raf-throttle).
 *
 * The current substrate is SVG-viewBox-based (render() rebuilds innerHTML).
 * Pass 5 §03 (3-layer canvas-tile substrate) is a LATER phase — Phase 1's job
 * is to bound the existing pipeline's commit rate, not replace it.
 *
 * If --gestures-v2 is OFF, this file is essentially dormant: the old pointer
 * handlers in app.js continue to mutate `view` and call render() themselves.
 * ============================================================================= */

(function () {
  'use strict';

  // The view object is declared in app.js as a top-level `let`. It IS attached
  // to window via __E2E.view() (read-only getter) but the actual mutable
  // reference needs us to wait until app.js has executed.
  function getView() {
    return typeof window.view !== 'undefined' ? window.view : null;
  }

  let pendingT = null;       // last-written {x, y, k} awaiting flush
  let rafHandle = null;
  let lastCommitMs = 0;      // for the perf HUD

  function commit() {
    rafHandle = null;
    const v = getView();
    if (!v || !pendingT) { pendingT = null; return; }
    v.x = pendingT.x; v.y = pendingT.y; v.k = pendingT.k;
    pendingT = null;
    const t0 = performance.now();
    try {
      if (typeof window.clampView === 'function') window.clampView();
      if (typeof window.render === 'function') window.render();
    } catch (e) {
      console.error('[EdgeSpace transform] render threw:', e);
    }
    lastCommitMs = performance.now() - t0;
    // Notify the perf HUD if it's listening.
    if (window.PerfHud && typeof window.PerfHud.markCommit === 'function') {
      window.PerfHud.markCommit(lastCommitMs);
    }
  }

  /**
   * scheduleApply(t)
   *  - Stash the latest transform; one commit per RAF.
   *  - Call from RAF-throttle path (touchmove → accumulate → schedule).
   */
  function scheduleApply(t) {
    pendingT = { x: t.x, y: t.y, k: t.k };
    if (rafHandle == null) rafHandle = requestAnimationFrame(commit);
  }

  /**
   * applyImmediate(t)
   *  - Write the transform and render synchronously this tick.
   *  - Used by INERTIA→PINCH handoff (must land before pinch baseline read).
   */
  function applyImmediate(t) {
    pendingT = { x: t.x, y: t.y, k: t.k };
    if (rafHandle != null) { cancelAnimationFrame(rafHandle); rafHandle = null; }
    commit();
  }

  /** Read the live transform (NOT a snapshot — same reference as window.view). */
  function get() {
    const v = getView();
    return v ? { x: v.x, y: v.y, k: v.k } : { x: 0, y: 0, k: 1 };
  }

  /** Cancel any pending RAF flush. Use when state transitions invalidate the queue. */
  function cancelPending() {
    if (rafHandle != null) { cancelAnimationFrame(rafHandle); rafHandle = null; }
    pendingT = null;
  }

  /** Diagnostic: last commit duration (ms). The perf HUD reads this. */
  function lastCommitTime() { return lastCommitMs; }

  window.CanvasTransform = Object.freeze({
    get,
    scheduleApply,
    applyImmediate,
    cancelPending,
    lastCommitTime
  });
})();
