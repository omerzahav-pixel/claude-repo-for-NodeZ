/* =============================================================================
 * EdgeSpace · Sprint 4.5 · pan-settle — the "rebuild only on stop" half
 *
 * The real Phase-4 fix has two halves:
 *   1. CanvasTransform.commit() → applyView() (transform-only, no DOM rebuild)
 *      moves all layers as one space at 60 fps during pan/zoom. (transform.js)
 *   2. On gesture SETTLE, run exactly ONE render() to restore full fidelity:
 *      re-rasterise #cv sharp at the new zoom, re-flow labels, recompute the
 *      cull set, and reset the CSS delta (render() sets __panBase + clears
 *      cv.style.transform). That's this module.
 *
 * It polls the Phase-1 gesture state machine read-only (GestureV2.getState())
 * and, on the motion→idle edge, calls window.render() once. During motion it
 * does nothing — applyView() (driven by commit) owns the frame. The gesture
 * machine is never touched.
 *
 * This replaces the retired static-pan.js (the diagnostic) and freeze-pan.js
 * (the redundant snapshot). Under --legacy-pan (emergency rollback) commit()
 * still calls render() every frame, so the settle driver is unnecessary and
 * does not install.
 * ============================================================================= */

(function () {
  'use strict';

  function inMotion() {
    try {
      const G = window.GestureV2;
      if (G && typeof G.getState === 'function') {
        const s = G.getState();
        if (s === 'pan' || s === 'pinch' || s === 'inertia') return true;
      }
      const b = document.body;
      if (b && (b.classList.contains('dragging') || b.classList.contains('holding'))) return true;
      if (window._inertiaActive) return true;
    } catch (e) {}
    return false;
  }

  function install() {
    let moving = false;
    function tick() {
      const now = inMotion();
      if (now !== moving) {
        moving = now;
        if (!now) {
          /* Settle → one full render at the final view. Re-rasters #cv sharp at
             the new zoom, reflows labels, recomputes the cull set, and resets the
             per-frame CSS delta (render() sets __panBase + clears cv.transform).
             The transformed live view and the re-rendered view are pixel-aligned
             (same mapping), so the swap is invisible. */
          try { if (typeof window.render === 'function') window.render(); } catch (e) {}
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function boot() {
    const F = window.Flags;
    // Under --legacy-pan, commit() renders every frame — no settle pass needed.
    if (F && F.on('legacy-pan')) return;
    install();
    window.PanSettle = Object.freeze({ inMotion });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
