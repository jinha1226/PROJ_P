import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SpdCombatFx, estimateDamage, estimateRemaining, parseCombatLine } from './spd-combat-fx'
import type { MonsterCell } from '../map/map-store'

describe('combat line parsing', () => {
  const names = ['goblin conjurer', 'goblin', 'rat']

  it('reads the player\'s hits, misses and kills', () => {
    expect(parseCombatLine('You hit the goblin.', names)).toEqual({ kind: 'hit', target: 'goblin' })
    expect(parseCombatLine('You slash the goblin conjurer!', names)).toEqual({ kind: 'hit', target: 'goblin conjurer' })
    expect(parseCombatLine('You miss the rat.', names)).toEqual({ kind: 'miss', target: 'rat' })
    expect(parseCombatLine('You kill the rat!', names)).toEqual({ kind: 'kill', target: 'rat' })
    expect(parseCombatLine('You hit the rat but do no damage.', names)).toEqual({ kind: 'nodmg', target: 'rat' })
    expect(parseCombatLine('The magic dart hits the goblin.', names)).toEqual({ kind: 'hit', target: 'goblin' })
  })

  it('ignores monsters fighting each other and attacks on the player', () => {
    expect(parseCombatLine('The goblin hits the rat.', names)).toBeNull()
    expect(parseCombatLine('The goblin hits you.', names)).toBeNull()
    expect(parseCombatLine('Welcome back.', names)).toBeNull()
  })
})

describe('damage estimates', () => {
  it('turns a tier drop into the average HP it implies', () => {
    expect(estimateDamage(30, 0, 1)).toBe(3)     // 100% → 90%
    expect(estimateDamage(30, 1, 3)).toBe(12)    // 90% → 50%
    expect(estimateDamage(30, 2, 2)).toBe(0)
    expect(estimateDamage(undefined, 0, 3)).toBe(0)
    expect(estimateRemaining(30, 5)).toBe(3)
  })
})

describe('SpdCombatFx', () => {
  const shown: string[] = []
  let fx: SpdCombatFx
  const mon = (id: number, name: string, x: number, avghp = 30): MonsterCell =>
    ({ x, y: 0, g: 'g', mon: { id, name, att: 0, typedata: { avghp } } })
  let fg = new Map<string, number | undefined>()
  const fgOf = (x: number, y: number) => fg.get(`${x},${y}`)
  const flush = () => new Promise<void>(r => setTimeout(r, 0))

  beforeEach(() => {
    shown.length = 0
    fg = new Map()
    fx = new SpdCombatFx({
      cellPoint: (x, y) => ({ x, y }),
      playerPos: () => ({ x: 0, y: 0 }),
      show: (text) => shown.push(text),
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('shows a hit inside a tier as a hit, and a miss as a miss', async () => {
    fx.onMonsters(new Map([['1,0', mon(1, 'goblin', 1)]]), fgOf)
    await flush()
    fx.onLine('You hit the goblin.')
    fx.onLine('You miss the goblin.')
    await flush()
    expect(shown).toEqual(['hit', 'miss'])
  })

  it('shows the kill with the HP its last tier implied', async () => {
    fx.onMonsters(new Map([['1,0', mon(1, 'rat', 1, 10)]]), fgOf)
    await flush()
    fx.onLine('You kill the rat!')
    fx.onMonsters(new Map(), fgOf)
    await flush()
    expect(shown).toEqual(['−~10 ✝'])
  })
})
