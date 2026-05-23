/* =============================================================================
 * EdgeSpace · Phase 2 · One-script-per-line editor enforcement
 * (Pass 3+ RTL Addendum § 07).
 *
 * Hebrew and Latin runs are visually painful when they share a single
 * line — the bidi reorder pulls a tiny English fragment into a Hebrew
 * paragraph and produces caret jumps, wrong-side punctuation, ambiguous
 * cursor positions. The enforced rule: at most ONE script per line.
 *
 * Detection trigger: when the user types a character that crosses a
 * script boundary within the current line, insert a soft `\n` at the
 * boundary so the new run starts on its own line. The opposite-script
 * character that triggered the break stays in the buffer — only the line
 * break is inserted.
 *
 * UX: first-time tooltip "Hebrew and Latin on separate lines — undo
 * with ⌘Z." Stored in localStorage so it only shows once. Settings
 * toggle: `auto-break at script boundary` (default ON, persisted under
 * `edgespace-auto-break`).
 *
 * Gated by Flags.on('rtl-v2'). When OFF this file installs nothing.
 *
 * Hooks: <textarea> + <input type="text"> inside #pn (property panel)
 * and #dlg (custom dialog). Each gets a single `input` listener that
 * detects the cursor's script context and inserts breaks as needed.
 *
 * Detection: scan the current line BEFORE the caret. If it contains a
 * Hebrew character, the line's script is "he". If it contains a Latin
 * letter, the line's script is "la". The character just typed (right
 * before the caret) determines the incoming script. Mismatch + line
 * already has visible content → break.
 * ============================================================================= */

(function () {
  'use strict';

  const STORE_TIP = 'edgespace-rtl-tip-shown';
  const STORE_OPT = 'edgespace-auto-break';   // 'off' to disable

  // Hebrew range U+0590-U+05FF. Includes nikud + cantillation.
  function scriptOf(ch) {
    if (!ch) return null;
    const c = ch.charCodeAt(0);
    if (c >= 0x0590 && c <= 0x05FF) return 'he';
    if ((c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)) return 'la';
    return null;
  }

  function autoBreakEnabled() {
    try { return localStorage.getItem(STORE_OPT) !== 'off'; }
    catch (e) { return true; }
  }
  function setAutoBreakEnabled(on) {
    try { localStorage.setItem(STORE_OPT, on ? 'on' : 'off'); } catch (e) {}
  }

  function showTipOnce() {
    try { if (localStorage.getItem(STORE_TIP) === '1') return; } catch (e) {}
    try { localStorage.setItem(STORE_TIP, '1'); } catch (e) {}
    const text = 'Hebrew and Latin on separate lines — undo with ⌘Z.';
    if (typeof window.toast === 'function') {
      window.toast(text, { ms: 4000 });
      return;
    }
    /* Phase 2.5 Issue 7 — toast fallback. window.toast may not be defined
       on early boot, on test pages, or under future build splits. Ship a
       self-contained bottom-centre pill so the one-time tip always shows. */
    const pill = document.createElement('div');
    pill.textContent = text;
    pill.setAttribute('role', 'status');
    pill.style.cssText = [
      'position:fixed',
      'inset-inline-start:50%',
      'bottom:64px',
      'transform:translateX(-50%) translateY(8px)',
      'z-index:99999',
      'background:var(--srf-3,#1E232B)',
      'color:var(--ink,#ECEEF1)',
      'border:1px solid var(--line-2,rgba(255,255,255,0.10))',
      'border-radius:8px',
      'padding:8px 14px',
      'font:500 12px/1.4 var(--font-sans,Inter),system-ui,sans-serif',
      'box-shadow:0 4px 12px rgba(0,0,0,0.4)',
      'opacity:0',
      'transition:opacity 200ms ease-out, transform 200ms ease-out',
      'pointer-events:none',
      '-webkit-user-select:none',
      'user-select:none',
      'max-width:90vw',
      'white-space:nowrap',
      'overflow:hidden',
      'text-overflow:ellipsis'
    ].join(';');
    document.body.appendChild(pill);
    requestAnimationFrame(() => {
      pill.style.opacity = '1';
      pill.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(() => {
      pill.style.opacity = '0';
      pill.style.transform = 'translateX(-50%) translateY(8px)';
      setTimeout(() => pill.remove(), 250);
    }, 4000);
  }

  function handleInput(ev) {
    if (!autoBreakEnabled()) return;
    const el = ev.target;
    if (!el || (el.tagName !== 'TEXTAREA' && (el.tagName !== 'INPUT' || el.type !== 'text'))) return;
    // Caret position is where typing landed.
    const caret = el.selectionStart;
    if (caret == null) return;
    const value = el.value;
    if (!value) return;
    const justTyped = value.charAt(caret - 1);
    const incoming = scriptOf(justTyped);
    if (!incoming) return;
    // Find the start of the current line.
    const lineStart = value.lastIndexOf('\n', caret - 2) + 1;
    const linePre = value.slice(lineStart, caret - 1);
    // What script characters does the line already contain (before this char)?
    let lineScript = null;
    for (let i = 0; i < linePre.length; i++) {
      const s = scriptOf(linePre.charAt(i));
      if (s) { lineScript = s; break; }
    }
    if (!lineScript || lineScript === incoming) return;
    // Mismatch — insert a newline BEFORE the just-typed char.
    const before = value.slice(0, caret - 1);
    const after  = value.slice(caret - 1); // includes the newly typed char
    el.value = before + '\n' + after;
    // Restore caret AFTER the newly typed char (now one position right).
    const newCaret = caret + 1;
    try { el.setSelectionRange(newCaret, newCaret); } catch (e) {}
    showTipOnce();
    // Dispatch a synthetic input event so app.js's autosave + render see
    // the new value. Use 'input' with `inputType:'insertText'`-like data
    // (a no-op trigger).
    el.dispatchEvent(new Event('input', { bubbles: true }));
    // Cancel the original event so app.js's listener doesn't fire twice
    // on the same change (we just dispatched a fresh one).
    ev.stopImmediatePropagation && ev.stopImmediatePropagation();
  }

  function boot() {
    if (!window.Flags || !window.Flags.on('rtl-v2')) return;
    // Capture phase so we run before app.js's per-field input handlers.
    document.addEventListener('input', handleInput, true);
    window.RtlAutoBreak = Object.freeze({
      enabled:  autoBreakEnabled,
      setEnabled: setAutoBreakEnabled,
      scriptOf
    });
    console.log('[EdgeSpace] RTL v2 auto-break installed · enabled=' + autoBreakEnabled());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
