import { describe, expect, it } from 'vitest'
import type { InvItem } from '../inventory-store'
import {
  describeMsg, indexLetter, itemCount, itemKind, liveItems, makeSlot, resolveSlot, shortLabel, slotName,
  useKeys, useMsg,
} from './spd-quickslots'
import { attackInput, lootSignal, nearestHostile } from './spd-indicators'
import type { MonsterCell } from '../map/map-store'

const L = (c: string) => c.charCodeAt(0)

// Shapes recorded from a live server (src/golden fixtures): the map key is
// the engine's item index, the letter its own field.
const MAGIC: InvItem = {
  base_type: 7, quantity: 1, sub_type: 20, letter: L('g'), name: 'potion of magic',
  col: 14, tile: [4279, 4317], action_verb: 'Drink',
}
const BLACK: InvItem = {
  base_type: 7, quantity: 2, sub_type: 3, letter: L('d'), name: '2 black potions',
  col: 9, tile: [4276], action_verb: 'Drink',
}
const SCROLLS: InvItem = {
  base_type: 5, quantity: 2, sub_type: 26, letter: L('h'), name: '2 scrolls labelled BAYMNICI ZEASE',
  col: 9, tile: [4124], action_verb: 'Read',
}
const ROBE: InvItem = { base_type: 2, quantity: 1, sub_type: 0, letter: L('a'), name: '+0 robe', col: 10 }
const EMPTIED: InvItem = { base_type: 100, quantity: 0, name: 'potion of curing', col: 7 }

describe('spd quickslots', () => {
  it('uses the wire letter, not the item index', () => {
    const items = new Map([[52, MAGIC], [53, BLACK], [0, ROBE]])
    expect(liveItems(items).map(l => l.letter)).toEqual(['a', 'd', 'g'])
    expect(indexLetter(26)).toBe('A')
  })

  it('uses consumables by index, gear by its e-menu letter', () => {
    expect(useMsg({ index: 53, letter: 'd', item: BLACK })).toEqual({ msg: 'inv_item_action', slot: 53 })
    expect(describeMsg({ index: 53, letter: 'd', item: BLACK })).toEqual({ msg: 'inv_item_describe', slot: 53 })
    expect(useMsg({ index: 0, letter: 'a', item: ROBE })).toEqual({ msg: 'input', text: 'ea' })
    // An engine without action verbs: keys.
    const old = { name: '2 potions of curing', col: 7, base_type: 7 }
    expect(useMsg({ index: 2, letter: 'c', item: old })).toEqual({ msg: 'input', text: 'qc' })
    expect(describeMsg({ index: 2, letter: 'c', item: old })).toEqual({ msg: 'input', text: 'ic' })
  })

  it('drops emptied slots that keep a stale name', () => {
    expect(liveItems(new Map([[4, EMPTIED]]))).toEqual([])
  })

  it('picks the verb from the engine, then the class', () => {
    expect(useKeys(MAGIC, 'g')).toBe('qg')
    expect(useKeys(SCROLLS, 'h')).toBe('rh')
    expect(useKeys(ROBE, 'a')).toBe('ea')
    expect(useKeys({ name: 'a wand of flame (5)', col: 7, base_type: 3 }, 'e')).toBe('Ve')
    expect(useKeys({ name: '12 darts', col: 7, base_type: 1 }, 'f')).toBe('Ff')
    expect(useKeys({ name: 'a book of Fire', col: 7, base_type: 8 }, 'b')).toBe('ib')
    expect(useKeys({ name: 'a potion of curing', col: 7 }, 'c')).toBe('qc')
    expect(itemKind({ name: 'a stone of tremors' })).toBe('evoke')
  })

  it('normalizes names and counts stacks', () => {
    expect(slotName('3 potions of curing {@q1}')).toBe('potion of curing')
    expect(itemCount(BLACK)).toBe(2)
    expect(itemCount({ name: '3 potions of curing', col: 7 })).toBe(3)
    expect(shortLabel('2 scrolls of teleportation')).toBe('telepor…')
  })

  it('follows an item across letter changes and identification', () => {
    const slot = makeSlot({ index: 53, letter: 'd', item: BLACK })
    // Moved letter: found by name.
    expect(resolveSlot(slot, new Map([[53, { ...BLACK, letter: L('k') }]]))?.letter).toBe('k')
    // Identified: same class and subtype.
    const ided = { ...BLACK, name: '2 potions of curing' }
    expect(resolveSlot(slot, new Map([[53, ided]]))?.letter).toBe('d')
    // Used up.
    expect(resolveSlot(slot, new Map([[53, EMPTIED]]))).toBeNull()
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

  it('reads underfoot items from the log', () => {
    expect(lootSignal('You see here a +0 dagger.')).toBe('here')
    expect(lootSignal('There are several objects here.')).toBe('here')
    expect(lootSignal('Items here: ) ! ? ?.')).toBe('here')
    expect(lootSignal('d - 2 potions of curing')).toBe('gone')
    expect(lootSignal('You hit the rat.')).toBeNull()
  })
})
