// Discrete user zoom levels shared by both map renderers. A "level" is an
// index into ZOOM_LEVELS; higher = more zoomed IN (fewer cells, bigger
// glyphs/sprites). Each spec is the *minimum* viewport the fit must satisfy —
// fitToContainer then expands beyond it to fill the container, so a smaller
// minimum viewport forces a larger font/cell.
//
// The model generalizes what used to be a binary zoom toggle: level
// ZOOM_DEFAULT reproduces the old "normal" view and level ZOOM_TOGGLE
// reproduces the old double-tap "zoom" view exactly (see the regression test),
// so the existing setZoomMode()/isZoomMode() callers and the double-tap path
// map cleanly onto two fixed levels.

export interface ZoomSpec {
  // ASCII (MapView): minimum viewport axes + font-size cap. minH/minW floor at
  // 17 keeps DCSS LOS (radius 7 ⇒ 15 cells) plus a one-cell border. maxFs is
  // raised as we zoom in so the font can actually grow past the normal cap.
  ascii: { minW: number; minH: number; maxFs: number }
  // Tile (TileMapView): minimum square viewport axis. Cell size is picked to
  // fit this many cells on the binding axis; full-bleed then shows more. Floor
  // 15 keeps LOS on the binding axis.
  tileAxis: number
}

// Index 0 = most zoomed OUT, last = most zoomed IN.
export const ZOOM_LEVELS: readonly ZoomSpec[] = [
  { ascii: { minW: 41, minH: 25, maxFs: 36 }, tileAxis: 25 }, // 0: zoom out
  { ascii: { minW: 33, minH: 21, maxFs: 36 }, tileAxis: 21 }, // 1: normal  (ZOOM_DEFAULT)
  { ascii: { minW: 29, minH: 19, maxFs: 48 }, tileAxis: 19 }, // 2
  { ascii: { minW: 25, minH: 17, maxFs: 64 }, tileAxis: 17 }, // 3: old zoom (ZOOM_TOGGLE)
  { ascii: { minW: 19, minH: 17, maxFs: 84 }, tileAxis: 15 }, // 4: max zoom in
]

export const ZOOM_MIN = 0
export const ZOOM_MAX = ZOOM_LEVELS.length - 1
// Level that reproduces the legacy "normal" (un-zoomed) view.
export const ZOOM_DEFAULT = 1
// Level the double-tap toggle / tile-mode default jumps to — the legacy "zoom".
export const ZOOM_TOGGLE = 3

export function clampZoom(level: number): number {
  if (level < ZOOM_MIN) return ZOOM_MIN
  if (level > ZOOM_MAX) return ZOOM_MAX
  return Math.round(level)
}

// Safe accessor: clamps before indexing so a stale/out-of-range persisted
// level can never read undefined.
export function zoomSpec(level: number): ZoomSpec {
  return ZOOM_LEVELS[clampZoom(level)]
}

// Compatibility bridges for the binary setZoomMode()/isZoomMode() API the
// X-mode, view-swap, and double-tap code still speak.
export function zoomModeToLevel(on: boolean): number {
  return on ? ZOOM_TOGGLE : ZOOM_DEFAULT
}
export function levelIsZoomed(level: number): boolean {
  return level > ZOOM_DEFAULT
}
