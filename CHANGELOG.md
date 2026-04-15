# NodeZ Changelog

Newest first. One entry per phase completed.

---

## Phase 5 P1 · Item #1 — press-and-hold drag on touch · 2026-04-16

Touch users now get a 350ms hold gate before a finger on a node becomes
a node-drag. A light swipe on a node pans the canvas instead of yanking
the node around; a deliberate press-and-hold arms the drag and then
motion moves the node. Mouse and Apple Pencil paths are unchanged
(immediate drag), and a tap with no motion (<350ms) still opens the
property panel — no regression in tap-to-edit.

**Feedback.** When the gate opens we add `.holding` to `<body>`, the
`g.node` hit-group, and the overlay `.nslice`. CSS gives the slice an
accent-color drop-shadow glow (`drop-shadow(0 0 10px rgba(217,119,87,
.7))`) with a 140ms transition, drops the hit-circle opacity so the
accent fill reads through, and flips the body cursor to `grabbing`.
If the browser exposes `navigator.vibrate`, a 12ms haptic buzz fires
at gate open so the user feels the transition. All feedback clears on
pointerup / pointercancel / multitouch / contextmenu fallback.

**State model.** `drag.holdPending=true` on touch + node-target
pointerdown. At 350ms the holdTimer flips `holdPending=false` and
paints feedback. Motion before the gate fires clears holdTimer and
swaps `drag.k` to `'pan'`, so the interaction smoothly converts
swipe → pan. Motion after the gate keeps `drag.k='node'` and drags
the node. longPressTimer (500ms contextmenu) also clears holdTimer
when it fires, and the contextmenu cleanup path clears `.holding`.

**Tests.** 5 targeted tests in `tests/phase5_hold_drag.spec.ts`:
5.1 mouse drag immediate · 5.2 swipe→pan on touch · 5.3 hold→drag
moves node not view · 5.4 tap→panel · 5.5 `.holding` on body +
slice + hit-group. All 5 green on desktop-chrome + ipad-safari +
ipad-chrome. Tests use synthetic PointerEvents (not
`touchscreen.tap`) for controlled hold durations. The spec's
`openCleanApp` helper waits 400ms past reload so the post-load
`zF()` auto-fit (setTimeout 300ms) settles before interaction —
otherwise the initial-framing race mutates view mid-drag and
5.3's view-stability assertion flakes.

**Commits.**
- `17b12b1` Phase 5 P1 #1 · press-and-hold drag on touch (app.js + app.css)
- `8233966` Phase 5 P1 #1 · 5-test spec for press-and-hold drag

---

## Phase 2 — PWA setup · 2026-04-16

End-to-end PWA: manifest, icons, Apple metas, service worker, persistent
storage. Installable from desktop Chrome + iOS Safari Add-to-Home-Screen.

**Icons.** New `scripts/gen-icons.mjs` encodes PNGs from scratch (zlib
deflateSync + CRC32 chunks, no image library) and emits four files into
`public/icons/`: `icon-192.png`, `icon-512.png`, `icon-180.png` (Apple
canonical), `icon-512-maskable.png` (40% safe-zone inset for Android
adaptive launcher). The design is three connected circles on the NodeZ
warm-dark background (#1a1815) — the brand mark as a tiny node graph.
Zero image-toolchain dependency keeps the build lean.

**Manifest.** `public/manifest.webmanifest` — `name`, `short_name`,
`description`, `start_url: "./"`, `scope: "./"`, `display: standalone`,
`orientation: any`, `theme_color` + `background_color` = #1a1815,
`categories: ["productivity", "utilities"]`, three `icons` entries
including a `purpose: "maskable"`, `prefer_related_applications: false`.
Relative URLs throughout so preview-URL sub-paths (Cloudflare Pages)
still resolve.

**Apple + legacy metas.** `index.html` head gains `lang="en"`, descriptive
title + description, `theme-color`, manifest link, 192 icon link, 180
`apple-touch-icon`, full Apple trio (`apple-mobile-web-app-capable`,
`apple-mobile-web-app-status-bar-style="black-translucent"`,
`apple-mobile-web-app-title="NodeZ"`), the legacy `mobile-web-app-capable`
alias, `format-detection=telephone=no`, and PWACompat v2.0.17 async-loaded
from jsdelivr to back-fill Windows/Samsung/legacy-Apple metas from the
manifest. Single source of truth.

**Service worker.** `public/sw.js` (~140 lines). Strategy split:
network-first for HTML navigations (deploys land on first reload, with
cached `index.html` fallback for offline boot), stale-while-revalidate
for same-origin shell assets, cache-first for CDN fonts + KaTeX (content-
addressed, never drift). `VERSION` bumps invalidate old caches in
`activate`; `skipWaiting()` + `clients.claim()` apply instantly, which
iOS Safari especially needs so a stale SW doesn't pin users on the old
bundle. `SKIP_WAITING` postMessage handler exposed for a future
"update available" UX. Data (IndexedDB `ideaVault`, localStorage) is
deliberately out of SW scope — app reads/writes it directly.

**Registration + persistent storage.** `src/bootstrap.ts` registers the
SW on `window.load` (so the shell paints before we compete for bandwidth),
wires an `updatefound` listener, and calls `navigator.storage.persist()`
to request eviction-resistant storage for IndexedDB workspaces. iOS 17+
grants persist silently once the PWA is installed; desktop Chrome grants
based on engagement signals. All paths relative so sub-path hosting
just works.

**Tests.** `tests/phase2_pwa.spec.ts` — 7 tests:
- 2.1 head metas + manifest link + PWACompat tag (`.first()` on locators
  because PWACompat async-injects duplicate Apple metas it derives from
  the manifest; we assert on our explicit one, which browsers use before
  PWACompat runs)
- 2.2 manifest parses, required fields present, 192 + 512 + maskable icons
- 2.3 every manifest icon fetches, returns PNG signature, > 500 bytes
- 2.4 `navigator.serviceWorker.ready` resolves with an active worker
- 2.5 `navigator.storage.persist()` invoked on boot (monkeypatched via
  `addInitScript`)
- 2.6 sw.js source has `VERSION` literal + `skipWaiting()` + `clients.claim()`
- 2.7 `dist/` build output contains manifest + icons + sw.js

Gotchas fixed: ESM Playwright tests restored `__dirname` via
`fileURLToPath(import.meta.url)`; WebKit SW support in Playwright's
harness is flaky, so the suite skips `ipad-safari` via `beforeEach` —
real iPad gets a manual pass.

**Lighthouse 13.** (PWA category was removed in LH12; audits now live in
Best Practices / SEO.) On `dist/` served statically:

| Category        | Score |
|-----------------|-------|
| Performance     | 93    |
| Best Practices  | 100   |
| SEO             | 100   |
| Accessibility   | 58    |

`installable-manifest` + `service-worker` audits pass. Accessibility 58
comes from pre-existing issues unrelated to Phase 2 (canvas/toolbar
color-contrast, toolbar buttons using `title` not aria-labels, the
deliberate `user-scalable=no` viewport to disable iPad pinch-zoom on
the app chrome, unlabeled workspace `<select>`). Tracked for Phase 5
polish; does not block Phase 3.

**Commits (4, on `v2-rewrite`):**
- `34087f9` Phase 2 · icons generator + 4 PNGs
- `abe5c44` Phase 2 · manifest + Apple metas + PWACompat shim
- `4736ca7` Phase 2 · service worker + register + storage.persist()
- `152b8ae` Phase 2 · 7-test spec

**Full-suite regression:** 162 passed / 6 skipped across desktop-chrome +
ipad-safari + ipad-chrome (skips = Phase 2 PWA suite on ipad-safari,
by design).

---

## Phase 1.8 — Layout polish · 2026-04-16

Four layout-polish items shipped as three focused commits on `v2-rewrite`.

**#1 Smart popover positioning.** New `placePopover(panelId, anchorId, opts)`
utility in `public/app.js`. Anchors popover to trigger; flips upward if
viewport space below is insufficient; clamps left/top so it stays fully
on-screen on narrow widths. LTR/RTL aware (Hebrew mode). `#more` switched
from `position:absolute` (inside a `position:relative` wrapper) to
`position:fixed`. Wrapper `<div>` removed. `toggleMore()` handles open/close
and delegates placement to the utility. A `resize` listener keeps the open
menu anchored when viewport reflows.

**#2 Responsive toolbar — DECISIONS.md D6.** Recorded the choice of
"overflow into More" over a bottom-nav alternative. Bottom-nav would
collide with the tabs strip and `.hint`; moving tabs is a shareable-product
decision parked for the auth/landing conversation. `@media(max-width:767px)`
now hides `#zoneBtn`, `#dimEdgesBtn`, `#patchBtn`, `#importBtn`, `#undoBtn`.
Remaining primary on phones: WS dropdown, + WS, Hebrew, + Add, Search,
Fit, ⋯ More. New `.tbLabel` rule lets a `<label>` live alongside `#tb button`
without losing the coarse-pointer 44 px min-size treatment.

**#3 Promoted toolbar buttons.** ⇲ Paste Patch (`#patchBtn`) opens
`showPatch()` directly. ⇅ Import full state (`#importBtn`) is a
`<label for="imp">` so iOS Safari preserves the user-gesture chain into
the hidden file input — same technique Phase 1 task 1.1 landed for the
More menu.

**#4 Collapsible breadcrumbs.** `bB()` renders two inline spans:
`.bc-mini` (default "… › current ▾") and `.bc-full` (hidden unless
`#bc.expanded`, the classic chain). Depth-1 canvases render just the
current name with no chevron and no toggle. Tapping `#bc` (but not an
inner `<a>`) toggles `.expanded`; ancestor links stopPropagation so
tapping navigates. `#bc` moved from `top:12px right:60px` / `max-width:42vw`
to `top:62px right:12px` / `max-width:60vw` because D6's wider toolbar
(two extra buttons × coarse-pointer 44 px) overlapped `#bc` at its old
coord and `#indicators` inside `#tb` was intercepting taps. Added
`window.__testAddChildCanvas` hook so Playwright specs can build depth-2+
chains without driving `addNode` + dblclick.

**Tests.** New `tests/phase18_layout.spec.ts` — 10 tests × 3 projects
(desktop-chrome, ipad-safari, ipad-chrome) = 30 test instances.
`openApp()` waits for `#bc .bc-mini` to populate before proceeding so
ipad-safari's longer `load()` timing doesn't flake 1.8.10. Full-suite
regression: **147 / 147 green** across all three projects.

**Commits:** `9946e61` (#1 popover), `9dd7443` (#2 + #3 responsive +
promoted), `38d6387` (#4 breadcrumbs + test suite).

---

## Phase 1.7 — Dialog/toast/toggle hardening · 2026-04-16

**#7 In-app dialog system.** `uiPrompt(title, default, opts)`,
`uiConfirm(msg, opts)`, `uiNotice(msg)` replace `prompt()` / `confirm()` /
`alert()` everywhere. XSS-safe (text nodes, not innerHTML).
`danger:true` surfaces a red destructive button. Esc cancels;
outside-click cancels prompts. `+WS` and `+Zone` toolbar buttons no
longer fire native prompts — both go through the in-app dialog path.

**#8 Toast replacing boot banner.** Removed the `#bootLog` v1 banner
entirely. `toast(msg, {type:'ok'|'err'|'warn', ms})` renders a
bottom-right auto-dismissing pill. Boot path shows "Loaded…".

**#9 Panel toggle / outside-click / Esc.** `?` Legend button now
**toggles** open AND closed (previously only opened). Outside-click
closes both `#lg` and `#more`. Listener switched from `'click'` to
`'pointerdown'` on capture phase because `#cv`'s `preventDefault()` +
`setPointerCapture()` on the pointerdown eats the synthetic click that
would have followed — Chromium behavior saved to memory as
`feedback_pointerdown_not_click`. Esc closes both panels. `.tog` ×
inside `#lg` still works (regression guard).

Phase 1.7 adds 17 targeted tests across `phase17_dialogs.spec.ts`,
`phase17_toast.spec.ts`, `phase17_toggle.spec.ts`.

**Commits:** `842e7b1` (#7 dialogs), `07aef3f` (#8 toast), `abee0fc` (#9 toggle).

---

## Phase 1.6 — D3 hybrid SVG + HTML overlay · 2026-04-15

**D3 decision (DECISIONS.md):** partial reversal of D2's full-SVG pivot.
Formula nodes keep SVG for the hit-rect / stroke / shadow, but their
rich content paints in an HTML overlay (`#canvasOverlay`) that iOS
WebKit actually renders — a `<foreignObject>` with KaTeX inside was
blank on real iPad. `#canvasOverlay` shares the canvas's
`translate(view.x, view.y) scale(k)` transform so overlay children use
world coords directly. `pointer-events:none` on the overlay by default
so taps fall through to SVG below; individual children re-enable when
needed (scrollable note bodies, link clicks).

**D5 decision:** per-node overlay slices. Instead of one overlay per
canvas layered above the SVG, each node gets its own slice interleaved
in DOM order so z-stacking works across SVG + overlay without manual
ordering code in the render loop.

**Commits:** `722b66b` (D3 decision), `88acd40` (D3 migration), `57756d2` (D5 slices).

---

## Phase 1.5 — On-screen diagnostics · 2026-04-15

Bottom-right ◆ diag overlay (`window.dbg`) so real-iPad testing can
surface bugs #1 / #3 / #5 without a USB debugger. Tap toggles
visibility, long-press clears log. Cleanup scheduled for Phase 6.
No-cache headers on `vite.config.ts` dev server so iPad always picks up
the latest during testing.

**Commits:** `6d17bea` (diagnostics + no-cache).

---

## Phase 1 — Core bug fixes + iPad hardening · 2026-04-15

**1.0 · Blocker bug repros (D2 pivot).** `DECISIONS.md` D2 — keep SVG,
fix the 5 data-layer bugs surgically instead of rewriting SVG → DOM.
Repro suite `tests/phase1_repros.spec.ts` pinned each bug before fixing.

**1.1 · iOS user-gesture chain for Import.** `More → Import full state`
becomes `<label for="imp">` wrapping a hidden file `<input>`. Synthetic
`.click()` from a button breaks user-gesture activation on iOS Safari;
a label tap forwards correctly. Hidden input must be in the layout tree
(`position:absolute; left:-9999px`), not `display:none`.

**1.2 · Auto-fit after import.** After `imF()` deserializes full state,
auto-`zF()` so the current canvas is framed.

**1.3 · Markdown processor.** In-place Markdown for note bodies.
XSS-safe ordering: escape first, then rewrite escaped entities into tags.
Preserves Hebrew RTL and mixed LTR numerals.

**1.4 · KaTeX re-render-on-load.** `auto-render.min.js` fires `onload`
and re-runs `render()` so formula nodes added before KaTeX is ready
still typeset.

**1.6a · Fixed-inset shell.** `body { position:fixed; inset:0;
overscroll-behavior:none }` blocks iPad rubber-band.

**1.6b · `#cv` claims touch defaults** via `touchstart` / `touchmove`
handlers so iPad Scribble and pinch don't hijack.

**1.6c · rbush viewport culling** for canvases ≥ 100 nodes with a 200 px
margin. Keeps the DOM small while preserving correctness for in-view nodes.

**1.7 · Per-canvas screenshot regression suite.**
`tests/phase1_screenshots.spec.ts` captures 48 PNGs per test run —
every canvas in `disc_math_and_probabilty_full.json` and `TRADING_REAL.json`
× 3 projects. Baselines under `test-screenshots/phase-1/{project}/{fixture}/`.

**1.5 note-overflow — skipped.** User deferred; re-evaluate in a later phase.

**Commits:** `733ce62` (1.0 + D2 repros), `c4301ca` (1.1 label), `475deba`
(1.3 + 1.4 Markdown + KaTeX), `64d5722` (1.2 auto-fit), `dc3ab6b` (1.6
hardening), `e0142d1` (1.7 screenshots + Phase 1 close-out).

---

## Phase 0 — Setup · 2026-04-15

Git-worktree split between `main` (frozen v1) and `v2-rewrite` (active dev):
initialized a new repo inside `NodeZ/`, committed the baseline
`idea_vault.html` + planning docs + test JSON fixtures on `main`, and
created a sibling worktree at `../NodeZ-v2/` where all Phase 1+ work
happens. The original v1 file stays pristine on `main` and is still
reachable for side-by-side comparison.

Vite vanilla project scaffolded in the worktree with loose TypeScript
(`allowJs: true`, `strict: false`) so we can mix `.js` and `.ts` freely
as modules land in later phases. `idea_vault.html` was split
byte-for-byte into three files preserving exact v1 behavior:

- `index.html` — the app shell (toolbar / sidebar / canvas DOM verbatim from lines 185-215 of v1, CDN font + KaTeX links, plus `./src/app.css` + `./app.js`)
- `src/app.css` — lines 7-183 of v1 (177 lines of styles)
- `public/app.js` — lines 217-769 of v1 (553 lines of JS; see DECISIONS.md D1 for why `public/` not `src/`)

Playwright installed with Chromium + WebKit and configured for three
projects: `ipad-safari` (WebKit + iPad Pro 11 landscape — our real
target), `ipad-chrome` (Chromium + iPad profile), and `desktop-chrome`
(parity sanity). A single baseline spec captures four screenshots per
engine — the untouched `idea_vault.html` via `file://` and the
Vite-served split — into `test-screenshots/baseline/`. Output
confirmed pixel-identical between original and split on iPad, proving
the extraction was faithful.

`npm run build` verified end-to-end: `dist/index.html` + `dist/app.js`
(81 KB passthrough) + `dist/assets/index-*.css` (16 KB, gzip 3.83 KB).
Cloudflare Pages will use exactly this output.

**Infrastructure:**

- Git repo initialized in `NodeZ/` with `main` branch, `v2-rewrite`
  branch, and remote `origin` pointing at
  `https://github.com/omerzahav-pixel/claude-repo-for-NodeZ.git`.
- Worktree at `C:/Users/Administrator/projects/NodeZ-v2/` for v2 work.
- `.gitignore` covers `*client_secret*.json`, `.env*`, `node_modules/`,
  `dist/`, Playwright caches, and `.claude/worktrees/`.

**Known baseline behavior (to fix in Phase 1):** on iPad Safari
emulation, the top toolbar is obscured by the orange `✓ load() …` debug
log strip, the canvas renders the three default zones (IDEAS / PROJECTS
/ INBOX), and tapping toolbar buttons produces no visible effect —
consistent with Azamat's "I tap a button and nothing happens"
complaint. Baseline captured; now the rebuild begins.
