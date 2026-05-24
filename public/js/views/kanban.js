/* =============================================================================
 * EdgeSpace · Sprint 3 · Kanban view (Pass 4 § 03b).
 *
 * Five columns matching the status hues: Idea / Pending / In progress /
 * Blocked / Done. Each card is a compact node preview. Drag-reorder
 * within / between columns updates the node's status (writes through
 * to S; persists via sv()).
 * ============================================================================= */

(function () {
  'use strict';

  const COLS = [
    { id: 'idea',     label: 'Idea',        color: '#B98CFB' },
    { id: 'pending',  label: 'Pending',     color: '#F2C462' },
    { id: 'progress', label: 'In progress', color: '#6FA8FF' },
    { id: 'blocked',  label: 'Blocked',     color: '#F87171' },
    { id: 'done',     label: 'Done',        color: '#4FD18B' }
  ];
  const SHAPE_GLYPH = {
    project: '◆', idea: '●', principle: '◇', resource: '⬢',
    question: '?', experiment: '⚗', library: '▤', doc: '📄',
    formula: 'ƒ', note: '✎'
  };

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function render(stage) {
    const E = window.__E2E;
    if (!E) { stage.innerHTML = '<div class="vs-empty">No state.</div>'; return; }
    const c = E.current();
    const nodes = (c?.nodes || []);
    if (!nodes.length) {
      stage.innerHTML = '<div class="vs-empty">No nodes on this canvas.</div>';
      return;
    }
    const grouped = {};
    for (const col of COLS) grouped[col.id] = [];
    for (const n of nodes) (grouped[n.status] || (grouped[n.status] = [])).push(n);
    let html = '<div class="vs-kanban">';
    for (const col of COLS) {
      const list = grouped[col.id] || [];
      html += '<div class="vs-col" data-status="' + col.id + '">' +
        '<div class="vs-col-head" style="border-top-color:' + col.color + '">' +
          '<span class="vs-col-title">' + col.label + '</span>' +
          '<span class="vs-col-count">' + list.length + '</span>' +
        '</div>' +
        '<div class="vs-col-body" data-drop="' + col.id + '">';
      for (const n of list) {
        html += '<div class="vs-card" draggable="true" data-id="' + n.id + '">' +
          '<div class="vs-card-head"><span class="vs-card-glyph">' + esc(SHAPE_GLYPH[n.shape] || '·') + '</span><span class="vs-card-title">' + esc(n.label || '(untitled)') + '</span></div>' +
          (n.notes ? '<div class="vs-card-body">' + esc((n.notes || '').slice(0, 120)) + '</div>' : '') +
        '</div>';
      }
      html += '</div></div>';
    }
    html += '</div>';
    stage.innerHTML = html;
    wireDnD(stage);
  }

  function wireDnD(stage) {
    let dragId = null;
    stage.querySelectorAll('.vs-card').forEach(card => {
      card.addEventListener('dragstart', e => {
        dragId = +card.getAttribute('data-id');
        card.classList.add('dragging');
        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragId)); } catch (_) {}
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.addEventListener('click', () => {
        const id = +card.getAttribute('data-id');
        if (window.ViewTabs) window.ViewTabs.setMode('canvas');
        if (typeof window.focusNode === 'function') requestAnimationFrame(() => window.focusNode(id));
      });
    });
    stage.querySelectorAll('.vs-col-body').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (_) {} col.classList.add('drop-target'); });
      col.addEventListener('dragleave', () => col.classList.remove('drop-target'));
      col.addEventListener('drop', e => {
        e.preventDefault(); col.classList.remove('drop-target');
        const newStatus = col.getAttribute('data-drop');
        if (!dragId || !newStatus) return;
        const E = window.__E2E;
        const node = E.current().nodes.find(n => n.id === dragId);
        if (!node || node.status === newStatus) return;
        if (typeof window.sn === 'function') window.sn();
        node.status = newStatus;
        node.modified = new Date().toISOString();
        if (typeof window.sv === 'function') window.sv();
        if (typeof window.render === 'function') window.render(); // triggers re-render of this view too
      });
    });
  }
  function unmount(stage) { stage.innerHTML = ''; }

  window.EdgeSpaceViews = window.EdgeSpaceViews || {};
  window.EdgeSpaceViews.kanban = { id: 'kanban', label: 'Kanban', render, unmount };
})();
