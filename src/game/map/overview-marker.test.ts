// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { overviewMarker } from './tile-map-view'
import type { Cell } from './map-store'

const cell = (g: string): Cell => ({ g } as Cell)

describe('overviewMarker', () => {
  it('marks down/up stairs by glyph', () => {
    expect(overviewMarker(cell('>'))?.ch).toBe('>')
    expect(overviewMarker(cell('<'))?.ch).toBe('<')
  })

  it('marks shops / gates / portals by the ∩ glyph', () => {
    expect(overviewMarker(cell('∩'))?.ch).toBe('∩')
  })

  it('gives stairs and gates distinct colours', () => {
    const colours = ['>', '<', '∩'].map(g => overviewMarker(cell(g))!.color)
    expect(new Set(colours).size).toBe(3)
  })

  it('ignores other cells and undefined', () => {
    expect(overviewMarker(cell('#'))).toBeNull()   // wall
    expect(overviewMarker(cell('@'))).toBeNull()   // player
    expect(overviewMarker(cell('.'))).toBeNull()   // floor
    expect(overviewMarker(undefined)).toBeNull()
  })
})
