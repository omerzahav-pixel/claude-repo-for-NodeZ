/* =============================================================================
 * EdgeSpace · Sprint 3 · List view (Pass 4 § 03a).
 *
 * Sortable rows. Columns: silhouette icon, title, type, status chip, last-touched.
 * Click a row to focus the node on the Canvas view.
 * ============================================================================= */

(function () {
  'use strict';

  const SHAPE_GLYPH = {
    project: '◆', idea: '●', principle: '◇', resource: '⬢',
    question: '?', experiment: '⚗', library: '▤', doc: '📄',
    formula: 'ƒ', note: '✎'
  };
  const STATUS_COLOR = {
    done: '#4FD18B', progress: '#6FA8FF', pending: '#F2C462',
    blocked: '#F87171', idea: '#B98CFB'
  };

  let sortBy = 'modified';
  let sortDir = 'desc';

  function fmtAge(ms) {
    if (!ms || !isFinite(ms)) return '—';
    const d = (Date.now() - ms) / (24 * 3600 * 1000);
    if (d < 1) return Math.max(1, Math.round(d * 24)) + 'h';
    if (d < 7) return Math.round(d) + 'd';
    if (d < 30) return Math.round(d / 7) + 'w';
    return Math.round(d / 30) + 'mo';
  }
  function tsOf(n) {
    return Date.parse(n.modified || n.created || '') || 0;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function render(stage) {
    const E = window.__E2E;
    if (!E) { stage.innerHTML = '<div class="vs-empty">No state.</div>'; return; }
    const c = E.current();
    const nodes = (c?.nodes || []).slice();
    if (!nodes.length) {
      stage.innerHTML = '<div class="vs-empty">No nodes on this canvas. Switch to Canvas view and add some.</div>';
      return;
    }
    nodes.sort((a, b) => {
      let av, bv;
      switch (sortBy) {
        case 'title':    av = (a.label || '').toLowerCase(); bv = (b.label || '').toLowerCase(); break;
        case 'type':     av = a.shape || ''; bv = b.shape || ''; break;
        case 'status':   av = a.status || ''; bv = b.status || ''; break;
        case 'modified': av = tsOf(a); bv = tsOf(b); break;
        default:         av = a.id; bv = b.id;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
    const head = (key, label) => {
      const arrow = sortBy === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
      return '<th data-sort="' + key + '">' + label + arrow + '</th>';
    };
    let html = '<div class="vs-list">' +
      '<table><thead><tr>' +
        '<th></th>' +
        head('title', 'Title') +
        head('type', 'Type') +
        head('status', 'Status') +
        head('modified', 'Modified') +
      '</tr></thead><tbody>';
    for (const n of nodes) {
      const sc = STATUS_COLOR[n.status] || STATUS_COLOR.idea;
      html += '<tr data-id="' + n.id + '">' +
        '<td class="vs-glyph">' + esc(SHAPE_GLYPH[n.shape] || '·') + '</td>' +
        '<td class="vs-title">' + esc(n.label || '(untitled)') + '</td>' +
        '<td class="vs-type">' + esc(n.shape || '') + '</td>' +
        '<td><span class="vs-chip" style="background:' + sc + '22;color:' + sc + ';border-color:' + sc + '55">' + esc(n.status || '') + '</span></td>' +
        '<td class="vs-age">' + fmtAge(tsOf(n)) + '</td>' +
      '</tr>';
    }
    html += '</tbody></table></div>';
    stage.innerHTML = html;
    stage.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const k = th.getAttribute('data-sort');
        if (sortBy === k) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else { sortBy = k; sortDir = k === 'modified' ? 'desc' : 'asc'; }
        render(stage);
      });
    });
    stage.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => {
        const id = +tr.getAttribute('data-id');
        if (window.ViewTabs) window.ViewTabs.setMode('canvas');
        if (typeof window.focusNode === 'function') requestAnimationFrame(() => window.focusNode(id));
      });
    });
  }
  function unmount(stage) { stage.innerHTML = ''; }

  window.EdgeSpaceViews = window.EdgeSpaceViews || {};
  window.EdgeSpaceViews.list = { id: 'list', label: 'List', render, unmount };
})();
