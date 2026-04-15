# Idea Vault — Claude Code Implementation Brief

**Date prepared:** 15 April 2026
**For:** Claude Code session running on Azamat's local machine
**Owner of project:** Azamat (Bar Ilan student + algorithmic trader, Hebrew/English bilingual, primary device is iPad + computer)

---

## 0. Read this section first

You are taking over an existing single-file HTML web app called **Idea Vault**. It is an interactive whiteboard / knowledge graph tool inspired by Obsidian Canvas, Heptabase, tldraw, Excalidraw, Kinopio. The user uses it for organizing trading systems, university coursework (in Hebrew), and life management.

The current state:
- One file: `idea_vault.html` (~96 KB, ~750 lines of inline JS + CSS in a single file)
- Works perfectly on desktop (Chrome, Safari, Firefox)
- **Does not work reliably on iPad Safari or iPad Chrome** — this is the central problem you must fix
- The user has tried many fixes via a chat-based assistant (me); none have worked. The previous chat assistant ran out of effective context for iPad debugging because the assistant cannot see the user's iPad directly. Claude Code can run a headless browser (Playwright, Puppeteer) and actually test against simulated iPad viewports — please use that capability.

You have **deep research already done** for this project (see `RESEARCH.md` in the same folder, or scroll down to the "Research summary" section below). The research identifies the root cause and the proven fix. Do not re-research from scratch.

This document tells you:
1. What the app does and how it's currently structured
2. What is broken and why
3. The recommended architecture changes (priority-ordered)
4. Concrete tasks to execute
5. Constraints, conventions, and what NOT to break

---

## 1. The app — what it is, what it does

### Core concept
A zoomable, pannable infinite canvas where the user creates **nodes** (different shapes for different types of content) inside **zones** (colored dashed-rectangle regions) and connects them with **edges** (8 types: blocker, feeds, related, derived, example, proof, arrow, custom-labeled). Nodes can have child sub-canvases (drill-down via portal arrow). Multiple **workspaces** allow the user to keep separate worlds for trading, university, life. Hebrew RTL is supported with a toggle.

### Node shapes (10 types)
- `project` — star polygon
- `idea` — circle
- `principle` — diamond
- `resource` — hexagon
- `question` — pentagon with "?"
- `experiment` — triangle with "⚗"
- `library` — book-stack rectangle
- `doc` — document with corner fold
- `formula` — rectangle with KaTeX-rendered LaTeX inside (also has a "compact" mode showing only ƒ glyph)
- `note` — rectangle with Markdown + KaTeX inline math (`$...$` and `$$...$$`)

### Status colors
done=green, progress=blue, pending=yellow, blocked=red, idea=gray. Status determines node fill color.

### Edges
8 types each with a distinct color. Cubic bezier curves. Trimmed ~46px at each end so arrowheads sit at node edge, not buried in node center. Edge labels render as floating HTML labels at midpoint.

### Tabs and workspaces
- Tab bar at the bottom shows all canvases (vault + sub-canvases). Right-click on a tab opens menu (rename, connect to project, delete).
- Workspace dropdown at top-left switches between completely separate state silos. Each workspace has its own canvases, nodes, zones, etc.
- "+ WS" button creates a new workspace.

### Persistence
- Currently uses IndexedDB primary, localStorage fallback. Key format: `vault3-{workspaceName}`.
- Each workspace stored as one big JSON blob.
- Save indicator (green dot near "More" button) shows status.

### KaTeX
- Loaded via CDN (`https://cdn.jsdelivr.net/npm/katex@0.16.9/`)
- Rendered with `strict: 'ignore'` to silence Hebrew-in-math warnings
- Used in formula nodes (whole node = math) and inside note bodies (auto-render of `$...$` and `$$...$$`)

### Hebrew support
- Per-workspace toggle (א/A button)
- Sets `body.he` class which flips `direction: rtl`
- Math content forced to LTR via `.fnode { direction: ltr !important }` to avoid bidi corruption of LaTeX

### Patch system
The app supports a "Paste Patch" feature: user pastes JSON (single patch or `{patches: [...]}` combined patch) → `applyPatch()` deserializes it into nodes/edges/zones. This is how the user loads pre-built content (e.g., his discrete math course canvases). Patch format:
```json
{
  "canvasId": "disc-math",
  "createCanvas": true,
  "canvasName": "Discrete Math",
  "parentCanvas": "vault",
  "parentNodeLabel": "מתמטיקה בדידה — 88195",
  "switchTo": false,
  "replaceZones": true,
  "zones": [...],
  "nodes": [{ "label": "...", "zone": "...", "shape": "formula", "latex": "..." }],
  "edges": [{ "from": "label A", "to": "label B", "type": "feeds", "customLabel": "..." }]
}
```
Combined: `{ "patches": [patch1, patch2, ...] }`.

Existing patch files in `/patches/` (or wherever the user stores them):
- `disc_math_ALL.json` — 11 patches, 143 nodes, 92 edges, full discrete math course in Hebrew
- `life_os_combined.json` — 11 canvases, 238 nodes, life organization system (PARA + GTD hybrid)
- `prob_ALL_combined.json` — probability course material

These patches are valuable — **do not break the patch import system**. Whatever rendering changes you make must continue to support the patch JSON format.

---

## 2. What's broken and why — root cause

**Symptom (on iPad Safari and iPad Chrome):**
- Toolbar buttons render visually but tapping them produces no visible result
- Canvas area is completely black/empty (no zones, no grid)
- Workspace dropdown shows "no options"
- "+ Add" creates a node but the node is invisible
- Legend and More menus open as tiny empty rectangles
- NODES sidebar minimize/maximize is the only thing that works

**Why the previous assistant's fixes didn't work:**
The previous assistant tried (in order): `touch-action: none`, `100dvh` viewport units, Pointer Events polyfilling, removing duplicate event handlers, `viewport-fit=cover`, `position: fixed` on canvas, KaTeX strict mode silencing, default-zone seeding, bulletproof `reconcileCanvases`, debug overlays, error catching wrappers. None fully solved the iPad issue.

**The actual root cause (from research):**
SVG-based interactive rendering is **architecturally incompatible** with reliable iPad/iOS performance. No shipping professional canvas tool uses SVG as its primary interactive engine on mobile:

| Tool | Rendering engine on mobile |
|------|---|
| tldraw | DOM elements + CSS transforms, Canvas 2D for overlays |
| Excalidraw | Two-layer Canvas 2D (static + interactive) |
| Figma | WebGL/WebGPU + WebAssembly |
| Miro | Canvas 2D + DOM hybrid |
| Obsidian Canvas | DOM elements + CSS transforms |

Combined iOS WebKit issues compound the problem:
- **Apple Scribble interception** (iPadOS 14+) eats `pointerdown` events. Workaround: add `touchmove` listener with `preventDefault()` on the canvas. (WebKit Bug #217430)
- **`pointer-events: none` is unreliable on SVG in iOS Safari** (WebKit Bug #154807, still open as of 2026)
- **Boundary pointer events fire in wrong order** for SVG hit-test target changes (only fixed in Safari Technology Preview 229, October 2025)
- **`pointer-events="bounding-box"` for SVG groups** only added in Safari Technology Preview 218 (April 2025) — older iOS versions lack it entirely

The fix is **not more CSS patches**. The fix is to change the rendering architecture.

---

## 3. Recommended architecture changes — priority order

### Priority 1 (CRITICAL, do first): Migrate rendering to DOM-based with CSS transforms

**Why:** This is what tldraw and Obsidian Canvas use. It's proven to work on iPad. It also keeps the rich HTML-content-inside-nodes capability the user has (KaTeX, Hebrew text, scrollable note bodies).

**How:**
- Each node becomes an absolutely-positioned `<div>` with `transform: translate3d(x, y, 0) scale(k)`
- The viewport is a single container `<div>` with `transform: translate3d(panX, panY, 0) scale(zoomK)` applied
- Edges become an SVG layer ON TOP (edges are decorative, not interactive in the same way; SVG works fine for read-only overlays). Or use a Canvas 2D layer for edges.
- Apply `contain: layout style size` to each node container for rendering isolation
- Apply `will-change: transform` to the viewport container during pan/zoom (remove after to avoid memory cost)
- Use `display: none` for nodes outside the visible viewport (viewport culling)

**Files to study:**
- tldraw source on GitHub: https://github.com/tldraw/tldraw (their `Shape` component pattern, but note tldraw v4+ is no longer MIT)
- Excalidraw source: https://github.com/excalidraw/excalidraw (MIT licensed, dual Canvas 2D pattern as alternative reference)

**What to keep from current code:**
- All the data model (nodes, edges, zones, workspaces, canvases, canvasMeta)
- All the patch system logic (applyPatch, applyPatchSingle)
- All the storage layer (IndexedDB primary, localStorage fallback) — but extend with cloud sync (Priority 3)
- Hebrew toggle, KaTeX rendering, status colors, edge types
- Sidebar, tabs, context menus, property panel — these UI components mostly work fine, just don't depend on SVG canvas

**Acceptance test:** App must work on a Playwright iPad emulation (1024x768, touch device, iOS user agent). User must be able to: tap "+ Add" and see a node appear, drag a node and see it move, pinch-zoom and see scale change, pan with one finger and see view translate.

### Priority 2 (HIGH): Convert to PWA with service worker

**Why:** Add-to-Home-Screen on iPad creates a near-native experience. Service worker enables offline use and reliable cache control (eliminates the "Netlify cached the old version" problem the user kept hitting).

**How:**
- Cannot stay as single HTML file anymore. Split into:
  - `index.html` — the app shell
  - `app.js` — main logic
  - `app.css` — styles
  - `manifest.json` — PWA manifest with `"display": "standalone"`, name, icons
  - `sw.js` — service worker (cannot be inlined; must be a separate file at the same scope)
  - `icon-192.png`, `icon-512.png` — app icons (generate placeholders if needed)
- Use **stale-while-revalidate** caching strategy: serve cached version immediately for instant load, then update cache in background
- Increment a `VERSION` constant in `sw.js` on each deploy to force update cycle
- Call `navigator.storage.persist()` on first load to request persistent IndexedDB storage (reduces iOS eviction risk)
- Use **PWACompat** (https://github.com/GoogleChromeLabs/pwacompat) — single script that auto-generates iOS splash screens from manifest at runtime, avoids creating 25+ static splash images

**Acceptance test:** Lighthouse PWA audit score 90+. App loads offline after first visit. Adding to home screen on iPad opens it full-screen without Safari chrome.

### Priority 3 (HIGH): Add Google Drive `appdata` cloud sync

**Why:** The user wants seamless cross-device sync (computer ↔ iPad). Google Drive `appdata` folder is invisible to user, uses non-sensitive `drive.appdata` scope (simpler OAuth consent), and gives 15GB free.

**How:**
- Use **Google Identity Services (GIS) + gapi client library** (entirely client-side, no backend needed)
- Setup: User creates Google Cloud project → enables Calendar API + Drive API → creates Web Application OAuth client ID → adds production domain to authorized origins → app prompts user for one-time consent
- On app load: read instantly from local OPFS cache, then check Drive for newer version by comparing `lastModified` timestamps. If newer, fetch and update local. If local newer, push to Drive after 5-second idle.
- Each workspace stored as separate JSON file in `appdata` folder
- Conflict resolution: simple last-write-wins with timestamp + deviceId. CRDTs are overkill for single user.
- Force-push on `visibilitychange` and `beforeunload`

**Files to study:**
- Google's official quickstart: https://developers.google.com/drive/api/quickstart/js
- `drive.appdata` scope reference: https://developers.google.com/drive/api/v3/appdata

**Acceptance test:** Modify on computer → wait 5 seconds → reload on iPad → changes appear. Multi-workspace switching loads different workspace JSONs from Drive.

### Priority 4 (MEDIUM): Google Calendar two-way integration

**Why:** User has recurring events (university lessons, exams) in Google Calendar. He wants the HUB canvas to show upcoming deadlines, and ideally to create calendar events from inside the app (e.g., adding a "study session" node that appears in his calendar).

**How:**
- Same OAuth client as Drive sync (just request additional `calendar` scope)
- Add an "Upcoming events" panel or zone on the HUB canvas that lists next 30 days of events
- For two-way: a node with type `calendar-event` that, when saved, posts to user's Calendar. Updates flow both ways.
- Always use `singleEvents: true` when listing to expand recurring instances
- Handle 401 token expiry (~1hr lifetime) by silently re-requesting token via `tokenClient.requestAccessToken()`

**Acceptance test:** Recurring lesson on Tuesday shows up in HUB upcoming events. Creating an "Exam prep session" node with a date posts to Google Calendar within 5 seconds.

### Priority 5 (MEDIUM): UI polish — make it feel professional

The user explicitly said: **"smooth, intuitive, professional, not amateur."** Apply these design principles:

- **8px base grid** — all spacing values in multiples of 8 (with 4 for tight icon-label gaps)
- **Layered dark surfaces** — never pure black. Use `#0F0F0F` base, `#181A1B` raised, `#242424` overlay. 5-8% luminance steps.
- **Desaturated accent colors** — current accent `#d97757` (clay) is good, keep it
- **Spring-based animations** for node drag-release, panel open/close. Use Motion library if React, or vanilla `requestAnimationFrame` with velocity/acceleration math
- **Command palette** (Cmd+K / long-press) for switching workspaces, jumping to nodes, executing actions. Use **cmdk** library or build custom.
- **Bottom navigation on mobile** — Workspaces / Search / Add / Settings (replaces top toolbar on small screens)
- **Spaces metaphor** — color-code each workspace (Trading=blue, University=purple, Life=green). Allow swipe between workspaces on mobile.
- **Reduce tab clutter** — when many sub-canvases exist, group by parent project. Pin the HUB canvas. Overflow into a "More canvases" menu.

### Priority 6 (LOW, future): Figma + Canva integration

User has these MCP-connected. Possible integrations:
- Embed Figma frames inside doc/library nodes via `<iframe src="https://www.figma.com/embed?...">` for read-only viewing
- Pull Figma design tokens at build time → CSS custom properties for the app's UI theme
- Embed Canva designs in nodes for visual mood boards

Not urgent. Implement if time allows after Priorities 1-5 are done.

---

## 4. Tech stack decision

**Don't introduce a heavy framework.** The user values simplicity and the fact that it's "just HTML you can drag around." Specifically:

- **No React, Vue, or Svelte.** Stay vanilla JS.
- **OK to add small targeted libraries via CDN or npm:**
  - **rbush** (~6KB) — R-tree spatial index for viewport culling
  - **@use-gesture/vanilla** (only if Pointer Events alone aren't enough for gestures) — actively maintained, framework-agnostic
  - **cmdk** (~12KB) — command palette
  - **Motion One** (~3.8KB) — animation primitives. Tiny and framework-free.
  - Keep KaTeX
  - **Cytoscape.js** is an option for the graph operations layer if you want algorithms (force-directed layout, centrality scores), but it's 170KB gzipped — only add if you actually use multiple of its features.

**Build setup:**
- **Vite** for dev + build. Fast, simple, well-documented. `npm create vite@latest` → vanilla template.
- Output: `dist/` folder with `index.html`, JS chunks, CSS, manifest, service worker, icons. Deploy that folder.
- TypeScript optional but recommended — catches the kind of bugs that have been biting this project. Use a loose `tsconfig` (no strict mode initially).

**Deployment:**
- **Cloudflare Pages** (replace Netlify). Free, unlimited bandwidth, faster cache invalidation.
- Setup: push to GitHub repo → connect to Cloudflare Pages → auto-deploy on push.
- Custom domain optional ($11/yr from Porkbun for `.com`).

---

## 5. Step-by-step task list for execution

Work through these in order. Commit and test each phase before moving on.

### Phase 0: Setup (1-2 hours)
1. Initialize git repo
2. Create Vite vanilla project
3. Move existing `idea_vault.html` content into project structure:
   - Extract inline `<style>` to `src/app.css`
   - Extract inline `<script>` to `src/app.js`
   - `src/index.html` becomes a minimal shell loading the JS/CSS
4. Verify desktop functionality is unchanged
5. Push to GitHub, connect Cloudflare Pages, verify deploy
6. Set up Playwright with iPad device emulation:
   ```js
   const iPad = devices['iPad Pro 11 landscape'];
   ```

### Phase 1: Rendering migration (2-4 days)

7. Create new rendering module `src/render.js`:
   - Replace SVG `cv` with a DOM container `cv` (`<div id="cv">` with `transform: translate3d(...)` for pan/zoom)
   - Each node renders as `<div class="node node-${shape}">` absolutely positioned
   - Edges render as a separate SVG layer (`<svg id="edges">`) overlaid on top, but SVG only used for the line paths — not for hit-testing or events
   - Implement viewport culling using rbush
8. Reimplement input handling using Pointer Events on the DOM nodes directly (no more delegated SVG events):
   - `pointerdown` on a node = start drag
   - `pointerdown` on canvas background = start pan
   - Two pointers = pinch zoom
   - Apply Apple Scribble workaround: `cv.addEventListener('touchmove', e => e.preventDefault(), { passive: false })`
9. Test in Playwright with iPad emulation. Should be able to: render zones, render nodes, drag a node, pan canvas, pinch zoom.
10. Test on user's actual iPad. **Stop and verify before continuing.**

### Phase 2: PWA setup (1 day)

11. Create `public/manifest.json` with proper PWA fields
12. Create `public/sw.js` with stale-while-revalidate caching
13. Add PWACompat script tag to `index.html`
14. Add `<link rel="manifest">`, Apple meta tags, theme color
15. Generate icon-192.png and icon-512.png (placeholder OK for now)
16. Register service worker in `app.js`: `navigator.serviceWorker.register('/sw.js')`
17. Call `navigator.storage.persist()` on first load
18. Verify Lighthouse PWA score 90+
19. Test "Add to Home Screen" on actual iPad

### Phase 3: Cloud sync (2 days)

20. Set up Google Cloud project, enable Drive API + Calendar API
21. Add OAuth Web Application client ID, configure consent screen in Testing mode
22. Implement `src/sync.js`:
    - Login flow: button triggers `tokenClient.requestAccessToken()`
    - Save token to localStorage with expiry
    - On 401, silently re-request token
    - List `appdata` files, download each as workspace JSON
    - Upload changed workspace JSON on idle (5s debounce)
    - Force upload on `visibilitychange` and `beforeunload`
23. Implement OPFS local cache layer (use OPFS via `navigator.storage.getDirectory()`)
24. Test cross-device: change on computer, wait, reload iPad, verify changes appear

### Phase 4: Google Calendar (1 day)

25. Add `calendar` scope to OAuth consent
26. Implement `src/calendar.js`:
    - Fetch upcoming events for next 30 days with `singleEvents: true`
    - Surface in HUB canvas as a special "Upcoming" zone or sidebar widget
    - Provide UI to create event from a node (POST to Calendar API)
27. Test recurring events display correctly

### Phase 5: UI polish (1-2 days)

28. Apply 8px grid to all spacing
29. Layer dark surfaces (`#0F0F0F` / `#181A1B` / `#242424`)
30. Add command palette using cmdk
31. Add bottom navigation for narrow screens
32. Implement spring-based drag-release animation
33. Group/pin/overflow tabs to reduce clutter
34. Add per-workspace color theming

### Phase 6: Polish + ship (1 day)

35. Test that `disc_math_and_probabilty_full.json` imports correctly (full-state import; verifies Hebrew RTL, KaTeX in formula nodes, sub-canvas hierarchy)
36. Test that `TRADING_REAL.json` imports correctly (full-state import; verifies dense graph performance, sub-canvas drill-down)
37. Test Hebrew RTL throughout
38. Test KaTeX in formula and note nodes
39. Run Lighthouse, fix any perf issues
40. Final iPad verification
41. Document changes in CHANGELOG.md
42. Final deploy

---

## 6. Constraints — what NOT to break

1. **Patch JSON format AND full-state import format must both remain compatible.** The user has both kinds of files. The "Import" button takes full-state JSON (replaces workspace). The "Paste Patch" button takes patches (additive). See section 7 for both formats. Test against both `disc_math_and_probabilty_full.json` and `TRADING_REAL.json`.
2. **Hebrew rendering must continue to work** — body `dir="rtl"` toggle, math forced LTR, KaTeX strict-ignore.
3. **Workspace separation must be preserved** — each workspace is a completely separate state silo, switchable via dropdown.
4. **Sub-canvas drill-down via project nodes** — clicking ↗ portal arrow on a project node opens its child canvas. This metaphor is important to the user.
5. **Existing keyboard shortcuts** (Ctrl+Z undo, Ctrl+A select all, Del to delete, Esc to deselect, double-click to create node) must keep working on desktop.
6. **Edge type system** (8 types + custom) and **status color system** (5 statuses) must stay.
7. **Don't bloat the bundle.** Aim for total JS payload under 200KB gzipped including all libraries. KaTeX alone is ~350KB but loads from CDN, doesn't count toward main bundle.
8. **It must still work fully offline once cached.** Cloud sync is an enhancement, not a requirement. App must function entirely from local storage if offline.

---

## 7. Files in this folder you can reference

- `CLAUDE_CODE_BRIEF.md` — this document, the master plan
- `RESEARCH.md` — the deep research that backs this brief. Refer to it for citations and deeper technical detail.
- `BUILD_DASHBOARD.md` — phase tracker, mirrors the Notion dashboard. Update phase status here as you complete each phase.
- `CREDENTIALS.md` — GitHub repo, OAuth client_id, Google Cloud project, Cloudflare setup notes
- `idea_vault.html` — the current single-file implementation. Read this carefully — it has 750+ lines of working logic that you will mostly preserve, just refactor.
- `disc_math_and_probabilty_full.json` — **full-state import** (NOT a patch). 17 canvases, ~280 nodes, Hebrew content covering discrete math (8 sessions + plan) and probability (4 weeks). Use as primary test case for import + Hebrew RTL + KaTeX rendering.
- `TRADING_REAL.json` — **full-state import**. 7 canvases, ~280 nodes covering Asset Rotation System roadmap and algo execution 2026 (with backtest/webhook/failure-modes sub-canvases). Use as primary test case for sub-canvas drill-down + dense graph performance.
- `CHANGELOG.md` — create in Phase 0, update after each phase
- `DECISIONS.md` — create when first architectural pivot happens, document tradeoffs there

### Two distinct import formats the app must support

The user has both kinds of files. Both must continue to work in the rebuild.

**Format A — Full-state import** (the format the user's actual test files use):
```json
{
  "canvases": { "vault": {...}, "disc-math": {...}, ... },
  "canvasMeta": { "vault": { "name": "Vault", ... }, ... },
  "current": "disc-math",
  "nextId": 1234,
  "hebrewMode": true,
  "sbCollapse": false
}
```
This **replaces** the entire workspace state. Used for "Import" button. Should also restore Hebrew mode + current canvas + sidebar collapse state.

**Format B — Patch** (for additive content):
```json
{
  "canvasId": "disc-math",
  "createCanvas": true,
  "canvasName": "Discrete Math",
  "parentCanvas": "vault",
  "parentNodeLabel": "מתמטיקה בדידה — 88195",
  "switchTo": false,
  "replaceZones": true,
  "zones": [...],
  "nodes": [{ "label": "...", "zone": "...", "shape": "formula", "latex": "..." }],
  "edges": [{ "from": "label A", "to": "label B", "type": "feeds" }]
}
```
Or combined: `{ "patches": [patch1, patch2, ...] }`. This **adds** to the existing workspace. Used for "Paste Patch" button.

---

## 8. Communication protocol

- The user (Azamat) will check in via the chat assistant interface periodically. Do not block waiting for him — make reasonable decisions and document them.
- When you finish a phase, write a one-paragraph summary in `CHANGELOG.md` so he can see progress.
- If you hit a fundamental decision point (e.g., "DOM rendering is harder than expected, switch to Canvas 2D?"), **stop and document the tradeoff** in a `DECISIONS.md` file. Don't silently change strategy.
- Use Playwright with iPad emulation for testing. Take screenshots and save them to `test-screenshots/` so the user can review what you saw.
- The user's primary frustration has been "I tap a button and nothing happens." Your top priority is **visible, immediate feedback for every interaction**. If something fails, show a visible error banner. Never fail silently.

---

## 9. Acceptance criteria — done means

- [ ] App loads on iPad Safari and iPad Chrome with full functionality
- [ ] Buttons produce visible, immediate results when tapped
- [ ] Nodes render and are draggable on iPad
- [ ] Pinch-to-zoom and one-finger pan work smoothly on iPad
- [ ] `disc_math_and_probabilty_full.json` imports correctly via full-state Import button (17 canvases, ~280 nodes, Hebrew, KaTeX)
- [ ] `TRADING_REAL.json` imports correctly via full-state Import button (7 canvases, ~280 nodes, sub-canvas drill-down)
- [ ] Patch format (single + combined) still works via Paste Patch button
- [ ] Hebrew RTL works
- [ ] KaTeX math renders in formula and note nodes
- [ ] Add to Home Screen works on iPad → opens as standalone app
- [ ] Google Drive sync: change on computer → reload iPad → changes appear
- [ ] Lighthouse PWA score 90+
- [ ] Total JS bundle under 200KB gzipped (excluding CDN-loaded KaTeX)
- [ ] Hosted on Cloudflare Pages with auto-deploy from GitHub

---

## 10. Research summary (condensed)

The full research is in `RESEARCH.md`. Key takeaways:

**Root cause of iPad failures:** SVG-based interactive rendering does not work reliably on iOS Safari due to compounded WebKit bugs (Scribble interception of pointerdown, unreliable `pointer-events: none` on SVG, boundary event ordering issues). Every shipping professional canvas tool uses Canvas 2D, WebGL, or DOM-with-CSS-transforms — never SVG.

**Recommended fix:** Migrate to DOM-based rendering with CSS transforms (tldraw's pattern). Each node = positioned `<div>` with `translate3d`. Viewport culling via rbush. SVG only for non-interactive edge overlay.

**iOS viewport setup:** `position: fixed; inset: 0` (not `100dvh`). `viewport-fit=cover`. `touch-action: none` on canvas. Apply Scribble workaround: `touchmove` listener with `preventDefault()`.

**Cloud sync:** Google Drive `appdata` folder + OPFS local cache. 15GB free. `drive.appdata` scope is non-sensitive (simpler consent). Avoid Supabase (1-week inactivity pause). Avoid GitHub Gists (PAT exposure risk).

**Google Calendar:** Use Google Identity Services + gapi client library. Token model OAuth (Google's official client-side recommendation). Free up to 1M queries/day. `singleEvents: true` for recurring events.

**Deployment:** Cloudflare Pages > Netlify (better cache invalidation, unlimited bandwidth). Use PWACompat for iOS splash screens.

**Don't use tldraw library** — its v4+ license is now proprietary ($6,000/yr commercial). Study its patterns, don't embed it. Excalidraw (MIT) is the safe alternative reference.

**Math rendering:** KaTeX over MathJax (348KB vs 5MB, faster, sync rendering).

**RTL:** Use HTML `dir="rtl"` and CSS logical properties (`margin-inline-start` not `margin-left`). Wrap math in `<span dir="ltr">`.

---

## 11. Final word

The previous chat-based debugging hit a wall because the assistant couldn't see the iPad. You can. Use Playwright. Use your headless browser. Test against iPad emulation early and often. Don't ship code you haven't seen render in iPad mode.

The user is patient and detail-oriented. He'd rather you take 5 days and ship something solid than 1 day with bugs. Quality over speed.

When in doubt, refer to:
- This brief (`CLAUDE_CODE_BRIEF.md`)
- The full research (`RESEARCH.md`)
- The original code (`idea_vault.html`)

Good luck.
