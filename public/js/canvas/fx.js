/* =============================================================================
 * EdgeSpace · Sprint 4.2 · fx control (paint, not transform)
 *
 * Sprint 4 (tile cache) and Sprint 4.1 (culling) both came back null on iPad.
 * The HUD finally showed why: during pan, `commit` (the transform write) is
 * ~2.4ms — exactly what Pass 5 budgeted — but `worst` is ~200ms. That ~200ms
 * gap is PAINT. iOS Safari re-rasterises the SVG every frame because of effects
 * it cannot GPU-composite:
 *   · the per-node freshness halo — a stroked <circle> whose `es-halo-pulse`
 *     is an always-on 3s CSS animation, so the layer is never static;
 *   · the selection drop-shadows and selected-edge glow (CSS `filter:`).
 * Culling can't help the most common action — viewing the whole canvas — because
 * then there is nothing off-screen to cull. The lever is paint.
 *
 * This module wires two flags (both default OFF) to the CSS suppression classes
 * (see components-v2.css · "fx suppression"):
 *
 *   --no-fx      Issue 2 · diagnostic-by-removal. Adds body.no-fx for the whole
 *                session: halo gone, all canvas filters off. The user pans and
 *                reads the HUD `paint` line — if it collapses, fx were the cost.
 *
 *   --fx-motion  Issue 3 Path A · the fix. Adds body.fx-suppressed ONLY while
 *                the canvas is in motion (pan / pinch / inertia / drag), removed
 *                on settle. The static view keeps the full freshness halo + glow;
 *                the user only loses fx mid-gesture, when they can't perceive it.
 *                Pan then becomes a pure composited transform — paint-independent.
 *
 * Path A keys off the existing gesture state machine by POLLING GestureV2.getState()
 * from a rAF loop (only installed when --fx-motion is on). We deliberately do not
 * edit gesture.js — the Phase-1 state machine is sensitive and a read-only poll
 * with a 1-frame lag is imperceptible and risk-free. The class is toggled only on
 * a motion↔still transition, never every frame.
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

  function installMotionWatcher() {
    let suppressed = false;
    function tick() {
      const now = inMotion();
      if (now !== suppressed) {
        suppressed = now;
        document.body.classList.toggle('fx-suppressed', now);
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function boot() {
    const F = window.Flags;
    if (!F) return;
    // Issue 2 — --no-fx: kill fx for the whole session (diagnostic / preference).
    if (F.on('no-fx')) document.body.classList.add('no-fx');
    // Issue 3 Path A — --fx-motion: drop fx only while moving.
    if (F.on('fx-motion')) installMotionWatcher();

    // Tiny introspection hook for tests / the HUD.
    window.FxControl = Object.freeze({
      noFx: () => !!(F.on('no-fx')),
      motion: () => !!(F.on('fx-motion')),
      suppressedNow: () => document.body.classList.contains('fx-suppressed') ||
                           document.body.classList.contains('no-fx')
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
