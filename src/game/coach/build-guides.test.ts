import { describe, it, expect } from 'vitest'
import { recommend, skillKo, buildKey } from './build-guides'

describe('build-guides', () => {
  it('recommends the dominant weapon for a Minotaur Fighter mid-game', () => {
    const r = recommend('Minotaur', 'Fighter', 12)
    expect(r).not.toBeNull()
    expect(r!.xl).toBe(12)
    expect(r!.items[0].skill).toBe('Axes')   // axes is the popular MiFi weapon
    expect(r!.items[0].ko).toBe('도끼')
  })

  it('uses the nearest milestone at or below the player XL', () => {
    expect(recommend('Minotaur', 'Fighter', 13)!.xl).toBe(12)
    expect(recommend('Minotaur', 'Fighter', 99)!.xl).toBe(27)
  })

  it('falls back to the earliest milestone below the first', () => {
    expect(recommend('Minotaur', 'Fighter', 0)!.xl).toBe(1)
  })

  it('leads a Gargoyle Earth Elementalist with Earth Magic / Spellcasting early', () => {
    const r = recommend('Gargoyle', 'Earth Elementalist', 5)!
    const skills = r.items.map(i => i.skill)
    expect(skills).toContain('Earth Magic')
    expect(skills).toContain('Spellcasting')
  })

  it('returns null for a build with no guide', () => {
    expect(recommend('Felid', 'Wanderer', 10)).toBeNull()
  })

  it('skillKo maps known skills and falls back to English', () => {
    expect(skillKo('Earth Magic')).toBe('대지마법')
    expect(skillKo('Nonexistent Skill')).toBe('Nonexistent Skill')
  })

  it('buildKey joins species and background', () => {
    expect(buildKey('Gargoyle', 'Fighter')).toBe('Gargoyle/Fighter')
  })
})
