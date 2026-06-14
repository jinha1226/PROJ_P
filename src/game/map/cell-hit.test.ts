import { describe, it, expect } from 'vitest'
import { cellFromPoint } from './cell-hit'

describe('cellFromPoint', () => {
  it('maps an interior point to the correct dungeon cell', () => {
    // rect at (0,0), no shift, 16×16 cells, dungeon origin (10,20), 21×21 viewport
    // clientX=40, clientY=32 → col=floor(40/16)=2, row=floor(32/16)=2 → {x:12, y:22}
    expect(cellFromPoint(40, 32, 0, 0, 0, 0, 16, 16, 10, 20, 21, 21)).toEqual({ x: 12, y: 22 })
  })

  it('maps correctly with a non-zero rect origin', () => {
    // rect at (100, 200), no shift, 16×16 cells, dungeon origin (5, 5), 21×21 viewport
    // clientX=116, clientY=216 → col=floor(16/16)=1, row=floor(16/16)=1 → {x:6, y:6}
    expect(cellFromPoint(116, 216, 100, 200, 0, 0, 16, 16, 5, 5, 21, 21)).toEqual({ x: 6, y: 6 })
  })

  it('maps correctly with a non-zero shift', () => {
    // rect at (0,0), shift (-8, -4), 16×16 cells, dungeon origin (0, 0), 21×21 viewport
    // clientX=8, clientY=4 → col=floor((8-(-8))/16)=1, row=floor((4-(-4))/16)=0 → {x:1, y:0}
    expect(cellFromPoint(8, 4, 0, 0, -8, -4, 16, 16, 0, 0, 21, 21)).toEqual({ x: 1, y: 0 })
  })

  it('returns null for a point left of the grid', () => {
    // clientX < rectLeft, so col < 0
    expect(cellFromPoint(-5, 8, 0, 0, 0, 0, 16, 16, 10, 20, 21, 21)).toBeNull()
  })

  it('returns null for a point above the grid', () => {
    // clientY < rectTop, so row < 0
    expect(cellFromPoint(8, -5, 0, 0, 0, 0, 16, 16, 10, 20, 21, 21)).toBeNull()
  })

  it('returns null for a point past cols', () => {
    // 21 cells × 16px = 336px wide; clientX=336 → col=21 ≥ cols
    expect(cellFromPoint(336, 8, 0, 0, 0, 0, 16, 16, 10, 20, 21, 21)).toBeNull()
  })

  it('returns null for a point past rows', () => {
    // 21 cells × 16px = 336px tall; clientY=336 → row=21 ≥ rows
    expect(cellFromPoint(8, 336, 0, 0, 0, 0, 16, 16, 10, 20, 21, 21)).toBeNull()
  })

  it('returns null when cellW is 0', () => {
    expect(cellFromPoint(10, 10, 0, 0, 0, 0, 0, 16, 10, 20, 21, 21)).toBeNull()
  })

  it('returns null when cellH is 0', () => {
    expect(cellFromPoint(10, 10, 0, 0, 0, 0, 16, 0, 10, 20, 21, 21)).toBeNull()
  })

  it('handles the last valid cell in the grid (corner)', () => {
    // col=20, row=20 should be valid; col=21 should be null
    expect(cellFromPoint(20 * 16 + 1, 20 * 16 + 1, 0, 0, 0, 0, 16, 16, 0, 0, 21, 21)).toEqual({ x: 20, y: 20 })
    expect(cellFromPoint(21 * 16, 20 * 16 + 1, 0, 0, 0, 0, 16, 16, 0, 0, 21, 21)).toBeNull()
  })
})
