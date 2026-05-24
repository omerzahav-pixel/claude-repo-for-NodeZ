/* =============================================================================
 * EdgeSpace · Sprint 3.1 · Issue 3 · Touch-friendly edge-draw handles.
 *
 * When a node is selected (window.__E2E.sel() returns non-null), this
 * module renders 4 small grab handles around it — one per cardinal mid-
 * edge anchor (top / right / bottom / left). The handles live in a fixed-
 * position DOM overlay layer (#edgeDrawHandles), positioned via the same
 * world→screen math the existing EdgeControls panel uses, so they stay
 * scale-invariant (always 12-px visible / 24-px touch target).
 *
 * Gesture:
 *   pointerdown on handle
 *     → start a draft edge: append a dashed SVG <line> to #cv at the
 *       handle's world anchor, capture pointermoves at document level
 *   pointermove
 *     → update line.x2/y2 in world coords
 *   pointerup
 *     → if pointer is over another .node → window.createEdge(from, to,
 *       'feeds') (default type; user can re-type via the edge-selection
 *       panel afterward)
 *     → otherwise → cancel (line is removed, nothing created)
 *
 * No flag — these handles are always-on for the selected node, replacing
 * the previous shift-drag desktop-only edge-create gesture (which also
 * still works, this just makes it discoverable on iPad).
 * ============================================================================= */

(function () {
  'use strict';

  // ─── State ─────────────────────────────────────────────────────────────
  let layer = null;       // DOM container for the 4 handles
  let handles = [];       // DOM elements
  let draftLine = null;   // SVG <line> in #cv during drag
  let draftFromId = null;
  let activePointerId = null;
  let lastSeenSelId = null;

  // Cardinal directions — match the anchors() function in edge-v2.js.
  // _w and _h are half-extents (distance from node center to node edge),
  // not full width/height. Default 80×60.
  const DIRS = [
    { side: 'top',    dx: 0,  dy: -1 },
    { side: 'right',  dx: 1,  dy: 0  },
    { side: 'bottom', dx: 0,  dy: 1  },
    { side: 'left',   dx: -1, dy: 0  }
  ];

  // ─── World ↔ screen helpers (same as edge-controls.js) ────────────────
  function worldToScreen(wx, wy) {
    if (!window.__E2E) return { x: 0, y: 0 };
    const v = window.__E2E.view();
    return {
      x: window.innerWidth  / 2 + (wx + v.x) * v.k,
      y: window.innerHeight / 2 + (wy + v.y) * v.k
    };
  }
  function screenToWorld(sx, sy) {
    const v = window.__E2E.view();
    return {
      x: (sx - window.innerWidth  / 2) / v.k - v.x,
      y: (sy - window.innerHeight / 2) / v.k - v.y
    };
  }

  function nodeHalfExtents(n) {
    return { w: n._w || 80, h: n._h || 60 };
  }

  function anchorWorld(node, side) {
    const { w, h } = nodeHalfExtents(node);
    switch (side) {
      case 'top':    return { x: node.x,     y: node.y - h };
      case 'right':  return { x: node.x + w, y: node.y     };
      case 'bottom': return { x: node.x,     y: node.y + h };
      case 'left':   return { x: node.x - w, y: node.y     };
    }
    return { x: node.x, y: node.y };
  }

  // ─── Layer + handle DOM ────────────────────────────────────────────────
  function ensureLayer() {
    if (layer && document.body.contains(layer)) return layer;
    layer = document.createElement('div');
    layer.id = 'edgeDrawHandles';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText =
      'position:fixed;left:0;top:0;right:0;bottom:0;' +
      'pointer-events:none;z-index:6';
    document.body.appendChild(layer);
    return layer;
  }

  function clearHandles() {
    for (const h of handles) {
      try { h.remove(); } catch (e) {}
    }
    handles = [];
  }

  function findNode(id) {
    if (!window.__E2E) return null;
    const c = window.__E2E.current();
    if (!c || !c.nodes) return null;
    return c.nodes.find(n => n.id === id);
  }

  function showHandlesFor(node) {
    clearHandles();
    if (!node) return;
    const lyr = ensureLayer();
    for (const d of DIRS) {
      const aWorld = anchorWorld(node, d.side);
      const screen = worldToScreen(aWorld.x, aWorld.y);
      const el = document.createElement('div');
      el.className = 'edge-handle';
      el.dataset.side = d.side;
      el.dataset.fromId = String(node.id);
      // 24-px touch target; inner dot is 12 px.
      el.style.cssText =
        'position:absolute;width:24px;height:24px;' +
        'left:' + (screen.x - 12) + 'px;' +
        'top:'  + (screen.y - 12) + 'px;' +
        'pointer-events:auto;cursor:crosshair;' +
        'display:flex;align-items:center;justify-content:center;' +
        'touch-action:none;-webkit-user-select:none;user-select:none;' +
        '-webkit-tap-highlight-color:transparent';
      const dot = document.createElement('span');
      dot.className = 'edge-handle-dot';
      el.appendChild(dot);
      attachHandleListeners(el, node.id, d.side);
      lyr.appendChild(el);
      handles.push(el);
    }
  }

  // ─── Draft-edge gesture ────────────────────────────────────────────────
  function attachHandleListeners(el, fromId, side) {
    el.addEventListener('pointerdown', function (e) {
      // Block bubbling so the canvas pan / gesture-machine doesn't engage.
      try { e.stopImmediatePropagation(); } catch (_) {}
      try { e.stopPropagation(); } catch (_) {}
      try { e.preventDefault(); } catch (_) {}
      const fromNode = findNode(fromId);
      if (!fromNode) return;
      draftFromId = fromId;
      activePointerId = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}

      const cv = document.getElementById('cv');
      if (!cv) return;
      const anchor = anchorWorld(fromNode, side);
      draftLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      draftLine.setAttribute('x1', anchor.x);
      draftLine.setAttribute('y1', anchor.y);
      draftLine.setAttribute('x2', anchor.x);
      draftLine.setAttribute('y2', anchor.y);
      draftLine.setAttribute('stroke', 'var(--hot,#FF7A45)');
      draftLine.setAttribute('stroke-width', '2');
      draftLine.setAttribute('stroke-dasharray', '5,4');
      draftLine.setAttribute('pointer-events', 'none');
      draftLine.setAttribute('data-edge-draft', '1');
      cv.appendChild(draftLine);

      document.addEventListener('pointermove', onDraftMove, true);
      document.addEventListener('pointerup',   onDraftEnd,  true);
      document.addEventListener('pointercancel', onDraftEnd, true);
    });
  }

  function onDraftMove(e) {
    if (!draftLine || e.pointerId !== activePointerId) return;
    const w = screenToWorld(e.clientX, e.clientY);
    draftLine.setAttribute('x2', w.x);
    draftLine.setAttribute('y2', w.y);
  }

  function onDraftEnd(e) {
    if (e.pointerId !== activePointerId) return;
    document.removeEventListener('pointermove', onDraftMove, true);
    document.removeEventListener('pointerup',   onDraftEnd,  true);
    document.removeEventListener('pointercancel', onDraftEnd, true);

    // Pick the .node under the finger. We use elementFromPoint to walk
    // past the still-present #edgeDrawHandles layer (its dots are 24px
    // squares — but pointer-events on the empty area between dots is
    // none on the layer parent, so we'd usually fall through anyway).
    let toId = null;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const nodeEl = el && el.closest && el.closest('.node');
    if (nodeEl) {
      const tid = +nodeEl.dataset.id;
      if (tid && tid !== draftFromId) toId = tid;
    }

    if (draftLine) { try { draftLine.remove(); } catch (_) {} draftLine = null; }
    const fromId = draftFromId;
    draftFromId = null;
    activePointerId = null;

    if (toId && typeof window.createEdge === 'function') {
      window.createEdge(fromId, toId, 'feeds');
    }
  }

  // ─── Refresh hook ──────────────────────────────────────────────────────
  function getSel() {
    if (window.__E2E && typeof window.__E2E.sel === 'function') return window.__E2E.sel();
    return null;
  }

  function refresh() {
    const s = getSel();
    // Quick same-state bail.
    const newId = s ? s.id : null;
    showHandlesFor(s);
    lastSeenSelId = newId;
  }

  function boot() {
    ensureLayer();
    if (typeof window.render === 'function' && !window.render.__edgeDrawHooked) {
      const orig = window.render;
      const wrapped = function () {
        const r = orig.apply(this, arguments);
        try { refresh(); } catch (e) {}
        return r;
      };
      wrapped.__edgeDrawHooked = true;
      window.render = wrapped;
    } else if (!window.render) {
      requestAnimationFrame(boot);
      return;
    }
    // Reposition on resize so handles stay anchored to their nodes.
    window.addEventListener('resize', () => { try { refresh(); } catch (e) {} });
    refresh();
  }

  window.EdgeDraw = Object.freeze({ refresh });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
