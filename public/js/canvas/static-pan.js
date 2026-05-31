/* =============================================================================
 * EdgeSpace · Sprint 4.4 · --static-pan (DIAGNOSTIC ISOLATION, not a fix)
 *
 * Four null results (tile cache, culling, no-fx, freeze/simple-nodes) mean we
 * were guessing. This sprint stops guessing. A code audit found that the prime
 * suspects from the brief do NOT read live geometry: edge-v2.js, cull-v1.js and
 * freeze-pan.js contain zero getBoundingClientRect / getBBox / getCTM calls —
 * they route and cull purely from the canvas-coordinate data model. So edge
 * re-routing and culling are NOT forcing reflow.
 *
 * What DOES run every pan frame: CanvasTransform.commit() (transform.js) calls
 * render(), and render() tears down and rebuilds the ENTIRE #cv + #canvasOverlay
 * innerHTML and rewrites viewBox/width/height — 60×/second. The browser must lay
 * out and paint that brand-new subtree every frame.
 *
 * --static-pan isolates exactly that. While the gesture is in motion it sets
 * window.__staticPan, which makes render() (see app.js) SKIP the rebuild and
 * instead move the existing layers with one CSS transform from the gesture-start
 * view. Nothing is rebuilt, no viewBox changes, no geometry is read.
 *
 *   · If pan jumps to 50–60 fps under --static-pan → the per-frame rebuild is
 *     the cost. Sprint 4.5 hardens this into the real fix (transform during pan,
 *     rebuild only on settle).
 *   · If pan is still ~6 fps → compositing the vector layer itself is the cost,
 *     and we reopen the paint line with a fresh trace.
 *
 * This module only manages the gesture edges (capture V0 on motion start; clear
 * + one real render on settle). The transform itself lives in render(). The
 * Phase-1 gesture machine is polled read-only and never touched. Default OFF;
 * window.__staticPan is undefined unless the flag is on.
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

  function readView() {
    try {
      const E = window.__E2E;
      if (E && typeof E.view === 'function') return E.view();
    } catch (e) {}
    return null;
  }

  function installWatcher() {
    let moving = false;
    function tick() {
      const now = inMotion();
      if (now !== moving) {
        moving = now;
        if (now) {
          // Entering motion — freeze the base view; render() will CSS-transform
          // the layers from here without rebuilding.
          const v = readView();
          if (v) window.__staticPanV0 = { x: v.x, y: v.y, k: v.k };
          window.__staticPan = true;
        } else {
          // Settling — clear the CSS transform and do ONE real render at the
          // final view so the live layers are crisp and correctly positioned.
          window.__staticPan = false;
          const cv = document.getElementById('cv');
          if (cv) cv.style.transform = '';
          try { if (typeof window.render === 'function') window.render(); } catch (e) {}
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function boot() {
    const F = window.Flags;
    if (!F) return;
    if (F.on('static-pan')) installWatcher();
    window.StaticPan = Object.freeze({
      active: () => !!F.on('static-pan'),
      on: () => !!window.__staticPan
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
