/* =============================================================================
 * EdgeSpace · Sprint 3.3 · Tools panel (Issue 7 of the Sprint 3.3 brief).
 *
 * Replaces the old top toolbar (#tb) — Import, Export, More menu, Add zone,
 * Add node, Patch, Fit, Undo/Redo — with a slide-out panel anchored to the
 * spine. Triggered by a gear chip near the bottom of the spine.
 *
 * Gated by Flags.on('nav-v2'). The panel is created lazily on first open
 * so it doesn't add DOM to canvases that never trigger it.
 *
 * The `--toolbar-migrated` flag (added in flags.js) controls visibility of
 * the OLD #tb top toolbar. When ON, the old toolbar is hidden; when OFF,
 * both UIs coexist (rollback safety + side-by-side comparison during the
 * transition).
 *
 * Every action in the panel calls the same window.* function the
 * corresponding old-toolbar button called — no functional changes, only
 * relocation.
 * ============================================================================= */

(function () {
  'use strict';

  let panel = null;
  let opened = false;

  // Lazy DOM construction. Returns the panel element, creating if needed.
  function ensurePanel() {
    if (panel && document.body.contains(panel)) return panel;
    panel = document.createElement('aside');
    panel.id = 'toolsPanel';
    panel.setAttribute('aria-label', 'Tools');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = renderHtml();
    document.body.appendChild(panel);
    wireActions();
    return panel;
  }

  function renderHtml() {
    return (
      '<div class="tp-head">' +
        '<span class="tp-title">Tools</span>' +
        '<button class="tp-close" data-act="close" aria-label="Close" title="Close (ESC)">×</button>' +
      '</div>' +
      '<div class="tp-section">' +
        '<div class="tp-section-head">Canvas</div>' +
        '<button class="tp-row" data-act="add-node">' +
          '<span class="tp-ic" aria-hidden="true">＋</span>' +
          '<span class="tp-name">Add node</span>' +
          '<span class="tp-sub">long-press also works</span>' +
        '</button>' +
        '<button class="tp-row" data-act="add-zone">' +
          '<span class="tp-ic" aria-hidden="true">▤</span>' +
          '<span class="tp-name">Add zone</span>' +
          '<span class="tp-sub">group of related nodes</span>' +
        '</button>' +
        '<button class="tp-row" data-act="fit">' +
          '<span class="tp-ic" aria-hidden="true">⤧</span>' +
          '<span class="tp-name">Fit view</span>' +
        '</button>' +
        '<button class="tp-row" data-act="undo">' +
          '<span class="tp-ic" aria-hidden="true">↶</span>' +
          '<span class="tp-name">Undo</span>' +
        '</button>' +
        '<button class="tp-row" data-act="redo">' +
          '<span class="tp-ic" aria-hidden="true">↷</span>' +
          '<span class="tp-name">Redo</span>' +
        '</button>' +
      '</div>' +
      '<div class="tp-section">' +
        '<div class="tp-section-head">Workspace</div>' +
        '<label class="tp-row" data-act="import" for="imp">' +
          '<span class="tp-ic" aria-hidden="true">📥</span>' +
          '<span class="tp-name">Import workspace</span>' +
        '</label>' +
        '<button class="tp-row" data-act="export">' +
          '<span class="tp-ic" aria-hidden="true">📤</span>' +
          '<span class="tp-name">Export workspace</span>' +
        '</button>' +
        '<button class="tp-row" data-act="patch">' +
          '<span class="tp-ic" aria-hidden="true">📋</span>' +
          '<span class="tp-name">Paste patch JSON</span>' +
        '</button>' +
      '</div>' +
      '<div class="tp-section">' +
        '<div class="tp-section-head">More</div>' +
        '<button class="tp-row" data-act="more">' +
          '<span class="tp-ic" aria-hidden="true">⋯</span>' +
          '<span class="tp-name">Open More menu</span>' +
          '<span class="tp-sub">export · settings · utilities</span>' +
        '</button>' +
        '<button class="tp-row" data-act="legend">' +
          '<span class="tp-ic" aria-hidden="true">?</span>' +
          '<span class="tp-name">Toggle legend</span>' +
        '</button>' +
        '<button class="tp-row" data-act="lang">' +
          '<span class="tp-ic" aria-hidden="true">א/A</span>' +
          '<span class="tp-name">Toggle Hebrew (RTL)</span>' +
        '</button>' +
      '</div>'
    );
  }

  function wireActions() {
    panel.addEventListener('click', (e) => {
      const t = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
      if (!t) return;
      const act = t.getAttribute('data-act');
      if (act === 'close')        { close(); return; }
      if (act === 'add-node')     { safeCall('addC'); close(); return; }
      if (act === 'add-zone')     { safeCall('addZoneCenter'); close(); return; }
      if (act === 'fit')          { safeCall('zF'); close(); return; }
      if (act === 'undo')         { safeCall('un'); return; }
      if (act === 'redo')         { safeCall('re'); return; }
      if (act === 'export')       { safeCall('ex'); close(); return; }
      if (act === 'patch')        { safeCall('showPatch'); close(); return; }
      if (act === 'more')         { safeCall('toggleMore'); close(); return; }
      if (act === 'legend')       { safeCall('toggleLegend'); close(); return; }
      if (act === 'lang')         { safeCall('toggleHebrew'); close(); return; }
      // 'import' is a <label for="imp"> — browser handles the file picker.
      if (act === 'import')       { close(); return; }
    });
    // Outside-click + ESC dismiss.
    document.addEventListener('click', outsideClick, true);
    document.addEventListener('keydown', escKey, true);
  }
  function safeCall(name) {
    try {
      if (typeof window[name] === 'function') window[name]();
    } catch (e) { console.error('[ES tools-panel] ' + name + ' threw:', e); }
  }
  function outsideClick(e) {
    if (!opened || !panel) return;
    const t = e.target;
    if (!t) return;
    if (t.closest && (t.closest('#toolsPanel') || t.closest('#spine'))) return;
    close();
  }
  function escKey(e) {
    if (!opened) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  function open() {
    ensurePanel();
    if (opened) return;
    opened = true;
    panel.classList.add('on');
    panel.setAttribute('aria-hidden', 'false');
  }
  function close() {
    if (!panel || !opened) return;
    opened = false;
    panel.classList.remove('on');
    panel.setAttribute('aria-hidden', 'true');
  }
  function toggle() { opened ? close() : open(); }

  function boot() {
    if (!window.Flags || !window.Flags.on('nav-v2')) return;
    // Pre-create so smoke-tests can find #toolsPanel without opening it.
    ensurePanel();
    // Apply the toolbar-migrated body class so CSS can hide #tb.
    syncToolbarBodyClass();
  }
  function syncToolbarBodyClass() {
    document.body.classList.toggle(
      'toolbar-migrated-on',
      !!(window.Flags && window.Flags.on('toolbar-migrated'))
    );
  }

  window.ToolsPanel = Object.freeze({ open, close, toggle });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
