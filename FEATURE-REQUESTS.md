# Feature requests

Real product gaps surfaced by user feedback that don't fit a current sprint's
remit. We log them here instead of letting them rot in chat history. Each
entry: short title, who asked, why, suggested shape, and whether anything is
required of the next sprint.

---

## FR-1 · User-created parent canvases / re-rooting

**Asked:** Sprint 3.2 feedback round.

**Why:** When the user imports a tree of canvases (e.g. a probability
roadmap with multiple sub-canvases), it lands as a flat set of canvases
visible only via the tab strip. The Vault canvas sits behind the
imported parent. The user wants to:

1. **Explicitly set the "root" of a workspace** — which canvas opens by
   default when the workspace is loaded. (Partial fix in Sprint 3.2:
   "Set as default for this workspace" context-menu action; see
   `setDefaultCanvasForWorkspace` in `app.js`.)
2. **Create a brand-new parent canvas** that holds existing canvases as
   children. Today canvases acquire a parent only via the "create
   roadmap from this project node" flow inside the Vault.

**Suggested shape:**
- A "New parent canvas" action in the spine's `+` menu or in the
  drawer's empty-state, which:
  - prompts for a name
  - creates an empty canvas
  - lets the user multi-select existing canvases and re-parent them to
    this new canvas (set their `canvasMeta[id].parentCanvas` to the new
    canvas id)
- A "Re-parent…" action in the per-canvas drawer-row context menu that
  opens a picker of all canvases in the workspace and lets the user pick
  the new parent.

**Required for Sprint 4?** No. Out of scope unless the user explicitly
prioritises it.

---

## FR-2 · Workspace-default canvas already shipped in Sprint 3.2

Sprint 3.2 Issue 5 added the "Set as default for this workspace" option
in the drawer-row context menu. Persisted per-workspace at
`localStorage['edgespace-default-canvas:' + workspaceName]`. On
workspace open, `loadState()` reads the key and calls `switchTo()` if
the canvas still exists. See `setDefaultCanvasForWorkspace()` in
`public/app.js`. Documented here so future work doesn't re-invent it.

---

## FR-3 · Drag-reorder workspace chips on the spine

**Asked:** Sprint 3.4 brief, Issue 9. Deferred from 3.4 by user choice
on the recommended option.

**Why:** Sprint 3.4 Issue 4 promoted four action chips (Search, Undo,
Import, Lang) into the spine alongside the Options gear and `+` add-
workspace. As workspace count grows the user will want to reorder
workspace chips to put the most-used at the bottom (most reachable on
iPad).

**Suggested shape:**
- Long-press a workspace chip on iPad / mouse-down + drag on desktop.
- Visual: chip lifts (shadow), other chips reflow to make room.
- Drop: persist new order to the workspace list (`saveWorkspaces` in
  `app.js` already accepts an ordered array).
- The Add (`+`), Options (gear), Lang, Import, Undo, Search chips are
  fixed in place and not reorderable.
- Long-press conflict: the drawer-row long-press menu (Sprint 3.2
  Issue 5) is on different DOM elements, so no collision. But the
  add-node long-press on canvas IS on `cv` — chip long-press is on the
  spine chip element, also no collision. Sanity-check on a real iPad
  before shipping.

**Required for Sprint 4?** No. Standalone feature, easy to add later.
