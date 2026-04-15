# NodeZ Changelog

Newest first. One entry per phase completed.

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
