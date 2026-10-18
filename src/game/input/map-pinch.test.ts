// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachMapPinch, MIN_MAP_ZOOM, MAX_MAP_ZOOM } from './map-pinch'

afterEach(() => { document.body.innerHTML = '' })

function setup() {
  const wrap = document.createElement('div')
  const grid = document.createElement('div')
  grid.id = 'map-grid'
  wrap.appendChild(grid)
  document.body.appendChild(wrap)
  const state = { enabled: true, zoom: 1 }
  const onStart = vi.fn()
  const setZoom = vi.fn((zoom: number) => { state.zoom = zoom })
  wrap.setPointerCapture = vi.fn()
  wrap.releasePointerCapture = vi.fn()
  const pinch = attachMapPinch(wrap, {
    enabled: () => state.enabled,
    getZoom: () => state.zoom,
    setZoom,
    onStart,
  })
  function fire(type: string, id: number, x: number, target = grid, pointerType = 'touch'): PointerEvent {
    const e = new PointerEvent(type, {
      pointerId: id, pointerType, clientX: x, clientY: 50, bubbles: true, cancelable: true,
    })
    target.dispatchEvent(e)
    return e
  }
  function begin(a = 0, b = 100): PointerEvent {
    fire('pointerdown', 1, a)
    return fire('pointerdown', 2, b)
  }
  return { wrap, grid, fire, begin, state, onStart, setZoom, pinch }
}

describe('map pinch zoom', () => {
  it('zooms relative to the start distance and current zoom, without accumulating drift', () => {
    const h = setup()
    h.state.zoom = 1.5
    expect(h.begin().defaultPrevented).toBe(true)
    h.fire('pointermove', 2, 150)
    expect(h.state.zoom).toBe(2.25)
    h.fire('pointermove', 2, 100)
    expect(h.state.zoom).toBe(1.5)
    expect(h.onStart).toHaveBeenCalledTimes(1)
  })

  it('clamps zoom in both directions', () => {
    const h = setup()
    h.begin()
    h.fire('pointermove', 2, 1000)
    expect(h.state.zoom).toBe(MAX_MAP_ZOOM)
    h.fire('pointermove', 2, 1)
    expect(h.state.zoom).toBe(MIN_MAP_ZOOM)
  })

  it('leaves Keypad gestures alone and stops when the mode changes', () => {
    const h = setup()
    h.state.enabled = false
    expect(h.begin().defaultPrevented).toBe(false)
    h.fire('pointermove', 2, 150)
    expect(h.onStart).not.toHaveBeenCalled()
    expect(h.setZoom).not.toHaveBeenCalled()
    h.state.enabled = true
    h.begin()
    h.state.enabled = false
    h.fire('pointermove', 2, 150)
    expect(h.setZoom).not.toHaveBeenCalled()
  })

  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])('stops on %s instead of continuing with a remaining finger', type => {
    const h = setup()
    h.begin()
    h.fire(type, 2, 100)
    h.fire('pointermove', 1, 20)
    expect(h.setZoom).not.toHaveBeenCalled()
  })

  it('ignores single touches, a third finger, outside touches and zero starting distance', () => {
    const h = setup()
    h.fire('pointerdown', 1, 0)
    h.fire('pointermove', 1, 10)
    h.begin()
    h.fire('pointerdown', 3, 200)
    h.fire('pointermove', 2, 150)
    h.fire('pointerup', 3, 200)
    h.fire('pointermove', 2, 160)
    h.pinch.cancel()
    h.fire('pointerdown', 1, 0)
    h.fire('pointerdown', 2, 100, h.wrap)
    h.fire('pointermove', 2, 150)
    h.pinch.cancel()
    h.begin(0, 0)
    h.fire('pointermove', 2, 150)
    expect(h.setZoom).not.toHaveBeenCalled()
  })

  it('ignores mouse and pen pointers', () => {
    const h = setup()
    h.fire('pointerdown', 1, 0, h.grid, 'mouse')
    h.fire('pointerdown', 2, 100, h.grid, 'pen')
    h.fire('pointermove', 2, 150)
    expect(h.onStart).not.toHaveBeenCalled()
    expect(h.setZoom).not.toHaveBeenCalled()
  })

  it('captures on the stable ancestor and keeps zooming after ASCII cells are rebuilt', () => {
    const h = setup()
    h.begin()
    expect(h.wrap.setPointerCapture).toHaveBeenCalledWith(1)
    expect(h.wrap.setPointerCapture).toHaveBeenCalledWith(2)
    h.grid.replaceWith(document.createElement('div'))
    h.fire('pointermove', 2, 150, h.wrap)
    expect(h.state.zoom).toBe(1.5)
    h.fire('pointermove', 2, 200, h.wrap)
    expect(h.state.zoom).toBe(2)
  })

  it('cancels explicitly and removes its listeners on destruction', () => {
    const h = setup()
    h.begin()
    h.pinch.cancel()
    expect(h.wrap.releasePointerCapture).toHaveBeenCalledWith(1)
    expect(h.wrap.releasePointerCapture).toHaveBeenCalledWith(2)
    h.fire('pointermove', 2, 150)
    expect(h.setZoom).not.toHaveBeenCalled()
    h.pinch.destroy()
    h.onStart.mockClear()
    h.begin()
    h.fire('pointermove', 2, 150)
    expect(h.onStart).not.toHaveBeenCalled()
    expect(h.setZoom).not.toHaveBeenCalled()
  })
})
