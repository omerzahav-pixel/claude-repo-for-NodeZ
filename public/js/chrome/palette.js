/* =============================================================================
 * EdgeSpace · Sprint 3 · ⌘K command palette (Pass 4 § 02).
 *
 * Triggers:
 *   - Cmd/Ctrl+K from any input that isn't a textarea
 *   - Two-finger swipe-down on iPad (detected by gesture.js? no — here)
 *   - Manually via window.Palette.open()
 *
 * 5 result kinds: Nodes / Canvases / Workspaces / Commands / Recent.
 * Inline prefix filters parsed by SearchIndex:  @node:  #canvas:  >cmd:  !status:
 * Fuzzy match with <mark> highlights. ↑↓ to navigate, ↩ to pick, ⌘1..9 jumps
 * to the first nine results, ESC dismisses.
 *
 * Gated by Flags.on('palette'). When OFF, this file installs nothing.
 *
 * Recent canvases: the SearchIndex's `bumpRecent(id, name)` is called from
 * the existing app.js `switchTo()` — we wrap it once here so we don't have
 * to edit app.js for the recents-list semantics.
 * ============================================================================= */

(function () {
  'use strict';

  let root = null;
  let inputEl = null;
  let resultsEl = null;
  let footEl = null;
  let lastResults = [];
  let selIdx = 0;
  let opened = false;

  function boot() {
    if (!window.Flags || !window.Flags.on('palette')) return;
    if (typeof window.SearchIndex === 'undefined') {
      requestAnimationFrame(boot);
      return;
    }
    install();
  }

  function install() {
    // Wrap switchTo so every canvas change feeds the recents list.
    if (typeof window.switchTo === 'function' && !window.switchTo.__paletteRecentsHooked) {
      const orig = window.switchTo;
      const wrapped = function (id) {
        const r = orig.apply(this, arguments);
        try {
          if (window.SearchIndex && id) {
            const name = window.__E2E?.state()?.canvasMeta?.[id]?.name || id;
            window.SearchIndex.bumpRecent(id, name);
          }
        } catch (e) {}
        return r;
      };
      wrapped.__paletteRecentsHooked = true;
      window.switchTo = wrapped;
    }
    // Build DOM container (hidden by default).
    root = document.createElement('div');
    root.id = 'palette';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="palette-backdrop"></div>' +
      '<div class="palette-box" role="dialog" aria-label="Command palette">' +
        '<div class="palette-input-row">' +
          '<span class="palette-ic">⌘K</span>' +
          '<input type="text" dir="auto" placeholder="Search nodes, canvases, commands…" autocomplete="off" spellcheck="false" />' +
          '<span class="palette-esc-chip">ESC</span>' +
        '</div>' +
        '<div class="palette-results" role="listbox"></div>' +
        '<div class="palette-foot">' +
          '<span><b>↑↓</b> nav</span>' +
          '<span><b>↩</b> open</span>' +
          '<span><b>⌘1-9</b> jump</span>' +
          '<span><b>@node:</b> · <b>#canvas:</b> · <b>&gt;cmd:</b></span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);
    inputEl = root.querySelector('input');
    resultsEl = root.querySelector('.palette-results');
    footEl = root.querySelector('.palette-foot');
    inputEl.addEventListener('input', onInput);
    inputEl.addEventListener('keydown', onKey);
    root.querySelector('.palette-backdrop').addEventListener('click', close);
    /* Sprint 3.2 Issue 4 — also bind the global key handler on `window`
       (capture phase) so the listener fires even if some other handler
       on document body grabs the event first. Both wires call the same
       handler; the toggle()'s internal `opened` guard prevents
       double-firing if both fire. */
    document.addEventListener('keydown', onGlobalKey, true);
    window.addEventListener('keydown', onGlobalKey, true);
    installTwoFingerSwipeDown();
    /* Sprint 3.2 Issue 4 — visible always-on entry point. Users on Chrome
     * report Cmd+K still triggers the browser's omnibox before our
     * preventDefault; a clickable pill removes the dependency entirely. */
    installSearchPill();
  }

  function installSearchPill() {
    if (document.getElementById('paletteOpenPill')) return;
    const pill = document.createElement('button');
    pill.id = 'paletteOpenPill';
    pill.type = 'button';
    pill.setAttribute('aria-label', 'Open command palette');
    pill.title = 'Search anywhere (⌘K / Ctrl+K)';
    const isMac = /Mac|iPad|iPhone|iPod/.test(navigator.platform);
    const kbd = isMac ? '⌘K' : 'Ctrl+K';
    pill.innerHTML =
      '<span class="pp-ic" aria-hidden="true">⌕</span>' +
      '<span class="pp-lbl">Search anywhere</span>' +
      '<span class="pp-kbd">' + kbd + '</span>';
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      open();
    });
    document.body.appendChild(pill);
  }

  function open() {
    if (!root) return;
    if (opened) { inputEl.select(); return; }
    opened = true;
    // Rebuild the index fresh on open so it reflects any in-session edits.
    if (window.SearchIndex && window.SearchIndex.rebuild) {
      Promise.resolve(window.SearchIndex.rebuild()).catch(() => {});
    }
    root.classList.add('on');
    root.setAttribute('aria-hidden', 'false');
    inputEl.value = '';
    selIdx = 0;
    renderResults('');
    requestAnimationFrame(() => { try { inputEl.focus(); } catch (e) {} });
  }
  function close() {
    if (!root) return;
    opened = false;
    root.classList.remove('on');
    root.setAttribute('aria-hidden', 'true');
    inputEl.blur();
  }
  function toggle() { opened ? close() : open(); }

  /* Defensive: track when we last handled the event so the dual document+
     window listeners don't both call toggle() back-to-back. */
  let lastHandledKeyTs = 0;
  function onGlobalKey(e) {
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
      // Suppress when typing in a textarea — they own Cmd+K for word delete on macOS.
      const t = document.activeElement;
      if (t && t.tagName === 'TEXTAREA') return;
      /* CRITICAL: call preventDefault BEFORE anything else so Chrome /
         Safari don't capture Cmd+K for the omnibox / Reader-search. The
         capture phase listener fires before bubble-phase, but the browser
         keyboard action is decided AFTER all in-page listeners — so
         preventDefault here actually does work. */
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      const now = Date.now();
      if (now - lastHandledKeyTs < 50) return; // de-dupe document+window double-fire
      lastHandledKeyTs = now;
      toggle();
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selIdx = Math.min(selIdx + 1, lastResults.length - 1);
      paintSelection();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selIdx = Math.max(selIdx - 1, 0);
      paintSelection();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      pick(selIdx, e.metaKey || e.ctrlKey);
      return;
    }
    // Cmd/Ctrl + 1..9 jumps to that result.
    if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      pick(parseInt(e.key, 10) - 1, false);
      return;
    }
  }

  function onInput() {
    selIdx = 0;
    renderResults(inputEl.value || '');
  }

  function renderResults(q) {
    let hits = [];
    try { hits = window.SearchIndex.search(q, { max: 30 }); } catch (e) { hits = []; }
    lastResults = hits;
    if (!hits.length) {
      resultsEl.innerHTML = '<div class="palette-empty">' +
        (q ? 'No matches.' : 'Type to search nodes, canvases, commands…') +
        '</div>';
      return;
    }
    // Group hits by kind.
    const grouped = {};
    for (const h of hits) (grouped[h.kind] || (grouped[h.kind] = [])).push(h);
    const ORDER = ['recent', 'node', 'canvas', 'workspace', 'command'];
    const HEAD = { recent: 'Recent', node: 'Nodes', canvas: 'Canvases', workspace: 'Workspaces', command: 'Commands' };
    let html = '';
    let runningIndex = 0;
    for (const kind of ORDER) {
      const list = grouped[kind];
      if (!list || !list.length) continue;
      html += '<div class="palette-res-head"><span>' + HEAD[kind] + '</span><span class="count">' + list.length + '</span></div>';
      for (const h of list) {
        const absIdx = runningIndex++;
        const isSel = absIdx === selIdx ? ' sel' : '';
        const kbd = absIdx < 9 ? '<span class="palette-kbd">⌘' + (absIdx + 1) + '</span>' : '';
        html += '<div class="palette-res' + isSel + '" data-i="' + absIdx + '" role="option">' +
          '<span class="palette-res-ic">' + kindGlyph(h.kind) + '</span>' +
          '<span class="palette-res-name">' + highlight(h.label, h.matches) + '</span>' +
          '<span class="palette-res-sub">' + escHtml(h.sub || '') + '</span>' +
          kbd +
        '</div>';
      }
    }
    resultsEl.innerHTML = html;
    resultsEl.querySelectorAll('.palette-res').forEach(row => {
      row.addEventListener('click', () => pick(parseInt(row.getAttribute('data-i'), 10), false));
      row.addEventListener('mouseenter', () => {
        selIdx = parseInt(row.getAttribute('data-i'), 10);
        paintSelection();
      });
    });
  }

  function paintSelection() {
    resultsEl.querySelectorAll('.palette-res').forEach(r => r.classList.remove('sel'));
    const r = resultsEl.querySelector('.palette-res[data-i="' + selIdx + '"]');
    if (r) {
      r.classList.add('sel');
      r.scrollIntoView({ block: 'nearest' });
    }
  }

  function pick(idx, openInNew) {
    const hit = lastResults[idx];
    if (!hit) return;
    close();
    try {
      hit.action(openInNew);
    } catch (e) {
      console.error('[ES palette] action threw:', e);
    }
  }

  function kindGlyph(kind) {
    switch (kind) {
      case 'node':      return '●';
      case 'canvas':    return '▤';
      case 'workspace': return '◇';
      case 'command':   return '⌘';
      case 'recent':    return '↺';
      default:          return '·';
    }
  }
  function highlight(label, matches) {
    if (!matches || !matches.length) return escHtml(label);
    const out = [];
    let last = 0;
    const set = new Set(matches);
    for (let i = 0; i < label.length; i++) {
      if (set.has(i)) {
        if (last < i) out.push(escHtml(label.slice(last, i)));
        // collect contiguous run
        let j = i;
        while (j < label.length && set.has(j)) j++;
        out.push('<mark>' + escHtml(label.slice(i, j)) + '</mark>');
        i = j - 1; last = j;
      }
    }
    if (last < label.length) out.push(escHtml(label.slice(last)));
    return out.join('');
  }
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Two-finger swipe-down to open the palette on iPad.
     Sprint 3.2 Issue 4 — was gated by `touchStartY < 200` (only swipes
     starting in the top 200px counted), which made it useless when the
     user swiped on the canvas body. Now: any starting position, but
     fingers must remain within 60px of each other horizontally (so an
     actual pinch-zoom doesn't get mistaken for a swipe). */
  function installTwoFingerSwipeDown() {
    let startMidY = null;
    let startSpread = null;
    let started2 = false;
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const a = e.touches[0], b = e.touches[1];
        startMidY = (a.clientY + b.clientY) / 2;
        startSpread = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        started2 = true;
      } else {
        started2 = false;
        startMidY = null;
      }
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
      if (!started2 || startMidY == null) return;
      if (e.touches.length > 0) return; // wait for all fingers up
      const c0 = e.changedTouches && e.changedTouches[0];
      const c1 = e.changedTouches && e.changedTouches[1];
      const ts = Array.from(e.changedTouches || []);
      if (ts.length < 1) { started2 = false; return; }
      // Compute end mid-Y and end spread from changedTouches; if only one
      // touch is in changedTouches, fall back to its Y.
      let endMidY, endSpread;
      if (ts.length >= 2) {
        endMidY   = (ts[0].clientY + ts[1].clientY) / 2;
        endSpread = Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
      } else {
        endMidY = ts[0].clientY;
        endSpread = startSpread;
      }
      const dy = endMidY - startMidY;
      const spreadDelta = Math.abs((endSpread || 0) - (startSpread || 0));
      // Real two-finger swipe-down: midpoint moved > 60 px down AND fingers
      // stayed close together (spread changed by < 60 px → not a pinch).
      if (dy > 60 && spreadDelta < 60) open();
      started2 = false;
      startMidY = null;
    }, { passive: true });
  }

  window.Palette = Object.freeze({ open, close, toggle });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
