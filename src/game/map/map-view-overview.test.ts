// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { MapStore } from './map-store'
import { MapView } from './map-view'

// happy-dom has no layout, so fitToContainer() is inert here; tests drive the
// viewport directly via setViewportSize and assert the paint through spans —
// same access pattern render() itself uses. 21×21 matches the constructor's
// default centerRow (10), so the player-centered rows land symmetrically.
function glyphAt(view: MapView, col: number, row: number): string {
  const rowDiv = view.element.children[row] as HTMLElement
  return (rowDiv.children[col] as HTMLElement).textContent ?? ''
}

describe('overview fit centering', () => {
  it('centers the viewport on the explored bbox center instead of the player', () => {
    const store = new MapStore()
    // Explored region spans (10,5)..(20,15); player sits in its corner.
    store.merge([
      { x: 10, y: 5, g: '@' },
      { x: 20, y: 15, g: '>' },
    ])
    const view = new MapView(store)
    view.setViewCenter({ x: 10, y: 5 })          // player corner
    view.setViewportSize(21, 21)
    view.fullRender()
    // Player-centered: offX = 10-10 = 0, offY = 5-10 = -5.
    expect(glyphAt(view, 10, 10)).toBe('@')
    // (20,15) → col 20, row 20: visible here only because the viewport is
    // generous; the overview assertion below is the behavior under test.

    view.setOverviewFit(true)
    view.fullRender()
    // Bbox center = (15,10); offX = 15-10 = 5, offY = 10-10 = 0 (symmetric).
    expect(glyphAt(view, 10 - 5, 5 - 0)).toBe('@')
    expect(glyphAt(view, 20 - 5, 15 - 0)).toBe('>')

    view.setOverviewFit(false)
    view.fullRender()
    expect(glyphAt(view, 10, 10)).toBe('@')      // back to player-centered
  })

  it('falls back to the player center when nothing is explored', () => {
    const store = new MapStore()
    const view = new MapView(store)
    view.setViewCenter({ x: 10, y: 10 })
    view.setViewportSize(21, 21)
    view.setOverviewFit(true)
    store.merge([{ x: 10, y: 10, g: ' ' }])      // blank only — no bounds
    view.fullRender()
    // No bounds → player-centered path; blank cell paints as space, no throw.
    expect(glyphAt(view, 10, 10)).toBe(' ')
  })
})
