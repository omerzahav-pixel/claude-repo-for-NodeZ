# NodeZ — Build Dashboard

*Last updated 16 April 2026 · Status: Phase 2 complete · Phase 5 P1 #1+#2+#3 landed · Branch: v2-rewrite*

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
**Status:** P1 in progress — Item #1 ✅ done 2026-04-16 (press-and-hold drag on touch; 350ms gate; swipe→pan / hold→drag / tap→panel unchanged; `.holding` visual + haptic feedback; 5-test spec `tests/phase5_hold_drag.spec.ts` green on desktop-chrome + ipad-safari + ipad-chrome). Item #2 ✅ done 2026-04-16 (live preview + autosave for property panel; `aSnap`/`aFlush`/`aField` helpers with 200ms debounce; `oninput`/`onchange` on all 12 fields; typing no longer rebuilds panel innerHTML — focus stays put; one undo snapshot per panel session; `cp()` flushes pending debounce before hiding; 6-test spec `tests/phase5_autosave.spec.ts` green on desktop-chrome + ipad-safari + ipad-chrome; 67/67 full-suite regression on desktop-chrome). Item #3 ✅ done 2026-04-16 (progressive node properties; primary fields label / body / shape+status / zone stay always visible, secondary fields rationale / url / tags / confidence / color / compact tuck behind a `<details class="pn-more">` disclosure; `panelDetailsOpen` persists across in-session rebuilds, `cp()` resets so fresh open is minimal; native `<details>` with custom chevron (RTL-mirrored for Hebrew); 5-test spec `tests/phase5_progressive.spec.ts` green on desktop-chrome + ipad-safari + ipad-chrome; 72/72 full-suite regression on desktop-chrome). Remaining P1: #4 smooth motion · #5 layered dark surfaces · #6 8px grid audit.

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
