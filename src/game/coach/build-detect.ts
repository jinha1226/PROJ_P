// Detect the player's build (species + background) from the game-start
// "Welcome, NAME the <Species> <Background>." message.
//
// Must run on the ENGLISH message BEFORE client-side translation rewrites it
// (see ws/connection.ts: observeBuildMessage is called ahead of
// translateIncoming). The player protocol exposes species but NOT background,
// and the build code is only in lobby entries, so the welcome line is the one
// place both appear together for the active game.

import type { ServerMsg } from '../../ws/types'

// Canonical DCSS names (0.34). Longest-first so multi-word names win over their
// suffixes (e.g. "Black Draconian" before "Draconian").
const SPECIES = [
  'Black Draconian','Green Draconian','Grey Draconian','Pale Draconian','Purple Draconian',
  'Red Draconian','White Draconian','Yellow Draconian','Deep Elf','Mountain Dwarf','Vine Stalker',
  'Armataur','Barachi','Coglin','Demigod','Demonspawn','Djinni','Draconian','Felid','Formicid',
  'Gargoyle','Gnoll','Human','Kobold','Merfolk','Minotaur','Mummy','Naga','Octopode','Oni',
  'Poltergeist','Revenant','Spriggan','Tengu','Troll',
]
const BACKGROUNDS = [
  'Air Elementalist','Earth Elementalist','Fire Elementalist','Ice Elementalist','Cinder Acolyte',
  'Chaos Knight','Hedge Wizard','Alchemist','Artificer','Berserker','Brigand','Conjurer','Delver',
  'Enchanter','Fighter','Forgewright','Gladiator','Hexslinger','Hunter','Monk','Necromancer',
  'Reaver','Shapeshifter','Summoner','Wanderer','Warper',
]

function alt(names: string[]): string {
  return [...names].sort((a, b) => b.length - a.length).map(n => n.replace(/ /g, '\\s')).join('|')
}
const BUILD_RE = new RegExp(`\\bthe (${alt(SPECIES)}) (${alt(BACKGROUNDS)})\\b`)

export interface Build { species: string; background: string }

// Pure: pull a build out of one line of text, or null. Exported for tests.
export function parseBuild(text: string): Build | null {
  const m = BUILD_RE.exec(text)
  return m ? { species: m[1].replace(/\s+/g, ' '), background: m[2].replace(/\s+/g, ' ') } : null
}

let current: Build | null = null

// Scan an incoming (pre-translation) server message for the welcome line.
export function observeBuildMessage(msg: ServerMsg): void {
  if (msg.msg !== 'msgs') return
  for (const m of msg.messages ?? []) {
    if (!m.text) continue
    const b = parseBuild(m.text)
    if (b) { current = b; return }
  }
}

export function getCurrentBuild(): Build | null {
  return current
}

export function clearBuild(): void {
  current = null
}
