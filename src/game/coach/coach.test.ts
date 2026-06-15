import { describe, it, expect } from 'vitest'
import { evaluateCoach, COACH_HINTS, type CoachInput } from './coach'

const base: CoachInput = {
  hp: 50, hpMax: 50, ac: 10, ev: 15, depth: 5,
  hostileThreats: [], poisonLethal: false,
}

describe('evaluateCoach priority', () => {
  it('returns null when all is well', () => {
    expect(evaluateCoach(base)).toBeNull()
  })
  it('poison_lethal has top priority', () => {
    expect(evaluateCoach({ ...base, poisonLethal: true, hp: 5, hostileThreats: [3] }))
      .toBe('poison_lethal')
  })
  it('no hint for low HP alone (RC hp_warning covers that)', () => {
    expect(evaluateCoach({ ...base, hp: 15, hostileThreats: [1] })).toBeNull()
    expect(evaluateCoach({ ...base, hp: 10, hostileThreats: [] })).toBeNull()
  })
  it('nasty_monster when a threat-3 hostile is visible and not in good shape', () => {
    expect(evaluateCoach({ ...base, hp: 25, hpMax: 50, hostileThreats: [0, 3] }))
      .toBe('nasty_monster')
  })
  it('low_defense only when calm (no tough/nasty in view) and AC/EV low for depth', () => {
    expect(evaluateCoach({ ...base, depth: 8, ac: 4, ev: 10, hostileThreats: [1] }))
      .toBe('low_defense')
  })
  it('no low_defense while a tough/nasty monster is in view', () => {
    expect(evaluateCoach({ ...base, depth: 8, ac: 4, ev: 10, hostileThreats: [2] }))
      .toBeNull()
  })
  it('no low_defense at shallow depth', () => {
    expect(evaluateCoach({ ...base, depth: 1, ac: 0, ev: 8, hostileThreats: [] }))
      .toBeNull()
  })
})

describe('COACH_HINTS text', () => {
  it('has ko and en for every hint id', () => {
    for (const id of ['nasty_monster', 'poison_lethal', 'low_defense'] as const) {
      expect(COACH_HINTS[id].ko.length).toBeGreaterThan(0)
      expect(COACH_HINTS[id].en.length).toBeGreaterThan(0)
    }
  })
})
