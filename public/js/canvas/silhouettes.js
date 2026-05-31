/* =============================================================================
 * EdgeSpace · Phase 2 · 10 node silhouettes (Pass 3 § 02).
 *
 *   project    · wedge-rim card + workspace-accent left rim + drill-down chip
 *   idea       · full pill, Instrument-Serif glyph watermark
 *   principle  · chamfered tag (left-side cut) + 2.4-px green accent bar
 *   resource   · hex-cap card (16-px chamfered top corners)
 *   question   · corner-cut top-right + "?" watermark
 *   experiment · rectangle + flask glyph top-right
 *   library    · stacked-sliver card (2 thin slivers above body)
 *   doc        · folded-corner page (36-px fold top-right)
 *   formula    · 4-px etched plaque + 3-px cyan top rule
 *   note       · soft 10-px radius card (default)
 *
 * Exports a single function `renderSilhouette(node, view, ctx)` returning
 * `{ sh, ring, glyphs, semantic }`:
 *
 *   sh         · SVG markup for the silhouette + status + halo + glyphs
 *   ring       · selection ring (dashed workspace-accent, outset 4px)
 *   glyphs     · additional decorations (drill chevron, link icon, etc.)
 *   semantic   · semantic LoD signal — view.k tier ('full' | 'silhouette' | 'micro')
 *
 * RTL: when ctx.rtl is true, status dot + halo move to top-left edge
 * (top-leading-script). Glyphs that have intrinsic direction (drill chevron)
 * also mirror.
 *
 * Gated by Flags.on('silhouettes'). When OFF, the existing per-shape branches
 * in app.js's render() loop continue to own node drawing.
 * ============================================================================= */

(function () {
  'use strict';

  const STATUS = {
    done:     '#4FD18B',
    progress: '#6FA8FF',
    pending:  '#F2C462',
    blocked:  '#F87171',
    idea:     '#B98CFB'
  };
  const WS_ACCENT_DEFAULT = '#FF7A45';
  const INK   = '#ECEEF1';
  const INK_3 = '#7C828E';
  const STALE_DESAT = 'opacity:0.55';

  // Half-extents — radii used to size each silhouette family. The actual
  // node bounds vary by type; we keep s ≈ 42 to match the v1 default.
  const S = 42;

  /** Pick a "trailing" anchor for status dot + halo (LTR top-right / RTL top-left). */
  function trailing(rtl, x, y, w, h) {
    if (rtl) return { x: x - w + 6, y: y - h + 6 };   // top-left
    return    { x: x + w - 6, y: y - h + 6 };          // top-right
  }

  function statusColor(node) { return STATUS[node.status] || STATUS.idea; }
  function workspaceAccent(ctx) { return ctx.wsAccent || WS_ACCENT_DEFAULT; }

  function selectionRing(node, w, h, r) {
    const x = node.x - w - 4, y = node.y - h - 4;
    const ww = w * 2 + 8, hh = h * 2 + 8;
    return `<rect class="es-sel-ring" x="${x}" y="${y}" width="${ww}" height="${hh}" rx="${(r||4)+2}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4,3"/>`;
  }

  /** Compose: silhouette body, then halo, then status dot, then glyphs. */
  function compose(node, ctx, paths, w, h, r, extraGlyphs) {
    const c = statusColor(node);
    const isStale = window.FreshnessHalo && window.FreshnessHalo.isStale(node);
    const groupOpen = isStale ? `<g style="${STALE_DESAT}">` : '<g>';
    const dot = trailing(ctx.rtl, node.x, node.y, w, h);
    const halo = window.FreshnessHalo
      ? window.FreshnessHalo.haloSvg(node, dot.x, dot.y, 7, c)
      : '';
    /* Sprint 5 Issue 1 — status legibility from afar. The silhouette body is a
       dark surface that nearly matches the background at zoom-out, and a tiny
       3.5-px dot is unreadable far away. Add a status-coloured bar on the inline-
       start edge (left in LTR, right in RTL) — a solid stripe that survives
       zoom-out — and enlarge the dot. Cheap rects, no filter. (This is the
       recommended default per the explainer; the user may pick fill/border.) */
    const _barW = 5;
    const statusBar = ctx.rtl
      ? `<rect class="es-status-bar" x="${node.x + w - _barW}" y="${node.y - h}" width="${_barW}" height="${h*2}" rx="2" fill="${c}"/>`
      : `<rect class="es-status-bar" x="${node.x - w}" y="${node.y - h}" width="${_barW}" height="${h*2}" rx="2" fill="${c}"/>`;
    const statusDot = `<circle cx="${dot.x}" cy="${dot.y}" r="5" fill="${c}"/>`;
    return groupOpen + paths + statusBar + (extraGlyphs || '') + halo + statusDot + '</g>';
  }

  // ── 1. project — wedge card + drill chip (Phase 2.9 Fix 2: rim removed).
  //   The amber left-rim accent was visual icing on top of the project's
  //   already-distinct silhouette + drill chip + metadata label. Four
  //   attempts to eliminate the orange residue on iPad (universal tap-
  //   highlight reset, compositor-layer isolation, edge-route in-place
  //   audit, label-transform live update) failed to converge. Pragmatic
  //   call: drop the rim entirely. The project type remains identifiable
  //   from its silhouette shape and the drill chevron (when it has a
  //   child canvas). Workspace accent now manifests only via selection
  //   ring and the freshness halo on the status dot.
  function project(node, ctx) {
    const w = S * 1.05, h = S * 0.75, r = 10;
    const body = `<rect x="${node.x - w}" y="${node.y - h}" width="${w*2}" height="${h*2}" rx="${r}" fill="var(--srf-3,#1E232B)" stroke="var(--line-2,rgba(255,255,255,0.10))" stroke-width="1"/>`;
    // Drill chip — small chevron on trailing edge if node has childCanvas.
    const drill = node.childCanvas
      ? (ctx.rtl
          ? `<path d="M ${node.x - w + 12} ${node.y + h - 7} l 4 -4 l -4 -4" fill="none" stroke="${INK_3}" stroke-width="1.5" stroke-linecap="round"/>`
          : `<path d="M ${node.x + w - 12} ${node.y + h - 7} l -4 -4 l 4 -4" fill="none" stroke="${INK_3}" stroke-width="1.5" stroke-linecap="round"/>`)
      : '';
    return { sh: compose(node, ctx, body, w, h, r, drill), w, h, r };
  }

  // ── 2. idea — full pill + faint Instrument-Serif watermark ──
  function idea(node, ctx) {
    const w = S, h = S * 0.55, r = h;
    const body = `<rect x="${node.x - w}" y="${node.y - h}" width="${w*2}" height="${h*2}" rx="${r}" fill="var(--srf-3,#1E232B)" stroke="var(--line-2,rgba(255,255,255,0.10))" stroke-width="1"/>`;
    // Watermark glyph — large italic 'i' centered, very low opacity
    const wm = `<text x="${node.x}" y="${node.y + 8}" text-anchor="middle" font-family="var(--font-serif,Georgia)" font-style="italic" font-size="30" fill="${INK_3}" fill-opacity="0.15">i</text>`;
    return { sh: compose(node, ctx, body + wm, w, h, r), w, h, r };
  }

  // ── 3. principle — chamfered tag (left chamfer) + 2.4px accent bar ──
  function principle(node, ctx) {
    const w = S, h = S * 0.65;
    // Chamfer 12px on leading-script side
    const chamfer = 12;
    const p = ctx.rtl
      ? `M ${node.x - w} ${node.y - h} L ${node.x + w - chamfer} ${node.y - h} L ${node.x + w} ${node.y - h + chamfer} L ${node.x + w} ${node.y + h} L ${node.x - w} ${node.y + h} Z`
      : `M ${node.x - w + chamfer} ${node.y - h} L ${node.x + w} ${node.y - h} L ${node.x + w} ${node.y + h} L ${node.x - w} ${node.y + h} L ${node.x - w} ${node.y - h + chamfer} Z`;
    const body = `<path d="${p}" fill="var(--srf-3,#1E232B)" stroke="var(--line-2,rgba(255,255,255,0.10))" stroke-width="1"/>`;
    const bar = ctx.rtl
      ? `<rect x="${node.x + w - 2.4}" y="${node.y - h + 4}" width="2.4" height="${h*2 - 8}" fill="#4FD18B"/>`
      : `<rect x="${node.x - w}"       y="${node.y - h + 4}" width="2.4" height="${h*2 - 8}" fill="#4FD18B"/>`;
    return { sh: compose(node, ctx, body + bar, w, h, 8), w, h, r: 8 };
  }

  // ── 4. resource — hex-cap card (top corners chamfered 16px) ──
  function resource(node, ctx) {
    const w = S, h = S * 0.7, cut = 12;
    const p =
      `M ${node.x - w + cut} ${node.y - h} ` +
      `L ${node.x + w - cut} ${node.y - h} ` +
      `L ${node.x + w}       ${node.y - h + cut} ` +
      `L ${node.x + w}       ${node.y + h} ` +
      `L ${node.x - w}       ${node.y + h} ` +
      `L ${node.x - w}       ${node.y - h + cut} Z`;
    const body = `<path d="${p}" fill="var(--srf-3,#1E232B)" stroke="var(--line-2,rgba(255,255,255,0.10))" stroke-width="1"/>`;
    return { sh: compose(node, ctx, body, w, h, 8), w, h, r: 8 };
  }

  // ── 5. question — corner-cut top-right + "?" watermark in pending hue ──
  function question(node, ctx) {
    const w = S * 0.95, h = S * 0.75, cut = 14;
    const trailingSide = ctx.rtl ? -1 : 1; // -1 = cut top-left, +1 = cut top-right
    const tcx = node.x + trailingSide * w;
    const p = trailingSide > 0
      ? `M ${node.x - w} ${node.y - h} L ${tcx - cut} ${node.y - h} L ${tcx} ${node.y - h + cut} L ${tcx} ${node.y + h} L ${node.x - w} ${node.y + h} Z`
      : `M ${tcx + cut} ${node.y - h} L ${node.x + w} ${node.y - h} L ${node.x + w} ${node.y + h} L ${tcx} ${node.y + h} L ${tcx} ${node.y - h + cut} Z`;
    const body = `<path d="${p}" fill="var(--srf-3,#1E232B)" stroke="var(--line-2,rgba(255,255,255,0.10))" stroke-width="1"/>`;
    const wm = `<text x="${node.x}" y="${node.y + 14}" text-anchor="middle" font-family="var(--font-serif,Georgia)" font-style="italic" font-size="34" fill="#F2C462" fill-opacity="0.30">?</text>`;
    return { sh: compose(node, ctx, body + wm, w, h, 6), w, h, r: 6 };
  }

  // ── 6. experiment — rectangle + flask glyph top-trailing in status hue ──
  function experiment(node, ctx) {
    const w = S, h = S * 0.7;
    const body = `<rect x="${node.x - w}" y="${node.y - h}" width="${w*2}" height="${h*2}" rx="6" fill="var(--srf-3,#1E232B)" stroke="var(--line-2,rgba(255,255,255,0.10))" stroke-width="1"/>`;
    const fx = ctx.rtl ? node.x - w + 14 : node.x + w - 14;
    const fy = node.y - h + 16;
    const c = statusColor(node);
    const flask = `<g transform="translate(${fx-6} ${fy-8})"><path d="M 5 0 L 5 4 L 1 11 L 11 11 L 7 4 L 7 0 Z" fill="none" stroke="${c}" stroke-width="1.4" stroke-linejoin="round"/><line x1="4" y1="0" x2="8" y2="0" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/></g>`;
    return { sh: compose(node, ctx, body + flask, w, h, 6), w, h, r: 6 };
  }

  // ── 7. library — stacked-sliver card (2 thin slivers above body) ──
  function library(node, ctx) {
    const w = S, h = S * 0.65;
    const slv1 = `<rect x="${node.x - w + 4}" y="${node.y - h - 6}" width="${w*2 - 8}" height="2" rx="1" fill="var(--srf-4,#272D37)"/>`;
    const slv2 = `<rect x="${node.x - w + 8}" y="${node.y - h - 3}" width="${w*2 - 16}" height="2" rx="1" fill="var(--srf-3,#1E232B)"/>`;
    const body = `<rect x="${node.x - w}" y="${node.y - h}" width="${w*2}" height="${h*2}" rx="6" fill="var(--srf-3,#1E232B)" stroke="var(--line-2,rgba(255,255,255,0.10))" stroke-width="1"/>`;
    return { sh: compose(node, ctx, slv1 + slv2 + body, w, h, 6), w, h, r: 6 };
  }

  // ── 8. doc — folded-corner page (36-px fold top-trailing) ──
  function doc(node, ctx) {
    const w = S * 0.95, h = S * 0.85, fold = 14;
    const trailingSide = ctx.rtl ? -1 : 1;
    const fx = node.x + trailingSide * w;
    const p = trailingSide > 0
      ? `M ${node.x - w} ${node.y - h} L ${fx - fold} ${node.y - h} L ${fx} ${node.y - h + fold} L ${fx} ${node.y + h} L ${node.x - w} ${node.y + h} Z`
      : `M ${fx + fold} ${node.y - h} L ${node.x + w} ${node.y - h} L ${node.x + w} ${node.y + h} L ${node.x - w} ${node.y + h} L ${node.x - w} ${node.y - h + fold} Z`;
    const body = `<path d="${p}" fill="var(--srf-3,#1E232B)" stroke="var(--line-2,rgba(255,255,255,0.10))" stroke-width="1"/>`;
    const foldEdge = trailingSide > 0
      ? `<path d="M ${fx - fold} ${node.y - h} L ${fx - fold} ${node.y - h + fold} L ${fx} ${node.y - h + fold}" fill="none" stroke="var(--line-3,rgba(255,255,255,0.16))" stroke-width="1"/>`
      : `<path d="M ${fx + fold} ${node.y - h} L ${fx + fold} ${node.y - h + fold} L ${fx} ${node.y - h + fold}" fill="none" stroke="var(--line-3,rgba(255,255,255,0.16))" stroke-width="1"/>`;
    return { sh: compose(node, ctx, body + foldEdge, w, h, 6), w, h, r: 6 };
  }

  // ── 9. formula — etched plaque + 3-px cyan top rule ──
  function formula(node, ctx) {
    const w = S * 1.1, h = S * 0.75;
    const body = `<rect x="${node.x - w}" y="${node.y - h}" width="${w*2}" height="${h*2}" rx="8" fill="var(--srf-2,#161A20)" stroke="var(--line-3,rgba(255,255,255,0.16))" stroke-width="1"/>`;
    const rule = `<rect x="${node.x - w + 2}" y="${node.y - h}" width="${w*2 - 4}" height="3" fill="#5BD6CB"/>`;
    return { sh: compose(node, ctx, body + rule, w, h, 8), w, h, r: 8 };
  }

  // ── 10. note — soft 10-px radius card ──
  function note(node, ctx) {
    const w = S, h = S * 0.65;
    const body = `<rect x="${node.x - w}" y="${node.y - h}" width="${w*2}" height="${h*2}" rx="10" fill="var(--srf-2,#161A20)" stroke="var(--line-2,rgba(255,255,255,0.10))" stroke-width="1"/>`;
    return { sh: compose(node, ctx, body, w, h, 10), w, h, r: 10 };
  }

  const RENDERERS = {
    project, idea, principle, resource, question,
    experiment, library, doc, formula, note
  };

  /**
   * Public entry point.
   * @param {object} node — node data (x, y, shape, status, ...)
   * @param {object} view — current {x, y, k}
   * @param {object} ctx  — { rtl, selected, focused, dim, wsAccent }
   * @returns {object}    — { sh, ring, w, h, r, semantic }
   */
  function renderSilhouette(node, view, ctx) {
    ctx = ctx || {};
    const renderer = RENDERERS[node.shape] || note;
    const out = renderer(node, ctx);
    const ring = ctx.selected ? selectionRing(node, out.w, out.h, out.r) : '';
    // Semantic LoD tier
    let semantic = 'full';
    if (view && view.k < 0.25) semantic = 'micro';
    else if (view && view.k < 0.45) semantic = 'silhouette';
    return {
      sh: out.sh,
      ring,
      w: out.w,
      h: out.h,
      r: out.r,
      semantic
    };
  }

  window.RenderSilhouette = renderSilhouette;
  window.SilhouetteTypes  = Object.freeze(Object.keys(RENDERERS));
})();
