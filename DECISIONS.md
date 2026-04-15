# NodeZ — Architectural Decisions Log

Each decision landed here when an architectural choice diverged from the brief
or when a significant tradeoff was made. Newest first.

---

## D3 — 2026-04-15 · Phase 1.6 · Partial reversal of D2: hybrid SVG + HTML overlay for rich content

**Context.** Phase 1 Playwright suite landed 42/42 green on `desktop-chrome` +
`ipad-safari` projects. On real iPad, three fixes (#1 Import, #3 KaTeX, #5
Markdown) still failed. Phase 1.5 shipped an on-screen diagnostic overlay
(`window.dbg`) so Azamat could read the import/render code-path log directly
on the deployed URL. The readings were definitive:

| Signal                                  | On real iPad      | Interpretation                                    |
| --------------------------------------- | ----------------- | ------------------------------------------------- |
| Import chain end-to-end                 | completes cleanly | `imF()` + `reconcileCanvases()` are fine          |
| `katex.render()` invocations per render | 9                 | KaTeX executed                                    |
| `.katex` DOM elements after render      | 18                | KaTeX wrote nodes into the DOM                    |
| `mdProcess` calls per render            | 2                 | Markdown processor ran                            |
| `<strong>` in `.note-body`              | 3                 | Markdown output is in the DOM                     |
| **Canvas formula node paint**           | **blank**         | **iOS WebKit did not draw what it parsed**        |
| **Canvas note body paint**              | **blank**         | **iOS WebKit did not draw what it parsed**        |
| Property-panel KaTeX preview            | perfect           | Same KaTeX HTML renders fine *outside* SVG        |
| Sidebar note preview                    | literal `**bold**`| Separate code path that doesn't call `mdProcess`  |

**Root cause.** iOS WebKit (which backs Safari *and* Chrome on iOS — Apple
forces every browser engine on the platform) has a long-standing paint bug for
HTML content embedded inside SVG `<foreignObject>`. The HTML subtree parses,
lays out, and has correct bounding rects — but WebKit's painter simply never
draws it. Desktop Chrome's Blink engine paints foreignObject contents
correctly, which is why the whole Playwright suite (including the `ipad-safari`
project, backed by a *Chromium-bundled* WebKit) flagged all fixes as green
even though real iPad users see blank cards. This is the failure class the
Phase 1.5 feedback memory warned about.

D2's "keep SVG for everything" was right for substrate, transforms, edges, and
simple SVG primitives. It was wrong for the node-content pieces that were
shipping HTML through `<foreignObject>`.

**Decision.** Hybrid architecture. Keep D2's SVG substrate but move all rich
HTML content off of `<foreignObject>` and onto an HTML overlay layer.

**What stays SVG:**

- `<svg id="cv">` root, `viewBox`, pan/zoom transform math.
- Node shape outlines: `<rect>`, `<circle>`, `<polygon>` (project star,
  principle diamond, resource hexagon, library rectangle, question pentagon,
  experiment triangle, doc folded rect, formula frame rect, note frame rect).
- Zone borders (`<rect class="zr">` with dashed stroke).
- Edges (`<path>` with marker-end arrowheads).
- Selection rings, hit rects (`class="th"`), resize handles.
- Compact-node labels rendered as `<text>` (plain SVG text, not foreignObject).

**What moves to HTML overlay:**

- Zone titles (currently a `<foreignObject>` wrapping a styled `<div>`).
- Edge labels (currently a `<foreignObject>` wrapping a styled `<div>`).
- Formula node header label (currently a `<foreignObject>` wrapping a styled
  `<div>`).
- Formula node KaTeX content (currently a `<foreignObject>` wrapping
  `<div class="fnode" data-latex>`).
- Note node title + body (currently a `<foreignObject>` wrapping
  `<div class="note-body">` with nested markdown HTML and `data-mathbody`).

**Implementation — the two-layer pattern (Excalidraw / tldraw).**

1. Add `<div id="canvasOverlay">` as a sibling of `<svg id="cv">`, same
   parent, `position:absolute; inset:0; pointer-events:none;
   transform-origin:0 0; will-change:transform`.
2. On every `render()`, apply the canvas-space transform to the overlay:

   ```js
   overlay.style.transform =
     `translate(${W/2}px,${H/2}px) scale(${view.k}) translate(${view.x}px,${view.y}px)`;
   ```

   This matches the SVG's `viewBox="${-W/2/view.k-view.x} ${-H/2/view.k-view.y}
   ${W/view.k} ${H/view.k}"` exactly: a world point `(wx, wy)` lands at screen
   `(W/2 + (wx + view.x) * view.k, H/2 + (wy + view.y) * view.k)` on both
   layers.

3. Each overlay child uses plain absolute positioning (`position:absolute;
   left:${wx}px; top:${wy}px`) inside the transformed parent. No per-child
   transform math — they all ride the parent's transform.

4. `pointer-events:none` on the overlay by default lets taps pass through to
   the SVG underneath (which owns drag / select / context-menu). Individual
   overlay children can opt back in (`pointer-events:auto`) for scrolling a
   long note body or tapping a link, once we need it.

**Why not `<div>` canvas for everything.** A full DOM-based canvas would
duplicate the transform for every single edge path, marker arrow, and shape
outline. SVG `<path>` + `<marker>` is the right tool for 2D vector primitives.
The overlay pattern buys us correct iOS paint for rich content *without*
losing SVG's transform batching or the tiny-per-edge cost that DOM paths
would introduce.

**Why not `<img>`-ize KaTeX output via canvas / SVG serialization.** Doable
but kills interactive select/copy of the math and introduces a second render
pipeline. Save it for a hypothetical Phase 6 perf optimization if overlay
paint ever becomes the bottleneck.

**Culling.** The rbush viewport-cull Set (`visIds`) built once per render for
the SVG node loop is reused by the overlay builder. Off-screen nodes produce
neither SVG shape nor overlay div.

**Test strategy.** Playwright can still verify DOM wiring (an overlay div
exists per visible formula, `.katex` renders inside it) but is *not* a paint
test — the foreignObject bug proved that `ipad-safari`'s Chromium-bundled
WebKit paints overlays Apple's WebKit won't. Real-iPad verification stays
required after each migration step. The diagnostic overlay exposes an
`overlay-paint-check` count so Azamat can confirm "N overlay divs mounted for
N expected rich-content nodes" without plugging into a Mac.

**Migration order (Phase 1.6):**

1. Add overlay layer infrastructure + migrate **formula node content only**
   (header label + KaTeX body) → deploy → real-iPad verification.
2. If #1 paints, migrate note node title + body → deploy → verify.
3. Migrate zone labels + edge labels → deploy → verify.
4. Wire sidebar mini-preview through `mdProcess` (separate one-line fix — the
   sidebar is plain HTML, not foreignObject, so it doesn't need overlay
   treatment, just needs to stop showing literal `**bold**`).

**Revisit threshold.** If iOS WebKit ever fixes the foreignObject paint bug
(tracked as a Safari bug since roughly 2019), the overlay layer can be
retired. Unlikely before 2027 based on historical cadence. The overlay pattern
is cheap enough that we don't need to remove it even if the bug gets fixed —
keeping the two-layer separation leaves room for Phase 5 polish (spring
animations on note bodies, embedded iframes in doc nodes, etc.) without
fighting SVG.

---

## D2 — 2026-04-15 · Phase 1 · Light-touch pivot: keep SVG, defer DOM rewrite

**Context.** The original CLAUDE_CODE_BRIEF.md called for a full SVG → DOM
rewrite in Phase 1. RESEARCH.md's central premise was that *"SVG interactive
rendering is incompatible with iPad Safari due to WebKit bugs."* The full
2–4 day rewrite was planned on that basis.

Before starting the rewrite, the user deployed Phase 0's `public/app.js`
(byte-for-byte v1 code) to Cloudflare Pages and verified it **works on
iPad**. The research premise was wrong for this project — v1's apparent
iPad failures on Netlify were caching / CSP / Add-to-Home-Screen artifacts
masquerading as SVG rendering bugs.

**The five "blocker" bugs the user wants fixed in Phase 1:**

1. Full-state Import button does nothing (silent failure).
2. Imported nodes land in scattered / wrong positions.
3. LaTeX renders in the sidebar / side panel but not on the canvas.
4. Long note bodies overflow their containers.
5. Markdown (`**bold**`, headings, lists) is not rendered — shown as raw text.

None of these are SVG-specific. Every one reproduces in a DOM rewrite unless
we also fix the underlying data-layer logic: broken `imF()` at
`public/app.js:468` (no try/catch, missing `applyHebrewState()` +
`rebuildWsDropdown()`, no shape validation), destructive `reconcileCanvases()`
overwriting valid node coords, missing Markdown processor entirely, KaTeX
auto-render ordering against a defer-loaded script, and `<foreignObject>`
without an inner overflow container. A DOM migration that ships with the
same five bugs is strictly worse than the current SVG code that ships with
them — it's more code, more risk, and no user-visible win.

**Decision.** Keep SVG as the rendering engine for v2. Phase 1 becomes
surgical data-layer fixes + iPad defensive hardening:

- **1.0** Failing Playwright repros for all 5 bugs + XSS test.
- **1.1** Fix `imF()`: try/catch, `applyHebrewState()`, `rebuildWsDropdown()`,
  shape validation, visible error feedback (never fail silently).
- **1.2** Fix `reconcileCanvases()` so it doesn't clobber valid x/y on
  import (sample 10 nodes, assert match within 1px of source file).
- **1.3** Write a small (~40-line regex) Markdown processor with XSS
  hardening: escape HTML → extract math placeholders → Markdown →
  re-inject math. Explicit test: note containing `<script>alert(1)</script>`
  renders as visible text, not executed JS.
- **1.4** Fix KaTeX canvas render — ensure `renderMathInElement` is loaded
  before the first canvas paint that contains formulas.
- **1.5** Fix `<foreignObject>` overflow via inner `<div>` with
  `overflow-y:auto; max-height:…` and a themed scrollbar.
- **1.6** iPad defensive hardening: Apple Scribble workaround
  (`touchmove` + `preventDefault` on the canvas surface), rbush viewport
  culling with 200px margin, and `position:fixed; inset:0;
  overflow:hidden; overscroll-behavior:none` on the app shell.
- **1.7** Regression suite: all 1.0 repros now pass; per-canvas
  screenshots of both fixtures saved under `test-screenshots/phase-1/`.

**Why this is the right call.** Defensive hardening (Scribble + viewport
culling + fixed-inset CSS) captures most of the iPad benefit the DOM
migration was supposed to deliver — at roughly one day of work instead
of two-to-four. The SVG ↔ DOM decision can be revisited later with real
performance data instead of research-report speculation.

**Revisit threshold.** We reconsider the DOM migration if **any** of these
become true:

1. iPad frame rate visibly drops (<30 fps during pan / pinch) with 300+
   visible nodes *after* viewport culling is in place.
2. A Phase 5 feature needs rich interaction on a node (spring drag,
   per-node hover animation, embedded iframes) and SVG + `<foreignObject>`
   fights us.
3. Real iPad reveals a pointer-event bug that the current architecture
   can't work around.

Until one of those fires, SVG stays. If a trigger fires, a new DECISIONS
entry (D3+) will document the migration with actual measurements attached
— not estimates.

**Tradeoff accepted.** The Phase 1 estimate in BUILD_DASHBOARD.md (2–4
days for DOM migration) compresses to roughly 2 days for light-touch.
Phase 5 polish items (8px grid, layered dark surfaces, command palette,
spring animations, bottom nav for mobile, per-workspace color theming)
remain committed — the user-facing "smooth / professional / intuitive"
feel comes from Phase 5, not from swapping rendering engines.

---

## D1 — 2026-04-15 · Phase 0 · Legacy `app.js` lives in `public/`, not `src/`

**Context.** The Phase 0 brief says "Extract inline `<script>` to `src/app.js`".
I did this initially. On `npm run build`, Vite emitted a warning and skipped
bundling the script:

```
<script src="./src/app.js"> in "/index.html" can't be bundled without
type="module" attribute
```

The production build produced an empty `dist/` with no JS — the deployed app
on Cloudflare Pages would be blank.

**Why a module import doesn't work yet.** The v1 script relies on top-level
`function foo(){}` declarations being automatically on `window` so inline
`onclick="foo()"` handlers in `index.html` can call them. ES modules run in
their own scope — the roughly 60 inline handlers in `index.html` would all
need to be rewritten to `addEventListener`, OR every function name assigned
to `window` at the bottom of the file. Both are real refactors and out of
scope for Phase 0 (whose goal is parity with v1, not refactor).

**Decision.** Move the legacy JS to `public/app.js` (Vite's passthrough
directory). Files in `public/` are copied verbatim to `dist/` during build
and served at web root in dev. The `<script src="./app.js"></script>` tag in
`index.html` therefore:

- In dev: resolves to `http://localhost:5173/app.js` (served from
  `public/app.js`).
- In production: `dist/app.js` sits next to `dist/index.html`, served by
  Cloudflare Pages.

No transformation, no module scope, no breakage of inline handlers.

**What stays in `src/`.** `src/app.css` works fine as a Vite-processed asset
(CSS doesn't have the module-scope problem). Phase 1's new rendering module
(`src/render.ts` or similar) will be authored as proper ES modules and
imported from a new `src/main.ts` entry point with
`<script type="module" src="./src/main.ts">`. The legacy
`public/app.js` will shrink and eventually be retired entirely as its
responsibilities migrate into modules.

**Tradeoff accepted.** Slight divergence from the brief's literal directory
layout, but the brief's intent ("extract inline script to a separate file")
is preserved. No behavioral change vs. the v1 single-file app.
