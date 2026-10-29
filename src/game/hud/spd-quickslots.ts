// Inventory model for the SPD-style chrome (spd-toolbar.ts, spd-bag.ts):
// which items are live, their real letters, what a tap on one sends, and
// quickslots — Shattered Pixel Dungeon's idea of pinning a few consumables
// to the bottom bar so a single tap uses them.
//
// DCSS has no client-side item use, so everything resolves to keystrokes:
// the item's inventory letter plus the verb its class takes (q quaff, r
// read, V evoke, F throw, e equip, i describe as the catch-all — the
// describe screen lists every action the engine allows).
//
// A slot remembers the item by its normalized name, its class/subtype and
// its last letter. The name survives the letter shuffling of a pickup or
// drop; class+subtype and then the letter cover a name change (identifying
// a potion turns "black potion" into "potion of curing").

import type { InvItem } from '../inventory-store'
import { TEX, type TileLoader } from '../tiles/tile-loader'
import { renderTiles, type TileRef } from '../tiles/tile-view'

export interface QuickSlot {
  name: string       // normalized (slotName)
  letter: string     // inventory letter when assigned / last resolved
  base?: number      // base_type
  sub?: number       // sub_type
}

export const QUICKSLOT_COUNT = 4
const STORAGE_KEY = 'pocketzot:spd-quickslots'

export type ItemKind = 'potion' | 'scroll' | 'wand' | 'evoke' | 'missile' | 'equip' | 'other'

// object_class_type (item-prop-enum.h), the classes the toolbar cares about.
const OBJ = {
  WEAPONS: 0, MISSILES: 1, ARMOUR: 2, WANDS: 3, SCROLLS: 5, JEWELLERY: 6,
  POTIONS: 7, STAVES: 9, MISCELLANY: 11, TALISMANS: 15, UNASSIGNED: 100,
} as const

const BASE_KIND: Record<number, ItemKind> = {
  [OBJ.WEAPONS]: 'equip', [OBJ.MISSILES]: 'missile', [OBJ.ARMOUR]: 'equip',
  [OBJ.WANDS]: 'wand', [OBJ.SCROLLS]: 'scroll', [OBJ.JEWELLERY]: 'equip',
  [OBJ.POTIONS]: 'potion', [OBJ.STAVES]: 'equip', [OBJ.MISCELLANY]: 'evoke',
  [OBJ.TALISMANS]: 'evoke',
}

// Inventory index → letter, as the engine's index_to_letter (a–z, A–Z).
// Only a fallback: the wire's `letter` is authoritative.
export function indexLetter(index: number): string {
  if (index < 26) return String.fromCharCode(97 + index)
  return String.fromCharCode(65 + index - 26)
}

export function itemLetter(index: number, item: InvItem): string {
  return item.letter ? String.fromCharCode(item.letter) : indexLetter(index)
}

export function isLive(item: InvItem): boolean {
  return !!item.name && item.base_type !== OBJ.UNASSIGNED && (item.quantity ?? 1) > 0
}

export interface LiveItem { index: number; letter: string; item: InvItem }

// The pack in letter order.
export function liveItems(items: ReadonlyMap<number, InvItem>): LiveItem[] {
  const out: LiveItem[] = []
  for (const [index, item] of items) {
    if (isLive(item)) out.push({ index, letter: itemLetter(index, item), item })
  }
  return out.sort((a, b) => letterOrder(a.letter) - letterOrder(b.letter))
}

function letterOrder(l: string): number {
  const c = l.charCodeAt(0)
  return c >= 97 ? c - 97 : c - 65 + 26
}

const EVOKABLE = /\b(phial|lamp of fire|horn of geryon|box of beasts|sack of spiders|phantom mirror|condenser vane|tin of tremorstones|lightning rod|gravitambourine|figurine|crystal ball|fan of gales|stone of tremors|disc of storms|talisman)\b/i
const MISSILE = /\b(darts?|javelins?|boomerangs?|stones?|large rocks?|throwing nets?|bolas(es)?)\b/i

function nameKind(name: string): ItemKind {
  if (/\bpotions?\b/i.test(name)) return 'potion'
  if (/\bscrolls?\b/i.test(name)) return 'scroll'
  if (/\bwands?\b/i.test(name)) return 'wand'
  if (EVOKABLE.test(name)) return 'evoke'
  if (MISSILE.test(name)) return 'missile'
  return 'other'
}

export function itemKind(item: Pick<InvItem, 'name' | 'base_type'>): ItemKind {
  if (item.base_type !== undefined) return BASE_KIND[item.base_type] ?? 'other'
  return nameKind(item.name)
}

// The ASCII glyph DCSS draws for the class — the slot face without tiles.
export const KIND_GLYPH: Record<ItemKind, string> = {
  potion: '!', scroll: '?', wand: '/', evoke: '}', missile: ')', equip: '[', other: '*',
}

// Face glyph for a slot whose item is gone.
export function nameKindGlyph(slot: QuickSlot): string {
  const kind = slot.base !== undefined ? BASE_KIND[slot.base] ?? 'other' : nameKind(slot.name)
  return KIND_GLYPH[kind]
}

// The engine's own verb (tileweb.cc action_verb) → command key. Checked
// before the class table: it already accounts for the item's state.
const VERB_KEYS: Record<string, string> = {
  drink: 'q', quaff: 'q', read: 'r', evoke: 'V', zap: 'V', throw: 'F', fire: 'F',
  wield: 'e', wear: 'e', 'put on': 'e', equip: 'e',
  unwield: 'c', 'take off': 'c', remove: 'c', unequip: 'c',
}
const KIND_KEYS: Record<ItemKind, string> = {
  potion: 'q', scroll: 'r', wand: 'V', evoke: 'V', missile: 'F', equip: 'e', other: 'i',
}

// Keystrokes that use the item on `letter`. Sent as one input message: the
// server writes multi-char text to the pty atomically (control-sets.ts).
export function useKeys(item: InvItem, letter: string): string {
  const verb = VERB_KEYS[(item.action_verb ?? '').toLowerCase()]
  return (verb ?? KIND_KEYS[itemKind(item)]) + letter
}

// The verb's display name for the bag's primary button.
export function useLabel(item: InvItem): string {
  if (item.action_verb) return item.action_verb
  switch (itemKind(item)) {
    case 'potion': return 'Drink'
    case 'scroll': return 'Read'
    case 'wand':
    case 'evoke': return 'Evoke'
    case 'missile': return 'Throw'
    case 'equip': return 'Equip'
    default: return 'Use'
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

export function itemCount(item: InvItem): number {
  if (item.quantity !== undefined) return item.quantity
  const m = /^\s*(\d+)\s/.exec(item.name)
  return m ? Number(m[1]) : 1
}

// Short face caption: the part after "of", else the last word.
export function shortLabel(name: string): string {
  const n = slotName(name)
  const of = / of (.+)$/.exec(n)
  const s = of ? of[1] : n.split(' ').pop() ?? n
  return s.length > 8 ? s.slice(0, 7) + '…' : s
}

export function makeSlot(live: LiveItem): QuickSlot {
  return { name: slotName(live.item.name), letter: live.letter, base: live.item.base_type, sub: live.item.sub_type }
}

// Where the slot's item is now, or null when it's gone.
export function resolveSlot(slot: QuickSlot, items: ReadonlyMap<number, InvItem>): LiveItem | null {
  const live = liveItems(items)
  const byName = live.find(l => slotName(l.item.name) === slot.name)
  if (byName) return byName
  if (slot.base !== undefined && slot.sub !== undefined) {
    const byType = live.find(l => l.item.base_type === slot.base && l.item.sub_type === slot.sub)
    if (byType) return byType
  }
  const kind = slot.base !== undefined ? BASE_KIND[slot.base] ?? 'other' : nameKind(slot.name)
  if (kind === 'other') return null
  return live.find(l => l.letter === slot.letter && itemKind(l.item) === kind) ?? null
}

// The item's sprite (main atlas, base + overlays), or null without tiles.
export function itemTile(loader: TileLoader | null, item: InvItem, scale = 1): HTMLElement | null {
  if (!loader || item.tile === undefined) return null
  const ids = Array.isArray(item.tile) ? item.tile : [item.tile]
  if (ids.length === 0) return null
  const refs: TileRef[] = ids.map(t => ({ t, tex: TEX.MAIN }))
  return renderTiles(loader, refs, scale)
}

export function loadSlots(): (QuickSlot | null)[] {
  let raw: unknown = null
  try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') } catch { /* empty */ }
  const out: (QuickSlot | null)[] = Array.from({ length: QUICKSLOT_COUNT }, () => null)
  if (!Array.isArray(raw)) return out
  for (let i = 0; i < QUICKSLOT_COUNT; i++) {
    const s = raw[i] as Partial<QuickSlot> | null
    if (s && typeof s.name === 'string' && typeof s.letter === 'string') {
      out[i] = { name: s.name, letter: s.letter, base: s.base, sub: s.sub }
    }
  }
  return out
}

export function saveSlots(slots: (QuickSlot | null)[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slots)) } catch { /* private mode */ }
}
