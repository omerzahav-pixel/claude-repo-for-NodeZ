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
 *        * node.weakspot.modifier            (Sprint 3.3 Issue 5)
 *
 * Sprint 3.3 Issue 5 — per-card Easier / Harder / Skip buttons let the
 * user manually tune the ranking. Modifiers persist on node.weakspot.
 *   Easier × 0.7 (decay), Harder × 1.4 (boost), Skip = hide for 7 days
 *   Reset clears every node's weakspot field on the current canvas.
 *
 * Hot / Warm / Cool buckets by need quantile. "Study now" focuses the
 * node on the Canvas view. Degrades gracefully on sparse canvases.
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
    /* Sprint 3.3 Issue 5 — user-tunable modifier stored on the node. */
    const mod = (node.weakspot && typeof node.weakspot.modifier === 'number')
      ? node.weakspot.modifier : 1.0;
    return stale * (openQ + failedX + 0.25) / touched * mod;
  }

  function isSkipped(node) {
    return !!(node.weakspot && node.weakspot.skipUntil && Date.now() < node.weakspot.skipUntil);
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
    if (node.weakspot && typeof node.weakspot.modifier === 'number' && node.weakspot.modifier !== 1) {
      sig.push('×' + node.weakspot.modifier.toFixed(2) + ' modifier');
    }
    return sig;
  }
  function whyFor(node) {
    if (node.shape === 'question') return 'Unanswered question';
    if (node.shape === 'experiment' && node.status === 'blocked') return 'Experiment is blocked';
    if (node.status === 'pending') return 'Marked pending';
    return 'Hasn\'t been touched in a while';
  }

  /* Sprint 3.3 Issue 5 — adjustment actions, persisted on node.weakspot. */
  function findNode(id) {
    const E = window.__E2E;
    if (!E) return null;
    const c = E.current();
    return c && c.nodes ? c.nodes.find(n => n.id === id) : null;
  }
  function applyModifier(nodeId, factor) {
    const node = findNode(+nodeId);
    if (!node) return;
    if (!node.weakspot) node.weakspot = {};
    const cur = (typeof node.weakspot.modifier === 'number') ? node.weakspot.modifier : 1.0;
    node.weakspot.modifier = Math.max(0.05, Math.min(20, cur * factor));
    node.modified = new Date().toISOString();
    if (typeof window.sv === 'function') window.sv();
  }
  function applySkip(nodeId, days) {
    const node = findNode(+nodeId);
    if (!node) return;
    if (!node.weakspot) node.weakspot = {};
    node.weakspot.skipUntil = Date.now() + days * 24 * 3600 * 1000;
    node.modified = new Date().toISOString();
    if (typeof window.sv === 'function') window.sv();
  }
  function resetAllModifiers() {
    const E = window.__E2E;
    if (!E) return 0;
    const c = E.current();
    if (!c) return 0;
    let n = 0;
    for (const node of c.nodes) {
      if (node.weakspot) { delete node.weakspot; n++; }
    }
    if (n && typeof window.sv === 'function') window.sv();
    return n;
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
    /* Sprint 3.3 Issue 5 — filter out skipped nodes from the ranking. */
    const ranked = nodes.filter(n => !isSkipped(n));
    const skippedCount = nodes.length - ranked.length;
    const scored = ranked.map(n => ({ n, need: computeNeed(n, nodes, edges) }));
    scored.sort((a, b) => b.need - a.need);
    const needs = scored.map(s => s.need).sort((a, b) => a - b);
    const p33 = needs[Math.floor(needs.length * 0.66)] || 0;
    const p66 = needs[Math.floor(needs.length * 0.85)] || 0;
    let html = '<div class="vs-weakspot">' +
      '<div class="vs-ws-head">' +
        '<span>Attention needed (' + scored.length + ' nodes ranked' +
        (skippedCount ? ', ' + skippedCount + ' skipped' : '') + ')</span>' +
        /* Sprint 3.3 Issue 5 — reset-all action. */
        '<button class="vs-ws-reset" data-act="reset-all" title="Clear every Easier / Harder / Skip adjustment on this canvas">Reset adjustments</button>' +
      '</div>' +
      '<div class="vs-ws-list">';
    for (const { n, need } of scored.slice(0, 50)) {
      const tier = tierOf(need, p33, p66);
      const sigs = signalsFor(n, edges, nodes);
      html += '<div class="vs-ws-row" data-id="' + n.id + '">' +
        '<span class="vs-ws-chip ' + tier.cls + '">' + tier.name + '</span>' +
        '<div class="vs-ws-body">' +
          '<div class="vs-ws-topic">' + esc(n.label || '(untitled)') + '</div>' +
          '<div class="vs-ws-why">' + esc(whyFor(n)) + '</div>' +
          '<div class="vs-ws-sigs">' + sigs.map(s => '<span>' + esc(s) + '</span>').join(' · ') + '</div>' +
          /* Sprint 3.3 Issue 5 — per-card Easier / Harder / Skip. */
          '<div class="vs-ws-adj">' +
            '<button class="vs-ws-adj-btn" data-act="easier" data-nid="' + n.id + '" title="Decay attention-need ×0.7">Easier</button>' +
            '<button class="vs-ws-adj-btn" data-act="harder" data-nid="' + n.id + '" title="Boost attention-need ×1.4">Harder</button>' +
            '<button class="vs-ws-adj-btn" data-act="skip"   data-nid="' + n.id + '" title="Hide from Weak-spot for 7 days">Skip</button>' +
          '</div>' +
        '</div>' +
        '<button class="vs-ws-go" data-go="' + n.id + '">Study now →</button>' +
      '</div>';
    }
    html += '</div></div>';
    stage.innerHTML = html;

    const go = (e) => {
      const goId = e.currentTarget.getAttribute('data-go') || e.currentTarget.getAttribute('data-id');
      if (!goId) return;
      const id = +goId;
      if (window.ViewTabs) window.ViewTabs.setMode('canvas');
      if (typeof window.focusNode === 'function') requestAnimationFrame(() => window.focusNode(id));
    };
    stage.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', go));
    // Row body click navigates (but not the adjust buttons inside it).
    stage.querySelectorAll('.vs-ws-row').forEach(row => {
      row.addEventListener('click', (ev) => {
        if (ev.target && ev.target.closest && ev.target.closest('.vs-ws-adj, .vs-ws-go')) return;
        go({ currentTarget: row });
      });
    });
    /* Sprint 3.3 Issue 5 — adjustment + reset wiring. */
    stage.querySelectorAll('.vs-ws-adj-btn').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const nid = btn.getAttribute('data-nid');
        const act = btn.getAttribute('data-act');
        if (act === 'easier') applyModifier(nid, 0.7);
        else if (act === 'harder') applyModifier(nid, 1.4);
        else if (act === 'skip') applySkip(nid, 7);
        render(stage); // re-rank immediately
      });
    });
    stage.querySelector('[data-act="reset-all"]')?.addEventListener('click', () => {
      const n = resetAllModifiers();
      // toast if available; otherwise just re-render.
      if (typeof window.toast === 'function') window.toast('Cleared ' + n + ' adjustment' + (n === 1 ? '' : 's'));
      render(stage);
    });
  }
  function unmount(stage) { stage.innerHTML = ''; }

  window.EdgeSpaceViews = window.EdgeSpaceViews || {};
  window.EdgeSpaceViews.weakspot = {
    id: 'weakspot', label: 'Weak-spot', render, unmount,
    // Expose for tests
    _internals: { applyModifier, applySkip, resetAllModifiers, isSkipped, computeNeed }
  };
})();
