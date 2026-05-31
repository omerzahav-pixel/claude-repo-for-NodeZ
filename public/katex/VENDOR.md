# Vendored KaTeX (0.16.9)

These files are a **local copy** of [KaTeX](https://katex.org/) `0.16.9`, vendored in
Sprint 7 (Issue 0) to remove a runtime CDN dependency.

## Why vendored (not CDN)

KaTeX used to load from `https://cdn.jsdelivr.net/npm/katex@0.16.9/...`. When that
cross-origin script failed (content blocker, flaky network, CSP), Safari surfaced an
opaque **`Script Error @?:?`** — no file, no line — because the browser hides details
of errors thrown by another origin. Serving KaTeX same-origin gives real stack traces
and removes the third-party point of failure (project constraint: no runtime CDN).

## Contents

| File | Source in the npm package |
|------|---------------------------|
| `katex.min.js` | `katex/dist/katex.min.js` |
| `katex.min.css` | `katex/dist/katex.min.css` |
| `contrib/auto-render.min.js` | `katex/dist/contrib/auto-render.min.js` |
| `fonts/*.woff2`, `fonts/*.woff` | `katex/dist/fonts/` (woff2 preferred; woff fallback) |

`.ttf` fonts are intentionally omitted — every target browser (incl. iOS Safari)
supports woff2/woff, and the `@font-face` `src` lists woff2 first.

## Referenced from

`index.html` — `<link>`/`<script>` tags point at `./katex/…`.

## Re-vendoring

```sh
npm install katex@0.16.9 --no-save
cp node_modules/katex/dist/katex.min.js          public/katex/
cp node_modules/katex/dist/katex.min.css         public/katex/
cp node_modules/katex/dist/contrib/auto-render.min.js public/katex/contrib/
cp node_modules/katex/dist/fonts/*.woff2 node_modules/katex/dist/fonts/*.woff public/katex/fonts/
```

The service worker (`public/sw.js`) serves `/katex/*` cache-first/SWR (it only changes
on a redeploy, which bumps the SW `VERSION` and sweeps the old cache).
