# NodeZ — Deep Research: From Desktop Prototype to Professional Mobile Tool

*Research date: 15 April 2026 · For: Claude Code implementing the NodeZ rebuild*

---

## TL;DR — the one thing that matters

**SVG-based interactive rendering is architecturally incompatible with reliable iPad/iOS performance.** No shipping professional canvas tool uses SVG as its primary interactive engine on mobile. Every successful whiteboard (tldraw, Excalidraw, Figma, Miro) uses Canvas 2D, WebGL, or DOM elements with CSS transforms. The repeated failures on iPad Safari aren't CSS bugs you can patch — they're the consequence of a rendering architecture that iOS WebKit handles poorly.

The path forward requires either migrating the rendering layer to Canvas 2D or adopting DOM-based rendering with aggressive viewport culling, combined with Google Drive `appdata` for frictionless cloud sync and Cloudflare Pages for deployment.

---

## 1. Why iPad Safari breaks and what the real fix is

The root cause is a stack of compounding WebKit bugs that collectively make SVG pointer interaction unreliable on iOS.

- **Apple's Scribble feature** (iPadOS 14+) aggressively intercepts `pointerdown` events even outside focused inputs — WebKit Bug #217430. **Workaround:** add a `touchmove` listener with `preventDefault()` on the canvas element.
- The CSS property `pointer-events: none` does **not** reliably work on SVG elements in iOS Safari (WebKit Bug #154807, still open as of 2026).
- **Boundary pointer events** — `pointerout` and `pointerover` — fire in the wrong order or not at all when the hit-test target changes under a stationary pointer. Only fixed in Safari Technology Preview 229 (October 2025).
- `pointer-events="bounding-box"` for SVG groups was only added in Safari Technology Preview 218 (April 2025), meaning older iOS versions lack it entirely.

**The fundamental problem:** every SVG element is a DOM node, and iOS Safari handles DOM mutations and event delegation on SVG elements differently than on HTML. Combine this with iOS's aggressive gesture recognition system (Scribble, system pinch-zoom, scroll bounce) competing for the same touch events, and you get a hostile environment that no amount of CSS `touch-action` patching can fix.

### What professional tools actually do

| Tool | Rendering engine | Mobile strategy |
|------|-----------------|----------------|
| tldraw | DOM elements + CSS transforms, Canvas 2D for overlays | Pure web, responsive |
| Excalidraw | Two-layer Canvas 2D (static + interactive) | Pure web |
| Figma | WebGL/WebGPU + WebAssembly (C++) | View-only on web, native app for editing |
| Miro | Canvas 2D + DOM hybrid | Native iPad app wrapper |
| Obsidian Canvas | DOM elements + CSS transforms | Capacitor wrapper for mobile |

tldraw renders shapes as HTML/SVG React components positioned via `translate3d()` CSS transforms with `contain: layout style size` for rendering isolation, then culls off-screen shapes with `display: none`. They migrated shape indicators from SVG to Canvas 2D rendering (v4.4.0) for **25× faster rendering**, with an open issue to convert all remaining SVG overlays to Canvas.

Excalidraw uses a strict two-canvas Canvas 2D architecture — a static canvas for drawing elements via RoughJS and an interactive canvas for selection handles, each with viewport culling and throttled rendering at 60fps. SVG is used only for export, never for interactive rendering.

### Recommended migration path for NodeZ

The highest-impact change is moving interactive rendering off SVG DOM nodes. Three viable approaches in order of effort:

1. **Intermediate fix (days):** Keep SVG data model but add aggressive viewport culling — `display: none` on all SVG groups outside the visible viewport using an R-tree spatial index. Add the Scribble workaround, set `touch-action: none` on root SVG, use `position: fixed; inset: 0`. Won't solve all issues but reduces them.
2. **Canvas 2D migration (weeks):** Adopt Excalidraw's dual-canvas pattern. Render nodes to a static Canvas 2D layer, selection handles to an interactive canvas layer. Use Konva.js for built-in event system + hit-testing, or Rough.js. KaTeX can pre-render math to images.
3. **DOM hybrid (weeks):** Adopt tldraw's pattern — render each node as an absolutely-positioned HTML `<div>` with CSS transforms, browser compositor for GPU acceleration. Preserves DOM accessibility, allows rich HTML inside nodes (iframes, formatted text, KaTeX). Pair with viewport culling and Canvas 2D for connection lines.

**Recommendation: option 3 (DOM hybrid).** Best fit for NodeZ because of the rich-content-in-nodes requirement (KaTeX, Hebrew text, scrollable note bodies).

---

## 2. The essential iOS viewport and touch setup

Regardless of rendering approach, the correct iOS viewport configuration is non-negotiable.

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

CSS foundation — use `position: fixed; inset: 0` rather than `height: 100dvh` (this is what tldraw uses, avoids URL bar collapse issues entirely):

```css
html, body {
  position: fixed;
  inset: 0;
  overflow: hidden;
  overscroll-behavior: none;
}
.canvas-container {
  width: 100%;
  height: 100%;
  touch-action: none;  /* not "manipulation" — full control */
  -webkit-user-select: none;
  user-select: none;
}
```

Safe area insets for notch/Dynamic Island require `padding: env(safe-area-inset-*)` on UI overlay elements (not the canvas itself).

**No gesture library or polyfill needed.** Pointer Events are natively supported in all browsers since 2019. Hammer.js is dead (last release 2016). The 300ms tap delay was eliminated in Safari 9.1 (2016) when using `width=device-width`. Use native Pointer Events with `setPointerCapture()` for drags and custom multi-pointer tracking for pinch-zoom. If higher-level gesture abstractions are needed, **@use-gesture/vanilla** (framework-agnostic, actively maintained by pmndrs) is the best option.

---

## 3. Google Calendar sync works entirely client-side

Two-way sync from a single HTML/JS app with no backend is fully feasible using Google Identity Services (GIS) + the gapi client library. Google's official quickstart demonstrates exactly this.

```html
<script src="https://apis.google.com/js/api.js"></script>
<script src="https://accounts.google.com/gsi/client"></script>
```

**Auth model:** the **GIS token model** (OAuth 2.0 implicit grant). Technically deprecated by IETF standards but Google still fully supports it and recommends it for client-side web apps. Google does **not** support PKCE without a `client_secret` for Web Application client types, making auth-code-with-PKCE impossible without a backend. Token model opens a popup, returns access token, works for single-user tools.

**Implementation details:**
- Access tokens expire after ~1 hour with no refresh token client-side
- Pattern: catch 401 errors → call `tokenClient.requestAccessToken()` again → if user has active Google session, re-auth happens silently
- Calendar API is **completely free** at 1,000,000 queries/day per project. Single user will never approach this.
- CORS is not an issue — `gapi.client` handles it transparently
- Always use `singleEvents: true` when listing recurring events to get expanded instances

**Cloud Console setup:** create project → enable Calendar API → configure OAuth consent in Testing mode (only your email as test user, no Google review needed) → create Web Application OAuth client ID with production domain + `http://localhost` in authorized JavaScript origins. Use `calendar` scope for full read-write access.

---

## 4. Google Drive `appdata` is the optimal cloud sync solution

After evaluating seven cloud storage options, **Google Drive's hidden `appdata` folder** paired with OPFS local caching is the clear winner.

- Invisible to user and other apps
- Uses `drive.appdata` scope (classified non-sensitive — simpler consent)
- 15 GB free storage — orders of magnitude more than needed

**Architecture:**
1. On app load, read instantly from OPFS (Origin Private File System, supported on iOS Safari 15.2+)
2. In background, check Drive for newer version by comparing `lastModified` timestamps
3. On edit, write to OPFS immediately with debouncing
4. Push to Drive after 5 seconds of idle
5. Force-push on `visibilitychange` and `beforeunload`

Gives instant local performance + cloud persistence.

| Option | Free storage | Mobile friction | Auto-save | Offline | Risk |
|--------|-------------|-----------------|-----------|---------|------|
| **Google Drive appdata** | 15 GB | Low (one-time OAuth) | Yes | With OPFS cache | Low — user owns data |
| Firebase Firestore | 1 GB, 50K reads/day | Low | Yes | Built-in | Medium — evolving policies |
| Supabase | 500 MB | Low | Yes | None built-in | **High — pauses after 1 week inactive** |
| Dropbox | 2 GB | Low | Yes | None | Low |
| GitHub Gists | Unlimited (1 MB/file) | **High** (PAT entry) | Yes | None | **High — PAT exposed client-side** |
| iCloud/CloudKit JS | N/A | Medium | Yes | None | **High — requires $99/yr Apple Dev account** |

**Conflict resolution:** simple last-write-wins with timestamps is sufficient for single user on two devices. Store `{ lastModified: Date.now(), deviceId: "..." }` with each workspace. CRDTs (Yjs, Automerge) are engineering overkill for single-user.

---

## 5. Making it feel professional, not amateur

The difference between premium apps (Linear, Notion, Superhuman) and amateur web tools comes down to four elements:

1. **Consistent spacing** — 8px base grid is industry standard. Primary values 8/16/24/32/48px, with 4px for tight associations.
2. **Restrained typography** — system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui`), line heights as multiples of 4px, max 3 sizes for hierarchy.
3. **Physics-based motion** — spring animations, never duration-based. Andy Matuschak (ex-Apple): "Animation APIs parameterized by duration and curve are fundamentally opposed to continuous, fluid interactivity." For vanilla JS, simple spring physics with `requestAnimationFrame` + velocity/acceleration math. **Motion library** (motion.dev) is the gold standard if using framework.
4. **Surface hierarchy** — for dark mode, never use pure black. Layered dark grays: `#0F0F0F` base, `#181A1B` raised, `#242424` overlay, stepping up 5–8% luminance per layer. Shadows ineffective in dark mode — surface luminance replaces them. Desaturate accent colors.

**For tab/canvas management:** implement command palette (Cmd+K). Libraries like **cmdk** or **kbar**. Centered modal with fuzzy search over workspaces, nodes, zones, actions. Eliminates need for complex tab management.

**For mobile navigation:** quantitative evidence strongly favors bottom navigation bar. Redbooth saw **65% increase in DAU** after switching from hamburger to bottom tabs. Use 3–5 bottom items. Gestures supplement, not replace, visible controls.

---

## 6. Open-source projects worth studying — and a critical license warning

**tldraw is NOT MIT licensed.** As of SDK v4.0 (late 2025), tldraw uses a proprietary license prohibiting production use without a paid commercial license ($6,000/yr per team). Only tldraw v1.x (unmaintained) and starter kits remain MIT. **Study tldraw patterns for inspiration only — do not embed or fork tldraw itself.**

**Excalidraw (MIT)** is the safest professional reference. Dual-canvas architecture, RoughJS integration, element schema migration, collaboration model — all well-documented and freely usable.

**Cytoscape.js (MIT)** — only major graph library that works in vanilla JS, loads via single CDN script tag at ~170KB gzipped. Provides graph algorithms (BFS, DFS, shortest path, PageRank, betweenness centrality), force-directed layout, CSS-like stylesheets. New WebGL renderer (v3.31, January 2025) significantly improves performance.

**JSON Canvas format** (MIT, jsoncanvas.org) — open spec behind Obsidian Canvas. Simple, well-documented. Defines four node types (text, file, link, group) and edges. Worth implementing as import/export format for Obsidian interop.

**Kinopio** (open-source client, Vue.js) — remarkable lightweight architecture (~220KB total bundle). "Patch cable" connection metaphor (drag from edge, inspired by modular synthesizers).

---

## 7. Deployment: Cloudflare Pages replaces Netlify

For the intermittent Netlify issues (stale caches, random URLs), **Cloudflare Pages** is the recommended replacement.

- **Unlimited bandwidth** (zero bandwidth fees)
- 500 builds/month free
- Cloudflare's global edge CDN
- Git-based deployment
- More aggressive cache invalidation than Netlify (solves the stale-version problem)

**Deploy workflow:** push to GitHub → Cloudflare auto-builds → iPad sees new version within seconds.

**GitHub Pages** is the simplest alternative — completely free, custom domains with HTTPS, no build step. Limitation: no serverless functions, 100 GB/month bandwidth cap. Fine for personal tool.

**PWA requirements:** three files minimum — `index.html`, `manifest.json`, `sw.js`. Service workers cannot be inlined. Manifest needs `"display": "standalone"` for full-screen iOS. For iOS splash screens: **PWACompat** (Google Chrome Labs) auto-generates from manifest at runtime, avoids creating 25+ static splash images.

**Service worker pattern:** stale-while-revalidate. Serve cached version immediately, update in background. Increment `VERSION` constant per deploy to trigger update cycle. Call `skipWaiting()` to activate new version immediately.

**Domain options:** Porkbun .com at $11.08/year with free WHOIS privacy. Cloudflare Registrar ~$1 cheaper at wholesale cost but requires Cloudflare nameservers.

---

## 8. Hebrew RTL, math rendering, and performance at scale

For bidirectional Hebrew/English text:
- HTML `dir="rtl"` (not CSS `direction`) as base
- CSS logical properties throughout: `margin-inline-start` (not `margin-left`), `text-align: start`, `inset-inline-start`
- One CSS file works for both directions
- Numbers display LTR automatically via Unicode Bidi Algorithm
- Math equations: wrap in `<span dir="ltr">` to prevent rendering issues
- Flexbox and Grid use logical start/end semantics — work correctly with RTL out of the box

**KaTeX over MathJax.** Bundle size 348 KB vs MathJax's 5 MB, renders synchronously without page reflows, consistently faster in benchmarks. For PWA needing offline capability, smaller bundle is decisive. KaTeX `renderToString()` enables pre-rendering — useful if migrating to Canvas 2D (pre-render math as HTML, draw to canvas via foreignObject or capture as image).

**Performance with hundreds of nodes on mobile:** viewport culling is the single highest-impact optimization. Only render nodes whose bounding boxes intersect visible viewport. Use R-tree spatial index — **rbush** library (~6KB) is the standard. With culling, 500-node canvas with 50 visible nodes only renders those 50 — total node count becomes irrelevant to frame rate.

Apply `CSS contain: layout style size` on each node container. Use `will-change: transform` on canvas container for GPU-accelerated panning (remove after to avoid memory cost). **Avoid SVG `<filter>` elements on mobile** — performance killers.

---

## 9. Figma and Canva integration possibilities

**Figma embeds** work via read-only iframes using Figma's Live Embed:
```html
<iframe src="https://www.figma.com/embed?embed_host=share&url=FIGMA_URL">
```

The Figma REST API can extract design tokens (colors, typography, spacing) using a Personal Access Token. Workflow: **Tokens Studio** plugin exports Figma Variables as JSON → transform via Style Dictionary → generate CSS custom properties. Bake design tokens in at build time.

**Canva embeds** as read-only iframes via Share → Embed:
```html
<iframe src="https://www.canva.com/design/DESIGN_ID/view?embed">
```

Design must have link-sharing enabled. Canva Connect API exists but oriented toward platform partnerships, not personal app integration.

For NodeZ: Canva embeds inside doc/library nodes (mood boards, visual plans) is the practical integration path. Not in scope for v2 ship.

---

## 10. The three highest-impact improvements, prioritized

**1. Fix the rendering architecture (CRITICAL).** Implement viewport culling immediately — every SVG group outside visible viewport gets `display: none`. This alone may make the current SVG approach tolerable on iPad. Add Scribble workaround, `touch-action: none`, `position: fixed; inset: 0`. If insufficient, migrate to DOM-based rendering with CSS transforms (tldraw's pattern) — proven at scale on iOS.

**2. Deploy on Cloudflare Pages with PWA setup (HIGH IMPACT, LOW EFFORT).** Move off Netlify to eliminate stale-cache problems. Add `manifest.json` and `sw.js` for offline + Add-to-Home-Screen on iPad. Use PWACompat for splash screens. Call `navigator.storage.persist()` on first load to request persistent IndexedDB storage, reducing iOS eviction risk. Turns app into something that feels installed rather than visited.

**3. Add Google Drive `appdata` sync (HIGH IMPACT, MEDIUM EFFORT).** Eliminates fragile IndexedDB-only persistence that risks data loss on iOS. Provides seamless multi-device sync. Enables multi-workspace (Trading/University/Life) workflow with separate JSON files. Auto-save with debouncing means user never thinks about saving. OAuth popup is one-time per device. `drive.appdata` scope keeps workspace files invisible in Drive. Combined with OPFS cache, creates offline-first architecture where cloud sync is transparent and data loss becomes nearly impossible.
