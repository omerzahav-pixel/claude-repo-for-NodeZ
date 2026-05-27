# EdgeSpace · Performance Baseline

Recorded measurements that the Phase 4 work (Canvas Tile Cache, `Pass 7 § 05`)
should improve against. Each entry: workspace, canvas, device, gesture, and
the frame-budget rate the perf HUD reported.

How to capture a new entry:
1. Open the deployed app with `?debug=perf` appended to the URL.
2. Switch to the target workspace and canvas.
3. Perform the gesture for ~5 seconds.
4. Read the `budget` line on the HUD. Record the colored percentage.
5. Append a row below.

---

## Sprint 3.5 — initial measurements

| Workspace | Canvas | Device | Gesture | Budget rate | Notes |
| --- | --- | --- | --- | --- | --- |
| `uni` | `Algo Execution` | iPad Pro 11" (user-reported) | One-finger pan | UNRESPONSIVE | User: "doesn't move at all". Frame budget exceeded so consistently the pan handler never gets a stable frame to commit. Definitive Phase 4 target. |
| `uni` | `Vault` | iPad Pro 11" (user-reported) | One-finger pan | "low frames when many things on screen" | Below 60 FPS sustained; user feels lag. |

These two readings come from user reports; the perf HUD wasn't installed
when the user took these. Sprint 3.5 ships the budget-rate badge so the
NEXT iPad session can fill in the actual percentages. The Phase 4 brief
should use this file as the baseline-vs-target table.

---

## What Phase 4 should achieve

Per `Pass 7 § 05` (Canvas Tile Cache):
- Tile the canvas viewport. Each tile is a cached raster of nodes/edges
  whose bounding box intersects the tile.
- Pan = composite tiles (cheap GPU blit) rather than re-rasterise per frame.
- Re-rasterise only the tile that contains a moved/added/edited node.
- Target on Algo Execution: budget rate <= 10 % (green) for one-finger pan.
- Target on a 2000-node synthetic canvas: budget rate <= 33 % (amber).
