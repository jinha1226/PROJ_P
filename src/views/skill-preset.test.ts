import { describe, it, expect } from 'vitest'
import {
  parseSkillRows, trainedNames, computeSkillToggles, presetToRc, rcToPreset,
} from './skill-preset'

describe('parseSkillRows', () => {
  it('reads letter, state and name from +/-/* rows', () => {
    const rows = parseSkillRows([
      ' a + Fighting               14',
      ' b - Dodging                 5',
      ' c * Ranged Weapons         12',
    ])
    expect(rows).toEqual([
      { letter: 'a', state: '+', name: 'Fighting' },
      { letter: 'b', state: '-', name: 'Dodging' },
      { letter: 'c', state: '*', name: 'Ranged Weapons' },
    ])
  })

  it('keeps translated names with a single internal space intact', () => {
    const rows = parseSkillRows([' d + 원거리 무기            5'])
    expect(rows[0]).toEqual({ letter: 'd', state: '+', name: '원거리 무기' })
  })

  it('parses two skills on one (un-reflowed) line and ignores non-rows', () => {
    const rows = parseSkillRows([
      'Skills:',
      ' a + Fighting     14   b - Dodging     5',
    ])
    expect(rows.map(r => r.letter)).toEqual(['a', 'b'])
  })

  it('dedupes a hotkey seen twice', () => {
    const rows = parseSkillRows([' a + Fighting   1', ' a + Fighting   1'])
    expect(rows).toHaveLength(1)
  })
})

describe('trainedNames', () => {
  it('returns names of on (+/*) skills only', () => {
    expect(trainedNames([
      { letter: 'a', state: '+', name: 'Fighting' },
      { letter: 'b', state: '-', name: 'Dodging' },
      { letter: 'c', state: '*', name: 'Hexes' },
    ])).toEqual(['Fighting', 'Hexes'])
  })
})

describe('computeSkillToggles', () => {
  const rows = [
    { letter: 'a', state: '+' as const, name: 'Fighting' },       // on,  not wanted → flip
    { letter: 'b', state: '-' as const, name: 'Ranged Weapons' }, // off, wanted     → flip
    { letter: 'c', state: '*' as const, name: 'Hexes' },          // on,  wanted     → keep
    { letter: 'd', state: '-' as const, name: 'Dodging' },        // off, not wanted → keep
  ]

  it('returns only the letters whose state must flip', () => {
    expect(computeSkillToggles(rows, ['Ranged Weapons', 'Hexes'])).toEqual(['a', 'b'])
  })

  it('returns nothing when already matching', () => {
    expect(computeSkillToggles(
      [{ letter: 'a', state: '+', name: 'Hexes' }],
      ['Hexes'],
    )).toEqual([])
  })
})

describe('preset RC round-trip', () => {
  it('joins and splits on | and tolerates empty/null', () => {
    expect(presetToRc(['Ranged Weapons', 'Hexes'])).toBe('Ranged Weapons|Hexes')
    expect(rcToPreset('Ranged Weapons|Hexes')).toEqual(['Ranged Weapons', 'Hexes'])
    expect(rcToPreset(null)).toEqual([])
    expect(rcToPreset('')).toEqual([])
  })
})
