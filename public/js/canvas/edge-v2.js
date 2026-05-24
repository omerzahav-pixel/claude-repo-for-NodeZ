/* =============================================================================
 * EdgeSpace · Phase 2 · 8 edge types + routing + auto-legend (Pass 3 § 06–07).
 *
 * Encodes edge type on 5 channels: hue, weight, dash, arrowhead, label.
 *
 *   feeds      hot         2.0  solid          filled triangle
 *   blocker    st-blocked  2.4  solid          blunt cap
 *   derived    st-progress 1.6  dashed 2/4     hollow chevron
 *   example    st-done     1.6  solid          hollow triangle
 *   proof      st-done     1.6  dashed 6/3     hollow triangle
 *   related    ink-3       1.2  dotted 1/4     ring endcap
 *   idea-from  st-idea     1.6  dashed 4/2     upward triangle
 *   tentative  st-pending  1.4  dash-dot       half-opacity arrow
 *
 * Routing rules (Pass 3 § 07):
 *   - Magnetic anchors  · 8 per node (4 mid-edges full strength + 4 corners 50%)
 *   - Cubic-spline      · bezier control points on horizontal midpoint
 *   - Label breaks      · 2 segments, label clip-pad 4px, rotation [-45°,+45°]
 *   - Multi-edge bundle · ≥ 2 edges between same pair fan vertically 7px
 *
 * Auto-legend: when canvas has ≥ 3 distinct edge types, dock a small DOM
 * legend bottom-right. Dismissible; reappears when a new type added.
 *
 * Gated by Flags.on('edges-v2'). When OFF, the v1 edge loop in app.js's
 * render() continues to own edges.
 * ============================================================================= */

(function () {
  'use strict';

  const TYPES = {
    feeds:      { hue: 'var(--hot,#FF7A45)',          w: 2.0, dash: 'none',          marker: 'filled', label: 'feeds' },
    blocker:    { hue: 'var(--st-blocked,#F87171)',   w: 2.4, dash: 'none',          marker: 'blunt',  label: 'blocker' },
    derived:    { hue: 'var(--st-progress,#6FA8FF)',  w: 1.6, dash: '2,4',           marker: 'hollow-chev', label: 'derived from' },
    example:    { hue: 'var(--st-done,#4FD18B)',      w: 1.6, dash: 'none',          marker: 'hollow', label: 'example' },
    proof:      { hue: 'var(--st-done,#4FD18B)',      w: 1.6, dash: '6,3',           marker: 'hollow', label: 'proof' },
    related:    { hue: 'var(--ink-3,#7C828E)',        w: 1.2, dash: '1,4',           marker: 'ring',   label: 'related' },
    'idea-from':{ hue: 'var(--st-idea,#B98CFB)',      w: 1.6, dash: '4,2',           marker: 'up-tri', label: 'idea from' },
    tentative:  { hue: 'var(--st-pending,#F2C462)',   w: 1.4, dash: '6,3,2,3',       marker: 'filled', label: 'tentative', opacity: 0.55 },
    // Legacy types fall through to feeds-like defaults
    custom:     { hue: 'var(--hot,#FF7A45)',          w: 1.8, dash: 'none',          marker: 'filled', label: 'custom' }
  };

  function spec(typeKey) { return TYPES[typeKey] || TYPES.feeds; }

  /** SVG <defs> with one marker per type. */
  function markerDefs() {
    const out = [];
    for (const k of Object.keys(TYPES)) {
      const s = TYPES[k];
      const id = 'e2-' + k;
      let m;
      switch (s.marker) {
        case 'filled':
          m = `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${s.hue}"/></marker>`;
          break;
        case 'blunt':
          m = `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><rect x="0" y="2" width="10" height="6" fill="${s.hue}"/></marker>`;
          break;
        case 'hollow':
          m = `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="none" stroke="${s.hue}" stroke-width="1.4"/></marker>`;
          break;
        case 'hollow-chev':
          m = `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,1 L9,5 L0,9" fill="none" stroke="${s.hue}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker>`;
          break;
        case 'ring':
          m = `<marker id="${id}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><circle cx="5" cy="5" r="3" fill="none" stroke="${s.hue}" stroke-width="1.4"/></marker>`;
          break;
        case 'up-tri':
          m = `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,3 L10,5 L0,7 z" fill="${s.hue}"/></marker>`;
          break;
        default:
          m = `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${s.hue}"/></marker>`;
      }
      out.push(m);
    }
    return out.join('');
  }

  /**
   * Compute the 8 magnetic anchors for a node bounding box.
   * Mid-edges (4) at strength 1.0, corners (4) at strength 0.5.
   */
  function anchors(n) {
    const w = (n._w || 80), h = (n._h || 60);
    return [
      // 4 mid-edges
      { x: n.x,     y: n.y - h, s: 1.0 },  // top
      { x: n.x + w, y: n.y,     s: 1.0 },  // right
      { x: n.x,     y: n.y + h, s: 1.0 },  // bottom
      { x: n.x - w, y: n.y,     s: 1.0 },  // left
      // 4 corners
      { x: n.x + w, y: n.y - h, s: 0.5 },  // top-right
      { x: n.x + w, y: n.y + h, s: 0.5 },  // bottom-right
      { x: n.x - w, y: n.y + h, s: 0.5 },  // bottom-left
      { x: n.x - w, y: n.y - h, s: 0.5 }   // top-left
    ];
  }

  /** Best anchor on `n` for an edge heading toward `target`. */
  function bestAnchor(n, target) {
    const cands = anchors(n);
    let best = cands[0], bestScore = -Infinity;
    for (const a of cands) {
      const dx = target.x - a.x, dy = target.y - a.y;
      const d  = Math.hypot(dx, dy) || 1;
      // Prefer anchors near the target, weighted by strength.
      const score = a.s * (1000 - d);
      if (score > bestScore) { bestScore = score; best = a; }
    }
    return best;
  }

  /** Build the cubic-spline path between two anchors. */
  function cubicPath(a, b, fanOffset) {
    fanOffset = fanOffset || 0;
    const dx = b.x - a.x, dy = b.y - a.y;
    const horiz = Math.abs(dx) >= Math.abs(dy);
    const off = Math.min(Math.abs(horiz ? dx : dy) * 0.75, 240);
    const c1x = horiz ? a.x + Math.sign(dx) * off : a.x;
    const c1y = horiz ? a.y + fanOffset           : a.y + Math.sign(dy) * off;
    const c2x = horiz ? b.x - Math.sign(dx) * off : b.x;
    const c2y = horiz ? b.y + fanOffset           : b.y - Math.sign(dy) * off;
    return {
      d: `M ${a.x},${a.y} C ${c1x},${c1y} ${c2x},${c2y} ${b.x},${b.y}`,
      c1: { x: c1x, y: c1y },
      c2: { x: c2x, y: c2y }
    };
  }

  /** Pre-compute a per-pair fan offset map so multi-edges separate. */
  function fanOffsetsFor(edges) {
    const byPair = new Map();
    for (const e of edges) {
      const key = e.from < e.to ? `${e.from}-${e.to}` : `${e.to}-${e.from}`;
      if (!byPair.has(key)) byPair.set(key, []);
      byPair.get(key).push(e);
    }
    const out = new Map();
    for (const [key, list] of byPair) {
      const n = list.length;
      // Center the fan: for n=2 → [-7,+7]; for n=3 → [-7,0,+7]; etc.
      list.forEach((e, i) => {
        const offset = (i - (n - 1) / 2) * 7;
        out.set(e.id, offset);
      });
    }
    return out;
  }

  /**
   * Render a single edge.
   * @param {object} edge — { id, from, to, type, customLabel }
   * @param {object} a, b — node refs
   * @param {object} view — current {x,y,k}
   * @param {object} opts — { fanOffset, dim, opacity, focused, showLabel, labelText }
   * @returns {string}    — SVG markup
   */
  function renderEdge(edge, a, b, view, opts) {
    opts = opts || {};
    const s = spec(edge.type || 'feeds');
    const anchorA = bestAnchor(a, b);
    const anchorB = bestAnchor(b, a);
    const path    = cubicPath(anchorA, anchorB, opts.fanOffset || 0);
    const dash    = s.dash === 'none' ? '' : `stroke-dasharray="${s.dash}"`;
    const op      = (opts.opacity != null ? opts.opacity : (s.opacity || 1)) * (opts.dim ? 0.18 : 1);
    /* Sprint 3.1 Issue 2 — emit an invisible 20-px-stroke hit-target FIRST,
       then the visible path. Both carry the same data-edge id so existing
       selectors keep working; the hit path uses pointer-events="stroke" so
       only the fat stroke band catches taps. liveRouteForNode() updates
       BOTH paths (querySelectorAll) so the hit zone tracks the visible
       edge during node-drag. */
    const hit     = `<path class="e2-hit" data-edge="${edge.id}" d="${path.d}" fill="none" stroke="transparent" stroke-width="20" pointer-events="stroke"/>`;
    const stroke  = `<path class="e2 e2-${edge.type||'feeds'}" data-edge="${edge.id}" d="${path.d}" fill="none" stroke="${s.hue}" stroke-width="${s.w}" ${dash} marker-end="url(#e2-${edge.type||'feeds'})" opacity="${op.toFixed(3)}" stroke-linecap="round" pointer-events="none"/>`;
    const strokePair = hit + stroke;
    if (!opts.showLabel) return strokePair;
    // Label sits at the path midpoint with background clip.
    const mx = (anchorA.x + 3 * path.c1.x + 3 * path.c2.x + anchorB.x) / 8;
    const my = (anchorA.y + 3 * path.c1.y + 3 * path.c2.y + anchorB.y) / 8;
    const text = opts.labelText || s.label;
    // Clamp rotation to [-45°, +45°] per spec
    let ang = Math.atan2(anchorB.y - anchorA.y, anchorB.x - anchorA.x) * 180 / Math.PI;
    if (ang >  45) ang =  45;
    if (ang < -45) ang = -45;
    if (ang >  90) ang -= 180;
    if (ang < -90) ang += 180;
    const labelRtl = /[֐-׿]/.test(text);
    const fsize = labelRtl ? 12 : 10;
    /* Phase 2.5 R4 — foreignObject was 22px tall, which clipped Heebo's
       slightly-taller descenders in RTL and left the bottom border
       invisible. Bump to 32px with vertical centering so all four sides of
       the pill remain visible at every script. The pill chip itself stays
       compact via padding + max-width on the inner div. */
    /* Phase 2.8 C — tag the label <g> with data-edge-label so the live-route
       function (called during the node-drag fast path) can find and update
       its transform in place. Without this tag, labels stayed at their old
       midpoint while the path itself moved — leaving orange-bordered chips
       drifting behind a dragged node ("orange residue"). */
    const labelSvg = `<g data-edge-label="${edge.id}" transform="translate(${mx} ${my}) rotate(${ang.toFixed(1)})"><foreignObject x="-64" y="-16" width="128" height="32" style="pointer-events:none;overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;justify-content:center;align-items:center;height:100%"><span style="direction:${labelRtl?'rtl':'ltr'};text-align:center;font-family:var(--font-sans,Inter);font-size:${fsize}px;color:${s.hue};background:var(--bg,#08090C);border-width:1px;border-style:solid;border-color:${s.hue};border-radius:4px;padding:2px 8px;display:inline-block;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;box-sizing:border-box;line-height:1.2">${escHtml(text)}</span></div></foreignObject></g>`;
    return strokePair + labelSvg;
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Public bulk renderer — replaces the v1 edge loop body when flag is on. */
  function renderAll(edges, nodeIndex, view, opts) {
    opts = opts || {};
    const fan = fanOffsetsFor(edges);
    const parts = [markerDefs() + ''];
    let i = 0;
    for (const e of edges) {
      const a = nodeIndex.get(e.from), b = nodeIndex.get(e.to);
      if (!a || !b) continue;
      const focused = opts.sel && (e.from === opts.sel.id || e.to === opts.sel.id);
      const dim = opts.dimE || (opts.focusMode && !focused);
      const showLabel = !opts.dimE && view.k > 0.4 && (!opts.focusMode || focused);
      parts.push(renderEdge(e, a, b, view, {
        fanOffset: fan.get(e.id) || 0,
        dim,
        showLabel,
        labelText: e.customLabel || (TYPES[e.type] && TYPES[e.type].label) || e.type
      }));
      i++;
    }
    return parts.join('');
  }

  // ─── Auto-legend ──────────────────────────────────────────────────────────
  const LEGEND_THRESHOLD = 3;
  const LEGEND_DISMISS_KEY = 'edgespace-edge-legend-dismissed';
  let legendEl = null;
  let lastTypesSig = '';

  function refreshLegend(edges) {
    if (!window.Flags || !window.Flags.on('edges-v2')) return;
    const present = new Set();
    for (const e of edges) present.add(e.type || 'feeds');
    const types = Array.from(present);
    const sig = types.sort().join(',');
    if (types.length < LEGEND_THRESHOLD) {
      if (legendEl) { legendEl.remove(); legendEl = null; }
      lastTypesSig = '';
      return;
    }
    let dismissed = false;
    try { dismissed = localStorage.getItem(LEGEND_DISMISS_KEY) === sig; } catch (e) {}
    if (dismissed) return;
    if (sig === lastTypesSig && legendEl) return;
    lastTypesSig = sig;
    if (legendEl) legendEl.remove();
    legendEl = document.createElement('div');
    legendEl.id = 'edgeLegend';
    legendEl.setAttribute('aria-label', 'Edge legend');
    legendEl.innerHTML =
      `<div class="el-head"><span>edges</span><span class="el-x" role="button" title="Dismiss">×</span></div>` +
      `<div class="el-body">` +
      types.map(t => {
        const s = spec(t);
        return `<div class="el-row" data-type="${t}"><svg width="32" height="10" viewBox="0 0 32 10"><line x1="2" y1="5" x2="30" y2="5" stroke="${s.hue}" stroke-width="${s.w}" ${s.dash==='none'?'':`stroke-dasharray="${s.dash}"`}/></svg><span>${s.label}</span></div>`;
      }).join('') +
      `</div>`;
    document.body.appendChild(legendEl);
    legendEl.querySelector('.el-x').addEventListener('click', () => {
      try { localStorage.setItem(LEGEND_DISMISS_KEY, sig); } catch (e) {}
      legendEl.remove(); legendEl = null;
    });
    // Hover-link: highlight matching edges on row hover, and vice versa.
    legendEl.querySelectorAll('.el-row').forEach(row => {
      const t = row.dataset.type;
      row.addEventListener('mouseenter', () => {
        document.querySelectorAll('.e2').forEach(p => p.style.opacity = '0.15');
        document.querySelectorAll('.e2-' + CSS.escape(t)).forEach(p => p.style.opacity = '1');
      });
      row.addEventListener('mouseleave', () => {
        document.querySelectorAll('.e2').forEach(p => { p.style.opacity = ''; });
      });
    });
  }

  /* =========================================================================
   * Live-route on node drag (Phase 2.5 R1).
   *
   * The existing app.js node-drag fast path skips a full render() and instead
   * CSS-transforms the moved slice + SVG hit-group. That left every edge
   * connected to the dragged node frozen at its original position until
   * pointerup fired the next render(). On iPad this is a hard visible break.
   *
   * Solution: a small DOM-walk that finds every edge `<path data-edge>` whose
   * source/target id matches the moving node, recomputes its path from the
   * node's live x/y, and updates the `d` attribute in place. No re-render,
   * no innerHTML churn — only the affected path strings are touched.
   *
   * Works for BOTH v1 edges (.edge data-edge) and v2 edges (.e2 data-edge)
   * because they share the same data-edge ID convention. Routing differs
   * between v1 (centre-to-centre cubic) and v2 (magnetic-anchor cubic) —
   * the function below uses v2 routing when --edges-v2 is on and v1 routing
   * otherwise so the visual stays consistent.
   * ========================================================================= */
  function liveRouteForNode(node, edges, nodeIndex) {
    if (!node || !edges || !edges.length) return 0;
    const cv = document.getElementById('cv');
    if (!cv) return 0;
    const useV2 = window.Flags && window.Flags.on('edges-v2');
    let touched = 0;
    // Pre-compute fan offsets ONCE for the whole edge set so multi-edge
    // bundling stays in sync as one end moves.
    const fan = useV2 ? fanOffsetsFor(edges) : null;
    for (const e of edges) {
      if (e.from !== node.id && e.to !== node.id) continue;
      const a = nodeIndex.get(e.from);
      const b = nodeIndex.get(e.to);
      if (!a || !b) continue;
      let d, c1, c2, anchorA, anchorB;
      if (useV2) {
        anchorA = bestAnchor(a, b);
        anchorB = bestAnchor(b, a);
        const p = cubicPath(anchorA, anchorB, fan.get(e.id) || 0);
        d = p.d; c1 = p.c1; c2 = p.c2;
      } else {
        // v1 centre-to-centre cubic (mirrors app.js's render() math).
        const rA = 46, rB = 46;
        const dx0 = b.x - a.x, dy0 = b.y - a.y, d0 = Math.hypot(dx0, dy0) || 1;
        const ax = a.x + dx0/d0*rA, ay = a.y + dy0/d0*rA;
        const bx = b.x - dx0/d0*rB, by = b.y - dy0/d0*rB;
        anchorA = { x: ax, y: ay };
        anchorB = { x: bx, y: by };
        const dx = bx - ax, dy = by - ay;
        const horiz = Math.abs(dx) >= Math.abs(dy);
        const off = Math.min(Math.abs(horiz ? dx : dy) * 0.75, 240);
        const c1x = horiz ? ax + Math.sign(dx) * off : ax;
        const c1y = horiz ? ay                        : ay + Math.sign(dy) * off;
        const c2x = horiz ? bx - Math.sign(dx) * off : bx;
        const c2y = horiz ? by                        : by - Math.sign(dy) * off;
        c1 = { x: c1x, y: c1y };
        c2 = { x: c2x, y: c2y };
        d = `M ${ax},${ay} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${bx},${by}`;
      }
      /* Selector matches both v1 (.edge) and v2 (.e2/.e2-hit) by data-edge
         id. Sprint 3.1 Issue 2 — each edge now renders TWO <path> elements
         (visible + invisible fat hit-target); update BOTH so the hit zone
         tracks the visible edge during node-drag. */
      const paths = cv.querySelectorAll(`path[data-edge="${e.id}"]`);
      paths.forEach(p => p.setAttribute('d', d));
      if (paths.length) touched++;
      /* Phase 2.8 C · also reposition the label <g data-edge-label> if it
         exists. Without this, labels stay at their old midpoint while the
         edge path slides under the dragged node — visible as orange-bordered
         chip "residue" trailing behind the moving node. */
      const label = cv.querySelector(`g[data-edge-label="${e.id}"]`);
      if (label) {
        const mx = (anchorA.x + 3*c1.x + 3*c2.x + anchorB.x) / 8;
        const my = (anchorA.y + 3*c1.y + 3*c2.y + anchorB.y) / 8;
        let ang = Math.atan2(anchorB.y - anchorA.y, anchorB.x - anchorA.x) * 180 / Math.PI;
        if (ang >  45) ang =  45;
        if (ang < -45) ang = -45;
        if (ang >  90) ang -= 180;
        if (ang < -90) ang += 180;
        label.setAttribute('transform', `translate(${mx} ${my}) rotate(${ang.toFixed(1)})`);
      }
    }
    return touched;
  }

  window.EdgeV2 = Object.freeze({
    TYPES, spec, anchors, bestAnchor, cubicPath, fanOffsetsFor,
    renderEdge, renderAll, markerDefs, refreshLegend,
    liveRouteForNode
  });
})();
