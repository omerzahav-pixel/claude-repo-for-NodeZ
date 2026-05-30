/* =============================================================================
 * EdgeSpace · Sprint 4.3 · freeze-pan (cheap pan, rich at rest)
 *
 * The end of the Phase-4 perf hunt. Three null results (tile cache, culling,
 * no-fx) plus the HUD's commit-vs-worst gap proved the bottleneck is PAINT:
 * iOS Safari re-rasterises the vector node/edge layer on every transform frame,
 * and — crucially — CanvasTransform.commit() calls render() every pan frame
 * (transform.js), so each frame rebuilds + repaints ~88 vector silhouettes +
 * halos + 46 bezier edges. commit ~2.7ms, paint ~200ms, pan ~5fps.
 *
 * The production answer (Figma / tldraw / Excalidraw) is "don't pay full vector
 * cost while moving — pay it once, at rest." A pixel-perfect DOM→bitmap snapshot
 * is not achievable here: iOS Safari can't rasterise the HTML overlay or
 * foreignObject into a canvas, and the project forbids external libraries
 * (html2canvas et al.). So we take the route the existing architecture makes
 * cheap and robust: since render() already runs every pan frame, we make that
 * per-frame render PAINT CHEAP by drawing each node as a single state-coloured
 * circle (the --simple-nodes path) WHILE the canvas is in motion, and restoring
 * the full silhouettes/halo the instant it settles. 88 cheap circles rasterise
 * in a fraction of 88 vector silhouettes.
 *
 * This module owns the motion signal: it polls the Phase-1 gesture state machine
 * (read-only, via GestureV2.getState()) on a rAF loop and toggles
 * window.__inMotion, which render() reads (see app.js · simpleMode). On settle
 * it forces one rich re-render so the user sees full detail the moment the
 * finger lifts. The gesture machine itself is never touched.
 *
 * Gated by --freeze-pan (default OFF). When OFF, the watcher never installs and
 * window.__inMotion stays undefined → render() is byte-identical to Sprint 4.2.
 * Composes with culling (4.1 trims the live set), the tile cache (4, zones stay
 * on canvas), and fx suppression (4.2).
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

  function installWatcher() {
    let moving = false;
    function tick() {
      const now = inMotion();
      if (now !== moving) {
        moving = now;
        window.__inMotion = now;
        /* Re-render on BOTH edges: entering motion swaps to simple circles
           immediately (don't wait for the next CanvasTransform frame); leaving
           motion restores the full rich nodes at the final view. */
        try { if (typeof window.render === 'function') window.render(); } catch (e) {}
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function boot() {
    const F = window.Flags;
    if (!F) return;
    if (F.on('freeze-pan')) installWatcher();
    window.FreezePan = Object.freeze({
      active: () => !!F.on('freeze-pan'),
      inMotion: () => !!window.__inMotion
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
