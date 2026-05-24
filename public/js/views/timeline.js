/* =============================================================================
 * EdgeSpace · Sprint 3 · Timeline view (Pass 4 § 03c).
 *
 * Grouped by last-touched date (Today / Yesterday / This week / Earlier).
 * Each row reads as "[verb] [title] · [where]". Vertical timeline rail on
 * the leading edge of each group.
 * ============================================================================= */

(function () {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function tsOf(n) { return Date.parse(n.modified || n.created || '') || 0; }
  function groupOf(ts) {
    if (!ts) return 'Earlier';
    const now = Date.now();
    const dayMs = 24 * 3600 * 1000;
    const ageDays = (now - ts) / dayMs;
    if (ageDays < 1) return 'Today';
    if (ageDays < 2) return 'Yesterday';
    if (ageDays < 7) return 'This week';
    return 'Earlier';
  }
  function verbFor(n) {
    // Heuristic: if `modified` set and differs from `created`, "Edited";
    // otherwise "Created".
    if (n.modified && n.modified !== n.created) return 'Edited';
    return 'Created';
  }

  function render(stage) {
    const E = window.__E2E;
    if (!E) { stage.innerHTML = '<div class="vs-empty">No state.</div>'; return; }
    const S = E.state();
    const c = E.current();
    const canvasName = S.canvasMeta?.[S.current]?.name || 'this canvas';
    const nodes = (c?.nodes || []).slice().sort((a, b) => tsOf(b) - tsOf(a));
    if (!nodes.length) {
      stage.innerHTML = '<div class="vs-empty">No nodes on this canvas.</div>';
      return;
    }
    const ORDER = ['Today', 'Yesterday', 'This week', 'Earlier'];
    const grouped = { Today: [], Yesterday: [], 'This week': [], Earlier: [] };
    for (const n of nodes) grouped[groupOf(tsOf(n))].push(n);
    let html = '<div class="vs-timeline">';
    for (const g of ORDER) {
      const list = grouped[g];
      if (!list.length) continue;
      html += '<div class="vs-tl-group">' +
        '<div class="vs-tl-head">' + g + '</div>' +
        '<div class="vs-tl-rail">';
      for (const n of list) {
        const verb = verbFor(n);
        const where = esc(canvasName);
        html += '<div class="vs-tl-row" data-id="' + n.id + '">' +
          '<span class="vs-tl-dot"></span>' +
          '<span class="vs-tl-verb">' + verb + '</span> ' +
          '<span class="vs-tl-title">' + esc(n.label || '(untitled)') + '</span>' +
          ' · <span class="vs-tl-where">' + where + '</span>' +
        '</div>';
      }
      html += '</div></div>';
    }
    html += '</div>';
    stage.innerHTML = html;
    stage.querySelectorAll('.vs-tl-row[data-id]').forEach(r => {
      r.addEventListener('click', () => {
        const id = +r.getAttribute('data-id');
        if (window.ViewTabs) window.ViewTabs.setMode('canvas');
        if (typeof window.focusNode === 'function') requestAnimationFrame(() => window.focusNode(id));
      });
    });
  }
  function unmount(stage) { stage.innerHTML = ''; }

  window.EdgeSpaceViews = window.EdgeSpaceViews || {};
  window.EdgeSpaceViews.timeline = { id: 'timeline', label: 'Timeline', render, unmount };
})();
