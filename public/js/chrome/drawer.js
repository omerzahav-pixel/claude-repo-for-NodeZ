/* =============================================================================
 * EdgeSpace · Sprint 3 · Canvas-tree drawer (Pass 4 § 01).
 *
 * 224-px wide column next to the spine. Shows the current workspace's
 * canvases as a tree with caret-expand. Child-status dots on the leading
 * edge of each row, child-count badges on the trailing side. An "Orphans"
 * section at the bottom collects canvases without a valid parent.
 *
 * Collapsible: a toggle reduces the drawer to icon-only width (40px). The
 * collapsed state persists in localStorage.
 *
 * Gated by Flags.on('nav-v2'). When OFF, this file installs nothing.
 * ============================================================================= */

(function () {
  'use strict';

  const STATE_KEY = 'edgespace-drawer-collapsed';
  const TREE_OPEN_KEY = 'edgespace-drawer-tree-open';
  let root = null;
  let collapsed = false;
  let openIds = new Set();

  function boot() {
    if (!window.Flags || !window.Flags.on('nav-v2')) return;
    if (typeof window.__E2E === 'undefined' || typeof window.S === 'undefined' && typeof window.switchTo !== 'function') {
      requestAnimationFrame(boot);
      return;
    }
    try { collapsed = localStorage.getItem(STATE_KEY) === '1'; } catch (e) {}
    try {
      const raw = localStorage.getItem(TREE_OPEN_KEY);
      if (raw) openIds = new Set(JSON.parse(raw));
    } catch (e) {}
    install();
  }

  function install() {
    root = document.createElement('aside');
    root.id = 'drawer';
    root.setAttribute('aria-label', 'Canvas tree');
    if (collapsed) root.classList.add('collapsed');
    document.body.appendChild(root);
    syncBodyClass();
    render();
    setInterval(refresh, 1500);
    // Patch the existing renderTabs so the drawer re-renders when tabs change.
    if (typeof window.renderTabs === 'function' && !window.renderTabs.__drawerHooked) {
      const orig = window.renderTabs;
      const wrapped = function () {
        const r = orig.apply(this, arguments);
        try { render(); } catch (e) {}
        return r;
      };
      wrapped.__drawerHooked = true;
      window.renderTabs = wrapped;
    }
  }

  async function refresh() { if (root) render(); }

  function getCanvases() {
    const E = window.__E2E;
    if (!E) return { meta: {}, byId: {}, current: 'vault' };
    const S = E.state();
    return {
      meta: S.canvasMeta || {},
      byId: S.canvases || {},
      current: S.current || 'vault'
    };
  }

  function nodeCount(id) {
    const E = window.__E2E;
    const c = E.state().canvases[id];
    return c?.nodes?.length || 0;
  }

  function buildTree() {
    const { meta, byId, current } = getCanvases();
    const allIds = Object.keys(byId);
    const children = {};
    const orphans = [];
    for (const id of allIds) {
      if (id === 'vault') continue;
      const pc = meta[id]?.parentCanvas;
      if (pc && byId[pc]) {
        (children[pc] || (children[pc] = [])).push(id);
      } else {
        orphans.push(id);
      }
    }
    return { meta, byId, current, children, orphans };
  }

  function descendantCount(id, children) {
    const stack = [id];
    let n = 0;
    while (stack.length) {
      const c = stack.pop();
      const k = children[c] || [];
      for (const kid of k) { n++; stack.push(kid); }
    }
    return n;
  }

  function render() {
    if (!root) return;
    if (collapsed) {
      root.innerHTML =
        '<button class="dr-toggle" data-act="expand" aria-label="Expand drawer" title="Expand">▶</button>';
      root.querySelector('[data-act="expand"]').onclick = toggle;
      return;
    }
    const tree = buildTree();
    const wsName = window.currentWs || 'workspace';
    const totalNodes = Object.values(tree.byId).reduce((n, c) => n + (c.nodes?.length || 0), 0);
    let html =
      '<div class="dr-head">' +
        '<div class="ws-name"><span class="dot" style="background:' + escAttr(wsColorHex(wsName)) + '"></span><span>' + escHtml(wsName) + '</span></div>' +
        '<div class="ws-count">' + totalNodes + ' nodes</div>' +
        '<button class="dr-toggle" data-act="collapse" aria-label="Collapse drawer" title="Collapse">◀</button>' +
      '</div>';
    /* Sprint 3.2 Issue 3 — explicit "Canvases" header so users understand
       the rows below are canvases (not nodes in the current canvas). */
    html += '<div class="dr-section-head"><span>Canvases</span><span class="ws-count">' + Object.keys(tree.byId).length + '</span></div>';
    html += '<div class="dr-tree">';
    // Render the vault first (it's the canonical root).
    html += renderNode('vault', tree, 0);
    // Then any direct vault-children that are at vault root.
    const vaultChildren = tree.children['vault'] || [];
    for (const id of vaultChildren) html += renderNode(id, tree, 1);
    html += '</div>';
    // Orphans section.
    if (tree.orphans.length) {
      html += '<div class="dr-section-head"><span>Orphans</span><span class="ws-count">' + tree.orphans.length + '</span></div>';
      html += '<div class="dr-tree dr-orphans">';
      for (const id of tree.orphans) html += renderNode(id, tree, 0);
      html += '</div>';
    }
    root.innerHTML = html;
    wireActions(tree);
  }

  function renderNode(id, tree, indent) {
    const { meta, current, children } = tree;
    const name = meta[id]?.name || id;
    const kids = children[id] || [];
    const isOpen = openIds.has(id) || id === 'vault';
    const isActive = id === current;
    const cnt = nodeCount(id);
    const descCnt = descendantCount(id, children);
    const caret = kids.length ? ('<span class="caret">' + (isOpen ? '▾' : '▸') + '</span>') : '<span class="caret">&nbsp;</span>';
    const statusDot = '<span class="child-dot" style="background:' + escAttr(wsColorHex(name)) + '"></span>';
    const badge = descCnt ? '<span class="count">' + descCnt + '</span>' : (cnt ? '<span class="count">' + cnt + '</span>' : '');
    let out = '<div class="dr-row' + (isActive ? ' active' : '') + '" data-id="' + escAttr(id) + '" style="padding-inline-start:' + (indent * 14 + 6) + 'px">' +
      caret + statusDot + '<span class="dr-name">' + escHtml(name) + '</span>' + badge + '</div>';
    if (isOpen && kids.length) {
      for (const kid of kids) out += renderNode(kid, tree, indent + 1);
    }
    return out;
  }

  function wireActions(tree) {
    root.querySelector('[data-act="collapse"]')?.addEventListener('click', toggle);
    root.querySelectorAll('.dr-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const id = row.getAttribute('data-id');
        if (!id) return;
        // Tap on caret toggles the children; tap on name navigates.
        if (e.target.classList && e.target.classList.contains('caret')) {
          if (openIds.has(id)) openIds.delete(id); else openIds.add(id);
          try { localStorage.setItem(TREE_OPEN_KEY, JSON.stringify(Array.from(openIds))); } catch (e) {}
          render();
        } else if (typeof window.switchTo === 'function') {
          window.switchTo(id);
        }
      });
      /* Sprint 3.2 Issue 5 — context menu on drawer rows: right-click on
         desktop, long-press on iPad. Shows actions for the canvas. */
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showRowMenu(row.getAttribute('data-id'), e.clientX, e.clientY);
      });
      let lpTimer = null;
      row.addEventListener('touchstart', () => {
        const id = row.getAttribute('data-id');
        const r = row.getBoundingClientRect();
        lpTimer = setTimeout(() => showRowMenu(id, r.left + r.width / 2, r.bottom), 500);
      }, { passive: true });
      const cancel = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
      row.addEventListener('touchend', cancel);
      row.addEventListener('touchmove', cancel);
      row.addEventListener('touchcancel', cancel);
    });
  }

  /* Sprint 3.2 Issue 5 — tiny ad-hoc context menu (no dependency on the
     existing #ctx menu, which is canvas-coord aware). */
  let menuEl = null;
  function showRowMenu(canvasId, x, y) {
    closeRowMenu();
    if (!canvasId) return;
    const isDefault = typeof window.getDefaultCanvasForWorkspace === 'function'
      && window.getDefaultCanvasForWorkspace() === canvasId;
    menuEl = document.createElement('div');
    menuEl.id = 'drawerRowMenu';
    menuEl.setAttribute('role', 'menu');
    menuEl.innerHTML =
      '<button data-act="set-default">' +
        (isDefault ? '✓ Default for this workspace' : 'Set as default for this workspace') +
      '</button>' +
      (isDefault
        ? '<button data-act="clear-default">Clear default</button>'
        : '');
    document.body.appendChild(menuEl);
    // Position; clamp inside viewport.
    const w = 240, h = isDefault ? 60 : 32;
    const left = Math.min(x, window.innerWidth - w - 8);
    const top  = Math.min(y, window.innerHeight - h - 8);
    menuEl.style.cssText =
      'position:fixed;z-index:300;background:var(--srf-3,#1F242E);' +
      'border:1px solid var(--line-3,#3A3F4A);border-radius:8px;' +
      'box-shadow:0 6px 16px rgba(0,0,0,0.55);padding:4px;' +
      'min-width:' + w + 'px;font-family:var(--font-sans,Inter);font-size:12.5px;' +
      'left:' + left + 'px;top:' + top + 'px';
    menuEl.querySelector('[data-act="set-default"]')?.addEventListener('click', () => {
      if (typeof window.setDefaultCanvasForWorkspace === 'function') {
        window.setDefaultCanvasForWorkspace(canvasId);
      }
      closeRowMenu();
      render();
    });
    menuEl.querySelector('[data-act="clear-default"]')?.addEventListener('click', () => {
      if (typeof window.clearDefaultCanvasForWorkspace === 'function') {
        window.clearDefaultCanvasForWorkspace();
      }
      closeRowMenu();
      render();
    });
    // Auto-dismiss on outside click / escape.
    setTimeout(() => {
      document.addEventListener('click', closeRowMenu, { once: true, capture: true });
      document.addEventListener('keydown', escClose, { once: true });
    }, 0);
  }
  function escClose(e) { if (e.key === 'Escape') closeRowMenu(); }
  function closeRowMenu() { if (menuEl) { try { menuEl.remove(); } catch (e) {} menuEl = null; } }

  function toggle() {
    collapsed = !collapsed;
    try { localStorage.setItem(STATE_KEY, collapsed ? '1' : '0'); } catch (e) {}
    root.classList.toggle('collapsed', collapsed);
    syncBodyClass();
    render();
  }
  function syncBodyClass() {
    document.body.classList.toggle('drawer-collapsed', collapsed);
  }

  function wsColorHex(name) {
    if (typeof window.wsColor === 'function') return window.wsColor(name);
    return '#FF7A45';
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) { return escHtml(s).replace(/"/g, '&quot;'); }

  window.Drawer = Object.freeze({ refresh, toggle });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
