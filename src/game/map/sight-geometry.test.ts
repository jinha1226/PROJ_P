// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MapStore } from './map-store'
import { TileMapView } from './tile-map-view'

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren() })
describe('portrait tile framing', () => {
  it('fits species LOS plus border, fits explored bounds while held, and restores player centering', () => {
    const ctx = new Proxy({} as CanvasRenderingContext2D, {
      get(target, key) {
        const values = target as unknown as Record<PropertyKey, unknown>
        return values[key] ?? (values[key] = vi.fn())
      },
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    const store = new MapStore()
    store.playerPos = { x: 0, y: 0 }
    store.merge([{ x: -20, y: -15, g: '.', col: 7 }, { x: 35, y: 20, g: '.', col: 7 }])
    const view = new TileMapView(store)
    document.body.appendChild(view.element)
    view.element.style.padding = '0px'
    vi.spyOn(view.element, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 390, height: 500 } as DOMRect)
    view.setSightAxis(19); view.fitToContainer()
    for (const x of [-9, 9]) {
      const point = view.cellClientCenter({ x, y: 0 })!
      expect(point.x).toBeGreaterThanOrEqual(0); expect(point.x).toBeLessThanOrEqual(390)
      expect(view.cellAtClient(point.x, point.y)).toEqual({ x, y: 0 })
    }
    const original = view.cellClientCenter(store.playerPos)
    view.setSightAxis(null); view.setOverviewFit(true); view.fitToContainer()
    for (const p of [{ x: -20, y: -15 }, { x: 35, y: 20 }]) {
      const point = view.cellClientCenter(p)!
      expect(point.x).toBeGreaterThanOrEqual(0); expect(point.x).toBeLessThanOrEqual(390)
      expect(point.y).toBeGreaterThanOrEqual(0); expect(point.y).toBeLessThanOrEqual(500)
    }
    view.setOverviewFit(false); view.setSightAxis(19); view.fitToContainer()
    expect(view.cellClientCenter(store.playerPos)).toEqual(original)
  })
})
