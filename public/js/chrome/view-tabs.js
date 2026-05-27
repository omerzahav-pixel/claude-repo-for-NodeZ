/* =============================================================================
 * EdgeSpace · Sprint 3 · View tabs + view-stage manager (Pass 4 § 03).
 *
 * A small segmented control with 5 modes: Canvas / List / Kanban /
 * Timeline / Weak-spot. URL preserves the current mode per session
 * (?view=list). Canvas is the default and shows the existing SVG canvas
 * untouched; the other four render into #viewStage (a full-viewport DOM
 * overlay above #cv) and the SVG canvas is hidden via CSS while active.
 *
 * Gated by Flags.on('views-v2'). When OFF, the segmented control isn't
 * built and the canvas stays as today.
 *
 * Per-view modules register themselves on window.EdgeSpaceViews:
 *   { id, label, icon, render(stage), unmount(stage) }
 * ============================================================================= */

(function () {
  'use strict';

  const STORE_KEY = 'edgespace-view-mode';
  const MODES = ['canvas', 'list', 'kanban', 'timeline', 'weakspot'];
  const LABEL = { canvas: 'Canvas', list: 'List', kanban: 'Kanban', timeline: 'Timeline', weakspot: 'Weak-spot' };
  const ICON  = { canvas: '⊞', list: '☰', kanban: '▥', timeline: '▤', weakspot: '◉' };

  let tabsEl = null;     // the segmented control in the top bar
  let stageEl = null;    // #viewStage — host element for non-canvas views
  let activeMode = 'canvas';
  let currentRendered = null;

  function boot() {
    if (!window.Flags || !window.Flags.on('views-v2')) return;
    if (typeof window.__E2E === 'undefined') {
      requestAnimationFrame(boot);
      return;
    }
    install();
  }

  function install() {
    // Build the segmented control. Anchor it as a fixed element in the
    // top-right area; the new top bar (Pass 4 § 01) is post-Phase-3 work,
    // so for this sprint we position it as a standalone chip cluster.
    tabsEl = document.createElement('div');
    tabsEl.id = 'viewTabs';
    tabsEl.setAttribute('aria-label', 'View mode');
    document.body.appendChild(tabsEl);
    stageEl = document.createElement('div');
    stageEl.id = 'viewStage';
    stageEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(stageEl);
    // Restore last view from URL or localStorage.
    const url = new URL(location.href);
    const fromUrl = url.searchParams.get('view');
    if (fromUrl && MODES.includes(fromUrl)) activeMode = fromUrl;
    else { try { const s = localStorage.getItem(STORE_KEY); if (s && MODES.includes(s)) activeMode = s; } catch (e) {} }
    renderTabs();
    applyMode(activeMode);
    /* Sprint 3.4 Issue 6 — re-render the tab strip after every workspace
       switch so the Weak-spot tab visibility tracks the new workspace's
       setting. */
    if (typeof window.switchWorkspace === 'function' && !window.switchWorkspace.__viewsHooked) {
      const o = window.switchWorkspace;
      const w = async function () {
        const r = await o.apply(this, arguments);
        try { renderTabs(); } catch (e) {}
        return r;
      };
      w.__viewsHooked = true;
      window.switchWorkspace = w;
    }
    // Re-render the active non-canvas view when the underlying data changes.
    if (typeof window.render === 'function' && !window.render.__viewsHooked) {
      const orig = window.render;
      const wrapped = function () {
        const r = orig.apply(this, arguments);
        if (activeMode !== 'canvas') {
          try { renderActiveView(); } catch (e) { console.error('[ES views] re-render:', e); }
        }
        return r;
      };
      wrapped.__viewsHooked = true;
      window.render = wrapped;
    }
  }

  function renderTabs() {
    if (!tabsEl) return;
    /* Sprint 3.4 Issue 6 — Weak-spot tab is hidden when the current
       workspace has weakspot disabled. Default per-ws is OFF; the
       one-time migration enables it for the workspace named "uni". */
    const visibleModes = MODES.filter(m => {
      if (m !== 'weakspot') return true;
      try { return typeof window.isWeakspotEnabled === 'function' && window.isWeakspotEnabled(); }
      catch (e) { return false; }
    });
    // If user is currently on weakspot but it's now disabled, jump to canvas.
    if (activeMode === 'weakspot' && !visibleModes.includes('weakspot')) {
      activeMode = 'canvas';
      applyMode('canvas');
    }
    tabsEl.innerHTML = visibleModes.map(m =>
      '<button class="vt-tab' + (m === activeMode ? ' active' : '') + '" data-mode="' + m + '" title="' + LABEL[m] + '">' +
        '<span class="vt-ic">' + ICON[m] + '</span>' +
        '<span class="vt-lbl">' + LABEL[m] + '</span>' +
      '</button>'
    ).join('');
    tabsEl.querySelectorAll('[data-mode]').forEach(b => {
      b.addEventListener('click', () => setMode(b.getAttribute('data-mode')));
    });
  }
  /* Sprint 3.4 Issue 6 — expose for the workspace-settings dialog so
     it can re-render tabs after toggling weakspot on/off. */
  function refresh() { renderTabs(); }

  function setMode(m) {
    if (!MODES.includes(m) || m === activeMode) return;
    activeMode = m;
    try { localStorage.setItem(STORE_KEY, m); } catch (e) {}
    const url = new URL(location.href);
    url.searchParams.set('view', m);
    history.replaceState(null, '', url.toString());
    renderTabs();
    applyMode(m);
  }

  function applyMode(m) {
    // Unmount previous view if any.
    if (currentRendered && typeof currentRendered.unmount === 'function') {
      try { currentRendered.unmount(stageEl); } catch (e) {}
    }
    currentRendered = null;
    if (m === 'canvas') {
      document.body.classList.remove('non-canvas-view');
      stageEl.classList.remove('on');
      stageEl.innerHTML = '';
      return;
    }
    document.body.classList.add('non-canvas-view');
    stageEl.classList.add('on');
    renderActiveView();
  }

  function renderActiveView() {
    if (activeMode === 'canvas') return;
    const reg = window.EdgeSpaceViews && window.EdgeSpaceViews[activeMode];
    if (!reg || typeof reg.render !== 'function') {
      stageEl.innerHTML = '<div class="vs-empty">View "' + activeMode + '" failed to load.</div>';
      return;
    }
    try {
      reg.render(stageEl);
      currentRendered = reg;
    } catch (e) {
      console.error('[ES views] render threw:', e);
      stageEl.innerHTML = '<div class="vs-empty">View error: ' + (e.message || 'unknown') + '</div>';
    }
  }

  window.ViewTabs = Object.freeze({ setMode, current: () => activeMode, refresh });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
