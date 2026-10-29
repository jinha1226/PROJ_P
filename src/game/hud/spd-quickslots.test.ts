import { describe, expect, it } from 'vitest'
import { indexLetter, itemCount, itemKind, resolveSlot, shortLabel, slotName, useKeys } from './spd-quickslots'
import { attackInput, nearestHostile } from './spd-indicators'
import type { MonsterCell } from '../map/map-store'

describe('spd quickslots', () => {
  it('maps inventory indices to letters', () => {
    expect(indexLetter(0)).toBe('a')
    expect(indexLetter(25)).toBe('z')
    expect(indexLetter(26)).toBe('A')
  })

  it('classifies items and picks the verb', () => {
    expect(useKeys('3 potions of curing', 'c')).toBe('qc')
    expect(useKeys('a scroll labelled XOBIQ', 'd')).toBe('rd')
    expect(useKeys('a wand of flame (5)', 'e')).toBe('Ve')
    expect(useKeys('a phial of floods', 'f')).toBe('Vf')
    expect(useKeys('12 darts', 'g')).toBe('Fg')
    expect(useKeys('a +0 dagger (weapon)', 'a')).toBe('ca')
    expect(useKeys('a +0 dagger', 'a')).toBe('ea')
    expect(useKeys('a book of Fire', 'h')).toBe('ih')
    expect(itemKind('a stone of tremors')).toBe('evoke')
  })

  it('normalizes names across stack size and inscription', () => {
    expect(slotName('3 potions of curing {@q1}')).toBe('potion of curing')
    expect(slotName('a potion of curing')).toBe('potion of curing')
    expect(itemCount('3 potions of curing')).toBe(3)
    expect(itemCount('a potion of curing')).toBe(1)
    expect(shortLabel('2 scrolls of teleportation')).toBe('telepor…')
  })

  it('resolves by name first, then by letter within the same class', () => {
    const items = new Map([
      [0, { name: 'a +0 dagger (weapon)', col: 7 }],
      [2, { name: '2 potions of curing', col: 7 }],
      [3, { name: '', col: 7 }],
    ])
    expect(resolveSlot({ name: 'potion of curing', letter: 'z' }, items)?.letter).toBe('c')
    // Identified since assignment: same letter, still a potion.
    expect(resolveSlot({ name: 'bubbling potion', letter: 'c' }, items)?.letter).toBe('c')
    expect(resolveSlot({ name: 'bubbling potion', letter: 'a' }, items)).toBeNull()
    expect(resolveSlot({ name: 'scroll of fog', letter: 'd' }, items)).toBeNull()
  })
})

describe('spd indicators', () => {
  const mon = (x: number, y: number, att: number, name = 'rat'): MonsterCell =>
    ({ x, y, g: 'r', mon: { id: x * 100 + y, name, att } })

  it('counts hostiles and finds the nearest', () => {
    const ms = new Map([
      ['5,5', mon(5, 5, 0)],
      ['2,1', mon(2, 1, 0)],
      ['1,2', mon(1, 2, 4)],
    ])
    const { target, count } = nearestHostile(ms, { x: 1, y: 1 })
    expect(count).toBe(2)
    expect(target?.x).toBe(2)
  })

  it('attacks adjacent targets by direction, others by auto-fight', () => {
    expect(attackInput({ x: 2, y: 1 }, { x: 1, y: 1 })).toEqual({ msg: 'input', text: 'l' })
    expect(attackInput({ x: 0, y: 0 }, { x: 1, y: 1 })).toEqual({ msg: 'input', text: 'y' })
    expect(attackInput({ x: 4, y: 1 }, { x: 1, y: 1 })).toEqual({ msg: 'key', keycode: 9 })
  })
})
