/* =============================================================================
 * EdgeSpace · Phase 1 · Performance HUD (devtools)
 *
 * A small mono overlay showing live FPS, dropped-frame count, average
 * commit time, frame-budget rate, and worst recent frame. The user reads
 * this on real iPad to verify Phase 1 fixes + scope Phase 4.
 *
 * Sprint 3.6 Issue 4 — rewritten. The previous version relied on the v2
 * CanvasTransform `markCommit` callback for its budget metric, but that
 * callback only fires when the v2 transform path is active. Legacy
 * render paths (and the old-app.js drag fast-path) never called it,
 * leaving budget pinned at 0% no matter how badly the user felt the
 * stutter. The new version self-measures from inside the rAF tick:
 *   · frame interval = time between two consecutive rAF callbacks
 *   · "active" = gesture state is pan / pinch / inertia
 *   · over-budget = frame interval > 16.7 ms WHILE active
 *
 * Activation:
 *   - URL  ?debug=perf  (one-shot, no flag persistence needed)
 *   - Flag --perf-hud   (persistent via flags.js)
 *
 * Hidden by default. Zero cost when not active (no rAF loop installed).
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
      'background:rgba(8,9,12,0.88)',
      'color:#ECEEF1',
      'border:1px solid rgba(255,122,69,0.32)',
      'border-radius:6px',
      'padding:8px 12px',
      'font:11px/1.45 ui-monospace,Menlo,Consolas,monospace',
      'letter-spacing:0.02em',
      'pointer-events:none',
      '-webkit-user-select:none',
      'user-select:none',
      'min-width:200px',
      'box-shadow:0 4px 12px rgba(0,0,0,0.4)'
    ].join(';');
    root.innerHTML =
      '<div style="color:#FF7A45;font-weight:600;margin-bottom:4px">perf</div>' +
      '<div id="ph-fps">fps —</div>' +
      '<div id="ph-worst">worst —</div>' +
      '<div id="ph-budget">budget —</div>' +
      '<div id="ph-commit">commit —</div>' +
      '<div id="ph-state">state —</div>' +
      '<div id="ph-mem" style="margin-top:4px;color:#7C828E"></div>';
    document.body.appendChild(root);

    const fpsEl    = root.querySelector('#ph-fps');
    const worstEl  = root.querySelector('#ph-worst');
    const budgetEl = root.querySelector('#ph-budget');
    const commitEl = root.querySelector('#ph-commit');
    const stateEl  = root.querySelector('#ph-state');
    const memEl    = root.querySelector('#ph-mem');

    const FRAME_BUDGET_MS = 16.7;
    /* Active-frame ring buffer. Each entry is the frame interval (ms)
       between two consecutive rAF callbacks while the gesture state was
       pan / pinch / inertia (i.e. the user was driving the canvas).
       2-second window at 60 fps = 120 entries. */
    const ACTIVE_WINDOW = 120;
    const activeFrames = [];      // frame intervals while active
    let activeFps = 60;            // EMA fps over active frames only

    /* Idle frames are sampled too, just for the "fps when not gesturing"
       baseline and to keep the smoothing reasonable. They DO NOT
       contribute to the budget or worst-frame metrics. */
    let lastTs = performance.now();
    let lastActiveTs = 0;           // ts of the last active frame, for window decay
    let commitSamples = [];         // recent commit times for rolling avg
    const COMMIT_WINDOW = 60;
    /* Sprint 3.6 — also track an idle-baseline fps EMA so the HUD shows
       a non-empty fps line even when the user isn't gesturing. This is
       what the existing test 1.4.2 checks. */
    let idleFps = 60;

    function isActive() {
      try {
        if (window.GestureV2 && typeof window.GestureV2.getState === 'function') {
          const s = window.GestureV2.getState();
          if (s === 'pan' || s === 'pinch' || s === 'inertia') return true;
        }
        /* Legacy app.js path: body.dragging or body.holding indicates an
           in-flight drag. */
        if (document.body.classList.contains('dragging')) return true;
        if (document.body.classList.contains('holding')) return true;
      } catch (e) {}
      return false;
    }

    function tick(now) {
      const dt = now - lastTs;
      lastTs = now;
      if (dt > 0.1 && dt < 1000) {
        /* Always update the idle-baseline fps EMA. */
        const inst = 1000 / dt;
        idleFps = idleFps * 0.92 + inst * 0.08;
        if (isActive()) {
          activeFrames.push(dt);
          if (activeFrames.length > ACTIVE_WINDOW) activeFrames.shift();
          lastActiveTs = now;
          activeFps = activeFps * 0.85 + inst * 0.15;
        }
      }

      /* Render the HUD ~ 10 Hz. */
      if ((tickCount++ % 6) === 0) {
        /* If no active samples in the last 3 seconds, decay the active
           buffer so the HUD doesn't keep showing stale stutter numbers
           after the user has stopped moving. */
        if (lastActiveTs && (now - lastActiveTs > 3000) && activeFrames.length > 0) {
          activeFrames.shift();
        }

        if (activeFrames.length > 5) {
          /* fps over the active window */
          fpsEl.textContent = 'fps    ' + activeFps.toFixed(1).padStart(5);
          /* worst frame */
          let worst = 0;
          for (const f of activeFrames) if (f > worst) worst = f;
          let wColor = '#4FD18B';
          if (worst > 50) wColor = '#F87171';
          else if (worst > 25) wColor = '#F2C462';
          worstEl.innerHTML = 'worst  <span style="color:' + wColor + '">' +
            worst.toFixed(0).padStart(4) + 'ms</span>';
          /* budget %: fraction of active frames exceeding 16.7 ms */
          const over = activeFrames.filter(f => f > FRAME_BUDGET_MS).length;
          const rate = over / activeFrames.length;
          const pct  = (rate * 100).toFixed(0).padStart(3);
          let bColor = '#4FD18B';
          if (rate >= 0.33) bColor = '#F87171';
          else if (rate >= 0.10) bColor = '#F2C462';
          budgetEl.innerHTML = 'budget <span style="color:' + bColor + '">' +
            pct + '%</span> over 16ms';
        } else {
          /* Idle baseline fps — keeps the fps line populated when the
             user isn't gesturing (rendering is at rest). worst + budget
             are meaningless without active samples, so hold them at —. */
          fpsEl.textContent    = 'fps    ' + idleFps.toFixed(1).padStart(5);
          worstEl.textContent  = 'worst  — (idle)';
          budgetEl.textContent = 'budget — (idle)';
        }

        if (commitSamples.length) {
          const sum = commitSamples.reduce((a, b) => a + b, 0);
          const avg = sum / commitSamples.length;
          commitEl.textContent = 'commit ' + avg.toFixed(2).padStart(5) + 'ms';
        } else {
          commitEl.textContent = 'commit — (legacy path)';
        }

        const gs = window.GestureV2 ? window.GestureV2.getState() : '—';
        stateEl.textContent  = 'state  ' + String(gs).padStart(7);
        if (performance && performance.memory) {
          const used = performance.memory.usedJSHeapSize / 1024 / 1024;
          memEl.textContent = 'heap   ' + used.toFixed(1) + ' MB';
        }
      }

      requestAnimationFrame(tick);
    }
    let tickCount = 0;
    requestAnimationFrame(tick);

    /** Called from transform.js after each render commit (v2 path only). */
    function markCommit(ms) {
      commitSamples.push(ms);
      if (commitSamples.length > COMMIT_WINDOW) commitSamples.shift();
    }

    window.PerfHud = Object.freeze({
      markCommit,
      reset: function () {
        activeFrames.length = 0;
        commitSamples.length = 0;
      },
      hide: function () { root.style.display = 'none'; },
      show: function () { root.style.display = 'block'; },
      /* Sprint 3.6 — exposed for tests. */
      snapshot: function () {
        return {
          activeFrames: activeFrames.slice(),
          activeFps: activeFps,
          worst: activeFrames.length ? Math.max(...activeFrames) : 0,
          budgetRate: activeFrames.length
            ? activeFrames.filter(f => f > FRAME_BUDGET_MS).length / activeFrames.length
            : 0
        };
      }
    });

    console.log('[EdgeSpace] Perf HUD v2 installed · ?debug=perf or --perf-hud');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
