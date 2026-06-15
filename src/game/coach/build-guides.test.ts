import { describe, it, expect } from 'vitest'
import { recommend, skillKo, buildKey } from './build-guides'

describe('build-guides', () => {
  it('targets a milestone ABOVE the current XL (a goal, not the current level)', () => {
    const r = recommend('Minotaur', 'Fighter', 12)
    expect(r).not.toBeNull()
    expect(r!.xl).toBeGreaterThan(12)        // forward-looking target
    expect(r!.xl).toBe(15)
    expect(r!.items[0].skill).toBe('Axes')   // axes is the popular MiFi weapon
    expect(r!.items[0].ko).toBe('도끼')
  })

  it('at XL1 skips the flat start milestones to a meaningful higher target', () => {
    const r = recommend('Minotaur', 'Fighter', 1)!
    expect(r.xl).toBeGreaterThan(5)          // not just the start-skill levels
    expect(r.items.some(i => i.skill === 'Axes')).toBe(true)
  })

  it('clamps to the furthest known milestone past max XL', () => {
    expect(recommend('Minotaur', 'Fighter', 99)!.xl).toBe(27)
  })

  it('leads a Gargoyle Earth Elementalist toward Earth Magic / Spellcasting', () => {
    const r = recommend('Gargoyle', 'Earth Elementalist', 5)!
    expect(r.xl).toBeGreaterThan(5)
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
