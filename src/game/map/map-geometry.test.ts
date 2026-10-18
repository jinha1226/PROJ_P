// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { MapStore } from './map-store'
import { MapView } from './map-view'
import { TileMapView } from './tile-map-view'

afterEach(() => vi.restoreAllMocks())

it('fits the ASCII grid to the visible area after pinch zoom', () => {
  const map = new MapView(new MapStore())
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this === map.element ? new DOMRect(0, 0, 320, 600) : new DOMRect(0, 0, 960, 16)
  })
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    fontFamily: 'monospace', fontWeight: 'bold', fontStretch: 'normal', letterSpacing: '0px',
    paddingTop: '2px', paddingBottom: '2px', paddingLeft: '2px', paddingRight: '2px',
    getPropertyValue: (key: string) => key === '--map-line-height' ? '0.9' : '',
  } as CSSStyleDeclaration)
  map.fitToContainer()
  const before = map.viewRect()
  map.setUserZoom(2)
  map.fitToContainer()
  const zoomed = map.viewRect()
  expect(zoomed.w).toBe(Math.ceil(before.w / 2))
  expect(zoomed.h).toBeLessThanOrEqual(Math.ceil(before.h / 2))
  const cellW = parseFloat(map.element.style.fontSize) * 0.6
  expect(Math.abs(2 + (Math.floor(zoomed.w / 2) + 0.5) * cellW - 160)).toBeLessThan(cellW)
})

function setup(tiles: boolean) {
  const drawImage = vi.fn()
  const ctx = new Proxy({ drawImage }, {
    get: (target, key) => key === 'drawImage' ? target.drawImage : () => {},
    set: () => true,
  }) as unknown as CanvasRenderingContext2D
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
  const store = new MapStore()
  const map = tiles ? new TileMapView(store) : new MapView(store)
  map.setViewportSize(5, 4)
  map.fullRender()
  const w = tiles ? 16 : 10
  const h = tiles ? 16 : 12
  // Model only layout (unavailable in happy-dom). The measured surface
  // follows its sub-cell translation, as the browser's DOMRects do.
  const rect = (col = 0, row = 0, width = w, height = h) => {
    const c = map.getViewCenter()
    return new DOMRect(100 + (col - c.x + Math.floor(c.x)) * w,
      200 + (row - c.y + Math.floor(c.y)) * h, width, height)
  }
  if (tiles) {
    const canvas = map.element.querySelector('canvas')!
    vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(() =>
      rect(0, 0, parseFloat(canvas.style.width), parseFloat(canvas.style.height)))
  } else {
    const surface = map.element.querySelector('.map-ascii-surface')!
    Array.from(surface.children).forEach((row, y) => {
      Array.from(row.children).forEach((span, x) => {
        vi.spyOn(span, 'getBoundingClientRect').mockImplementation(() => rect(x, y))
      })
    })
  }
  return { map, store, w, h, drawImage }
}

describe.each([false, true])('fractional map geometry (tiles=%s)', tiles => {
  it('keeps cached and fresh hit tests aligned across positive and negative cell boundaries', () => {
    const { map, w, h } = setup(tiles)
    const origin = map.viewRect()
    const hit = map.hitTester()!
    const grab = map.hitTester(true)!
    const px = 100 + 2.5 * w
    const py = 200 + 2.5 * h
    for (const c of [{ x: 0.25, y: -0.375 }, { x: -1.25, y: 2.75 }, { x: -2, y: -1 }]) {
      map.setViewCenter(c)
      map.panRender()
      const expected = { x: Math.floor(origin.x + 2.5 + c.x), y: Math.floor(origin.y + 2.5 + c.y) }
      expect(hit(px, py)).toEqual(expected)
      expect(map.cellAtPoint(px, py)).toEqual(expected)
      expect(grab(px, py)?.x).toBeCloseTo(origin.x + 2.5 + c.x)
      expect(grab(px, py)?.y).toBeCloseTo(origin.y + 2.5 + c.y)
      expect(map.viewRect()).toEqual({ x: origin.x + c.x, y: origin.y + c.y, w: 5, h: 4 })
    }
  })

  it('only translates sub-cell moves, but paints dirty cells and integral boundary crossings', () => {
    const { map, store, drawImage } = setup(tiles)
    const get = vi.spyOn(store, 'get')
    map.setViewCenter({ x: 0.25, y: 0.375 })
    map.panRender()
    expect(get).not.toHaveBeenCalled()
    expect(drawImage).not.toHaveBeenCalled()
    const origin = map.viewRect()
    const cell = { x: Math.floor(origin.x) + 2, y: Math.floor(origin.y) + 2 }
    const dirty = store.merge([{ ...cell, g: '@' }])
    map.panRender(dirty)
    expect(get).toHaveBeenCalledWith(cell.x, cell.y)
    map.setCursor(cell)
    map.setViewCenter({ x: -0.125, y: 1.25 })
    map.panRender()
    map.fullRender()
    for (const [x, y] of get.mock.calls) {
      expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true)
    }
    if (tiles) {
      expect(drawImage).toHaveBeenCalled()
      for (const args of drawImage.mock.calls) {
        expect(args.slice(1).every(Number.isInteger)).toBe(true)
      }
    } else {
      expect(map.element.querySelector('.map-cursor')?.textContent).toBe('@')
    }
  })

  it('paints the extra edge cells without including them in the minimap footprint', () => {
    const { map, store, w, h } = setup(tiles)
    const get = vi.spyOn(store, 'get')
    map.setViewCenter({ x: 0.875, y: 0.875 })
    map.fullRender()
    const view = map.viewRect()
    const edge = { x: Math.floor(view.x) + view.w, y: Math.floor(view.y) + view.h }
    expect(get).toHaveBeenCalledWith(edge.x, edge.y)
    expect(map.cellAtPoint(100 + 4.5 * w, 200 + 3.5 * h)).toEqual(edge)
    const surface = map.element.querySelector<HTMLElement>(tiles ? 'canvas' : '.map-ascii-surface')!
    expect(surface.style.transform).not.toBe('')
    map.setViewCenter({ x: 0, y: 0 })
    map.panRender()
    expect(surface.style.transform).toBe(tiles ? 'translate(0px, 0px)' : 'translate(0%, 0%)')
  })
})
