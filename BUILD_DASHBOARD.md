# NodeZ — Build Dashboard

*Last updated 15 April 2026 · Status: handoff to Claude Code · Branch: v2-rewrite*

> Mirrors the live Notion dashboard at https://www.notion.so/343704adcc0e8166b4bac09c27ef5349
> When you change phase status here, also update Notion (manually or via Notion MCP if connected).

---

## Mission

Rebuild **Idea Vault → NodeZ** as a reliable, mobile-first knowledge canvas. Same data model, same patches, smoother feel, actually works on iPad.

---

## Phase tracker

### ⏳ Phase 0 — Setup
*Vite project · git worktree · Playwright baseline · Cloudflare Pages connected to GitHub*
**Status:** not started · **Est:** 1–2 hours

### 🚧 Phase 1 — Rendering migration ⚠️ CRITICAL
*Move from SVG to DOM-with-CSS-transforms · viewport culling via rbush · Apple Scribble workaround · Pointer Events on DOM nodes*
**Status:** not started · **Est:** 2–4 days · **Pause here for iPad verification before continuing**

### 🚧 Phase 2 — PWA setup
*Service worker · manifest · PWACompat · navigator.storage.persist() · Add to Home Screen working*
**Status:** not started · **Est:** 1 day

### 🚧 Phase 3 — Cloud sync
*Google Drive appdata folder · OPFS local cache · last-write-wins with timestamps · debounced upload*
**Status:** not started · **Est:** 2 days

### 🚧 Phase 4 — Calendar integration
*Google Calendar API · two-way sync · upcoming events on HUB · recurring events expanded*
**Status:** not started · **Est:** 1 day

### 🎨 Phase 5 — UI polish
*8px grid · layered dark surfaces · command palette · spring animations · per-workspace color theming · bottom nav for mobile*
**Status:** not started · **Est:** 1–2 days

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
