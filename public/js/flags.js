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

  /* The canonical list.
     Sprint 4 Issue 5 — retired 8 flags by flipping defaults to true.
     These 8 lived 4+ weeks in production with no rollback events; per
     Pass 7 §05 the new behaviour becomes hard-on. The flag NAMES are
     kept so URLs that mention them don't error, AND so the rollback
     path `?flag=-gestures-v2` (URL negation) still works for emergency
     downgrade. Actual code-branch removal (the bundle-size reduction
     half of retirement) is a separate cleanup pass — flipping defaults
     is the behavioural half. */
  const DEFAULTS = Object.freeze({
    // Phase 1 (retired Sprint 4)
    'gestures-v2':       true,   // §04 · gesture state machine
    'raf-throttle':      true,   // §05 · compositor-aligned throttle
    'lifecycle-v2':      true,   // §06 · IDB single-flight + SW pre-paint
    'perf-hud':          false,  // devtools — stays opt-in
    // Phase 2 (retired Sprint 4)
    'webfont':           true,   // §02 · Geist + Heebo webfont stack
    'silhouettes':       true,   // §03 · 10 silhouettes + freshness halo
    'edges-v2':          true,   // §06 · 8 edge types + routing + legend
    'zones-v2':          true,   // §08 · 6% fill + dashed border + DOM chip
    'rtl-v2':            true,   // RTL contract · logical props + script-break editor
    // Phase 3 (recent — stays behind flag for ≥ 1 more decision-gate cycle)
    'nav-v2':            false,  // §01 · workspace spine + canvas drawer
    'palette':           false,  // §02 · ⌘K command palette
    'views-v2':          false,  // §03 · 5 view modes
    'toolbar-migrated':  false,  // Sprint 3.3 · hide #tb top toolbar
    // Phase 4 (new — behind flag for at least one decision-gate cycle)
    'canvas-tiles':      false,  // Pass 5 §03 · rasterised tile layer
    'cull-v1':           false,  // Sprint 4.1 · viewport culling (mount/unmount)
    'no-fx':             false,  // Sprint 4.2 · kill freshness halo + all canvas filters (paint diagnostic)
    'fx-motion':         false,  // Sprint 4.2 · drop fx only while the canvas is in motion (Path A fix)
    'simple-nodes':      false,  // Sprint 4.3 · circle + state colour + title, no silhouette/halo
    'freeze-pan':        false   // Sprint 4.3 · render simple nodes during motion (cheap pan), rich at rest
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

  /* Sprint 3.4 — auto-persist URL-set flags to localStorage so iPad
     users who can't easily use devtools can open a single magic URL
     once and have it remembered for every subsequent visit. Without
     this they'd have to keep the query string in the URL forever
     (or every reload would clear the flags).

     Only writes when the URL actually contained flag overrides —
     plain visits to the production URL never touch storage here.

     Skip if storage is unavailable (private mode / quota). */
  if (Object.keys(queried).length) {
    try {
      const persisted = loadStored();
      let dirty = false;
      for (const k of Object.keys(queried)) {
        if (persisted[k] !== queried[k]) {
          persisted[k] = queried[k];
          dirty = true;
        }
      }
      if (dirty) localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch (e) {}
  }

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
