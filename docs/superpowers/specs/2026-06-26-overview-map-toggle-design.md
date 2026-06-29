# Overview-map toggle (one-button whole-level view)

## Problem

Wide-LOS species (e.g. Barachi, LOS radius 8) need many cells on screen. The
user zooms the tile map far out to see the whole floor at once (e.g. to find
the stairs after clearing a level), but at that zoom tile sprites become tiny
mush — unreadable. ASCII mode would stay legible but the user finds ASCII
unfamiliar and doesn't want it forced.

## Goal

One button that **toggles** between two states:

1. **Overview** — the whole *explored* level fits on screen (tiles, not ASCII),
   with a readable glyph overlay marking **stairs (`<` / `>`) and shops only**.
   No monster overlay (avoids clutter when the map is packed with monsters or
   revealed wide by magic mapping). Purpose: navigation / stair-finding.
2. **Play** — back to the user's previous zoom (their comfortable ~8–9 cell
   radius). Toggling overview off restores exactly the zoom level they were at.

Normal play is otherwise untouched: no forced ASCII, no always-on overlay.

## Design (as built)

True whole-level fit-to-bounds was judged too heavy and too cramped on a phone
(a full 80×70 level → ~5px cells, overlapping markers). Instead we **extend the
existing discrete zoom system** with wider levels — far less code, reuses all
zoom machinery, stays player-centered so cells don't collapse — and the value
comes from the marker overlay, which is legible at any zoom.

### Viewport: 3 wider zoom levels

`zoom.ts`: prepend 3 levels at the zoom-OUT end (tileAxis 31/37/43 vs the old
max of 25). Prepending keeps the "index 0 = most out" convention; the legacy
constants shift up by 3 (`ZOOM_DEFAULT` 1→4, `ZOOM_TOGGLE` 3→6) and a new
`ZOOM_OVERVIEW = 0` names the widest. The +/- controls reach the new levels too.

### Overlay: stairs (+ shops) on the canvas

`TileMapView` already draws ASCII glyphs onto its single `<canvas>`, so the
overlay reuses that text-draw capability via a final `drawMarkers()` pass:

- The backing canvas draws each cell at `ATLAS_CELL` then CSS-scales to
  `cellPx`, so markers are **inverse-scaled** (font = TARGET_PX / scale) to land
  at a ~fixed on-screen size no matter how far out the zoom is — that's what
  keeps them readable while tiles shrink.
- Drawn last (over tiles/cursor/minibars), high-contrast (coloured glyph + black
  outline). `>` downstairs (yellow), `<` upstairs (cyan).
- Detection is by **map glyph** (`cell.g`) — reliable across render modes and
  versions. Escape hatches / branch entrances share `>`/`<` and surfacing them
  is fine (all navigation). `overviewMarker()` is the single classifier.
- Shops / gates / portals are marked too, via the `∩` glyph (confirmed against
  live data), in a distinct colour. Detection stays glyph-based in
  `overviewMarker`.
- Monsters get **no** overlay — they appear only as their (tiny) tiles.

### Button

- Toggle button (`▣`) beside the floating zoom +/- controls, lit when active.
- Tap → overview: widest zoom (`ZOOM_OVERVIEW`) + markers on, refit.
- Tap again → restore the user's zoom, markers off.
- **Transient**: never persists to `mapZoomLevel` (reload returns to real zoom);
  any manual +/- or a render-mode swap exits overview (`clearOverview`).

### Scope / non-goals

- **Tile renderer only**. `MapView` (ASCII) gets a no-op `setMarkers` so the
  caller is uniform; ASCII already shows `<`/`>` legibly.
- Tap-to-travel inside overview is not specially designed; existing
  `cellAtClient` geometry applies as-is.
- Shops (see above) are a follow-up, not in this cut.

## Testing

- `zoom.ts`: `ZOOM_OVERVIEW` is the widest level; levels stay monotonic and keep
  the LOS floor (existing zoom.test.ts invariants).
- `overviewMarker()`: marks `>`/`<` with distinct colours, ignores walls / floor
  / player / undefined.
- game-view: the overview button toggles its active state; a manual zoom step
  exits overview.
