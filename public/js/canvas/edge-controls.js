/* =============================================================================
 * EdgeSpace · Sprint 3 preamble · Edge selection + control panel.
 *
 * When the user taps an edge:
 *   1. The edge's <path> gains class `.e2-sel` which CSS thickens by +1px
 *      and adds a 4px outset glow in --hot-ring.
 *   2. A floating DOM control panel anchors at the edge midpoint, scale-
 *      invariant (DOM, not SVG). Contents:
 *        · Edge-type chip — clickable, cycles through 8 types
 *        · Label input    — rename or blank to remove the label
 *        · Trash icon     — delete the edge
 *   3. Tap elsewhere dismisses the panel and deselects.
 *
 * RTL: the panel anchors on the trailing-script side of the midpoint
 * (top-leading-script edge under RTL).
 *
 * This module surfaces window.EdgeControls.{select, deselect, current}
 * and listens for #cv pointerdowns to do hit-testing. The CanvasV2's
 * render() will re-call EdgeControls.reposition() after each render so
 * the panel tracks edge motion.
 * ============================================================================= */

(function () {
  'use strict';

  const TYPES_ORDER = ['feeds', 'blocker', 'derived', 'example', 'proof', 'related', 'idea-from', 'tentative'];
  let panel = null;        // DOM element
  let currentId = null;    // selected edge id

  function ensurePanel() {
    if (panel && document.body.contains(panel)) return panel;
    panel = document.createElement('div');
    panel.id = 'edgeControls';
    panel.setAttribute('aria-label', 'Edge controls');
    panel.style.cssText = 'display:none;position:fixed;z-index:30;pointer-events:auto';
    document.body.appendChild(panel);
    return panel;
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function findEdge(id) {
    if (typeof window.__E2E === 'undefined') return null;
    const c = window.__E2E.current();
    if (!c) return null;
    return (c.edges || []).find(e => String(e.id) === String(id));
  }

  function worldToScreen(wx, wy) {
    const v = window.__E2E.view();
    return {
      x: window.innerWidth  / 2 + (wx + v.x) * v.k,
      y: window.innerHeight / 2 + (wy + v.y) * v.k
    };
  }

  function getEdgeMidpointScreen(edge) {
    const c = window.__E2E.current();
    const a = c.nodes.find(n => n.id === edge.from);
    const b = c.nodes.find(n => n.id === edge.to);
    if (!a || !b) return null;
    // Midpoint approximation in world coords (same as edge-v2 renderEdge label math).
    return worldToScreen((a.x + b.x) / 2, (a.y + b.y) / 2);
  }

  function render() {
    const p = ensurePanel();
    if (currentId == null) { p.style.display = 'none'; return; }
    const edge = findEdge(currentId);
    if (!edge) { deselect(); return; }
    const mid = getEdgeMidpointScreen(edge);
    if (!mid) { deselect(); return; }
    const rtl = document.body.classList.contains('he');
    const type = edge.type || 'feeds';
    const label = edge.customLabel || '';
    p.innerHTML =
      '<div class="ec-row">' +
        '<button class="ec-type-chip" data-act="cycle-type" title="Cycle edge type">' +
          '<span class="ec-type-sw ec-type-' + type + '"></span>' +
          '<span class="ec-type-name">' + escHtml(type) + '</span>' +
        '</button>' +
        '<input class="ec-label-input" type="text" value="' + escHtml(label) + '" placeholder="label" dir="auto" />' +
        '<button class="ec-trash" data-act="delete" aria-label="Delete edge">×</button>' +
      '</div>';
    p.style.display = 'block';
    // Position: anchor 36px above the midpoint, centred horizontally; in
    // RTL anchor to the trailing side (right edge of midpoint).
    p.style.top = (mid.y - 56) + 'px';
    p.style.insetInlineStart = (rtl ? (window.innerWidth - mid.x) : mid.x) + 'px';
    p.style.transform = 'translateX(' + (rtl ? '50%' : '-50%') + ')';
    // Wire actions
    p.querySelector('[data-act="cycle-type"]').onclick = cycleType;
    p.querySelector('[data-act="delete"]').onclick = deleteEdge;
    const input = p.querySelector('.ec-label-input');
    input.oninput = onLabelInput;
    input.onkeydown = (ev) => { if (ev.key === 'Enter') input.blur(); if (ev.key === 'Escape') deselect(); };
    /* Sprint 3.1 Issue 2 — each edge now renders TWO paths (visible + fat
       invisible hit-target). Target the VISIBLE one only: .e2 (v2) or
       .edge (v1), never the .e2-hit / .edge-hit sibling. */
    document.querySelectorAll('path.e2-sel').forEach(el => el.classList.remove('e2-sel'));
    const visible = document.querySelector(
      'path.e2[data-edge="' + edge.id + '"], path.edge[data-edge="' + edge.id + '"]'
    );
    if (visible) visible.classList.add('e2-sel');
  }

  function cycleType() {
    const edge = findEdge(currentId);
    if (!edge) return;
    const i = TYPES_ORDER.indexOf(edge.type || 'feeds');
    edge.type = TYPES_ORDER[(i + 1) % TYPES_ORDER.length];
    if (typeof window.sv === 'function') window.sv();
    if (typeof window.render === 'function') window.render();
    render();
  }

  function deleteEdge() {
    const edge = findEdge(currentId);
    if (!edge) return;
    if (typeof window.sn === 'function') window.sn();
    const c = window.__E2E.current();
    c.edges = c.edges.filter(e => e.id !== edge.id);
    deselect();
    if (typeof window.sv === 'function') window.sv();
    if (typeof window.render === 'function') window.render();
  }

  function onLabelInput(ev) {
    const edge = findEdge(currentId);
    if (!edge) return;
    const v = ev.target.value.trim();
    edge.customLabel = v || null;
    if (typeof window.sv === 'function') window.sv();
    if (typeof window.render === 'function') window.render();
  }

  function select(edgeId) {
    currentId = String(edgeId);
    render();
  }

  function deselect() {
    currentId = null;
    document.querySelectorAll('path.e2-sel').forEach(el => el.classList.remove('e2-sel'));
    if (panel) panel.style.display = 'none';
  }

  function current() { return currentId; }

  // Reposition on every render — the canvas may have panned/zoomed.
  function reposition() {
    if (currentId != null) render();
  }

  // Hit-test: install a pointerdown listener on #cv that checks if the
  // target is an edge path. Capture phase so we run before the existing
  // app.js pointer handler, but we DO NOT stopImmediatePropagation —
  // app.js still handles node/zone/pan as normal.
  function installHitTest() {
    const cv = document.getElementById('cv');
    if (!cv) { requestAnimationFrame(installHitTest); return; }
    cv.addEventListener('pointerdown', function (e) {
      /* Sprint 3.1 Issue 2 — find an edge path under the pointer. With the
         fat invisible hit-target (.e2-hit / .edge-hit, stroke=20), single-
         finger taps on iPad reliably land here. We check e.target first,
         then fall through to elementFromPoint to handle browsers that
         report the parent <svg> as target. */
      let path = null;
      if (e.target && e.target.tagName === 'path' && e.target.hasAttribute('data-edge')) {
        path = e.target;
      } else if (e.target && e.target.closest && e.target.closest('path[data-edge]')) {
        path = e.target.closest('path[data-edge]');
      } else {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el && el.closest && el.closest('path[data-edge]')) path = el.closest('path[data-edge]');
      }
      // Skip edge selection while a node is being dragged — node drag wins.
      if (path) {
        const id = path.getAttribute('data-edge');
        select(id);
        /* stopImmediatePropagation kills sibling listeners on #cv (the
           app.js pan / beginInteraction handler is bound to #cv too),
           which is the only way to prevent it from grabbing the same
           pointerdown and starting a PAN. */
        try { e.stopImmediatePropagation(); } catch (_) {}
        try { e.stopPropagation(); } catch (_) {}
        try { e.preventDefault(); } catch (_) {}
        return;
      }
      // Tap on anything else inside cv → deselect.
      if (currentId != null) {
        if (e.target && e.target.closest && e.target.closest('#edgeControls')) return;
        deselect();
      }
    }, true);
    // Also deselect on document-level pointerdown outside #cv.
    document.addEventListener('pointerdown', function (e) {
      if (currentId == null) return;
      if (e.target && e.target.closest) {
        if (e.target.closest('#cv') || e.target.closest('#edgeControls')) return;
      }
      deselect();
    }, true);
  }

  function boot() {
    ensurePanel();
    installHitTest();
    // Reposition after every render — register a hook the existing render()
    // calls don't know about. Easiest: wrap window.render once.
    if (typeof window.render === 'function' && !window.render.__edgeControlsHooked) {
      const orig = window.render;
      const wrapped = function () {
        const r = orig.apply(this, arguments);
        try { reposition(); } catch (e) {}
        return r;
      };
      wrapped.__edgeControlsHooked = true;
      window.render = wrapped;
    } else if (!window.render) {
      // app.js hasn't installed render yet; retry once.
      requestAnimationFrame(boot);
      return;
    }
  }

  window.EdgeControls = Object.freeze({ select, deselect, current, reposition });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
