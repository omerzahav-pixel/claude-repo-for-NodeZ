/* =============================================================================
 * EdgeSpace · Sprint 4 · Phase 4 (Pass 5 §03 + Pass 7 §05) · Canvas tile cache
 *
 * Rasterises the dot-grid pattern + zone fills onto a single <canvas>
 * sized 1.5× the viewport on each axis (4× total area). Pan within that
 * area is a pure CSS transform on the canvas element — no redraw.
 * Pinch within a zoom tier (round(log2(scale)) unchanged) is the same.
 * Re-bake fires on:
 *   (a) zoom-tier crossing — round(log2(view.k)) shifts
 *   (b) pan beyond the 50% overdraw margin — center of bake drifts more
 *       than viewport/2 from the current view center
 *   (c) zone set changes — content invalidation
 *   (d) viewport resize
 *   (e) compositor drop (visibilitychange + canvas contextlost)
 *
 * R5 mitigation (tile-tearing): the single-canvas-with-overdraw design
 * has no inter-tile boundaries, so there are no seams to defeat. The 4-px
 * overdraw margin mentioned in Pass 7 §05 is for true tile grids; the
 * simpler "panbox" architecture here avoids the seam class of bugs
 * entirely. Pass 7 R5 explicitly accepts this fallback ("full repaint
 * per zoom-tier crossing, 5 ms one-off, no seams").
 *
 * Gated by Flags.on('canvas-tiles'). When OFF, this module installs
 * nothing and the SVG renders zone fills + (nothing for dot-grid;
 * EdgeSpace has no SVG dot-grid today) as before. The tile cache also
 * adds a new visual element (the dot-grid) that wasn't in the SVG path,
 * so toggling the flag is the visual switch.
 * ============================================================================= */

(function () {
  'use strict';

  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let viewportW = 0;
  let viewportH = 0;

  /* Bake state — the world-coordinate window currently rasterised into
     the canvas backing store. */
  let bakedTier = null;        // round(log2(view.k)) at last bake
  let bakedCenterX = null;     // world coord at center of bake
  let bakedCenterY = null;
  let bakedScale = 1;          // exact view.k at last bake
  let bakedWidth = 0;          // canvas size in CSS pixels (3× viewport)
  let bakedHeight = 0;
  /* Sprint 4 §05 — color of the dot-grid; subtle ink-on-bg. */
  const GRID_SPACING_WORLD = 32;        // dots every 32 world units
  const GRID_DOT_RADIUS_CSS = 0.9;      // dot radius in CSS pixels
  const GRID_COLOR = 'rgba(255,255,255,0.045)';
  /* "Tier" is the discrete zoom level used to decide when to re-bake.
     Pass 5 §03 says "≥ 1.5× shift from last bake". round(log2) gives
     boundaries at 1.0, ~1.41, ~2.0, ~2.83, ... — roughly 1.41× per
     step. Close enough. */
  function currentTier(k) { return Math.round(Math.log2(k || 1)); }

  function hexToRgba(hex, alpha) {
    if (!hex || typeof hex !== 'string') return 'rgba(255,122,69,' + alpha + ')';
    const m = hex.replace(/^#/, '');
    let r = 255, g = 122, b = 69;
    if (m.length === 3) {
      r = parseInt(m[0] + m[0], 16);
      g = parseInt(m[1] + m[1], 16);
      b = parseInt(m[2] + m[2], 16);
    } else if (m.length >= 6) {
      r = parseInt(m.slice(0, 2), 16);
      g = parseInt(m.slice(2, 4), 16);
      b = parseInt(m.slice(4, 6), 16);
    }
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // ─── Geometry helpers ────────────────────────────────────────────────────
  function getView() {
    const E = window.__E2E;
    if (E && typeof E.view === 'function') {
      const v = E.view();
      if (v) return v;
    }
    return { x: 0, y: 0, k: 1 };
  }
  function currentZones() {
    const E = window.__E2E;
    if (E && typeof E.current === 'function') {
      const c = E.current();
      if (c && Array.isArray(c.zones)) return c.zones;
    }
    return [];
  }

  // ─── Sizing ──────────────────────────────────────────────────────────────
  function syncCanvasSize() {
    if (!canvas) return;
    dpr = Math.max(1, window.devicePixelRatio || 1);
    viewportW = window.innerWidth;
    viewportH = window.innerHeight;
    /* Bake size = 2× viewport on each axis (50% overdraw on each side
       means the user can pan a full viewport in any direction before
       running out of pre-baked content and forcing a re-bake). */
    const cssW = viewportW * 2;
    const cssH = viewportH * 2;
    bakedWidth  = cssW;
    bakedHeight = cssH;
    /* CSS size: matches the bake area in CSS px. Backing-store size:
       cssSize × DPR for crisp rendering on Retina. */
    canvas.style.width  = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  // ─── Bake ────────────────────────────────────────────────────────────────
  function bake() {
    if (!ctx) return;
    const view = getView();
    const k = view.k || 1;
    bakedTier = currentTier(k);
    bakedScale = k;
    /* Center the bake on the current view center.
       view.x and view.y are the canvasOverlay's translate values:
         screen.x = W/2 + (worldX + view.x) * view.k
       Center of viewport (W/2, H/2) maps to world (-view.x, -view.y).
       So bakedCenter (in world coords) = (-view.x, -view.y). */
    bakedCenterX = -view.x;
    bakedCenterY = -view.y;

    /* Reset transform + clear. The canvas backing-store is dpr × CSS px.
       We'll scale the context so 1 unit in our drawing math = 1 CSS px. */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    /* Map world (x, y) → bake-canvas-CSS px:
         canvas px = bakedWidth/2 + (worldX - bakedCenterX) * k
       (since bake centers worldX = bakedCenterX at canvas-x = bakedWidth/2)
       So translate to bake center, then scale by k, then world coords
       map naturally. */
    ctx.translate(bakedWidth / 2, bakedHeight / 2);
    ctx.scale(k, k);
    ctx.translate(-bakedCenterX, -bakedCenterY);

    /* World extent currently covered by the bake = bakedWidth / k. */
    const worldHalfW = (bakedWidth / 2) / k;
    const worldHalfH = (bakedHeight / 2) / k;
    const minWX = bakedCenterX - worldHalfW;
    const minWY = bakedCenterY - worldHalfH;
    const maxWX = bakedCenterX + worldHalfW;
    const maxWY = bakedCenterY + worldHalfH;

    /* 1. Zone fills (under the dot-grid so dots show through subtly). */
    const zones = currentZones();
    for (const z of zones) {
      if (!z || z.x == null || z.y == null) continue;
      ctx.fillStyle = hexToRgba(z.color, 0.06);
      ctx.fillRect(z.x, z.y, z.w || 0, z.h || 0);
    }

    /* 2. Dot grid. Snap to GRID_SPACING_WORLD boundaries within the
       bake extent. Dot radius is in CSS pixels (not world), so we
       multiply by 1/k to keep it visually consistent regardless of
       zoom — i.e., a dot always renders as ~0.9 CSS px on screen.

       At very-zoomed-out levels (k < 0.4) the grid would render as a
       solid noise field; clamp the rendered spacing to a minimum of
       16 CSS px between dots by skipping every Nth row at low zoom. */
    const screenSpacing = GRID_SPACING_WORLD * k;
    const skip = (screenSpacing < 6) ? Math.ceil(8 / screenSpacing) : 1;
    const step = GRID_SPACING_WORLD * Math.max(1, skip);
    const xStart = Math.floor(minWX / step) * step;
    const yStart = Math.floor(minWY / step) * step;
    ctx.fillStyle = GRID_COLOR;
    const dotR = GRID_DOT_RADIUS_CSS / k;
    for (let wy = yStart; wy <= maxWY; wy += step) {
      for (let wx = xStart; wx <= maxWX; wx += step) {
        ctx.beginPath();
        ctx.arc(wx, wy, dotR, 0, 6.2832);
        ctx.fill();
      }
    }
  }

  // ─── Per-frame sync ──────────────────────────────────────────────────────
  function syncTransform() {
    if (!canvas) return;
    const view = getView();
    const k = view.k || 1;
    /* Where on screen should the CENTER of the baked canvas appear?
       Baked center is at world coord (bakedCenterX, bakedCenterY).
       That world point maps to screen:
         sx = W/2 + (bakedCenterX + view.x) * k
       The canvas element's natural top-left is at screen (0, 0) when
       transform is identity; we want the canvas's CENTER to land at
       (sx, sy). So we translate by (sx - bakedWidth/2, sy - bakedHeight/2)
       and scale by (k / bakedScale) to compensate for any zoom drift
       since the last bake (per Pass 5 §03 "within-tier scale stays in
       transform, full re-bake only on tier crossing"). */
    const screenCx = viewportW / 2 + (bakedCenterX + view.x) * k;
    const screenCy = viewportH / 2 + (bakedCenterY + view.y) * k;
    const scaleAdj = k / (bakedScale || 1);
    const tx = screenCx - (bakedWidth  / 2) * scaleAdj;
    const ty = screenCy - (bakedHeight / 2) * scaleAdj;
    canvas.style.transform =
      'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0)' +
      ' scale(' + scaleAdj.toFixed(6) + ')';
  }

  // ─── Re-bake triggers ────────────────────────────────────────────────────
  function maybeRebake() {
    if (!canvas) return;
    const view = getView();
    const k = view.k || 1;
    const tier = currentTier(k);
    if (tier !== bakedTier) {
      bake();
      return;
    }
    /* Pan-margin check. We baked centered on (bakedCenterX, bakedCenterY).
       Current view center in world = (-view.x, -view.y). If we've drifted
       more than 50% of bake area, re-bake. */
    const driftX = Math.abs((-view.x) - bakedCenterX) * k;
    const driftY = Math.abs((-view.y) - bakedCenterY) * k;
    if (driftX > bakedWidth / 4 || driftY > bakedHeight / 4) {
      bake();
    }
  }

  function refresh() {
    maybeRebake();
    syncTransform();
  }

  /* Sprint 4 Issue 3 — recovery path. iOS Safari can drop the canvas
     backing store under memory pressure or after tab restore; the
     canvas paints invisible. visibilitychange when returning to the
     tab triggers a re-bake. The 2D context spec doesn't fire
     `contextlost` on iOS Safari for 2D (only WebGL), so we rely on
     visibility as the primary trigger. */
  function installRecovery() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        requestAnimationFrame(() => { bake(); syncTransform(); });
      }
    });
    /* Defensive: if the canvas element does fire contextlost (newer
       Safari may), handle it. */
    canvas.addEventListener('contextlost', (e) => {
      try { e.preventDefault(); } catch (_) {}
      requestAnimationFrame(() => { bake(); syncTransform(); });
    });
    window.addEventListener('resize', () => {
      syncCanvasSize();
      bake();
      syncTransform();
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => { syncCanvasSize(); bake(); syncTransform(); }, 200);
    });
  }

  // ─── Boot ────────────────────────────────────────────────────────────────
  function boot() {
    if (!window.Flags || !window.Flags.on('canvas-tiles')) return;
    canvas = document.getElementById('tiles');
    if (!canvas) {
      requestAnimationFrame(boot);
      return;
    }
    try {
      ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    } catch (e) {
      ctx = canvas.getContext('2d');
    }
    if (!ctx) {
      console.warn('[EdgeSpace tile-cache] 2D context unavailable — staying inert');
      return;
    }
    document.body.classList.add('canvas-tiles-on');
    syncCanvasSize();
    /* Initial bake needs to wait until __E2E + zones are available. */
    function tryInitial() {
      if (!window.__E2E) { requestAnimationFrame(tryInitial); return; }
      bake();
      syncTransform();
      installRecovery();
      hookRender();
    }
    tryInitial();
  }

  function hookRender() {
    /* Wrap window.render so every render-driven view change syncs the
       tile transform + invalidates on tier/pan drift. Cheap: no per-
       frame work beyond a few floats and a CSS string write. */
    if (typeof window.render === 'function' && !window.render.__tilesHooked) {
      const orig = window.render;
      const wrapped = function () {
        const r = orig.apply(this, arguments);
        try { refresh(); } catch (e) { console.error('[EdgeSpace tile-cache] refresh threw:', e); }
        return r;
      };
      wrapped.__tilesHooked = true;
      window.render = wrapped;
    } else if (!window.render) {
      requestAnimationFrame(hookRender);
    }
  }

  /* Exposed for the perf-HUD and tests. */
  window.TileCache = Object.freeze({
    bake: function () { if (ctx) bake(); },
    refresh: refresh,
    /* Sprint 4.5 · cheap per-frame transform sync (no re-bake) for applyView,
       since the per-frame path no longer goes through the render() wrap. */
    sync: function () { if (ctx) syncTransform(); },
    snapshot: function () {
      return {
        installed: !!ctx,
        bakedTier: bakedTier,
        bakedCenter: { x: bakedCenterX, y: bakedCenterY },
        bakedScale: bakedScale,
        canvasSize: canvas ? { w: canvas.width, h: canvas.height } : null,
        dpr: dpr
      };
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
