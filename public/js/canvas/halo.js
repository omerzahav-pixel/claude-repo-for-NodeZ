/* =============================================================================
 * EdgeSpace · Phase 2 · Freshness halo (Pass 3 § 05).
 *
 *   age (hours)   alpha            visual
 *   ──────────    ─────            ──────
 *   ≤ 6           0.55             fresh, 3-second pulse animation
 *   6 .. 720      log-decay        steady ring, fades log-linearly
 *   > 720 (30d)   0                stale; node ink desaturates 35%
 *
 * Formula:
 *   t = (ln(h) - ln(6)) / (ln(720) - ln(6))    // [0, 1] across the band
 *   alpha = max(0, 0.55 * (1 - t))
 *
 * No dependency on view scale. The halo paints in world coords as a stroke
 * on the silhouette outline at top-trailing (top-right LTR / top-left RTL).
 * ============================================================================= */
(function () {
  'use strict';

  const FRESH_MS    = 6 * 60 * 60 * 1000;        // 6 h
  const STALE_MS    = 30 * 24 * 60 * 60 * 1000;  // 30 d
  const LN_FRESH    = Math.log(6);
  const LN_STALE    = Math.log(720);
  const PEAK_ALPHA  = 0.55;

  function alphaForAgeMs(ageMs) {
    if (!isFinite(ageMs) || ageMs < 0) ageMs = 0;
    if (ageMs <= FRESH_MS) return PEAK_ALPHA;
    if (ageMs >= STALE_MS) return 0;
    const h = ageMs / (60 * 60 * 1000);
    const t = (Math.log(h) - LN_FRESH) / (LN_STALE - LN_FRESH);
    return Math.max(0, PEAK_ALPHA * (1 - t));
  }

  /** Hours of age accept both Date strings and ms timestamps. */
  function ageMs(node, nowMs) {
    nowMs = nowMs || Date.now();
    // EdgeSpace nodes have a `created` field (YYYY-MM-DD) and optionally a
    // `modified` ISO timestamp. Use modified if present, else created.
    const ref = node.modified || node.created;
    if (!ref) return 0;
    const t = Date.parse(ref);
    if (!isFinite(t)) return 0;
    return Math.max(0, nowMs - t);
  }

  function isFresh(node, nowMs) { return ageMs(node, nowMs) <= FRESH_MS; }
  function isStale(node, nowMs) { return ageMs(node, nowMs) >= STALE_MS; }

  /**
   * Build the SVG halo string. Returns '' if alpha is 0.
   * cx, cy is the dot center. r is the halo outer radius.
   * statusColor is the hue.
   */
  function haloSvg(node, x, y, r, statusColor, nowMs) {
    const a = alphaForAgeMs(ageMs(node, nowMs));
    if (a <= 0) return '';
    const cls = isFresh(node, nowMs) ? 'es-halo es-halo-pulse' : 'es-halo';
    return `<circle class="${cls}" cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${statusColor}" stroke-width="2" stroke-opacity="${a.toFixed(3)}"/>`;
  }

  window.FreshnessHalo = Object.freeze({
    alphaForAgeMs, ageMs, isFresh, isStale, haloSvg,
    FRESH_MS, STALE_MS, PEAK_ALPHA
  });
})();
