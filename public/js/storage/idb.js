/* =============================================================================
 * EdgeSpace · Phase 1 · IDB single-flight open (Pass 5 §06)
 *
 * iOS Safari kills backgrounded tabs without notice. On return, the cached
 * page resumes but the JavaScript context has been discarded — and any IDB
 * connection that was open is now in a half-closed state. The existing
 * idbOpen() in app.js opens a new connection per call, which:
 *
 *   (a) is wasteful — every storage read/write opens-then-closes,
 *   (b) blocks on `onversionchange` events from other tabs / SW updates,
 *   (c) doesn't recover gracefully when the JS context is torn down mid-tx.
 *
 * This module overrides window.idbOpen with a single-flight version that:
 *
 *   - opens the database lazily, exactly once per JS context
 *   - reuses the resolved Promise so concurrent callers share one open()
 *   - handles `onversionchange` by closing + nulling the cached db, so the
 *     next call opens fresh
 *   - exposes a `closeAndReopen()` helper for the visibility tickle
 *
 * Activated by Flags.on('lifecycle-v2'). When OFF this file installs nothing
 * and the existing per-call idbOpen() in app.js continues to be used.
 * ============================================================================= */

(function () {
  'use strict';

  function boot() {
    if (!window.Flags || !window.Flags.on('lifecycle-v2')) return;
    // The existing app.js declares idbOpen() as a function expression assigned
    // to window via implicit global. We override window.idbOpen with the
    // single-flight version; all callers (idbGet, idbSet, etc.) go through
    // it because they're written as `await idbOpen()`.
    if (typeof window.idbOpen !== 'function') {
      // app.js hasn't defined it yet — wait one tick.
      requestAnimationFrame(boot);
      return;
    }
    install();
  }

  function install() {
    const DB_NAME  = 'ideaVault';
    const DB_STORE = 'state';
    let db = null;
    let opening = null;

    function openOnce() {
      if (db) return Promise.resolve(db);
      if (opening) return opening;

      opening = new Promise((resolve, reject) => {
        let req;
        try { req = indexedDB.open(DB_NAME, 1); }
        catch (err) { reject(err); return; }

        req.onupgradeneeded = () => {
          // Match app.js's original schema: a single object store with
          // out-of-line keys (string keys passed at put-time).
          try {
            if (!req.result.objectStoreNames.contains(DB_STORE)) {
              req.result.createObjectStore(DB_STORE);
            }
          } catch (e) { /* WebKit sometimes throws on duplicate create */ }
        };

        req.onsuccess = () => {
          db = req.result;
          // Auto-recover from another tab upgrading the schema.
          db.onversionchange = () => {
            try { db.close(); } catch (e) {}
            db = null;
            console.log('[EdgeSpace idb] onversionchange — connection closed');
          };
          // Recover from background-tab freeze: when iOS closes the
          // backing store without firing close, the next request rejects.
          db.onclose = () => {
            db = null;
            console.log('[EdgeSpace idb] onclose — will reopen on demand');
          };
          // Surface any uncaught errors so we can see them in the perf HUD.
          db.onerror = (ev) => {
            console.warn('[EdgeSpace idb] error:', ev.target && ev.target.error);
          };
          resolve(db);
        };

        req.onerror = () => reject(req.error || new Error('idb open failed'));
        req.onblocked = () => console.warn('[EdgeSpace idb] open blocked by another tab');
      });

      // Whatever happens — resolve OR reject — release the single-flight slot
      // so a subsequent call can retry after a transient failure.
      opening.finally(() => { opening = null; });
      return opening;
    }

    // Replace the existing global.
    window.idbOpen = openOnce;

    // Public helper used by the visibility tickle.
    window.IdbV2 = Object.freeze({
      get: openOnce,
      closeAndReopen: function () {
        if (db) {
          try { db.close(); } catch (e) {}
          db = null;
        }
        return openOnce();
      },
      hasOpen: function () { return !!db; }
    });

    console.log('[EdgeSpace] IDB single-flight installed');

    // Visibility tickle: nudge layout + re-confirm IDB on tab return.
    // Per Pass 5 §06 — costs ~0.5 ms once and recovers a backgrounded canvas.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      // Layout invalidation forces the compositor to re-allocate dropped layers.
      const root = document.getElementById('cv') || document.getElementById('canvasOverlay');
      if (root) {
        const t = root.style.transform || '';
        // assignment-to-self triggers style recomputation on the layer
        root.style.transform = t || 'translate3d(0,0,0)';
        if (!t) requestAnimationFrame(() => { root.style.transform = ''; });
      }
      // Re-confirm IDB connection (best-effort; nothing breaks if it fails).
      openOnce().catch(err => console.warn('[EdgeSpace idb] reopen failed:', err));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
