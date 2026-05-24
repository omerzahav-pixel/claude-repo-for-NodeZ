/* =============================================================================
 * EdgeSpace · Sprint 3 · Weak-spot view (Pass 4 § 03d).
 *
 * Auto-derives an "attention-need" score per node:
 *
 *   stale-days     = max(1, daysSinceModified)
 *   openQuestions  = 1 if shape='question' and status not in {done, blocked}
 *                  + count of incident edges where the OTHER endpoint is
 *                    shape='question' and unanswered
 *   failedExps     = 1 if shape='experiment' and status='blocked'
 *   touchedRecent  = 1/days, clamped to [0.05, 1]
 *
 *   need = stale-days * (openQuestions + failedExps + 0.25) / touchedRecent
 *
 * Hot / Warm / Cool buckets by need quantile. "Study now" action focuses
 * the node on the Canvas view.
 *
 * Degrades gracefully on sparse canvases — when nothing matches the
 * signal heuristics, all nodes land in Cool with low need scores.
 * ============================================================================= */

(function () {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function tsOf(n) { return Date.parse(n.modified || n.created || '') || 0; }
  function ageDays(n) {
    const t = tsOf(n);
    if (!t) return 30;
    return Math.max(0.01, (Date.now() - t) / (24 * 3600 * 1000));
  }

  function computeNeed(node, allNodes, edges) {
    const stale = Math.max(1, ageDays(node));
    let openQ = 0, failedX = 0;
    if (node.shape === 'question' && node.status !== 'done' && node.status !== 'blocked') openQ++;
    if (node.shape === 'experiment' && node.status === 'blocked') failedX++;
    for (const e of edges) {
      let other = null;
      if (e.from === node.id) other = allNodes.find(n => n.id === e.to);
      else if (e.to === node.id) other = allNodes.find(n => n.id === e.from);
      if (!other) continue;
      if (other.shape === 'question' && other.status !== 'done') openQ++;
    }
    const touched = Math.min(1, Math.max(0.05, 1 / Math.max(1, ageDays(node))));
    return stale * (openQ + failedX + 0.25) / touched;
  }

  function tierOf(need, p33, p66) {
    if (need >= p66) return { name: 'Hot',  cls: 'tier-hot',  color: '#F87171' };
    if (need >= p33) return { name: 'Warm', cls: 'tier-warm', color: '#F2C462' };
    return                  { name: 'Cool', cls: 'tier-cool', color: '#6FA8FF' };
  }

  function signalsFor(node, edges, allNodes) {
    const sig = [];
    sig.push(Math.round(ageDays(node)) + 'd stale');
    if (node.shape === 'question' && node.status !== 'done') sig.push('open question');
    if (node.shape === 'experiment' && node.status === 'blocked') sig.push('experiment blocked');
    const conn = edges.filter(e => e.from === node.id || e.to === node.id).length;
    if (conn) sig.push(conn + ' incident edge' + (conn === 1 ? '' : 's'));
    if (node.status === 'pending') sig.push('status pending');
    return sig;
  }
  function whyFor(node) {
    if (node.shape === 'question') return 'Unanswered question';
    if (node.shape === 'experiment' && node.status === 'blocked') return 'Experiment is blocked';
    if (node.status === 'pending') return 'Marked pending';
    return 'Hasn\'t been touched in a while';
  }

  function render(stage) {
    const E = window.__E2E;
    if (!E) { stage.innerHTML = '<div class="vs-empty">No state.</div>'; return; }
    const c = E.current();
    const nodes = (c?.nodes || []);
    const edges = (c?.edges || []);
    if (!nodes.length) {
      stage.innerHTML = '<div class="vs-empty">No nodes on this canvas.</div>';
      return;
    }
    const scored = nodes.map(n => ({ n, need: computeNeed(n, nodes, edges) }));
    scored.sort((a, b) => b.need - a.need);
    const needs = scored.map(s => s.need).sort((a, b) => a - b);
    const p33 = needs[Math.floor(needs.length * 0.66)] || 0;
    const p66 = needs[Math.floor(needs.length * 0.85)] || 0;
    let html = '<div class="vs-weakspot"><div class="vs-ws-head">Attention needed (' + scored.length + ' nodes ranked)</div><div class="vs-ws-list">';
    for (const { n, need } of scored.slice(0, 50)) {
      const tier = tierOf(need, p33, p66);
      const sigs = signalsFor(n, edges, nodes);
      html += '<div class="vs-ws-row" data-id="' + n.id + '">' +
        '<span class="vs-ws-chip ' + tier.cls + '">' + tier.name + '</span>' +
        '<div class="vs-ws-body">' +
          '<div class="vs-ws-topic">' + esc(n.label || '(untitled)') + '</div>' +
          '<div class="vs-ws-why">' + esc(whyFor(n)) + '</div>' +
          '<div class="vs-ws-sigs">' + sigs.map(s => '<span>' + esc(s) + '</span>').join(' · ') + '</div>' +
        '</div>' +
        '<button class="vs-ws-go" data-go="' + n.id + '">Study now →</button>' +
      '</div>';
    }
    html += '</div></div>';
    stage.innerHTML = html;
    const handler = (e) => {
      const goId = e.currentTarget.getAttribute('data-go') || e.currentTarget.getAttribute('data-id');
      if (!goId) return;
      const id = +goId;
      if (window.ViewTabs) window.ViewTabs.setMode('canvas');
      if (typeof window.focusNode === 'function') requestAnimationFrame(() => window.focusNode(id));
    };
    stage.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', handler));
    stage.querySelectorAll('[data-id]').forEach(el => {
      if (!el.hasAttribute('data-go')) el.addEventListener('click', handler);
    });
  }
  function unmount(stage) { stage.innerHTML = ''; }

  window.EdgeSpaceViews = window.EdgeSpaceViews || {};
  window.EdgeSpaceViews.weakspot = { id: 'weakspot', label: 'Weak-spot', render, unmount };
})();
