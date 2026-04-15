# NodeZ — Architectural Decisions Log

Each decision landed here when an architectural choice diverged from the brief
or when a significant tradeoff was made. Newest first.

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
