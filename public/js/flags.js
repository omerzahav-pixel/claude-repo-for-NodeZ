/* =============================================================================
 * EdgeSpace · Phase 1 · Feature flags
 *
 * Central flag registry. All Phase 1 flags default OFF. Existing code paths
 * stay live as fallbacks; flipping a flag ON activates the new path.
 *
 * Three override layers, last write wins:
 *   1. Default map (this file)
 *   2. localStorage key `edgespace-flags` — JSON {name:bool}
 *   3. URL query — single flag: ?flag=gestures-v2   (sets ON)
 *                  multi:        ?flags=gestures-v2,raf-throttle
 *                  off:          ?flag=-gestures-v2 (leading dash = OFF)
 *
 * Usage:
 *   if (window.Flags.on('gestures-v2')) { ...new path... }
 *   window.Flags.set('gestures-v2', true);   // persists to localStorage
 *
 * No build step — this file is loaded by index.html as a regular <script>
 * BEFORE app.js so it's available everywhere.
 * ============================================================================= */

(function () {
  'use strict';

  // The canonical list. Add new flags here as they ship.
  const DEFAULTS = Object.freeze({
    // Phase 1 (Pass 5 — stability)
    'gestures-v2':   false,   // §04 · gesture state machine
    'raf-throttle':  false,   // §05 · compositor-aligned throttle (pairs w/ gestures-v2)
    'lifecycle-v2':  false,   // §06 · IDB single-flight + SW pre-paint + visibility tickle
    'perf-hud':      false,   // devtools · FPS HUD (also auto-on via ?debug=perf)
    // Phase 2 (Pass 2/3 — visual foundation)
    'webfont':       false,   // §02 · Geist + Geist Mono + Instrument Serif + Heebo
    'silhouettes':   false,   // §03 · 10 distinct node silhouettes + freshness halo
    'edges-v2':      false,   // §06 · 8 edge types + routing + auto-legend
    'zones-v2':      false,   // §08 · 6%-fill + dashed border + DOM sticky chip
    'rtl-v2':        false,   // RTL addendum · logical props + auto-script-break editor
    // Phase 3 (Pass 4 — navigation)
    'nav-v2':            false, // §01 · workspace spine + canvas drawer
    'palette':           false, // §02 · ⌘K command palette
    'views-v2':          false, // §03 · 5 view modes (Canvas/List/Kanban/Timeline/Weak-spot)
    // Sprint 3.3 (transition flag — Issue 7)
    'toolbar-migrated':  false  // hide #tb top toolbar in favour of the spine Tools panel
  });

  const STORAGE_KEY = 'edgespace-flags';

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return (obj && typeof obj === 'object') ? obj : {};
    } catch (e) { return {}; }
  }

  function parseQuery() {
    const out = {};
    if (typeof location === 'undefined') return out;
    const params = new URLSearchParams(location.search);
    // ?debug=perf is the documented HUD shortcut.
    if (params.get('debug') === 'perf') out['perf-hud'] = true;
    // ?flag=name or ?flag=-name
    const flagSingle = params.get('flag');
    if (flagSingle) applyFlagToken(out, flagSingle);
    // ?flags=a,b,-c
    const flagsMulti = params.get('flags');
    if (flagsMulti) flagsMulti.split(',').forEach(t => applyFlagToken(out, t.trim()));
    return out;
  }

  function applyFlagToken(target, token) {
    if (!token) return;
    if (token.startsWith('-')) target[token.slice(1)] = false;
    else target[token] = true;
  }

  const stored = loadStored();
  const queried = parseQuery();
  // Merge in precedence order: defaults < stored < query.
  const state = Object.assign({}, DEFAULTS, stored, queried);

  function on(name) { return state[name] === true; }
  function off(name) { return !on(name); }

  function set(name, value) {
    state[name] = !!value;
    try {
      const persisted = loadStored();
      persisted[name] = !!value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch (e) { /* private mode / quota — runtime override still works */ }
  }

  function reset(name) {
    try {
      const persisted = loadStored();
      delete persisted[name];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch (e) {}
    state[name] = DEFAULTS[name] === true;
  }

  function all() { return Object.assign({}, state); }

  window.Flags = Object.freeze({
    on, off, set, reset, all,
    DEFAULTS: DEFAULTS
  });

  // Tiny console signal so the user can see what's active without opening devtools.
  const active = Object.keys(state).filter(k => state[k]);
  if (active.length && typeof console !== 'undefined') {
    console.log('[EdgeSpace] Flags ON:', active.join(', '));
  }
})();
