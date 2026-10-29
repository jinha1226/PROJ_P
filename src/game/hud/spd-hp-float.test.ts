import { describe, expect, it } from 'vitest'
import { hpChange } from './spd-hp-float'

describe('spd HP numbers', () => {
  it('shows net HP change, never a first snapshot or a max-HP move', () => {
    expect(hpChange({}, { hp: 20, hp_max: 30 })).toBe(0)
    expect(hpChange({ hp: 20, hp_max: 30 }, { hp: 13 })).toBe(-7)
    expect(hpChange({ hp: 13, hp_max: 30 }, { hp: 20 })).toBe(7)
    expect(hpChange({ hp: 20, hp_max: 30 }, { hp: 21 })).toBe(0)  // regen trickle
    expect(hpChange({ hp: 20, hp_max: 30 }, { hp: 25, hp_max: 35 })).toBe(0)
  })
})
