// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { SPD_HEROES, heroSpriteUrl, isPlayerSprite, nextPlayerSprite, heroSpriteSync, _setHeroSpriteForTest } from './spd-hero'

describe('spd-hero', () => {
  it('cycles through every hero and back through the DCSS doll', () => {
    let cur = nextPlayerSprite('dcss')
    const seen: string[] = []
    for (let i = 0; i < SPD_HEROES.length + 1; i++) { seen.push(cur); cur = nextPlayerSprite(cur) }
    expect(seen).toEqual([...SPD_HEROES, 'dcss'])
  })
  it('validates stored pref values', () => {
    expect(isPlayerSprite('warrior')).toBe(true)
    expect(isPlayerSprite('dcss')).toBe(true)
    expect(isPlayerSprite('paladin')).toBe(false)
  })
  it('resolves sprite URLs under the app base', () => {
    expect(heroSpriteUrl('mage')).toMatch(/\/tiles\/spd\/hero-mage\.png$/)
  })
  it('exposes a sprite synchronously only once it is decoded', () => {
    expect(heroSpriteSync('rogue')).toBeNull()
    const img = document.createElement('img')
    _setHeroSpriteForTest('rogue', img)
    expect(heroSpriteSync('rogue')).toBe(img)
    _setHeroSpriteForTest('rogue', null)
    expect(heroSpriteSync('rogue')).toBeNull()
  })
})
