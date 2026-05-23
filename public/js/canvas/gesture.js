/* =============================================================================
 * EdgeSpace · Phase 1 · Gesture state machine (Pass 5 §04)
 *
 *   States:  IDLE → PAN → INERTIA → IDLE
 *            IDLE → PINCH → IDLE
 *            IDLE → HOLD → IDLE
 *            INERTIA → PINCH   ← the load-bearing transition (P5.1 fix)
 *
 * One state owns the transform at any time. State transitions are atomic:
 *   - cancel the previous state's RAF
 *   - zero the previous state's residual velocity
 *   - consume the input event that triggered the transition
 *
 * The INERTIA → PINCH transition is the pan-then-zoom teleport fix. When the
 * pinch starts with inertia still decaying, we cancel the inertia RAF AND
 * zero velocity in the same synchronous tick, then read the pinch baseline
 * from the *post-cancel* transform — never a stale snapshot.
 *
 * Gated by Flags.on('gestures-v2'). When OFF this file installs nothing and
 * the existing pointer handlers in app.js continue to own the gestures.
 *
 * Substrate: writes through window.CanvasTransform (Phase 1 transform.js).
 * Phase 1 still uses the SVG-viewBox render path; the 3-layer substrate from
 * §03 lands in a later phase.
 * ============================================================================= */

(function () {
  'use strict';

  // Defer setup until DOM + Flags + CanvasTransform + the canvas element exist.
  function boot() {
    if (!window.Flags) return; // flags.js missing — bail silently
    if (!window.Flags.on('gestures-v2')) return; // flag OFF, old path keeps owning

    const cv = document.getElementById('cv');
    if (!cv) {
      // app.js may not have created #cv yet; retry once after a frame.
      requestAnimationFrame(boot);
      return;
    }
    if (!window.CanvasTransform) {
      console.warn('[EdgeSpace gesture] CanvasTransform missing — load order bug');
      return;
    }

    install(cv);
  }

  function install(cv) {
    // -- State ----------------------------------------------------------------
    /** @type {'idle'|'pan'|'inertia'|'pinch'|'hold'} */
    let state = 'idle';
    let rafInertia = null;
    let rafHold    = null;

    // velocity is the per-frame delta to apply during inertia, in CSS px / frame
    let vel = { x: 0, y: 0 };
    // recent samples for swipe-velocity computation at touchend
    let lastSampleX = 0, lastSampleY = 0, lastSampleT = 0;
    let prevSampleX = 0, prevSampleY = 0, prevSampleT = 0;

    // pan accumulator (paired with --raf-throttle)
    const useThrottle = window.Flags.on('raf-throttle');
    let pendingDx = 0, pendingDy = 0;
    let rafPan = null;

    // pinch baseline
    let pinch = null; // {dist, cx, cy, k, x, y}
    const activePtrs = new Map(); // pointerId → {x,y}

    // Hold-gate timestamp recorded on pointerdown. The actual hold UX
    // (context menu on long-press, etc.) is owned by the existing app.js
    // code path — we record this so a future Phase can promote HOLD into
    // a real state if needed. Today: unused after recording.
    let holdStart = null;
    /* Phase 2.8 B — high-level gesture event dispatch.
       The state machine surfaces these as window.onCanvasLongPress /
       window.onCanvasDoubleTap callbacks; app.js registers the existing
       "add node here" UX against them. Gesture.js stays the producer of
       low-level events; app.js stays the consumer that decides UX. */
    const LONG_PRESS_MS = 500;
    const DOUBLE_TAP_MS = 350;
    const DOUBLE_TAP_DIST_PX = 30;
    const HOLD_MOVE_TOL_PX = 8;
    let longPressTimer = null;
    let longPressTouchStart = null;
    let lastTap = { t: 0, x: 0, y: 0 };

    function clearLongPress() {
      if (longPressTimer != null) { clearTimeout(longPressTimer); longPressTimer = null; }
      longPressTouchStart = null;
    }
    function fireLongPress(x, y, target) {
      if (typeof window.onCanvasLongPress === 'function') {
        try { window.onCanvasLongPress({ x, y, target }); } catch (e) { console.error('[ES onCanvasLongPress]', e); }
      }
    }
    function fireDoubleTap(x, y, target) {
      if (typeof window.onCanvasDoubleTap === 'function') {
        try { window.onCanvasDoubleTap({ x, y, target }); } catch (e) { console.error('[ES onCanvasDoubleTap]', e); }
      }
    }

    // -- Helpers --------------------------------------------------------------
    function speedSq(v) { return v.x * v.x + v.y * v.y; }
    const INERTIA_STOP_SQ = 0.05 * 0.05;   // pixels² / frame²
    const INERTIA_FRICTION = 0.92;          // preserved from existing pipeline
    const SWIPE_MIN_SPEED_SQ = 0.05 * 0.05; // touchend gates inertia entry

    function setState(next, opts) {
      opts = opts || {};
      // Atomically cancel everything from the previous state.
      if (rafInertia != null) { cancelAnimationFrame(rafInertia); rafInertia = null; }
      if (rafPan != null)     { cancelAnimationFrame(rafPan);     rafPan = null; pendingDx = 0; pendingDy = 0; }
      if (rafHold != null)    { cancelAnimationFrame(rafHold);    rafHold = null; }

      // The INERTIA → PINCH atom: zero velocity in the SAME tick the cancel
      // happens, so the pinch baseline read sees no further drift.
      if (state === 'inertia' && next === 'pinch') {
        vel.x = 0; vel.y = 0;
        // Also drop any queued transform write from the throttle path.
        if (window.CanvasTransform && window.CanvasTransform.cancelPending) {
          window.CanvasTransform.cancelPending();
        }
      }

      // Phase 1 R3 — every transition into IDLE clears transient body
      // classes that *might* have been left behind by either the old hold
      // gate or our own (currently dead) tickHold path. The accent-orange
      // halo is driven by body.dragging + .nslice.sel; if the old pointerup
      // path's idempotent clear hasn't fired yet, we mop here so the user
      // never sees stuck residue after a finger lift.
      if (next === 'idle') {
        const b = document.body;
        if (b) {
          b.classList.remove('holding');
          b.classList.remove('dragging');
        }
        const heldSlice = document.querySelector('.nslice.holding');
        if (heldSlice) heldSlice.classList.remove('holding');
        const heldGroup = document.querySelector('g.node.holding');
        if (heldGroup) heldGroup.classList.remove('holding');
        const cv = document.getElementById('cv');
        if (cv) cv.classList.remove('gr');
      }

      state = next;
      if (opts.consume) {
        try { opts.consume.preventDefault(); } catch (e) {}
      }
    }

    function clientToWorld(cx, cy, t) {
      const W = innerWidth, H = innerHeight;
      return {
        x: (cx - W / 2) / t.k - t.x,
        y: (cy - H / 2) / t.k - t.y
      };
    }

    // -- PAN throttle flush ---------------------------------------------------
    function flushPan() {
      rafPan = null;
      if (state !== 'pan') return;
      if (pendingDx === 0 && pendingDy === 0) return;
      const t = window.CanvasTransform.get();
      t.x += pendingDx / t.k;
      t.y += pendingDy / t.k;
      pendingDx = 0; pendingDy = 0;
      window.CanvasTransform.scheduleApply(t);
    }

    // -- INERTIA tick ---------------------------------------------------------
    function tickInertia() {
      if (state !== 'inertia') { rafInertia = null; return; }
      // Apply this frame's velocity, then decay.
      const t = window.CanvasTransform.get();
      t.x += vel.x / t.k;
      t.y += vel.y / t.k;
      vel.x *= INERTIA_FRICTION;
      vel.y *= INERTIA_FRICTION;
      window.CanvasTransform.applyImmediate(t);
      if (speedSq(vel) < INERTIA_STOP_SQ) {
        setState('idle');
        return;
      }
      rafInertia = requestAnimationFrame(tickInertia);
    }

    // -- Listeners ------------------------------------------------------------
    // CAPTURE phase so we run before the existing bubble-phase handlers.
    // When this state machine handles a gesture, we DO NOT stop the existing
    // handlers — they continue to run on the same events. Both update the
    // same `view` object, so the LAST writer wins per tick. To avoid double-
    // writes, the existing handlers detect Flags.on('gestures-v2') and bail
    // (see app.js patches).

    cv.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button === 2) return; // right-click → ctx menu
      // Always track the pointer so we can detect a second finger arriving
      // even when the first finger is on a node (pinch should still take
      // priority over a node drag).
      activePtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

      /* PHASE 2.7 R2 (3rd attempt) · HARD-RESET pinch entry.
         When the canvas has exactly 2 active touches, every piece of prior
         state is nuked and pinch begins from a clean snapshot:
           - snapshot the CURRENT view (whatever is visually on screen NOW)
           - snapshot the two touch SCREEN positions
           - precompute the WORLD-space anchor under the initial midpoint
           - cancel any inertia / pan deltas / queued RAFs / active drag
         Every subsequent pointermove computes the transform from scratch
         against this baseline — no accumulator, no incremental delta. That
         guarantees pure-pinch behaviour identical regardless of what was
         happening pre-pinch. */
      if (activePtrs.size === 2) {
        const pts = Array.from(activePtrs.values()).slice(0, 2);
        const t = window.CanvasTransform.get();
        const sx0 = pts[0].x, sy0 = pts[0].y;
        const sx1 = pts[1].x, sy1 = pts[1].y;
        const midX = (sx0 + sx1) / 2;
        const midY = (sy0 + sy1) / 2;
        const dist = Math.hypot(sx1 - sx0, sy1 - sy0) || 1;
        // Anchor in WORLD coords — the canvas-space point that the initial
        // screen midpoint sits over right now. This stays "glued" to the
        // current screen midpoint as the user pinches.
        const W = innerWidth, H = innerHeight;
        const anchorWorldX = (midX - W / 2) / t.k - t.x;
        const anchorWorldY = (midY - H / 2) / t.k - t.y;
        pinch = {
          startDist: dist,
          startMidX: midX, startMidY: midY,
          baseK: t.k, baseX: t.x, baseY: t.y,
          anchorWorldX, anchorWorldY
        };
        // NUKE everything carried in from a prior state.
        if (rafInertia != null) { cancelAnimationFrame(rafInertia); rafInertia = null; }
        if (rafPan != null) { cancelAnimationFrame(rafPan); rafPan = null; }
        pendingDx = 0; pendingDy = 0;
        vel.x = 0; vel.y = 0;
        if (window.CanvasTransform && window.CanvasTransform.cancelPending) {
          window.CanvasTransform.cancelPending();
        }
        if (window._inertiaActive && window._cancelInertia) window._cancelInertia();
        state = 'pinch';
        try { e.preventDefault(); } catch (_) {}
        return;
      }

      // Single pointer. Only claim PAN if the target is empty canvas —
      // node / zone-handle / resize-handle interactions are owned by the
      // existing app.js handlers, which run on the bubble phase after us.
      // Claiming PAN for a node tap would race the old node-drag code and
      // produce ghost transforms + stuck body.dragging halo.
      const tgt = e.target;
      const onInteractive = tgt && (
        (tgt.closest && (
          tgt.closest('.node') || tgt.closest('.nrz') ||
          tgt.closest('.zh')   || tgt.closest('.zd')
        ))
      );
      if (onInteractive) {
        // Do not enter PAN. Old code owns this gesture.
        // We keep the pointer in activePtrs so a second finger still triggers
        // pinch above. State stays whatever it was (idle most likely).
        return;
      }

      // Empty canvas → claim as PAN. INERTIA → PAN handoff (one-finger drop
      // while inertia is decaying) cancels inertia and starts fresh.
      setState('pan', { consume: e });

      lastSampleX = e.clientX; lastSampleY = e.clientY; lastSampleT = performance.now();
      prevSampleX = lastSampleX; prevSampleY = lastSampleY; prevSampleT = lastSampleT;
      vel.x = 0; vel.y = 0;
      pendingDx = 0; pendingDy = 0;
      holdStart = performance.now();

      /* Phase 2.8 B — arm long-press timer for empty-canvas touches only.
         Fires window.onCanvasLongPress after 500ms if the finger hasn't
         moved more than HOLD_MOVE_TOL_PX. Existing app.js node-drag /
         shift-drag-edge / context-menu paths handle their own hold
         semantics for interactive targets — we ONLY watch empty canvas. */
      if (e.pointerType === 'touch') {
        clearLongPress();
        longPressTouchStart = { x: e.clientX, y: e.clientY, target: e.target };
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          // The state machine flipped if the user moved past threshold;
          // skip if we're no longer in pan-from-rest.
          if (state !== 'pan') { longPressTouchStart = null; return; }
          // Final motion check against the start coords.
          const cur = activePtrs.get(e.pointerId);
          if (!cur || !longPressTouchStart) { longPressTouchStart = null; return; }
          const dx = Math.abs(cur.x - longPressTouchStart.x);
          const dy = Math.abs(cur.y - longPressTouchStart.y);
          if (dx > HOLD_MOVE_TOL_PX || dy > HOLD_MOVE_TOL_PX) { longPressTouchStart = null; return; }
          const { x, y, target } = longPressTouchStart;
          longPressTouchStart = null;
          // Hand off to PAN exit so we don't also fire pan-inertia.
          vel.x = 0; vel.y = 0;
          fireLongPress(x, y, target);
        }, LONG_PRESS_MS);
      }
    }, true);

    cv.addEventListener('pointermove', function (e) {
      const rec = activePtrs.get(e.pointerId);
      if (rec) { rec.x = e.clientX; rec.y = e.clientY; }

      if (state === 'pinch' && pinch && activePtrs.size >= 2) {
        /* PHASE 2.7 R2 (3rd attempt) · DECLARATIVE pinch math.
           Each frame computes the entire transform from the snapshot
           taken at pinch entry + the current screen positions of the two
           touches. No accumulators. No frame-to-frame state mutation.
           That makes the pinch behave identically regardless of what was
           on screen before pinch entry (node drag, pan, inertia, etc.). */
        const pts = Array.from(activePtrs.values()).slice(0, 2);
        const sx0 = pts[0].x, sy0 = pts[0].y;
        const sx1 = pts[1].x, sy1 = pts[1].y;
        const currentMidX = (sx0 + sx1) / 2;
        const currentMidY = (sy0 + sy1) / 2;
        const currentDist = Math.hypot(sx1 - sx0, sy1 - sy0) || 1;
        const W = innerWidth, H = innerHeight;
        // Scale: ratio of current distance to start distance.
        const newK = pinch.baseK * (currentDist / pinch.startDist);
        // Translation: solve for view.x/y so that anchorWorld is at
        // currentMid in screen coords.
        //   screenX = W/2 + (worldX + view.x) * view.k
        //   → view.x = (screenX - W/2) / view.k - worldX
        const newX = (currentMidX - W / 2) / newK - pinch.anchorWorldX;
        const newY = (currentMidY - H / 2) / newK - pinch.anchorWorldY;
        const next = { x: newX, y: newY, k: newK };
        window.CanvasTransform.applyImmediate(next);
        try { e.preventDefault(); } catch (_) {}
        return;
      }

      if (state !== 'pan') return;

      const dx = e.clientX - lastSampleX;
      const dy = e.clientY - lastSampleY;
      /* Phase 2.8 B — any meaningful motion cancels the pending long-press
         (the user is panning, not pressing). The 8px threshold matches
         iOS Safari's own long-press cancel distance. */
      if (longPressTouchStart) {
        const totalDx = Math.abs(e.clientX - longPressTouchStart.x);
        const totalDy = Math.abs(e.clientY - longPressTouchStart.y);
        if (totalDx > HOLD_MOVE_TOL_PX || totalDy > HOLD_MOVE_TOL_PX) clearLongPress();
      }
      prevSampleX = lastSampleX; prevSampleY = lastSampleY; prevSampleT = lastSampleT;
      lastSampleX = e.clientX;   lastSampleY = e.clientY;   lastSampleT = performance.now();

      // Track per-sample velocity for inertia handoff.
      vel.x = dx; vel.y = dy;

      if (useThrottle) {
        // Accumulate and let one RAF flush per frame commit the transform.
        pendingDx += dx; pendingDy += dy;
        if (rafPan == null) rafPan = requestAnimationFrame(flushPan);
      } else {
        // Direct path: write through immediately. Still goes via CanvasTransform
        // so the perf HUD can time the commit.
        const t = window.CanvasTransform.get();
        t.x += dx / t.k; t.y += dy / t.k;
        window.CanvasTransform.applyImmediate(t);
      }
    }, true);

    function pointerUpOrCancel(e) {
      activePtrs.delete(e.pointerId);

      /* Phase 2.8 A — PINCH exit MUST zero velocity unconditionally.
         The pinch midpoint moves very fast during a normal pinch (each
         finger contributes half its motion to the midpoint). On the LAST
         touchend of a pinch, the v1 pointerup-inertia path used to read
         "midpoint velocity" as a real swipe and fire inertia — flinging
         the canvas across the screen. Velocity is captured only during
         actual PAN motion (one finger drag); PINCH exit always = vel 0. */
      if (state === 'pinch') {
        if (activePtrs.size < 2) {
          pinch = null;
          vel.x = 0; vel.y = 0;
          pendingDx = 0; pendingDy = 0;
          if (rafInertia != null) { cancelAnimationFrame(rafInertia); rafInertia = null; }
          if (window._inertiaActive && window._cancelInertia) window._cancelInertia();
          if (activePtrs.size === 1) {
            // One finger remains — transition to PAN with that finger as the
            // new anchor. Canvas does NOT snap; transform stays at current.
            const remaining = Array.from(activePtrs.values())[0];
            lastSampleX = remaining.x; lastSampleY = remaining.y; lastSampleT = performance.now();
            prevSampleX = lastSampleX; prevSampleY = lastSampleY; prevSampleT = lastSampleT;
            state = 'pan'; // no setState() — preserves the current transform
          } else {
            setState('idle');
          }
        }
        return;
      }

      if (state !== 'pan') {
        setState('idle');
        return;
      }

      /* Phase 2.8 B — double-tap detection. If this pointerup ends a
         touch that didn't move much AND there was a prior touchend within
         350ms within 30px, fire window.onCanvasDoubleTap. Only for empty-
         canvas releases (longPressTouchStart was armed → target was canvas).
         A successful long-press already fired; that path also clears
         longPressTimer so we won't re-fire here. */
      const movedThisGesture = longPressTouchStart
        ? (Math.abs(e.clientX - longPressTouchStart.x) > HOLD_MOVE_TOL_PX ||
           Math.abs(e.clientY - longPressTouchStart.y) > HOLD_MOVE_TOL_PX)
        : true;
      if (e.pointerType === 'touch' && longPressTouchStart && !movedThisGesture) {
        const now = performance.now();
        const dxTap = Math.abs(e.clientX - lastTap.x);
        const dyTap = Math.abs(e.clientY - lastTap.y);
        if (now - lastTap.t < DOUBLE_TAP_MS && dxTap < DOUBLE_TAP_DIST_PX && dyTap < DOUBLE_TAP_DIST_PX) {
          // Second tap of a double-tap pair. Capture target BEFORE
          // clearLongPress (which nulls longPressTouchStart).
          const tgt = longPressTouchStart.target;
          clearLongPress();
          lastTap.t = 0; // consume so a triple-tap doesn't re-fire
          // Suppress pan inertia for the tap.
          vel.x = 0; vel.y = 0;
          fireDoubleTap(e.clientX, e.clientY, tgt);
          setState('idle');
          return;
        }
        // First tap: record and let the timer continue (long-press might
        // still fire if user holds; double-tap windows the second touch).
        lastTap = { t: now, x: e.clientX, y: e.clientY };
      }
      clearLongPress();

      // Pan end: maybe enter inertia.
      // Compute velocity from the most recent two samples (px / frame at 60Hz).
      const dt = Math.max(1, lastSampleT - prevSampleT); // ms
      const vxPerMs = (lastSampleX - prevSampleX) / dt;
      const vyPerMs = (lastSampleY - prevSampleY) / dt;
      // Convert to px-per-16ms (one frame).
      vel.x = vxPerMs * 16;
      vel.y = vyPerMs * 16;

      // Only enter inertia for touch gestures with enough velocity.
      if (e.pointerType === 'touch' && speedSq(vel) > SWIPE_MIN_SPEED_SQ) {
        setState('inertia');
        rafInertia = requestAnimationFrame(tickInertia);
      } else {
        setState('idle');
        vel.x = 0; vel.y = 0;
      }
    }
    cv.addEventListener('pointerup',     pointerUpOrCancel, true);
    cv.addEventListener('pointercancel', pointerUpOrCancel, true);

    // Wheel: discrete zoom event. Treat as a one-shot PINCH-equivalent so
    // the same code path handles the math. Cancels inertia.
    cv.addEventListener('wheel', function (e) {
      if (state === 'inertia') { setState('idle'); }
      const t = window.CanvasTransform.get();
      const before = clientToWorld(e.clientX, e.clientY, t);
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      t.k = t.k * factor;
      const after = clientToWorld(e.clientX, e.clientY, t);
      t.x += after.x - before.x;
      t.y += after.y - before.y;
      window.CanvasTransform.applyImmediate(t);
      try { e.preventDefault(); } catch (_) {}
    }, { passive: false, capture: true });

    // -- Public introspection (for tests + the perf HUD) ----------------------
    window.GestureV2 = Object.freeze({
      getState: () => state,
      getVelocity: () => ({ x: vel.x, y: vel.y }),
      getActivePointerCount: () => activePtrs.size
    });

    console.log('[EdgeSpace] Gesture v2 installed · raf-throttle=' + useThrottle);
  }

  // Init order: wait for DOMContentLoaded so app.js has run (it's loaded
  // non-deferred at the end of <body>, so DOMContentLoaded fires AFTER it).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
