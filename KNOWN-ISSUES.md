# EdgeSpace · Known Issues

Issues that have been investigated but not resolved, parked for fresh evidence.

---

- iPad-only orange residue when dragging project nodes inside zones.
  Investigated across phases 2.5 / 2.6 / 2.7 / 2.8 / 2.9 without a
  conclusive root cause. Removing the project node amber rim
  (phase 2.9) did not eliminate it, which suggests the source is
  somewhere else in the render pipeline — possibly an SVG
  filter/mask cache or a Cloudflare Pages caching artifact on the
  particular iPad. Deferred to a future investigation when fresh
  evidence emerges (e.g. via fresh Web Inspector capture after a
  hard cache clear, or a Mac with Safari Web Inspector connected).

- Auto-break tooltip invisible on iPad despite Phase 2.7 visualViewport
  positioning fix. Line break itself works (confirmed by user). The
  toast just doesn't appear. Deferred per user — "not that important
  if you just have issues with that."

---

## Sprint 3.5 — Import-doubling cleanup (auto-applied)

Earlier sprints (probably the period when both the old top toolbar's
`<label for="imp">` and the new spine Import chip's `<label for="imp">`
co-existed without flag-gating) appear to have caused some users'
workspaces to ingest the same canvases twice. The user reported
duplicate `probability` and `execution` canvases that could not be
removed.

**Mitigation shipped in Sprint 3.5:**
1. `imF()` now has a 1.5 s re-entry guard so iOS Safari can't dispatch
   the change event twice within one file-picker session.
2. `reconcileCanvases()` runs a new `dedupeIdenticalCanvases()` pass
   that removes byte-equal duplicate canvas pairs within a workspace.
   Conservative — anything non-identical is left alone and surfaced as
   a `console.warn` so the user can inspect manually.
3. Issue 5 of Sprint 3.5 adds an explicit "Delete canvas" option in the
   drawer-row context menu for any remaining manual cleanup.

Migration runs automatically on every workspace load (it's inside
`reconcileCanvases`). Idempotent — safe to run repeatedly. No data
loss for divergent canvases.
