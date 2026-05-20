/* =============================================================================
 * EdgeSpace · Phase 2 · Zone sticky-chip rebuild (Pass 3 § 08).
 *
 *   - 6% opacity tinted fill in the zone's assigned hue
 *   - dashed 2/4 border in the same hue at 18% opacity
 *   - DOM title chip (NOT SVG) that floats outside the zone's top edge as
 *     a pill; sticks to the visible top edge of the zone when scrolled
 *     out, so the label never disappears
 *   - chip is scale-invariant (always native pixel size)
 *
 * Two halves:
 *   1. SVG patch — renderZoneV2(z, view) returns the rect + border markup
 *      that the render() loop emits instead of the v1 zone group
 *   2. DOM chip layer — a sibling div populated/repositioned after every
 *      render(). One chip per zone, position computed from the zone's
 *      world coords + the current view transform.
 *
 * Gated by Flags.on('zones-v2'). When OFF the v1 zone group continues to
 * own zones.
 * ============================================================================= */

(function () {
  'use strict';

  function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(124,130,142,${alpha})`;
    if (hex.startsWith('rgba(')) return hex;
    const m = hex.replace('#', '');
    const r = parseInt(m.length === 3 ? m[0]+m[0] : m.slice(0,2), 16);
    const g = parseInt(m.length === 3 ? m[1]+m[1] : m.slice(2,4), 16);
    const b = parseInt(m.length === 3 ? m[2]+m[2] : m.slice(4,6), 16);
    if (!isFinite(r)) return `rgba(124,130,142,${alpha})`;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /**
   * SVG markup for one zone — fill + dashed border.
   * The label slot is EMPTY in SVG; the DOM chip layer renders it.
   */
  function renderZoneSvg(z) {
    const fill   = hexToRgba(z.color, 0.06);
    const stroke = hexToRgba(z.color, 0.18);
    const lk = z.locked !== false;
    const handle = lk ? '' : `<rect class="zh" x="${z.x+z.w-14}" y="${z.y+z.h-14}" width="14" height="14" rx="3"/>`;
    return `<g class="zone zone-v2" data-zone="${z.id}"><rect class="zr ${lk?'locked':'zd'}" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-dasharray="2,4" data-locked="${lk?1:0}"/>${handle}</g>`;
  }

  /** Render all zones — replaces the v1 zone loop. */
  function renderAll(zones) {
    return zones.map(renderZoneSvg).join('');
  }

  // ─── DOM chip layer ───────────────────────────────────────────────────────
  let chipLayer = null;
  function ensureLayer() {
    if (chipLayer && document.body.contains(chipLayer)) return chipLayer;
    chipLayer = document.createElement('div');
    chipLayer.id = 'zoneChips';
    chipLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:14';
    document.body.appendChild(chipLayer);
    return chipLayer;
  }

  /**
   * World → screen helper. Mirrors the existing app.js viewBox math:
   *   screenX = W/2 + (worldX + view.x) * view.k
   *   screenY = H/2 + (worldY + view.y) * view.k
   */
  function worldToScreen(wx, wy, view) {
    return {
      x: window.innerWidth  / 2 + (wx + view.x) * view.k,
      y: window.innerHeight / 2 + (wy + view.y) * view.k
    };
  }

  /**
   * Reposition every chip. Called after each render() while flag is on.
   * Sticky behaviour: if the zone's top edge is above the viewport top
   * (screen y < CHIP_MIN_Y), pin the chip to CHIP_MIN_Y as long as the
   * zone's bottom edge is still below it.
   */
  const CHIP_MIN_Y = 8;          // 8px from top of viewport
  const CHIP_TOP_OFFSET = -18;   // chip floats 18px above zone top edge

  function reposition(zones, view) {
    const layer = ensureLayer();
    if (!window.Flags || !window.Flags.on('zones-v2')) {
      layer.innerHTML = '';
      return;
    }
    const ids = new Set();
    for (const z of zones) {
      ids.add(z.id);
      let chip = layer.querySelector(`[data-chip="${cssEsc(z.id)}"]`);
      if (!chip) {
        chip = document.createElement('div');
        chip.className = 'zone-chip';
        chip.setAttribute('data-chip', z.id);
        layer.appendChild(chip);
      }
      const isRtl = document.body.classList.contains('he') || /[֐-׿]/.test(z.name || '');
      chip.textContent = (z.name || '') + (z.locked === false ? '' : ' 🔒');
      chip.style.color = z.color;
      chip.style.borderColor = hexToRgba(z.color, 0.35);
      chip.style.background  = hexToRgba(z.color, 0.10);
      chip.dir = isRtl ? 'rtl' : 'ltr';
      // World coords → screen.
      const topMid    = worldToScreen(z.x + z.w / 2, z.y, view);
      const bottomMid = worldToScreen(z.x + z.w / 2, z.y + z.h, view);
      // Sticky math: clamp the chip top into [CHIP_MIN_Y, bottomMid.y - 28].
      let chipTop = topMid.y + CHIP_TOP_OFFSET;
      const stickFloor = Math.max(CHIP_MIN_Y, chipTop);
      const stickCeil  = bottomMid.y - 28;
      chipTop = Math.min(stickFloor, stickCeil);
      // Hide if zone fully off-screen below or above.
      const offScreen = bottomMid.y < 0 || topMid.y > window.innerHeight;
      if (offScreen) { chip.style.display = 'none'; continue; }
      chip.style.display = 'block';
      chip.style.top = chipTop + 'px';
      // Position center horizontally; align by transform so RTL chips
      // anchor to the trailing-script side.
      chip.style.insetInlineStart = (isRtl ? (window.innerWidth - topMid.x) : topMid.x) + 'px';
      chip.style.transform = 'translateX(' + (isRtl ? '50%' : '-50%') + ')';
    }
    // Garbage-collect chips for deleted zones.
    layer.querySelectorAll('.zone-chip').forEach(el => {
      if (!ids.has(el.getAttribute('data-chip'))) el.remove();
    });
  }

  function cssEsc(s) {
    return window.CSS && window.CSS.escape ? window.CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  window.ZonesV2 = Object.freeze({
    renderAll, renderZoneSvg, reposition, ensureLayer
  });
})();
