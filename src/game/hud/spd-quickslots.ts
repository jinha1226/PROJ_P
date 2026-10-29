// Quickslots for the SPD-style toolbar (spd-toolbar.ts): the Shattered
// Pixel Dungeon idea of pinning a few consumables to the bottom bar so a
// single tap uses them. DCSS has no such client-side concept, so a slot is
// resolved to keystrokes at tap time: the item's current inventory letter
// plus the verb its class takes (q quaff, r read, V evoke, F throw, e/c
// equip/unequip, i describe as the catch-all).
//
// A slot remembers the item by its normalized name AND its last letter.
// The name survives the letter shuffling of a pickup/drop; the letter is
// the fallback when the name itself changes (identifying a potion turns
// "bubbling potion" into "potion of curing"), accepted only while the item
// on that letter still takes the same verb.

import type { InvItem } from '../inventory-store'

export interface QuickSlot {
  name: string    // normalized (slotName)
  letter: string  // inventory letter when assigned / last resolved
}

export const QUICKSLOT_COUNT = 4
const STORAGE_KEY = 'pocketzot:spd-quickslots'

export type ItemKind = 'potion' | 'scroll' | 'wand' | 'evoke' | 'missile' | 'equip' | 'other'

// Inventory index → letter, as the engine's index_to_letter (a–z, A–Z).
export function indexLetter(index: number): string {
  if (index < 26) return String.fromCharCode(97 + index)
  return String.fromCharCode(65 + index - 26)
}

const EVOKABLE = /\b(phial|lamp of fire|horn of geryon|box of beasts|sack of spiders|phantom mirror|condenser vane|tin of tremorstones|lightning rod|gravitambourine|figurine|crystal ball|fan of gales|stone of tremors|disc of storms|talisman)\b/i
const MISSILE = /\b(darts?|javelins?|boomerangs?|stones?|large rocks?|throwing nets?|bolas(es)?)\b/i
const EQUIP = /\b(armour|robe|cloak|scarf|hat|helmet|cap|gloves|gauntlets|boots|barding|shield|buckler|orb|ring|amulet|staff|sword|blade|sabre|scimitar|axe|mace|flail|club|whip|hammer|morningstar|dagger|knife|rapier|spear|halberd|glaive|trident|scythe|bardiche|lance|partisan|bow|crossbow|sling|arbalest|hand cannon|quarterstaff|lajatang|dire flail|giant club|eveningstar|cutlass|falchion|longsword|claymore|broadsword|leather|chain mail|plate|scale mail|ring mail|dragon scales|troll)\b/i
const WORN = /\((weapon|worn|left hand|right hand|around neck|offhand|on left \w+|on right \w+|in hand)\)/i

export function itemKind(name: string): ItemKind {
  if (/\bpotions?\b/i.test(name)) return 'potion'
  if (/\bscrolls?\b/i.test(name)) return 'scroll'
  if (/\bwands?\b/i.test(name)) return 'wand'
  if (EVOKABLE.test(name)) return 'evoke'
  if (MISSILE.test(name)) return 'missile'
  if (EQUIP.test(name)) return 'equip'
  return 'other'
}

// The ASCII glyph DCSS draws for the class — the slot face in lieu of the
// item tile.
export const KIND_GLYPH: Record<ItemKind, string> = {
  potion: '!', scroll: '?', wand: '/', evoke: '}', missile: ')', equip: '[', other: '*',
}

// Keystrokes that use the item on `letter`. Sent as one input message: the
// server writes multi-char text to the pty atomically (control-sets.ts).
export function useKeys(name: string, letter: string): string {
  switch (itemKind(name)) {
    case 'potion': return 'q' + letter
    case 'scroll': return 'r' + letter
    case 'wand':
    case 'evoke': return 'V' + letter
    case 'missile': return 'F' + letter
    case 'equip': return (WORN.test(name) ? 'c' : 'e') + letter
    default: return 'i' + letter
  }
}

// Drop quantity, article, inscription and equip-state suffix; singularize
// the stackable classes so "3 potions of curing" and "a potion of curing"
// name the same slot.
export function slotName(name: string): string {
  return name
    .replace(/\{[^}]*\}/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/^\s*(\d+|an?|the)\s+/i, '')
    .replace(/\bpotions\b/i, 'potion')
    .replace(/\bscrolls\b/i, 'scroll')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Leading stack count ("3 potions of …"), or 1.
export function itemCount(name: string): number {
  const m = /^\s*(\d+)\s/.exec(name)
  return m ? Number(m[1]) : 1
}

// Short face caption: the part after "of", else the last word.
export function shortLabel(name: string): string {
  const n = slotName(name)
  const of = / of (.+)$/.exec(n)
  const s = of ? of[1] : n.split(' ').pop() ?? n
  return s.length > 8 ? s.slice(0, 7) + '…' : s
}

export interface ResolvedSlot {
  letter: string
  item: InvItem
}

// Where the slot's item is now, or null when it's gone.
export function resolveSlot(slot: QuickSlot, items: ReadonlyMap<number, InvItem>): ResolvedSlot | null {
  const live = [...items.entries()].filter(([, it]) => it.name)
  for (const [idx, item] of live) {
    if (slotName(item.name) === slot.name) return { letter: indexLetter(idx), item }
  }
  for (const [idx, item] of live) {
    if (indexLetter(idx) !== slot.letter) continue
    if (itemKind(item.name) === itemKind(slot.name) && itemKind(item.name) !== 'other') {
      return { letter: slot.letter, item }
    }
  }
  return null
}

export function loadSlots(): (QuickSlot | null)[] {
  let raw: unknown = null
  try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') } catch { /* empty */ }
  const out: (QuickSlot | null)[] = Array.from({ length: QUICKSLOT_COUNT }, () => null)
  if (!Array.isArray(raw)) return out
  for (let i = 0; i < QUICKSLOT_COUNT; i++) {
    const s = raw[i] as Partial<QuickSlot> | null
    if (s && typeof s.name === 'string' && typeof s.letter === 'string') out[i] = { name: s.name, letter: s.letter }
  }
  return out
}

export function saveSlots(slots: (QuickSlot | null)[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slots)) } catch { /* private mode */ }
}
