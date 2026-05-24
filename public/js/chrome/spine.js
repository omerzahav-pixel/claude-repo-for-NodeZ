/* =============================================================================
 * EdgeSpace · Sprint 3 · Workspace spine (Pass 4 § 01).
 *
 * 56-px vertical strip on the leading-script edge. One round chip per
 * workspace (active gets a 3-px rail indicator). + chip at the bottom adds
 * a new workspace. Long-press on a chip shows the workspace name tooltip
 * (in addition to the chip-letter abbreviation always visible).
 *
 * Gated by Flags.on('nav-v2'). When OFF, this file installs nothing and
 * the old #wsSel <select> dropdown in the toolbar remains the only way
 * to switch workspaces.
 *
 * Existing #tabs bottom strip ALSO stays alive when --nav-v2 is on, per
 * the brief: "Bottom tab strip still works when flag is OFF... critical".
 * It's not a competitor; the user can have both for the first week.
 * ============================================================================= */

(function () {
  'use strict';

  let root = null;
  const STORAGE_COLOR_KEY = 'vault3-ws-colors';

  function boot() {
    if (!window.Flags || !window.Flags.on('nav-v2')) return;
    if (typeof window.listWorkspaces !== 'function') {
      // app.js hasn't finished loading. Retry once a frame.
      requestAnimationFrame(boot);
      return;
    }
    install();
  }

  function install() {
    root = document.createElement('aside');
    root.id = 'spine';
    root.setAttribute('aria-label', 'Workspaces');
    document.body.appendChild(root);
    // Add body class so the CSS layout-shift rules (#tb, #sb, #fl move
    // right to make room for the 280px spine+drawer column) activate.
    document.body.classList.add('nav-v2-on');
    /* Sprint 3.2 Issue 7 — event delegation on the spine root so the
       per-button listeners survive every re-render. (The previous
       direct-attach pattern recreated all listeners on each render; if
       a click landed during the brief window between innerHTML and
       re-attach, the event was lost.) */
    root.addEventListener('click', (e) => {
      const tgt = e.target && e.target.closest ? e.target.closest('[data-act],[data-ws]') : null;
      if (!tgt) return;
      const ws = tgt.getAttribute('data-ws');
      const act = tgt.getAttribute('data-act');
      if (ws && typeof window.switchWorkspace === 'function' && ws !== window.currentWs) {
        window.switchWorkspace(ws);
        return;
      }
      if (act === 'new-ws' && typeof window.newWorkspace === 'function') { window.newWorkspace(); return; }
      if (act === 'drawer-toggle' && window.Drawer && typeof window.Drawer.toggle === 'function') {
        window.Drawer.toggle();
        return;
      }
    });
    render();
    // Re-render when workspaces change. The existing app.js code doesn't
    // emit events; poll every 1s for cheap freshness, and re-render on
    // workspace switch via the global hook below.
    setInterval(refresh, 1500);
    // Hook: app.js calls rebuildWsDropdown() after every workspace mutation.
    // Patch that to also re-render us.
    if (typeof window.rebuildWsDropdown === 'function' && !window.rebuildWsDropdown.__spineHooked) {
      const orig = window.rebuildWsDropdown;
      const wrapped = async function () {
        const r = await orig.apply(this, arguments);
        try { await render(); } catch (e) {}
        try { window.Drawer && window.Drawer.refresh && window.Drawer.refresh(); } catch (e) {}
        return r;
      };
      wrapped.__spineHooked = true;
      window.rebuildWsDropdown = wrapped;
    }
    /* Sprint 3.2 Issue 2 — also wrap switchWorkspace so the drawer
       re-renders the instant the new workspace finishes loading, instead
       of waiting for the 1500ms poll. Without this, the user sees the
       drawer go empty for ~1.5s after every chip tap. */
    if (typeof window.switchWorkspace === 'function' && !window.switchWorkspace.__spineHooked) {
      const orig = window.switchWorkspace;
      const wrapped = async function () {
        const r = await orig.apply(this, arguments);
        try { await render(); } catch (e) {}
        try { window.Drawer && window.Drawer.refresh && window.Drawer.refresh(); } catch (e) {}
        return r;
      };
      wrapped.__spineHooked = true;
      window.switchWorkspace = wrapped;
    }
  }

  async function refresh() {
    if (root) await render();
  }

  function wsColorHex(name) {
    if (typeof window.wsColor === 'function') return window.wsColor(name);
    return '#FF7A45';
  }

  function chipLetter(name) {
    if (!name) return '?';
    // Two-char abbreviation: first letter + first letter after a separator.
    const parts = String(name).split(/[\s_\-.]+/).filter(Boolean);
    if (!parts.length) return name.slice(0, 2).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  async function render() {
    if (!root) return;
    let list = [];
    try { list = await window.listWorkspaces(); } catch (e) { list = []; }
    const cur = window.currentWs || 'workspace';
    const chips = list.map(ws => {
      const c = wsColorHex(ws);
      const letter = chipLetter(ws);
      const active = ws === cur ? ' active' : '';
      return '<button class="ws-chip' + active + '" data-ws="' + escAttr(ws) + '" style="background:' + escAttr(c) + ';color:' + textOn(c) + '" title="' + escAttr(ws) + '"><span>' + escHtml(letter) + '</span></button>';
    }).join('');
    root.innerHTML =
      '<div class="spine-top">' + chips + '</div>' +
      '<div class="spine-bot">' +
        '<button class="ws-chip add" data-act="new-ws" title="New workspace">+</button>' +
        '<button class="sb" data-act="drawer-toggle" aria-label="Toggle drawer" title="Toggle drawer">☰</button>' +
      '</div>';
    /* Sprint 3.2 Issue 7 — actions wired via root-level event delegation
       in install(); no per-render attach needed. */
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) { return escHtml(s).replace(/"/g, '&quot;'); }

  /* Sprint 3.2 Issue 2 — wsColor() returns HSL strings, not hex. The
     previous textOn() only parsed hex, fell through to white for HSL,
     and produced low-contrast white-on-yellow chips that the user
     couldn't read. Now we handle both. */
  function textOn(color) {
    if (!color) return '#fff';
    const s = String(color).trim();
    let r, g, b;
    // Try hsl(h, s%, l%) — we judge contrast off the lightness directly.
    const hsl = s.match(/^hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
    if (hsl) {
      const L = parseFloat(hsl[3]) / 100;
      return L > 0.55 ? '#1A0A04' : '#fff';
    }
    // Try #rgb / #rrggbb / rgb(...) / rgba(...).
    const hex = s.replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(hex)) {
      r = parseInt(hex[0] + hex[0], 16); g = parseInt(hex[1] + hex[1], 16); b = parseInt(hex[2] + hex[2], 16);
    } else if (/^[0-9a-f]{6}$/i.test(hex)) {
      r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16);
    } else {
      const rgb = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
      if (rgb) { r = +rgb[1]; g = +rgb[2]; b = +rgb[3]; }
      else return '#fff';
    }
    if (!isFinite(r)) return '#fff';
    const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return L > 0.55 ? '#1A0A04' : '#fff';
  }

  window.Spine = Object.freeze({ refresh });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
