import { describe, it, expect } from 'vitest'
import { sightAxis } from './sight-fit'
import { MapStore } from './map-store'

describe('sight framing', () => {
  it('includes one extra tile on every side of species LOS', () => {
    expect(sightAxis('Human')).toBe(17)
    expect(sightAxis('Barachi')).toBe(19)
    expect(sightAxis('Kobold')).toBe(11)
    expect(sightAxis('unknown future species')).toBe(17)
  })
  it('expands for observed vision but never infers blindness from corridor walls', () => {
    expect(sightAxis('Kobold', 7)).toBe(17)
    expect(sightAxis('Human', 2)).toBe(17)
    expect(sightAxis('Human', 8)).toBe(19)
  })
  it('excludes remembered terrain, blank padding, and cells without visibility flags', () => {
    const s = new MapStore()
    s.playerPos = { x: 0, y: 0 }
    s.merge([
      { x: 4, y: 0, g: '.', col: 7, t: { bg: 1 } },
      { x: 8, y: 0, g: '.', col: 7, t: { bg: 0x40001 } },
      { x: 9, y: 0, g: '.', col: 7 },
      { x: 10, y: 0, g: ' ', col: 0, t: { bg: 1 } },
    ])
    expect(s.visibleRadius()).toBe(4)
    s.merge([{ x: 8, y: 0, t: { bg: 1 } }])
    expect(s.visibleRadius()).toBe(8)
  })
})
