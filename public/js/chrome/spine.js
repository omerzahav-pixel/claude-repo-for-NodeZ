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
      /* Sprint 3.3 Issue 7 — gear chip opens the Tools panel. */
      if (act === 'tools-toggle' && window.ToolsPanel && typeof window.ToolsPanel.toggle === 'function') {
        window.ToolsPanel.toggle();
        return;
      }
      /* Sprint 3.4 Issue 4 — promoted chip actions. */
      if (act === 'search') {
        if (window.Palette && typeof window.Palette.open === 'function') window.Palette.open();
        return;
      }
      if (act === 'undo') {
        // Hard-block the click if the chip is in disabled state (defensive
        // — CSS pointer-events:none on .disabled handles most of this, but
        // a tap on the icon glyph could still bubble). Otherwise call un().
        if (tgt.classList && tgt.classList.contains('disabled')) return;
        if (typeof window.un === 'function') window.un();
        return;
      }
      if (act === 'lang') {
        if (typeof window.toggleHebrew === 'function') window.toggleHebrew();
        return;
      }
      // 'import' is a <label for="imp"> — browser opens file picker automatically.
      if (act === 'import') return;
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
    /* Sprint 3.4 Issue 4 — wrap bB() so the spine's Undo chip syncs its
       disabled state every time app.js updates #undoBtn. Cheap: just
       toggles a class, no re-render. */
    if (typeof window.bB === 'function' && !window.bB.__spineHooked) {
      const orig = window.bB;
      const wrapped = function () {
        const r = orig.apply(this, arguments);
        try { syncUndoChip(); } catch (e) {}
        return r;
      };
      wrapped.__spineHooked = true;
      window.bB = wrapped;
    }
  }

  function syncUndoChip() {
    if (!root) return;
    const chip = root.querySelector('[data-act="undo"]');
    if (!chip) return;
    const disabled = !!document.getElementById('undoBtn')?.disabled;
    chip.classList.toggle('disabled', disabled);
    if (disabled) chip.setAttribute('disabled', '');
    else chip.removeAttribute('disabled');
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
    /* Sprint 3.4 Issue 4 — promoted chips above the gear. Bottom-up order:
         +  add workspace
         ⚙  Options / Tools panel
         א/A  Lang toggle
         ⤓  Import workspace (opens file picker via <label for="imp">)
         ↶  Undo (disabled when hist stack is empty)
         ⌕  Search (migrated from #paletteOpenPill — opens palette)
         ☰  Drawer toggle
       Workspace chips stack above this in `.spine-top`.

       Undo disabled state is derived from #undoBtn.disabled (set by
       app.js bB() after every undo / sn() / re()). When disabled, the
       chip has class "disabled" → CSS dims + blocks pointer events. */
    const undoDisabled = !!document.getElementById('undoBtn')?.disabled;
    root.innerHTML =
      '<div class="spine-top">' + chips + '</div>' +
      '<div class="spine-bot">' +
        '<button class="sb" data-act="drawer-toggle" aria-label="Toggle drawer" title="Toggle drawer">☰</button>' +
        '<button class="sb" data-act="search" aria-label="Search anywhere" title="Search anywhere (⌘K / Ctrl+K)">⌕</button>' +
        '<button class="sb' + (undoDisabled ? ' disabled' : '') + '" data-act="undo" aria-label="Undo" title="Undo (Ctrl+Z)"' + (undoDisabled ? ' disabled' : '') + '>↶</button>' +
        '<label class="sb" data-act="import" for="imp" aria-label="Import workspace" title="Import workspace (JSON)">⤓</label>' +
        '<button class="sb" data-act="lang" aria-label="Toggle Hebrew" title="Toggle Hebrew (RTL)">א/A</button>' +
        '<button class="sb tools" data-act="tools-toggle" aria-label="Tools" title="More tools (Export · Add zone · Add node · More)">⚙</button>' +
        '<button class="ws-chip add" data-act="new-ws" title="New workspace">+</button>' +
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
