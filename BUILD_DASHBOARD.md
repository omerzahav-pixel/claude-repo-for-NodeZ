# NodeZ — Build Dashboard

*Last updated 16 April 2026 · Status: Phase 2 complete · Phase 5 P1 complete (all 6 items) · Phase 5 P2 complete (all 8 items) · Branch: v2-rewrite*

> Mirrors the live Notion dashboard at https://www.notion.so/343704adcc0e8166b4bac09c27ef5349
> When you change phase status here, also update Notion (manually or via Notion MCP if connected).

---

## Mission

Rebuild **Idea Vault → NodeZ** as a reliable, mobile-first knowledge canvas. Same data model, same patches, smoother feel, actually works on iPad.

---

## Phase tracker

### ✅ Phase 0 — Setup
*Vite project · git worktree · Playwright baseline · Cloudflare Pages connected to GitHub*
**Status:** ✅ done 2026-04-15 — Cloudflare Pages connect still needs the user in the browser; everything else shipped. See CHANGELOG.md.

### ✅ Phase 1 — Light-touch fixes + iPad hardening ⚠️ CRITICAL
*Pivoted from full SVG→DOM rewrite (see DECISIONS.md D2) · keep SVG, fix the 5 data-layer bugs · defensive iPad hardening (Scribble + rbush culling + fixed-inset CSS)*
**Status:** ✅ done 2026-04-15 — 42/42 Playwright tests green on desktop-chrome + ipad-safari. Landed: 1.1 More→Import label fix (iOS user-gesture), 1.2 auto-fit-on-import, 1.3 Markdown processor with XSS-safe ordering, 1.4 KaTeX re-render-on-load, 1.6a fixed-inset shell CSS, 1.6b touchstart/touchmove claim on #cv, 1.6c rbush viewport culling (≥100 nodes, 200px margin), 1.7 per-canvas screenshot suite (48 PNGs under `test-screenshots/phase-1/{project}/{fixture}/`). Skipped: 1.5 note-overflow fix (user deferred — re-evaluate after real-iPad check).

### ✅ Phase 1.7 — Dialog/toast/toggle hardening
*In-app dialog system · toast replaces boot banner · panel toggle + outside-click + Esc for #lg and #more*
**Status:** ✅ done 2026-04-16. Items #7 (uiPrompt/uiConfirm/uiNotice replace native prompt/confirm/alert — XSS-safe, iPad-friendly), #8 (toast API, #bootLog banner removed, boot toast "Loaded…"), #9 (`?` Legend button now TOGGLES, outside-click via pointerdown capture to survive #cv preventDefault + setPointerCapture, Esc closes both panels). 17 targeted Phase 1.7 tests in `tests/phase17_*.spec.ts`.

### ✅ Phase 1.8 — Layout polish
*Smart popover positioning · responsive toolbar (D6) · promoted toolbar buttons · collapsible breadcrumbs*
**Status:** ✅ done 2026-04-16. Items #1 (placePopover() with flip-up + viewport clamp + RTL support, #more now position:fixed), #2 (responsive D6: secondary buttons collapse into More <768px — decision recorded in DECISIONS.md vs. bottom-nav alternative), #3 (⇲ Paste Patch + ⇅ Import promoted to top toolbar; Import remains `<label for=imp>` for iOS user-gesture chain), #4 (collapsible breadcrumbs: `.bc-mini` default + `.bc-full` expanded, moved below toolbar to top:62px). 30 Phase 1.8 tests in `tests/phase18_layout.spec.ts`, 147/147 full-suite green across desktop-chrome + ipad-safari + ipad-chrome.

### ✅ Phase 2 — PWA setup
*Service worker · manifest · PWACompat · navigator.storage.persist() · Add to Home Screen working · Lighthouse 90+*
**Status:** ✅ done 2026-04-16. Landed: PWA icon set (192/512 any + 512 maskable + 180 apple-touch, generated via pure-Node `scripts/gen-icons.mjs` — no image lib), `public/manifest.webmanifest` (display=standalone, theme+bg #1a1815, categories, scope ./), Apple metas + PWACompat shim in `index.html`, `public/sw.js` (network-first HTML / SWR same-origin / cache-first CDN, VERSION-bumped caches, skipWaiting + clients.claim), SW registered on window.load via `src/bootstrap.ts`, `navigator.storage.persist()` called on boot. 7 Phase 2 tests in `tests/phase2_pwa.spec.ts` (162/168 full-suite green, 6 skips = ipad-safari PWA set per WebKit-SW flakiness). Lighthouse 13 audit (no PWA category since LH12): Performance 93 · Best Practices 100 · SEO 100 · Accessibility 58 (pre-existing canvas/toolbar issues, not Phase 2 — tracked for Phase 5). Installable-manifest + service-worker audits pass.

### 🚧 Phase 3 — Cloud sync
*Google Drive appdata folder · OPFS local cache · last-write-wins with timestamps · debounced upload*
**Status:** not started · **Est:** 2 days

### 🚧 Phase 4 — Calendar integration
*Google Calendar API · two-way sync · upcoming events on HUB · recurring events expanded*
**Status:** not started · **Est:** 1 day

### 🎨 Phase 5 — UI polish
*Press-and-hold touch drag · live preview + autosave notes · progressive node properties · smooth motion · layered dark surfaces (#0F0F0F/#181A1B/#242424) · 8px grid · selection glow · auto-fit + smart placement · redo + tooltips · workspace color coding*
**Status:** P1 ✅ all 6 items done 2026-04-16, P2 ✅ all 8 items done 2026-04-16 — Item #1 ✅ done 2026-04-16 (press-and-hold drag on touch; 350ms gate; swipe→pan / hold→drag / tap→panel unchanged; `.holding` visual + haptic feedback; 5-test spec `tests/phase5_hold_drag.spec.ts` green on desktop-chrome + ipad-safari + ipad-chrome). Item #2 ✅ done 2026-04-16 (live preview + autosave for property panel; `aSnap`/`aFlush`/`aField` helpers with 200ms debounce; `oninput`/`onchange` on all 12 fields; typing no longer rebuilds panel innerHTML — focus stays put; one undo snapshot per panel session; `cp()` flushes pending debounce before hiding; 6-test spec `tests/phase5_autosave.spec.ts` green on desktop-chrome + ipad-safari + ipad-chrome; 67/67 full-suite regression on desktop-chrome). Item #3 ✅ done 2026-04-16 (progressive node properties; primary fields label / body / shape+status / zone stay always visible, secondary fields rationale / url / tags / confidence / color / compact tuck behind a `<details class="pn-more">` disclosure; `panelDetailsOpen` persists across in-session rebuilds, `cp()` resets so fresh open is minimal; native `<details>` with custom chevron (RTL-mirrored for Hebrew); 5-test spec `tests/phase5_progressive.spec.ts` green on desktop-chrome + ipad-safari + ipad-chrome; 72/72 full-suite regression on desktop-chrome). Item #4 ✅ done 2026-04-16 (smooth motion on open/close; #pn fades+slides 220ms ease-out open / 140ms ease-in close, #modal backdrop fades 180ms + inner .mc scales from 0.98 + translateY(8px); `@media (prefers-reduced-motion: reduce)` disables all transitions; `op()`/`cp()` migrated from inline `display:none/block` to `.on` class toggle so the CSS actually transitions; 4-test spec `tests/phase5_motion.spec.ts` asserts non-zero transition-duration on opacity/transform, green on desktop-chrome + ipad-safari + ipad-chrome; 76/76 full-suite regression on desktop-chrome). Item #5 ✅ done 2026-04-16 (layered dark surfaces palette migration; `--bg`/`--bg2`/`--panel`/`--panel2`/`--border` tokens re-set from warm-brown (#1a1815/#22201c/#2a2620/#332d25/#3a352e) to cool neutral greys (#0F0F0F/#181A1B/#242424/#2E2E2E/#333333); all hard-coded `#1a1815` occurrences in `src/app.css` + `public/app.js` swept to `#0F0F0F`; `#toast .ts` bg→`var(--bg2)`; `<meta name=theme-color>` + `#backBtn` inline + `manifest.webmanifest` bg/theme all → `#0F0F0F`; `scripts/gen-icons.mjs` BG constant → `[0x0F, 0x0F, 0x0F, 0xff]` + 4 icons regenerated; `tests/phase2_pwa.spec.ts` theme-color assertion updated; 7/7 Phase 2 PWA tests + 9/9 Phase 5 motion/progressive tests green on desktop-chrome; 8/8 Phase 2 iPad tests green (6 ipad-safari skips pre-existing WebKit-SW flakiness)). Item #6 ✅ done 2026-04-16 (8px grid audit; every `padding`/`margin`/`gap`/`border-radius` token in `src/app.css` normalized to the 4/8/12/16/20/24 step ladder — 40+ spots updated across toolbar, tabs, More menu, sidebar rows, breadcrumbs, filter row, property panel, brow buttons, context/edge-picker menus, modal, dialog, toast, legend, hint; `@media(pointer:coarse)` overrides tightened to 12-step padding too, `.pn-close` bumped from 36×36 → 40×40 for mobile touch; inline-style spacing in `public/app.js` swept — formula-preview 7/14→8/16, color-picker swatch 50→48 + 6→8px radius, paste-patch `<code>` 1/4→2/4 + 3→4 radius, dbg panel headers 5/8→4/8 + 7→8 radius, dbg overlay 6→8 padding + 6→8 radius + bottom 100→104, edge-label 2/5→2/8 + 3→4 radius, picker inputs 7→8 + 10→12; inline select in `index.html` 7→8 + 6/10→8/12. No behavioral/functional changes — all 76 desktop-chrome + 40 iPad Phase-5 tests green post-audit). P1 complete. **P2 Item — selection glow + drag visual feedback ✅ done 2026-04-16** (selected node slice + hit-group gain `.sel` class in render loop; `.nslice.sel` gets a soft accent halo via `drop-shadow(0 0 6px rgba(217,119,87,.45)) + drop-shadow(0 0 2px rgba(217,119,87,.7))` with 160ms transition; during active drag `body.dragging .nslice.sel` brightens to 12/.8 + 3/1 with 80ms transition; rule placed BEFORE `.holding` so the stronger press-and-hold glow still wins during the hold→drag overlap; `@media (prefers-reduced-motion: reduce)` nulls transitions; 5-test spec `tests/phase5_selection.spec.ts` — single-select/close/computed-filter/drag-override/multi-select — 15/15 green across desktop-chrome + ipad-safari + ipad-chrome; 81/81 desktop-chrome full-suite regression green). **P2 Item — expandable description field ✅ done 2026-04-16** (property-panel textareas auto-grow up to 50vh via `aGrow()` helper called on `oninput` + after `op()` innerHTML rebuild, with overflow switching hidden→auto past the cap; every textarea label — f_notes, f_rationale, f_latex — gets a ⇱ button that opens `expandField(fieldId, nodeKey, label)` in the modal overlay at 60vh tall; typing in the expanded `<textarea id=ef_body>` writes through to `sel[nodeKey]` via the existing `aField()` path, and `closeExpanded()` re-syncs the panel textarea from the live value before fading the modal; CSS: `#pn textarea{resize:none;max-height:50vh;overflow-y:hidden}` so JS drives height, `.flabel` flex row for label + button, `.expandBtn` enlarges to 10/16 under `pointer:coarse`; 6-test spec `tests/phase5_expand.spec.ts` — empty-min-height/long-autogrow/keystroke-grow/expand-prefill/expand-writethrough/button-count — 18/18 green across desktop-chrome + ipad-safari + ipad-chrome; 87/87 desktop-chrome + 168/168 iPad full-suite regression green). **P2 Item — redo ✅ done 2026-04-16** (`redoStack` mirrors `hist`; `re()` pops it, pushes current S back onto `hist`, restores, re-renders; any fresh mutation via `sn()` clears `redoStack` so branching history stays linear; ↷ toolbar button next to ↶; `bB()` disables both buttons when their stack is empty (`#tb button:disabled` ~35% opacity via CSS); Ctrl+Y and Ctrl+Shift+Z both trigger redo via `keydown` branches added to the existing Ctrl+Z handler; 6-test spec `tests/phase5_redo.spec.ts` — initial-disabled/addC-un-re-roundtrip/stack-clear-on-mutation/Ctrl+Y/Ctrl+Shift+Z/undo-button-disabled — 18/18 green across desktop-chrome + ipad-safari + ipad-chrome; 93/93 desktop-chrome + 180/180 iPad regression green). **P2 Item — workspace color coding ✅ done 2026-04-16** (`wsColor(name)` derives a stable HSL hue from a polynomial hash of the string `h = (h * 31 + charCode) % 360` so same input always returns same color; `rebuildWsDropdown()` sets an inline `color:hsl(..)` on every `<option>` and pushes `borderLeftColor` + `borderLeftWidth:3px` onto `#wsSel`, with `paddingLeft:10px` compensating so the text doesn't jump right when the stripe widens; bullet prefix dropped to avoid forcing the toolbar to wrap into 2 rows on iPad-Pro-11-landscape (which overlapped the breadcrumbs at top:64px); 6-test spec `tests/phase5_wscolor.spec.ts` — stripe-color-present/stripe-width-3px/per-option-inline-color/switch-updates-stripe/wsColor-stable/padding-compensated — 18/18 green across desktop-chrome + ipad-safari + ipad-chrome; 99/99 desktop-chrome + 192/192 iPad regression green). **P2 Item — paste-patch size sanity ✅ done 2026-04-16** (`applyPatch()` gains a two-tier guard: bytes-first (before parse, cheap) with `PATCH_WARN_BYTES=500KB` → uiConfirm and `PATCH_MAX_BYTES=10MB` → uiNotice-reject; nodes-second (after parse) with `PATCH_WARN_NODES=200` → uiConfirm and `PATCH_MAX_NODES=2000` → uiNotice-reject; `patchNodeCount(raw)` handles both single-patch and multi-patch (`raw.patches[]`) shapes; typical 5–50-node Claude patches still wave through with no prompt; 7-test spec `tests/phase5_patchsize.spec.ts` — constants-exposed/small-no-prompt/oversize-reject/warn-cancel-rollback/warn-apply-anyway/too-many-nodes-reject/nodeCount-aggregation — 21/21 green across desktop-chrome + ipad-safari + ipad-chrome; 106/106 desktop-chrome + 206/206 iPad regression green). **P2 Item — tooltips pass ✅ done 2026-04-16** (audited every toolbar button + sidebar toggle for `title=`; gaps filled on #wsSel · #backBtn · #addBtn · #zoneBtn · #sr · #fitBtn · #moreBtn · sidebar cycle toggle ☰; existing titles expanded — redo now says "Ctrl+Y / Ctrl+Shift+Z" so both shortcuts are discoverable, #heBtn explains "toggle RTL + translated UI"; static English titles in `index.html` are the baseline so browsers show them before JS runs; added `tt*` i18n keys to both `T.en` and `T.he`; `refreshUiText()` now walks a titleMap and overrides each element's title on every language switch, Hebrew mode gets Hebrew tooltips ("התאם תצוגה לכל הנקודות" etc.), toggle back restores English; by-selector lookup covers the anonymous `#sb .sbhead .sbtog` spans; 6-test spec `tests/phase5_tooltips.spec.ts` — all-present/sidebar-present/english-default/hebrew-rewrite/toggle-back/redo-advertises-both-shortcuts — 18/18 green across desktop-chrome + ipad-safari + ipad-chrome; 112/112 desktop-chrome + 218/218 iPad regression green). **P2 Item — auto-fit + smart placement + empty states ✅ done 2026-04-16** (`#emptyState` overlay shown on truly blank canvases (zero nodes AND zero zones) via `render()` toggle of `.on` class; panel has `✦` emoji, title "This canvas is empty", hint paragraph, and accent CTA button that calls `addC()`; `display:none` → `display:flex` via `.on` with 250ms opacity fade; `pointer-events:none` on outer box, re-enabled on `.es-inner` so taps fall through to canvas but CTA is clickable; full i18n — `esTitle`/`esHint`/`esAdd` keys in both `T.en` and `T.he`, updated in `refreshUiText()`; `findFreeSpot(cx,cy)` spirals outward from center with 120px spacing, 8 directions per ring, max 20 rings — consecutive `+ Add` clicks never stack; `addC()` now uses `findFreeSpot`; `applyPatch()` calls `zF()` auto-fit after both single-patch and multi-patch paths when `nodeTotal >= 10`; `zoneAt()` made null-safe for empty zone arrays; `@media(pointer:coarse)` larger padding + 44px CTA min-height; `@media(prefers-reduced-motion:reduce)` disables fade; 7-test spec `tests/phase5_polish.spec.ts` — empty-state-visible/CTA-creates-node/hides-on-add/Hebrew-i18n/smart-placement-spacing/findFreeSpot-center/auto-fit-after-large-patch — 21/21 green across desktop-chrome + ipad-safari + ipad-chrome; 119/119 desktop-chrome + 232/232 iPad regression green). **P2 Item — landing screen + recent workspaces ✅ done 2026-04-16** (on first load with ≥ 2 workspaces, a z-index:200 full-viewport overlay lists all workspaces as `.ld-card` cards with `.ld-stripe` color stripe (reusing `wsColor()`) and node count per workspace (fetched via IDB peek); current workspace gets `.cur` highlight ring; click a card to `switchWorkspace()` + close; "Continue with current" button dismisses without switching; "+ New workspace" opens `newWorkspace()` prompt; Escape key dismisses; `showLanding()` async function called at end of `load()`, skips silently when <2 workspaces; full i18n — `ldTitle`/`ldHint`/`ldNew`/`ldSkip`/`ldCurrent`/`ldNodes` in both `T.en` and `T.he`; `refreshUiText()` updates landing text on Hebrew toggle; CSS: backdrop `rgba(0,0,0,.6)`, inner panel `max-width:460px`, card hover/highlight transitions, `@media(pointer:coarse)` min-height:48px cards + 44px new-ws button, `@media(prefers-reduced-motion:reduce)` disables fade; 7-test spec `tests/phase5_landing.spec.ts` — no-landing-1ws/landing-shows-2ws/cards-with-stripes/current-highlighted/skip-dismisses/card-switches-and-closes/manual-showLanding — 21/21 green across desktop-chrome + ipad-safari + ipad-chrome; 126/126 desktop-chrome + 246/246 iPad regression green). **P2 complete — all 8 items shipped.**

### 🚀 Phase 6 — Final ship
*All patches re-verified · Lighthouse 90+ · production deploy · documentation*
**Status:** not started · **Est:** 1 day

---

## Resources

- **GitHub repo:** https://github.com/omerzahav-pixel/claude-repo-for-NodeZ
- **GitHub username:** `omerzahav-pixel`
- **GitHub PAT:** see `CREDENTIALS.md` (the user has it saved in Notion + Windows Credential Manager)
- **Cloudflare Pages:** to be linked after first deploy in Phase 0
- **Production URL:** to be set after first Cloudflare deploy
- **Google Cloud project:** `nodez-493411`
- **OAuth client_id:** `696635339426-rmc4kuoqvap7khdpota1tjm3764mu29n.apps.googleusercontent.com`
- **OAuth scopes to request:** `drive.appdata`, `calendar`, `openid email profile`

---

## Files in the project folder

- `CLAUDE_CODE_BRIEF.md` — master implementation plan (read first)
- `RESEARCH.md` — deep research backing the architecture
- `BUILD_DASHBOARD.md` — this file (phase tracker)
- `CREDENTIALS.md` — API setup, OAuth client, deployment notes
- `idea_vault.html` — current 96KB single-file implementation (don't break)
- `disc_math_and_probabilty_full.json` — full-state import, 17 canvases, ~280 nodes, Hebrew + KaTeX (primary test case)
- `TRADING_REAL.json` — full-state import, 7 canvases, ~280 nodes, sub-canvas drill-down (primary test case)
- `CHANGELOG.md` — created in Phase 0, updated per phase
- `DECISIONS.md` — created when first architectural pivot happens

---

## Acceptance criteria

- [ ] Works on iPad Safari and iPad Chrome
- [ ] Buttons give visible immediate feedback
- [ ] Drag, pan, pinch-zoom smooth on iPad
- [ ] `disc_math_and_probabilty_full.json` imports via Import button
- [ ] `TRADING_REAL.json` imports via Import button
- [ ] Patch format (single + combined `{patches:[...]}`) still works via Paste Patch button
- [ ] Hebrew RTL works
- [ ] KaTeX renders
- [ ] Add to Home Screen → standalone app
- [ ] Cloud sync verified across computer ↔ iPad
- [ ] Lighthouse PWA score 90+
- [ ] Total JS under 200 KB gzipped
- [ ] Cloudflare Pages auto-deploy from GitHub

---

## Notes from the chat handoff

> The previous chat-based debugging hit a wall after 50+ exchanges because the assistant could not see the iPad. Claude Code can — use Playwright with iPad device emulation early and often.

> The user values quality over speed. He'd rather wait 5 days for something solid than 1 day with bugs.

> The user's #1 frustration: "I tap a button and nothing happens." Every interaction must give visible immediate feedback. Never fail silently.

> The user is on Windows PowerShell. Use Windows-compatible commands.

---

## Future zones (NOT in scope for v2 ship)

- Figma frame embeds in doc/library nodes
- Canva embeds for visual mood boards
- ARS algo trading roadmap port
- Multi-user collaboration

---

## Decision log

*Each major architectural decision Claude Code makes lands here. If something gets pivoted (e.g., DOM rendering didn't work, switched to Canvas 2D), it's documented here with the reasoning. Also writes to DECISIONS.md.*
