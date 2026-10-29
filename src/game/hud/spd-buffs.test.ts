import { describe, expect, it } from 'vitest'
import { buffIcon } from './spd-buffs'
import { hpChange } from './spd-hp-float'

describe('spd status icons', () => {
  it('keys icons on the engine\'s English light', () => {
    expect(buffIcon('Hasted')).toBe('⚡')
    expect(buffIcon('Slow')).toBe('🐌')
    expect(buffIcon('Pois (12)')).toBe('☠')
    expect(buffIcon('<lightred>Berserk</lightred>')).toBe('😡')
    expect(buffIcon('Stoneskin')).toBe('🛡')
    expect(buffIcon('Petrifying')).toBe('🗿')
    expect(buffIcon('Xyzzy')).toBeNull()
  })
})

describe('spd HP numbers', () => {
  it('shows net HP change, never a first snapshot or a max-HP move', () => {
    expect(hpChange({}, { hp: 20, hp_max: 30 })).toBe(0)
    expect(hpChange({ hp: 20, hp_max: 30 }, { hp: 13 })).toBe(-7)
    expect(hpChange({ hp: 13, hp_max: 30 }, { hp: 20 })).toBe(7)
    expect(hpChange({ hp: 20, hp_max: 30 }, { hp: 21 })).toBe(0)  // regen trickle
    expect(hpChange({ hp: 20, hp_max: 30 }, { hp: 25, hp_max: 35 })).toBe(0)
  })
})
