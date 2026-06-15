import { describe, it, expect } from 'vitest'
import {
  ZOOM_LEVELS, ZOOM_MIN, ZOOM_MAX, ZOOM_DEFAULT, ZOOM_TOGGLE,
  clampZoom, zoomSpec, zoomModeToLevel, levelIsZoomed,
} from './zoom'

describe('zoom levels', () => {
  it('default level reproduces the legacy normal view', () => {
    expect(ZOOM_LEVELS[ZOOM_DEFAULT]).toEqual({
      ascii: { minW: 33, minH: 21, maxFs: 36 },
      tileAxis: 21,
    })
  })

  it('toggle level reproduces the legacy double-tap zoom view', () => {
    // Guards against drift: old MapView zoom = max(17,33-8)/max(17,21-8) with
    // a 64px cap; old TileMapView ZOOM_AXIS = 17.
    expect(ZOOM_LEVELS[ZOOM_TOGGLE]).toEqual({
      ascii: { minW: 25, minH: 17, maxFs: 64 },
      tileAxis: 17,
    })
  })

  it('levels are monotonic: zooming in never shows more cells or a smaller cap', () => {
    for (let l = 1; l <= ZOOM_MAX; l++) {
      const prev = ZOOM_LEVELS[l - 1]
      const cur = ZOOM_LEVELS[l]
      expect(cur.ascii.minW).toBeLessThanOrEqual(prev.ascii.minW)
      expect(cur.ascii.minH).toBeLessThanOrEqual(prev.ascii.minH)
      expect(cur.ascii.maxFs).toBeGreaterThanOrEqual(prev.ascii.maxFs)
      expect(cur.tileAxis).toBeLessThanOrEqual(prev.tileAxis)
    }
  })

  it('every level keeps LOS visible (axis floor 15, ascii 17)', () => {
    for (const spec of ZOOM_LEVELS) {
      expect(spec.ascii.minW).toBeGreaterThanOrEqual(17)
      expect(spec.ascii.minH).toBeGreaterThanOrEqual(17)
      expect(spec.tileAxis).toBeGreaterThanOrEqual(15)
    }
  })

  it('clampZoom keeps levels in range and integral', () => {
    expect(clampZoom(-5)).toBe(ZOOM_MIN)
    expect(clampZoom(99)).toBe(ZOOM_MAX)
    expect(clampZoom(2)).toBe(2)
    expect(clampZoom(2.4)).toBe(2)
  })

  it('zoomSpec never returns undefined for out-of-range input', () => {
    expect(zoomSpec(-1)).toBe(ZOOM_LEVELS[ZOOM_MIN])
    expect(zoomSpec(100)).toBe(ZOOM_LEVELS[ZOOM_MAX])
  })

  it('binary zoom-mode bridges map onto the two fixed levels', () => {
    expect(zoomModeToLevel(true)).toBe(ZOOM_TOGGLE)
    expect(zoomModeToLevel(false)).toBe(ZOOM_DEFAULT)
    expect(levelIsZoomed(ZOOM_DEFAULT)).toBe(false)
    expect(levelIsZoomed(ZOOM_TOGGLE)).toBe(true)
    expect(levelIsZoomed(ZOOM_MAX)).toBe(true)
  })
})
