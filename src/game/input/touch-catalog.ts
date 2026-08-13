// Single source of truth for every command a touch button can send. The
// shipped TAB_BUTTONS grids are derived from DEFAULT_TAB_IDS, and the edit
// mode's command picker lists CATALOG grouped by `group`. Adding a command
// here makes it both assignable and (via KEY_LABELS in touch.ts) eligible
// for the in-place modifier relabel.
import { getPref } from '../../prefs'
import { validateLayout, type Slot, type TouchLayout } from './custom-layout'

export interface TabButtonDef {
  label: string
  title?: string
  text?: string
  key?: number
}

export type CatalogGroup = 'consume' | 'move' | 'combat' | 'info' | 'misc'

export interface CatalogEntry extends TabButtonDef {
  id: string
  group: CatalogGroup
}

export const GROUP_LABELS: Record<CatalogGroup, { ko: string; en: string }> = {
  consume: { ko: '소모품·휴식', en: 'Consume · Rest' },
  move:    { ko: '이동·지도',   en: 'Move · Map' },
  combat:  { ko: '전투·시전',   en: 'Combat · Cast' },
  info:    { ko: '정보',        en: 'Info' },
  misc:    { ko: '기타',        en: 'Misc' },
}

export const CATALOG: CatalogEntry[] = [
  // consume / rest
  { id: 'quaff',       group: 'consume', label: 'q',  title: 'Quaff potion',          text: 'q' },
  { id: 'read',        group: 'consume', label: 'r',  title: 'Read scroll',           text: 'r' },
  { id: 'rest',        group: 'consume', label: '5',  title: 'Rest until healed',     text: '5' },
  // move / map
  { id: 'travel',      group: 'move',    label: 'G',  title: 'Go to level / branch',  text: 'G' },
  { id: 'stairs-up',   group: 'move',    label: '<',  title: 'Ascend stairs',         text: '<' },
  { id: 'stairs-down', group: 'move',    label: '>',  title: 'Descend stairs',        text: '>' },
  { id: 'map',         group: 'move',    label: 'X',  title: 'Examine level map',     text: 'X' },
  { id: 'explore',     group: 'move',    label: 'o',  title: 'Auto-explore',          text: 'o' },
  // combat / cast
  { id: 'ability',     group: 'combat',  label: 'a',  title: 'Use ability',           text: 'a' },
  { id: 'fire',        group: 'combat',  label: 'f',  title: 'Fire / quivered',       text: 'f' },
  { id: 'evoke',       group: 'combat',  label: 'v',  title: 'Evoke item',            text: 'v' },
  { id: 'cast',        group: 'combat',  label: 'z',  title: 'Cast spell',            text: 'z' },
  { id: 'autofight',   group: 'combat',  label: '⇥',  title: 'Auto-fight nearest',    key: 9 },
  { id: 'wield',       group: 'combat',  label: 'w',  title: 'Wield weapon',          text: 'w' },
  // info screens
  { id: 'inventory',   group: 'info',    label: 'i',  title: 'Inventory',             text: 'i' },
  { id: 'skills',      group: 'info',    label: 'm',  title: 'Skills screen',         text: 'm' },
  { id: 'spells-list', group: 'info',    label: 'I',  title: 'List memorised spells', text: 'I' },
  { id: 'status',      group: 'info',    label: '@',  title: 'Character status',      text: '@' },
  { id: 'library',     group: 'info',    label: 'M',  title: 'Spell library',         text: 'M' },
  { id: 'overview',    group: 'info',    label: '^O', title: 'Dungeon overview (Ctrl+O)', key: 15 },
  { id: 'character',   group: 'info',    label: '%',  title: 'Character overview',    text: '%' },
  { id: 'abilities',   group: 'info',    label: 'A',  title: 'Abilities/mutations',   text: 'A' },
  { id: 'religion',    group: 'info',    label: '^',  title: 'Religion / deity',      text: '^' },
  { id: 'runes',       group: 'info',    label: '}',  title: 'Runes collected',       text: '}' },
  { id: 'known',       group: 'info',    label: '\\', title: 'Item knowledge',        text: '\\' },
  { id: 'gold',        group: 'info',    label: '$',  title: 'Gold / shopping list',  text: '$' },
  // misc
  { id: 'pickup',      group: 'misc',    label: ',',  title: 'Pick up item',          text: ',' },
  { id: 'look',        group: 'misc',    label: 'x',  title: 'Examine surroundings',  text: 'x' },
  { id: 'puton',       group: 'misc',    label: 'P',  title: 'Put on jewellery',      text: 'P' },
  { id: 'remove',      group: 'misc',    label: 'R',  title: 'Remove jewellery',      text: 'R' },
  { id: 'drop',        group: 'misc',    label: 'd',  title: 'Drop',                  text: 'd' },
  { id: 'reassign',    group: 'misc',    label: '=',  title: 'Reassign inventory/spell letters', text: '=' },
  { id: 'help',        group: 'misc',    label: '?',  title: 'Help',                  text: '?' },
]

export const CATALOG_BY_ID: Map<string, CatalogEntry> = new Map(CATALOG.map(e => [e.id, e]))

// The shipped grids, expressed as catalog ids. Must reproduce the historical
// TAB_BUTTONS exactly — touch-catalog.test.ts pins that equivalence.
// 4 columns per row (the grid invariant, see custom-layout COLS).
export const DEFAULT_TAB_IDS: { micro: string[][]; macro: string[][] } = {
  micro: [
    ['quaff', 'read', 'inventory', 'rest'],
    ['travel', 'skills', 'pickup', 'spells-list'],
    ['ability', 'fire', 'stairs-up', 'stairs-down'],
  ],
  macro: [
    ['status', 'library', 'map', 'overview'],
    ['fire', 'evoke', 'ability', 'cast'],
    ['character', 'abilities', 'religion', 'runes'],
  ],
}

export function defaultLayout(): TouchLayout {
  const rows = (ids: string[][]): Slot[][] => ids.map(r => r.map(id => ({ cmd: id })))
  return {
    v: 1,
    dpad: { side: 'left', size: 'sm' },
    tabs: { micro: rows(DEFAULT_TAB_IDS.micro), macro: rows(DEFAULT_TAB_IDS.macro) },
  }
}

export function validateStoredLayout(x: unknown): TouchLayout | null {
  return validateLayout(x, id => CATALOG_BY_ID.has(id))
}

export function customLayout(): TouchLayout | null {
  return validateStoredLayout(getPref('touchLayout'))
}

export function currentLayout(): TouchLayout {
  return customLayout() ?? defaultLayout()
}

// null → `{ label: '' }`: renderContent's existing `!def.label` check renders
// that as a spacer, so empty slots reuse the spacer path unchanged.
export function slotToDef(slot: Slot): TabButtonDef {
  if (slot === null) return { label: '' }
  if ('cmd' in slot) return CATALOG_BY_ID.get(slot.cmd) ?? { label: '' }
  return { label: slot.raw, text: slot.raw }
}
