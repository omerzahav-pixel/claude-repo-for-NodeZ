/* =============================================================================
 * EdgeSpace · Sprint 4.1 · Viewport culling (--cull-v1)
 *
 * Sprint 4's tile cache produced a flat null result on iPad: it offloaded the
 * dot-grid and zone fills, but pan stayed at ~5.5 FPS / ~212 ms worst frame.
 * The null result was the diagnosis — those layers were never the bottleneck.
 * The real cost is element count: render() mounts ALL ~100 nodes, their edges,
 * and their DOM .nslice overlays every frame, even the ~88 that are off-screen.
 * iOS Safari cannot cheaply transform ~100 composited layers as a batch.
 *
 * This module decides WHICH nodes/edges are worth mounting on a given frame:
 * only those whose bounding box falls within (viewport + a one-viewport margin
 * on each side). render() skips the rest entirely (true unmount — they never
 * enter the innerHTML string — not display:none, which still costs layer-tree
 * and paint on iOS).
 *
 * Two properties make this cheap and safe:
 *   · Throttled. The O(N+E) scan that produces the base sets runs at most once
 *     per ~100 ms while a gesture is active (pan / pinch / inertia). Between
 *     scans render() reuses the cached set — the generous margin covers up to
 *     a full screen of pan before the set goes stale. On settle (no active
 *     gesture) the next render forces a fresh scan. NEVER per-frame inside a
 *     touchmove. Idle renders (select / edit / focus animation) force-refresh
 *     since they're infrequent.
 *   · Hard exceptions. The caller passes a `keep` set (selected node, dragged
 *     node, in-progress edge endpoint, drawer focus target). Those ids — and
 *     the edges incident to them — are unioned into the result on EVERY call,
 *     not subject to the throttle, so selection/drag chrome never blinks out
 *     even when its node is panned far off-screen.
 *
 * Gated by --cull-v1 (default OFF). When OFF, render() uses its legacy path
 * (the rbush ≥100-node node-only cull) unchanged — full rollback intact.
 * Composes with the tile cache: zones still paint on canvas; culling only
 * touches the SVG outlines/edges + DOM overlays.
 * ============================================================================= */

(function () {
  'use strict';

  /* One scan per ~100 ms while a gesture drives the canvas. */
  const THROTTLE_MS = 100;
  /* Margin = this many viewport dimensions on EACH side of the screen rect.
     1.0 means the mounted region is a 3×3 grid of viewports centred on the
     screen — a fast flick of up to one full screen between scans never
     reveals an unmounted gap. Bump up if popping appears; down if memory
     is tight. Surfaced on the HUD as "margin: 1.0vw". */
  const MARGIN_VIEWPORTS = 1.0;

  /* Cached base sets + the bookkeeping that decides when to recompute them. */
  let _lastT = -1e9;          // performance.now() of the last real scan
  let _baseNodes = new Set(); // node ids whose bbox ∩ inflated rect
  let _baseEdges = new Set(); // edge ids in-set by endpoint or bbox
  let _adj = new Map();       // node id → [edge id, …] for keep-expansion
  let _lastNodesRef = null;   // array identity — changes on canvas switch
  let _lastNodeLen = -1;
  let _lastEdgeLen = -1;
  let _lastRect = null;       // inflated rect of the last scan (debug/HUD)
  let _scanCount = 0;

  function now() {
    try { return performance.now(); } catch (e) { return 0; }
  }

  /* Half-extents of a node's bounding box in world units. Formula/note nodes
     carry their sized _w/_h (set by render) or an explicit userW/userH; glyph
     nodes (project/idea/principle/…) get a generous ±80 fallback so a partially
     on-screen glyph never unmounts a frame early. */
  function halfW(n) { return (n._w || n.userW || 80); }
  function halfH(n) { return (n._h || n.userH || 80); }

  function intersects(minX, minY, maxX, maxY, rect) {
    return maxX >= rect.minX && minX <= rect.maxX &&
           maxY >= rect.minY && minY <= rect.maxY;
  }

  /* The screen rectangle in world coords, inflated by the margin. Mirrors the
     viewBox math in render(): the visible world rect is
       x ∈ [-W/2/k - view.x , +W/2/k - view.x]
       y ∈ [-H/2/k - view.y , +H/2/k - view.y]
     then grown by MARGIN_VIEWPORTS × (viewport size) on each side. */
  function inflatedRect(view, W, H) {
    const vw = W / view.k, vh = H / view.k;
    const minX = -W / 2 / view.k - view.x;
    const minY = -H / 2 / view.k - view.y;
    const mx = vw * MARGIN_VIEWPORTS, my = vh * MARGIN_VIEWPORTS;
    return {
      minX: minX - mx,
      minY: minY - my,
      maxX: minX + vw + mx,
      maxY: minY + vh + my
    };
  }

  function rescan(nodes, edges, rect) {
    const baseNodes = new Set();
    for (const n of nodes) {
      const hw = halfW(n), hh = halfH(n);
      if (intersects(n.x - hw, n.y - hh, n.x + hw, n.y + hh, rect)) baseNodes.add(n.id);
    }
    /* Build the node index + adjacency once, reuse for the edge pass. */
    const byId = new Map();
    for (const n of nodes) byId.set(n.id, n);
    const adj = new Map();
    const baseEdges = new Set();
    for (const e of edges) {
      const a = byId.get(e.from), b = byId.get(e.to);
      if (a) { let l = adj.get(e.from); if (!l) adj.set(e.from, l = []); l.push(e.id); }
      if (b) { let l = adj.get(e.to);   if (!l) adj.set(e.to,   l = []); l.push(e.id); }
      if (!a || !b) continue;
      /* Endpoint visible → edge visible. Otherwise a long edge can cross the
         screen with BOTH endpoints off-screen; keep it if its bbox (the two
         centres) intersects the inflated rect. */
      const inByNode = baseNodes.has(e.from) || baseNodes.has(e.to);
      let inSet = inByNode;
      if (!inSet) {
        const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
        const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
        inSet = intersects(minX, minY, maxX, maxY, rect);
      }
      if (inSet) baseEdges.add(e.id);
    }
    _baseNodes = baseNodes;
    _baseEdges = baseEdges;
    _adj = adj;
    _lastRect = rect;
    _scanCount++;
  }

  /**
   * Decide the mounted set for this frame.
   *
   * @param {Array}  nodes  canonical node records (current canvas)
   * @param {Array}  edges  canonical edge records
   * @param {Object} view   {x, y, k}
   * @param {number} W, H   viewport pixel size
   * @param {Set}    keep    node ids that must stay mounted (hard exceptions)
   * @param {boolean} active a gesture is driving the canvas (throttle on)
   * @returns {{nodeSet:Set, edgeSet:Set, margin:string, recomputed:boolean}}
   */
  function compute(nodes, edges, view, W, H, keep, active) {
    const t = now();
    const contentChanged =
      nodes !== _lastNodesRef ||
      nodes.length !== _lastNodeLen ||
      edges.length !== _lastEdgeLen;
    /* Recompute the base sets when: content changed (canvas switch / add /
       delete), OR we're idle/settling (force a fresh, correctly-centred set),
       OR the throttle window elapsed during an active gesture. */
    const due = !active || contentChanged || (t - _lastT) >= THROTTLE_MS;
    let recomputed = false;
    if (due) {
      rescan(nodes, edges, inflatedRect(view, W, H));
      _lastT = t;
      _lastNodesRef = nodes;
      _lastNodeLen = nodes.length;
      _lastEdgeLen = edges.length;
      recomputed = true;
    }

    /* Union the hard exceptions every call — cheap (keep is 0–3 ids) and never
       throttled, so selection/drag chrome can't blink out mid-pan. */
    const nodeSet = new Set(_baseNodes);
    const edgeSet = new Set(_baseEdges);
    if (keep && keep.size) {
      for (const id of keep) {
        nodeSet.add(id);
        const incident = _adj.get(id);
        if (incident) for (const eid of incident) edgeSet.add(eid);
      }
    }
    return {
      nodeSet,
      edgeSet,
      margin: MARGIN_VIEWPORTS.toFixed(1) + 'vw',
      recomputed
    };
  }

  /* Force the next compute() to rescan even if the throttle window hasn't
     elapsed. Called when something off the data path moves the camera or the
     content (e.g. drawer focus navigation) and wants the set fresh on arrival. */
  function invalidate() { _lastT = -1e9; _lastNodesRef = null; }

  function snapshot() {
    return {
      throttleMs: THROTTLE_MS,
      marginViewports: MARGIN_VIEWPORTS,
      baseNodes: _baseNodes.size,
      baseEdges: _baseEdges.size,
      scanCount: _scanCount,
      rect: _lastRect ? Object.assign({}, _lastRect) : null
    };
  }

  window.CullV1 = Object.freeze({ compute, invalidate, snapshot, THROTTLE_MS, MARGIN_VIEWPORTS });
})();
