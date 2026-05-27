/* =============================================================================
 * EdgeSpace · Phase 1 · Performance HUD (devtools)
 *
 * A small mono overlay top-right showing live FPS, dropped-frame count, and
 * average transform-commit time. The user needs this to verify on real iPad
 * that Phase 1's fixes are doing what they're supposed to do — without it
 * the gesture state machine + RAF throttle are claims, not measurements.
 *
 * Activation:
 *   - URL  ?debug=perf  (one-shot, no flag persistence needed)
 *   - Flag --perf-hud   (persistent via flags.js)
 *
 * Hidden by default. Zero cost when not active (no RAF loop installed).
 *
 * Inputs:
 *   - FPS: rAF interval since last frame, exponential moving average.
 *   - Dropped: count of frames where interval > 1.5 × budget (24ms @ 60fps).
 *   - Commit time: window.CanvasTransform.markCommit() pushes here.
 *   - Gesture state: read from window.GestureV2 when present.
 *
 * No effect on rendering. The HUD is its own `position: fixed` overlay outside
 * the canvas tree so it doesn't fight the transform layers.
 * ============================================================================= */

(function () {
  'use strict';

  function boot() {
    const flagOn = window.Flags && window.Flags.on('perf-hud');
    if (!flagOn) return;
    install();
  }

  function install() {
    if (document.getElementById('perfHud')) return;
    const root = document.createElement('div');
    root.id = 'perfHud';
    root.style.cssText = [
      'position:fixed',
      'top:8px',
      'right:8px',
      'z-index:99998',
      'background:rgba(8,9,12,0.82)',
      'color:#ECEEF1',
      'border:1px solid rgba(255,122,69,0.32)',
      'border-radius:6px',
      'padding:8px 12px',
      'font:11px/1.45 ui-monospace,Menlo,Consolas,monospace',
      'letter-spacing:0.02em',
      'pointer-events:none',
      '-webkit-user-select:none',
      'user-select:none',
      'min-width:180px',
      'box-shadow:0 4px 12px rgba(0,0,0,0.4)'
    ].join(';');
    root.innerHTML =
      '<div style="color:#FF7A45;font-weight:600;margin-bottom:4px">perf</div>' +
      '<div id="ph-fps">fps —</div>' +
      '<div id="ph-drop">drop —</div>' +
      '<div id="ph-commit">commit —</div>' +
      /* Sprint 3.5 Issue 4 — frame-budget warning. Counts commits that
         exceed 16 ms and shows a colored badge. Sustained > 33 % rate
         in the rolling window means the canvas is too dense for the
         current substrate — this is the signal Phase 4 (Canvas Tile
         Cache) will baseline against. */
      '<div id="ph-budget">budget —</div>' +
      '<div id="ph-state">state —</div>' +
      '<div id="ph-mem" style="margin-top:4px;color:#7C828E"></div>';
    document.body.appendChild(root);

    const fpsEl    = root.querySelector('#ph-fps');
    const dropEl   = root.querySelector('#ph-drop');
    const commitEl = root.querySelector('#ph-commit');
    const budgetEl = root.querySelector('#ph-budget');
    const stateEl  = root.querySelector('#ph-state');
    const memEl    = root.querySelector('#ph-mem');

    let lastTs = performance.now();
    let emaFps = 60;             // exponential moving average of fps
    let droppedFrames = 0;       // total since boot
    let commitSamples = [];      // recent commit times for rolling avg
    const COMMIT_WINDOW = 60;    // ≈ 1s at 60fps
    const FRAME_BUDGET_MS = 16.7;
    const DROP_THRESHOLD = FRAME_BUDGET_MS * 1.5;

    function tick(now) {
      const dt = now - lastTs;
      lastTs = now;
      // Update FPS EMA. Skip the very first frame (dt is huge).
      const inst = 1000 / Math.max(dt, 0.1);
      emaFps = emaFps * 0.92 + inst * 0.08;
      if (dt > DROP_THRESHOLD) droppedFrames++;

      // Render the HUD ~ every 6 frames (10 Hz update — readable without flicker).
      if ((tickCount++ % 6) === 0) {
        fpsEl.textContent    = 'fps    ' + emaFps.toFixed(1).padStart(5);
        dropEl.textContent   = 'drop  ' + String(droppedFrames).padStart(6);
        // Rolling commit avg
        if (commitSamples.length) {
          const sum = commitSamples.reduce((a,b)=>a+b, 0);
          const avg = sum / commitSamples.length;
          commitEl.textContent = 'commit ' + avg.toFixed(2).padStart(5) + 'ms';
          /* Sprint 3.5 Issue 4 — budget bar. Show the over-budget rate
             as a percentage with a color cue:
               < 10 %  green   (canvas comfortable for current substrate)
              10-33 %  amber   (intermittent stutter under heavy gestures)
               > 33 %  red     (canvas too dense; Phase 4 tile cache needed) */
          const over = commitSamples.filter(s => s > FRAME_BUDGET_MS).length;
          const rate = over / commitSamples.length;
          const pct  = (rate * 100).toFixed(0).padStart(3);
          let color = '#4FD18B';
          if (rate >= 0.33) color = '#F87171';
          else if (rate >= 0.10) color = '#F2C462';
          budgetEl.innerHTML = 'budget <span style="color:' + color + '">' + pct + '%</span> over 16ms';
        }
        const gs = window.GestureV2 ? window.GestureV2.getState() : '—';
        stateEl.textContent  = 'state  ' + gs.padStart(7);
        // Memory (Chrome / Edge only — Safari hides it)
        if (performance && performance.memory) {
          const used = performance.memory.usedJSHeapSize / 1024 / 1024;
          memEl.textContent = 'heap   ' + used.toFixed(1) + ' MB';
        }
      }

      requestAnimationFrame(tick);
    }
    let tickCount = 0;
    requestAnimationFrame(tick);

    /** Called from transform.js after each render commit. */
    function markCommit(ms) {
      commitSamples.push(ms);
      if (commitSamples.length > COMMIT_WINDOW) commitSamples.shift();
    }

    window.PerfHud = Object.freeze({
      markCommit,
      reset: function () { droppedFrames = 0; commitSamples = []; },
      hide: function () { root.style.display = 'none'; },
      show: function () { root.style.display = 'block'; }
    });

    console.log('[EdgeSpace] Perf HUD installed · activate via ?debug=perf');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
