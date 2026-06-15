import { describe, it, expect, beforeEach } from 'vitest'
import { parseBuild, observeBuildMessage, getCurrentBuild, clearBuild } from './build-detect'

describe('parseBuild', () => {
  it('parses single-word species and background', () => {
    expect(parseBuild('Welcome, Foo the Minotaur Fighter.')).toEqual({ species: 'Minotaur', background: 'Fighter' })
  })
  it('parses multi-word species + background', () => {
    expect(parseBuild('Welcome, Bar the Gargoyle Earth Elementalist.'))
      .toEqual({ species: 'Gargoyle', background: 'Earth Elementalist' })
  })
  it('prefers the longer "Black Draconian" over "Draconian"', () => {
    expect(parseBuild('Welcome, Baz the Black Draconian Conjurer.'))
      .toEqual({ species: 'Black Draconian', background: 'Conjurer' })
  })
  it('handles "Deep Elf"', () => {
    expect(parseBuild('Welcome back, Q the Deep Elf Necromancer.'))
      .toEqual({ species: 'Deep Elf', background: 'Necromancer' })
  })
  it('returns null on unrelated text', () => {
    expect(parseBuild('You hit the orc.')).toBeNull()
  })
})

describe('observeBuildMessage', () => {
  beforeEach(() => clearBuild())
  it('captures the build from a msgs welcome line', () => {
    observeBuildMessage({ msg: 'msgs', messages: [{ text: 'Some line' }, { text: 'Welcome, P the Coglin Hunter.' }] } as never)
    expect(getCurrentBuild()).toEqual({ species: 'Coglin', background: 'Hunter' })
  })
  it('ignores non-msgs messages', () => {
    observeBuildMessage({ msg: 'player', species: 'Minotaur' } as never)
    expect(getCurrentBuild()).toBeNull()
  })
})
