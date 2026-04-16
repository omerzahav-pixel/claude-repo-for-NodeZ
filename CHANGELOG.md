# NodeZ Changelog

Newest first. One entry per phase completed.

---

## Phase 5 P2 · Landing screen + recent workspaces · 2026-04-16

On first load, if the user has two or more workspaces, a full-viewport
overlay lists them as cards with color stripes (reusing wsColor) and
node counts. The current workspace is highlighted with an accent ring.
Click a card to switch to that workspace; "Continue with current" or
Escape to dismiss without switching; "+ New workspace" to create one.

The overlay skips silently when only one workspace exists — single-
workspace users never see it. Node counts are fetched via a
lightweight IDB peek per workspace (no full state load).

Full Hebrew i18n. z-index: 200 (above emptyState, modal, everything).

Tests: 7-test spec `tests/phase5_landing.spec.ts`, 126/126 desktop +
246/246 iPad regression green.

**Phase 5 P2 is now complete — all 8 items shipped.**

---

## Phase 5 P2 · Auto-fit + smart placement + empty states · 2026-04-16

Three small polish items bundled into one pass:

**Empty-state overlay** — A blank canvas now shows a centered overlay
with a ✦ emoji, "This canvas is empty" title, a hint paragraph, and
an accent "+ Add first node" CTA button. Hides the moment the first
node or zone appears. Full Hebrew i18n. Fade-in animation (250ms)
respects prefers-reduced-motion.

**Smart placement** — `findFreeSpot(cx, cy)` spirals outward from the
requested center with 120px spacing. Consecutive "+ Add" taps no
longer stack nodes on top of each other — each new node lands in the
nearest free spot.

**Auto-fit after large paste-patch** — When a patch adds ≥ 10 nodes,
`zF()` fires automatically so the user sees all imported content
without having to manually zoom out.

Also: `zoneAt()` now returns null instead of crashing when the canvas
has zero zones — a state that was impossible before the empty-state
overlay but is now valid.

Tests: 7-test spec `tests/phase5_polish.spec.ts`, 119/119 desktop +
232/232 iPad regression green.

---

## Phase 5 P2 · Tooltips pass · 2026-04-16

Walked every toolbar button, input, and sidebar toggle and asked: if I
didn't write this app, would I know what this icon does on hover? The
single-glyph buttons (⌇ dim-edges, ⇲ paste-patch, ⇅ import, ↶ undo,
↷ redo, א/A Hebrew, ? legend) already had titles; the text-label
buttons did not because they "look obvious" — except the current
canvas isn't always obvious. Gaps filled:

- `#wsSel` → "Switch workspace"
- `#backBtn` → "Back to parent canvas"
- `#addBtn` → "Add node (or double-click empty canvas)"
- `#zoneBtn` → "Add zone (group of related nodes)"
- `#sr` → "Filter visible nodes by label / notes"
- `#fitBtn` → "Fit view to all nodes"
- `#moreBtn` → "More options (export / import / utilities / workspace)"
- sidebar cycle toggle (☰) → "Cycle sidebar: Nodes · Edges · Zones"

Existing titles expanded: `#redoBtn` now says "Redo (Ctrl+Y /
Ctrl+Shift+Z)" so both shortcuts are discoverable. `#heBtn` spells out
"toggle RTL + translated UI" (previously just "Hebrew mode").

**i18n pass (`public/app.js`).** Static English titles in `index.html`
are the baseline so the browser paints them before JS runs. On boot
and every Hebrew toggle, `refreshUiText()` now walks a `titleMap` of
`{elementId → ttKey}` and writes `T[lang][ttKey]` into the title
attribute. The anonymous `#sb .sbhead .sbtog` spans are targeted by
selector since they don't have ids. Toggling back to English restores
the English strings — no drift.

**Tests.** `tests/phase5_tooltips.spec.ts` — 6 assertions: every
tracked element has a non-empty title, sidebar toggle spans carry
titles, default is English, Hebrew toggle rewrites to Hebrew
("התאם…"), toggle back restores English, and the redo tooltip
advertises both shortcut variants. 18/18 green across desktop-chrome
+ ipad-safari + ipad-chrome. 112/112 desktop-chrome + 218/218 iPad
full-suite regression green.

iPad Safari/Chrome don't surface title hints on tap so this is
primarily a desktop-UX improvement, but the attribute + i18n plumbing
is worth maintaining for future accessibility passes (screen readers
do read titles in many modes).

---

## Phase 5 P2 · Paste-patch size sanity · 2026-04-16

`applyPatch()` used to `JSON.parse` whatever lived in `#pt` and dive
straight into the apply loop. A pathologically large paste —
20MB of text, or a 5000-node patch — would freeze the main thread
for several seconds during parse and the render storm that followed.
The app didn't crash, but it looked broken. This change guards both
dimensions with a two-tier check.

**Thresholds (`public/app.js`).**

    PATCH_WARN_BYTES = 500KB   PATCH_MAX_BYTES = 10MB
    PATCH_WARN_NODES = 200     PATCH_MAX_NODES = 2000

Bytes-first (before parse) so truly huge pastes don't even get to
`JSON.parse`. Nodes-second (after parse) because node count is what
determines how long the render loop will take. At each tier:

- Exceed WARN → `uiConfirm()` with a clear message and "Apply anyway"
  override label — the user can bulldoze through if they know what
  they're doing.
- Exceed MAX → `uiNotice()` and return. Hard stop.

**`patchNodeCount(raw)` helper.** Walks both the single-patch shape
(`raw.nodes[]`) and the multi-patch bundle shape (`raw.patches[].nodes[]`)
and returns the total. Same function used by the test spec so the
boundaries are asserted against a single source of truth.

**No behavioral change for normal patches.** A typical Claude-generated
patch is 5–50 nodes / 1–50KB. Those wave through with zero prompts —
the guard's purpose is to catch the rare abuser (accidental clipboard
dump, runaway generator), not to interrupt everyday use.

**Error path cleanup.** Split the original single-try/catch so
"Parse error" (bad JSON) and "Apply error" (post-parse failure inside
the loop) surface with the right dialog title, not both as "Patch
failed".

**Tests.** `tests/phase5_patchsize.spec.ts` — 7 assertions:
thresholds-exposed, small-no-prompt, oversize-reject, warn-cancel
rollback, warn-apply-anyway completes, too-many-nodes-reject,
nodeCount-aggregation across `raw.patches[]`. 21/21 green across
desktop-chrome + ipad-safari + ipad-chrome. 106/106 desktop-chrome
+ 206/206 iPad full-suite regression green (6 pre-existing
ipad-safari PWA-test skips).

---

## Phase 5 P2 · Workspace color coding · 2026-04-16

Switching workspaces used to look identical regardless of which one
was active — the `#wsSel` dropdown showed black text on a dark panel
and nothing else signaled identity. Now every workspace name hashes to
a stable HSL hue so the same string always returns the same color,
with no per-workspace picker or storage migration.

**`wsColor(name)` helper (`public/app.js`).** Polynomial hash
`h = (h * 31 + charCode) % 360` → `hsl(h, 55%, 60%)`. Fixed saturation
and lightness keep colors legible on the dark palette without clashing
with canvas content. Same string → same hue, always.

**`rebuildWsDropdown()`.** Every `<option>` now carries an inline
`style="color: hsl(...)"` so the list shows each workspace in its own
hue. The `#wsSel` element itself gets `borderLeftColor` +
`borderLeftWidth:3px` from the current workspace's color, turning the
left edge into a stripe that persists even when the dropdown is
closed. `paddingLeft` shrinks from 12px (the default from the inline
`padding:8px 12px`) to 10px so the 3px stripe doesn't shove content
rightward — net content-edge position unchanged at 13px from the
outer edge.

**No bullet prefix on options.** First cut prepended "● " to each
option. On iPad Pro 11 landscape this made the select wide enough to
push the wrapped toolbar into 2 rows, which overlapped the breadcrumbs
at `top:64px` and blocked tap events. Dropping the bullet fixed it —
inline color alone is sufficient identity signal. Confirmed by
`tests/phase18_layout.spec.ts 1.8.10 Depth>1 chain: tap toggles
expanded class` going back to green on both iPad projects.

**Tests.** `tests/phase5_wscolor.spec.ts` — 6 assertions covering
stripe presence + 3px width, per-option inline color (normalized to
`rgb(...)` by `style.color` getter), deterministic stripe color on
workspace switch, `wsColor` stability, and padding-left compensation
so text doesn't shift. 18/18 green across desktop-chrome +
ipad-safari + ipad-chrome. 99/99 desktop-chrome + 192/192 iPad
full-suite regression green.

---

## Phase 5 P2 · Redo · 2026-04-16

Undo had been live since Phase 1 via `un()` popping `hist`. Redo
mirrors it: `re()` pops a separate `redoStack`, pushes the current
state back onto `hist`, and restores. Any fresh mutation through
`sn()` clears `redoStack` — a classic branching-history model, not a
list you can walk sideways.

**Code (`public/app.js`).** New globals `redoStack = []`. `sn()` now
does `redoStack.length = 0` on every fresh snapshot. `un()` captures
`S` into `redoStack` before popping `hist`. `re()` is symmetric.
`bB()` end-of-function reads both stacks and sets
`#undoBtn.disabled = !hist.length` / `#redoBtn.disabled = !redoStack.length`
so the toolbar shows available-actions without the user having to tap
and see nothing happen.

**Keyboard.** Existing Ctrl+Z branch in the keydown handler kept.
Added Ctrl+Shift+Z and Ctrl+Y branches before the plain Ctrl+Z test,
both calling `re()`. Works with ⌘ on macOS (`e.metaKey`) too.

**UI.** `<button id="redoBtn" onclick="re()" title="Redo (Ctrl+Y)">↷</button>`
added to the toolbar next to ↶. `src/app.css` gains
`#tb button:disabled{opacity:.35;cursor:default;color:var(--muted)}`
so disabled state is visible without ambiguity.

**Tests.** `tests/phase5_redo.spec.ts` — 6 assertions covering
initial-disabled state, addC→un→re roundtrip, redo-stack clear on
fresh mutation, Ctrl+Y shortcut, Ctrl+Shift+Z shortcut, and undo
button disabled state. 18/18 green across desktop-chrome + ipad-safari
+ ipad-chrome. 93/93 desktop-chrome + 180/180 iPad full-suite
regression green.

---

## Phase 5 P2 · Expandable description field · 2026-04-16

The property panel's textareas were a tiny 64px tall regardless of
content. On iPad, writing even a few lines of a description felt
cramped and made you fight a small scrollable box. Two changes fix it:
auto-grow, and an expand-to-modal affordance for focused writing.

**`aGrow(el)` helper (`public/app.js`).** Sets `el.style.height =
Math.min(scrollHeight, 0.5 * innerHeight)` and toggles `overflowY`
between `hidden` and `auto` based on whether content fits. Called:
- Once from `op()` right after `pn.innerHTML = …` so existing content
  opens at the right height.
- Inline from every textarea's `oninput` (alongside the existing
  `aField(...)`) so typing grows continuously.

**`expandField(fieldId, nodeKey, label)` / `closeExpanded(…)`.** Opens
the existing `#modal` with a 60vh-tall textarea pre-filled from
`sel[nodeKey]`. Typing in the expanded view runs through the same
`aField()` autosave path the panel textarea uses — no data-fork, the
node mutates in place. `closeExpanded()` flushes autosave, closes the
modal, copies the live `sel[nodeKey]` back into the panel's textarea
value, and re-grows it so height is correct before the user sees the
panel again. The Done button label is inline `hebrewMode?'סיום':'Done'`
(not worth a dictionary entry for one micro-string).

**Where the buttons live.** Notes (`f_notes`), rationale
(`f_rationale`), and latex (`f_latex`) each get a `⇱` expand button
injected into a new `<label class="flabel">` flex row. `.expandBtn` is
transparent by default, tints to accent on hover, and bumps from 2/6
to 6/10 padding under `@media(pointer:coarse)` for comfortable iPad
tapping. The old plain `<label>…</label>` pattern is kept for
non-expandable fields (tags, confidence, zone, etc.).

**CSS changes.** `#pn textarea` switched from `resize:vertical;
min-height:64px` to `resize:none; min-height:64px; max-height:50vh;
overflow-y:hidden` — the vertical resize handle was unusable on touch
and now `aGrow()` drives the height. `min-height` still acts as the
floor so an empty textarea doesn't collapse.

**Tests.** `tests/phase5_expand.spec.ts` — 6 tests × 3 projects = 18
new assertions:
- 5P2.E1 empty `f_notes` opens at ~min-height (30–120px), not pre-grown.
- 5P2.E2 seeding 20 lines of notes then opening the panel grows
  `f_notes` past 180px, capped below `50vh + 4`.
- 5P2.E3 typing 10 lines via keyboard in `f_notes` makes it grow vs.
  the pre-type height.
- 5P2.E4 calling the expand button opens `#modal.on #ef_body` with
  the node's pre-existing notes pre-filled.
- 5P2.E5 fill `#ef_body` with new text → 300ms settle → `sel.notes`
  matches the new text; then `closeExpanded` → panel `f_notes.value`
  re-syncs to the new text.
- 5P2.E6 default shape + Details open → `#pn .expandBtn` count ≥ 2
  (notes + rationale both got the affordance).

**Regression.** 87/87 desktop-chrome + 168/168 iPad engines green
(6 pre-existing WebKit-SW PWA skips).

---

## Phase 5 P2 · Selection glow + drag visual feedback · 2026-04-16

First item in the P2 (ship-if-time) bucket. The drawn SVG ring on a
selected node was always there but read as a thin outline lost in dense
canvases; now the selected node also carries a soft accent halo so it
pops at a glance, and brightens while being dragged so the user feels
"this is the one I'm moving".

**Wiring.** In `public/app.js` render loop, when `se = sel?.id === n.id
|| selSet.has(n.id)`, both the SVG hit-group (`g.node[data-id]`) and
the overlay slice (`.nslice[data-nid]`) now receive a `sel` class —
mirroring the existing `dim`/`tgt`/`holding` class pattern. The hit
group isn't styled directly but having the class there keeps
delegation/querying symmetric with the slice, the same way `.holding`
is applied to both layers for Phase 5 P1 #1.

**CSS.** Two rules in `src/app.css`, placed BEFORE `.nslice.holding`
so the stronger press-and-hold glow still wins during the brief
overlap when a selected node is being held for drag:

```css
.nslice.sel{filter:drop-shadow(0 0 6px rgba(217,119,87,.45)) drop-shadow(0 0 2px rgba(217,119,87,.7));transition:filter 160ms ease-out}
body.dragging .nslice.sel{filter:drop-shadow(0 0 12px rgba(217,119,87,.8)) drop-shadow(0 0 3px rgba(217,119,87,1));transition:filter 80ms ease-out}
@media (prefers-reduced-motion: reduce){.nslice.sel,body.dragging .nslice.sel{transition:none}}
```

Accent orange `rgb(217,119,87)` matches `--accent`. Base halo sits at
.45/.7 alpha with 6/2px spread (visible but calm); the drag-active
variant jumps to .8/1 alpha with 12/3px spread so motion reads as
"intensified selection" rather than a new indicator.

**Tests.** `tests/phase5_selection.spec.ts` — 5 tests × 3 projects = 15
new assertions:
- 5P2.1: tapping node A tags its slice + hit-group; node B stays clean.
- 5P2.2: re-tapping (toggle close) drops the `sel` class.
- 5P2.3: `getComputedStyle(…).filter` on `.nslice.sel` contains
  `drop-shadow` (CSS rule actually took effect, not just the class).
- 5P2.4: forcing `body.dragging` changes the settled computed filter
  vs. the base `.sel` filter — confirms the cascade override. Reads
  with a 200ms settle so getComputedStyle returns the end-of-transition
  value, not a mid-transition interpolation.
- 5P2.5: Ctrl+click multi-select leaves at least one `.nslice.sel` in
  the DOM (selSet multi-select path also tagged).

**Regression.** 81/81 desktop-chrome full suite green (76 pre-existing
+ 5 new). 160/161 iPad engines green, 6 skipped (pre-existing WebKit-SW
PWA flakiness). One flaky miss on ipad-safari hold-drag 5.3 re-ran
green — unrelated to this change.

---

## Phase 5 P1 · Item #6 — 8px grid audit · 2026-04-16

Every spacing token in the chrome now lands on the 4/8/12/16/20/24
ladder. Before: padding values drifted to 5, 6, 7, 9, 10, 11, 14, 18
depending on when the element was written. After: exactly one step-size
system, so alignment between toolbar, breadcrumbs, filter pills, panel,
menus, and dialog reads as deliberate instead of incidental.

**src/app.css sweep.** 40+ spots touched:
- Toolbar: `#tb` padding 6→8 · gap 3→4 · radius 10→12; button padding
  6/10→8/12 · radius 7→8.
- Tabs: `.tab` padding 6/14→8/16 · radius 6→8 · gap 6→8; `.newtab`
  6/10→8/12; `.x` padding 0/2→0/4.
- Sidebar: `.sbhead` padding 10/12→12 square; `.sbsearch input`
  padding 6/8→8 square; `.item` padding 6/12→8/12; `.dot` margin-top
  3→4; `.item .urp` padding 1/6→2/8 · margin-top 2→4; `.zhdr` gained
  `gap:8`.
- More menu: button/label padding 7/12→8/12 · radius 5→4; `.mh`
  padding 6/12/2→8/12/4; `.msep` margin 4/6→4/8; `#indicators` gap
  6→8.
- Breadcrumbs: `#bc` top 62→64 · padding 6/14→8/16 · radius 10→12 ·
  gap 6→8; `.bc-sep` padding 0/1→0/2; `.bc-full` gap 6→8.
- Filter row: `#fl` top 68→72 · gap 5→4.
- Pills: `.pill` padding 4/10→4/12 · radius 14→16.
- Legend: `#lg` top 54→56 · right 18→16 · padding 10/14→12/16 · radius
  10→12; `.row` gap 6→8 · padding 1→2; `.sw` 10→12; `h4`
  margin-bottom 3→4. `#lgBtn` right 18→16.
- Panel: `#pn` padding 18→16 · radius 10→12 · translateY 6→8; `.meta`
  margin-bottom 10→12; input padding 8/10→8/12 · radius 7→8; textarea
  min-height 60→64; `details.pn-more` margin-top 14→16.
- Brow: gap 6→8 · margin-top 14→16; button min-width 70→72 · padding
  7→8 · radius 7→8.
- Chips: `.urp` padding 4/10→4/12; `.origin` padding 2/7→2/8; `.port`
  margin-left 6→8.
- Ctx: `min-width` 180→184; button padding 6/12→8/12 · radius 5→4;
  `.csep` margin 3→4; `.csub` padding 3/12→4/12.
- Modal: `p` margin-bottom 10→12; textarea padding 10→12 · radius 7→8
  · min-height 220→224; `.pitem` padding 8/10→8/12 · radius 6→8.
- Dialog: `.dc` padding 18/20→20 square · width 420→424; `p.dmsg`
  margin-bottom 14→16; `.dbody` 14→16; input padding 9/11→8/12 ·
  radius 7→8; button padding 8/14→8/16 · radius 7→8.
- Toast: `#toast` right/bottom 14→16 · gap 6→8 · max-width 340→344,
  padding-allowance 28→32; `.ts` padding 8/14→8/12 · radius 7→8 ·
  box-shadow 14→16.
- Edge picker: button padding 7/14→8/16 · radius 5→4; `.sw` 22×3→24×4.
- Hint: padding 6/11→8/12.
- Coarse-pointer overrides: `#ctx/#ep/#more` button padding 10/14→12/16;
  `.pill` 8/14→8/16; `#pn input/textarea/select` padding 10/12→12.
- `.pn-close` 36×36→40×40 (mobile touch target).

**Inline sweeps.** `public/app.js`: dbg-panel header padding 5/8→4/8 +
gap 6→8 + radius 7→8 (also flipped `rgba(26,24,21)` debug background
to `rgba(15,15,15)` matching the Phase-5-#5 neutral palette); dbg-body
padding 6/8→8 square; dbg-overlay padding 6→8 + radius 6→8 + bottom
100→104 + max-height 150→152; formula preview padding 14→16 + margin
6→8 + min-height 50→48 + radius 7→8; color-picker swatch 50→48 width
+ radius 6→8; project + pull picker input padding 8/10→8/12 +
margin-bottom 10→12 + radius 7→8; paste-patch `<code>` padding 1/4→2/4
+ radius 3→4; edge-label padding 2/5→2/8 + radius 3→4.
`index.html`: `#wsSel` inline select padding 6/10→8/12 + radius 7→8.

**Verification.** Pure spacing refactor — no functional or visual-behavior
changes. 76/76 desktop-chrome full suite + 40/40 Phase-5 suite on
ipad-safari + ipad-chrome green post-audit. No test assertion updates
needed: the suites target class toggles, text content, and computed
transitions, not raw pixel offsets.

---

## Phase 5 P1 · Item #5 — layered dark surfaces · 2026-04-16

The palette was a warm-brown leftover from the idea_vault prototype:
`#1a1815` bg, `#22201c` inputs, `#2a2620` panels, `#d97757` terracotta
accent. It read "leather journal" — fine for a single-user canvas on a
desktop, wrong for a knowledge tool that needs to feel calm and modern
on iPad in a dim room. Migrated to a cool neutral stack of greys so
the content carries the color temperature, not the chrome.

**Palette.** `:root` in `src/app.css`:
- `--bg #0F0F0F` · body + canvas (true dark — OLED-friendly)
- `--bg2 #181A1B` · inputs, filter pills, toast
- `--panel #242424` · floating panels (#pn, #modal .mc, #more)
- `--panel2 #2E2E2E` · nested surfaces, hover states
- `--border #333333` · 1px hairlines

Gives three clear depth layers (body → chrome → panel) instead of the
two we had before. Text stays on `--text #f5f0e6` (cream) for warmth
against the neutral greys.

**Sweep.** Every hard-coded `#1a1815` in `src/app.css` (3 refs — mostly
button text on light accents) and `public/app.js` (4 button-text refs +
2 SVG `fill` attrs in the formula-icon templates + boot-debug header +
filter pill) replaced with `#0F0F0F`. `#toast .ts` bg → `var(--bg2)`
so toast tone follows the palette. Color-picker default swatch
`#22201c` → `#181A1B`. Panel chrome now pulls exclusively from
CSS custom properties — no more inline color literals.

**Install chrome.** `<meta name=theme-color>` in `index.html` → `#0F0F0F`,
inline `#backBtn color` → `#0F0F0F`, `public/manifest.webmanifest`
`background_color` and `theme_color` → `#0F0F0F`. iOS status bar and
Android splash now match the app's true body color instead of flashing
a lighter frame on launch.

**Icons.** `scripts/gen-icons.mjs` `const BG = [0x0F, 0x0F, 0x0F, 0xff]`
(comment updated "warm dark" → "neutral dark"); regenerated all four
PNGs (192, 512, 512-maskable, 180-apple). `dist/` rebuilt so the SW
pre-cache ships the new icons.

**Tests.** `tests/phase2_pwa.spec.ts` theme-color assertion updated
to `#0F0F0F`; Phase 2 suite green on desktop-chrome (7/7) + ipad-chrome
(7/7), ipad-safari skip pattern unchanged. Phase 5 motion +
progressive regression green (9/9 on desktop-chrome) — palette change
didn't regress any interactive behavior.

---

## Phase 5 P1 · Item #4 — smooth motion on open/close · 2026-04-16

The property panel and paste-patch modal used to snap in and out of
existence — display:none one frame, display:block the next. Now they
fade and settle with matched easings, so the UI feels like it's
thinking rather than flinching.

**Panel (#pn).** Opacity 0↔1 + `translateY(6px → 0)`. 220ms ease-out
on open; 140ms ease-in on close. `visibility` is held at `visible`
through the close fade via a delayed transition
(`visibility 0ms linear 140ms`) so the panel stays on-screen while
opacity animates to 0, then drops out of hit testing at the end.

**Modal (#modal + .mc).** Backdrop opacity fades 180ms ease-out.
Inner dialog `.mc` scales from 0.98 and translates down 8px, resolving
to identity on the same curve. Dialog feels like it settles in rather
than slams into place.

**Prefers-reduced-motion.** `@media (prefers-reduced-motion: reduce)`
blocks on both rules null all durations to 0ms. Users with vestibular
sensitivity who've asked their OS for less motion get zero-duration
transitions — still class-toggle correctness, no animation.

**Migration.** `op()` / `cp()` migrated from `pn.style.display =
'block/none'` to `pn.classList.add/remove('on')` because `display:
none` kills transitions. Panel now lives permanently in the DOM; its
visibility is class-driven.

**Tests.** 4 targeted tests in `tests/phase5_motion.spec.ts` assert the
CSS is wired rather than timing mid-fade opacity (which is flaky):
5.4.1 op()/cp() toggle `.on` · 5.4.2 #pn computed
`transition-property` contains opacity with non-zero duration · 5.4.3
#modal same assertion · 5.4.4 #modal .mc resolves to identity
transform on open (proves scale-up is not stuck in closed state).
All 4 green on desktop-chrome + ipad-safari + ipad-chrome. Full-suite
regression: 76/76 on desktop-chrome (existing `toBeHidden()` assertions
still pass — Playwright auto-retries until `visibility:hidden` settles
after the fade).

**Commits.**
- `36e44ee` Phase 5 P1 #4 · smooth motion on open/close (app.js + app.css)
- `3dfec45` Phase 5 P1 #4 · 4-test spec for smooth motion

---

## Phase 5 P1 · Item #3 — progressive node properties · 2026-04-16

The property panel used to dump every field — rationale, URL, doc URL,
tags, confidence, color, compact — onto the user in one tall scroll.
Now it shows only the fields 90% of edits touch, and tucks the rest
behind a "More details" disclosure. Renaming a node or switching its
zone no longer requires scrolling past six optional inputs.

**Layout.** `op(n)` composes two sections:
- *Primary* (always visible): label, body (notes / note body / LaTeX
  depending on shape), shape + status 2-col grid, zone.
- *Details* (collapsed by default, inside `<details class="pn-more">`):
  rationale, URL, doc URL, tags, confidence, color picker (note /
  formula shapes), compact toggle (formula only).

**State.** New module-level `panelDetailsOpen` flag persists the user's
open/closed choice across in-session panel rebuilds (shape change
triggers `op(sel)`, node switch, sP() refresh). `cp()` resets the flag
to `false` so the next fresh-open panel starts minimal again — an
advanced edit session holds state; closing the panel means "done for
now."

**CSS.** Uses the native HTML `<details>` element — good a11y + keyboard
story for free. Custom chevron (`::before` content `›`, rotates 90°
on `[open]`, mirrors to `‹` with `-90°` for Hebrew RTL) replaces the
browser's default disclosure triangle. Summary styled as an uppercase
muted label above a top-border divider so it reads as a section
header, not an orphan inline control.

**Tests.** 5 targeted tests in `tests/phase5_progressive.spec.ts`:
5.3.1 panel opens with Details closed (secondary fields not visible)
· 5.3.2 clicking summary expands (fields become visible) · 5.3.3
shape-change rebuild preserves open state · 5.3.4 `cp()` resets so
reopening starts collapsed · 5.3.5 autosave still fires for Details
fields (f_tags writes through aField unchanged). All 5 green on
desktop-chrome + ipad-safari + ipad-chrome. Full-suite regression:
72/72 on desktop-chrome.

**Commits.**
- `eafefc2` Phase 5 P1 #3 · progressive disclosure (app.js + app.css)
- `c4c79b7` Phase 5 P1 #3 · 5-test spec for progressive disclosure

---

## Phase 5 P1 · Item #2 — live preview + autosave for property panel · 2026-04-16

Typing in the property panel is now WYSIWYG and Save-less. Every
keystroke re-renders the canvas + sidebar immediately, and the full
state persists 200ms after the user stops typing. Selects + checkboxes
commit instantly. Closing the panel flushes any pending debounce first,
so the user can't lose an unsaved keystroke by tapping Close too fast.

**Helpers.** New `aSnap` / `aFlush` / `aField(applyFn, immediate)`
helpers wrap every field mutation. `aField`:
1. Calls `sn()` exactly once per panel session (`autosaveSnapped` flag)
   so multi-keystroke typing collapses into a single undo frame —
   Ctrl+Z walks back to before the panel opened, not one letter at a
   time.
2. Runs `applyFn(sel)` to mutate the selected node in-place.
3. Calls `render()` + `renderSB()` for live preview.
4. For `immediate` (selects, checkboxes, color-reset), fires `sv()`
   right away. For debounced (text inputs), schedules `sv()` at
   `AUTOSAVE_MS=200`.

**Wiring.** `op(n)` now adds `oninput` on `#f_label`, `#f_notes`,
`#f_rationale`, `#f_url`, `#f_docUrl`, `#f_tags`, `#f_conf`, `#f_latex`,
and `onchange` on `#f_shape`, `#f_status`, `#f_zone`, `#f_compact`,
`#f_color`. `#f_shape` and `#f_compact` handlers also call `op(sel)`
to rebuild the panel because their on/off state toggles which fields
are shown. All other fields mutate in place — the panel innerHTML is
NOT rebuilt on each keystroke, so focus stays in the active
textarea/input.

**Panel lifecycle.** `op()` calls `aFlush()` and resets
`autosaveSnapped=false` at the top, so switching selection flushes
the previous panel's pending write and starts a fresh undo frame.
`sP()` (save-patch / apply) calls `aFlush()` then `op(sel)` to
re-render. `cp()` (close panel) calls `aFlush()`, resets
`autosaveSnapped`, and hides the panel. The Reset-color button changed
from a full `sP()` re-render to `aField(x=>x.color=null, true)` —
same effect, no panel rebuild.

**Tests.** 6 targeted tests in `tests/phase5_autosave.spec.ts`:
5.2.1 label live-preview into `.nslice[data-nid]` overlay · 5.2.2
notes persists after 200ms debounce + reload · 5.2.3 `cp()` flushes
pending debounce (verifies in-memory state, then 250ms for WebKit
IDB commit, then reload) · 5.2.4 typing keeps focus inside `#f_notes`
· 5.2.5 shape select rebuilds the panel (rationale hidden for
`shape:note`, notes textarea gains min-height) · 5.2.6 multi-keystroke
edit collapses into a single undo snapshot. All 6 green on
desktop-chrome + ipad-safari + ipad-chrome. Full-suite regression:
67/67 on desktop-chrome.

**Commits.**
- `bded2e9` Phase 5 P1 #2 · live preview + autosave for property panel (app.js)
- `5615d2d` Phase 5 P1 #2 · 6-test spec for live preview + autosave

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
