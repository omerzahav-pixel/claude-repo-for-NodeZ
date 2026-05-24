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
