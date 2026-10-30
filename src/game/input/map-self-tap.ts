import type { Cell } from '../map/map-store'

// Wire `f` is dungeon_feature_type, not a sprite id or minimap category.
// These are Crawl's TAG_MAJOR_VERSION=34 values (0.24 through trunk keep
// removed slots and append new features). Direction follows terrain.cc's
// feat_stair_direction and main.cc's shop/altar/Golubria/shaft handling.
// Unknown features never trigger stairs; don't guess from the player's '@' glyph or
// MF_FEATURE, which includes non-interactive fountains as well as altars.
const UP: ReadonlyArray<readonly [number, number]> = [
  [46, 49],   // stone stairs, escape hatch
  [60, 60],   // dungeon exit
  [62, 62],   // Hell exit
  [67, 67],   // portal vault exit
  [86, 102],  // branch exits
  [134, 134], // sealed stairs up (let the engine explain the seal)
  [149, 159], // portal branch exits
  [175, 175], // Gauntlet exit
  [194, 194], // Arena exit
  [198, 201], // Hell subbranch exits
]
const DOWN: ReadonlyArray<readonly [number, number]> = [
  [37, 37],   // known shaft
  [40, 40],   // shop (not abandoned shop)
  [42, 45],   // stone stairs, escape hatch
  [50, 55],   // Hell entrances, Abyss entrance/exit
  [57, 59],   // Pandemonium entrance/exit/transit
  [61, 61],   // exit through Abyss
  [63, 64],   // Hell, old Labyrinth entrance
  [66, 66],   // portal vault entrance
  [69, 85],   // branch entrances
  [103, 121], // altars Zin through Dithmenos
  [132, 132], // Abyssal stair
  [135, 135], // sealed stairs down
  [138, 148], // Passage of Golubria, portal branch entrances
  [160, 162], // altars Gozag, Qazlal, Ru
  [165, 168], // altars Ecumenical, Pakellas, Uskayaw, Hepliaklqana
  [170, 171], // Wu Jian altar, transporter (not its landing)
  [174, 174], // Gauntlet entrance
  [193, 193], // Arena entrance
  [195, 195], // Ignis altar
]

const SHOP = 40
const ALTARS: ReadonlyArray<readonly [number, number]> = [
  [103, 121], [160, 162], [165, 168], [170, 170], [195, 195],
]

// What the player stands on, for the SPD stairs button: its key and what
// to draw. Null off any usable feature.
export function standingFeature(cell: Cell | undefined): { key: '<' | '>'; kind: 'up' | 'down' | 'shop' | 'altar' } | null {
  const key = selfTapKey(cell)
  if (key !== '<' && key !== '>') return null
  const f = cell!.f!
  if (f === SHOP) return { key, kind: 'shop' }
  if (ALTARS.some(([lo, hi]) => f >= lo && f <= hi)) return { key, kind: 'altar' }
  return { key, kind: key === '<' ? 'up' : 'down' }
}

// Called only for a tap on the player at the command prompt. Terrain takes
// priority over items; send just the command, leaving confirmations to Crawl.
export function selfTapKey(cell: Cell | undefined): '<' | '>' | ',' | null {
  if (!cell) return null
  const f = cell.f
  if (f !== undefined) {
    if (UP.some(([lo, hi]) => f >= lo && f <= hi)) return '<'
    if (DOWN.some(([lo, hi]) => f >= lo && f <= hi)) return '>'
  }
  // Let Crawl check for items. MF_ITEM loses to special terrain, and
  // view.cc's _draw_player replaces the foreground including item markers,
  // so the wire cannot reliably tell us what is under the player. Picking
  // up on an empty cell costs no turn and only reports that nothing is here.
  return ','
}
