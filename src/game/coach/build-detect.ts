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
  newgameNames.clear()
}

// --- New-game choice capture (English names, pre-translation) ---
// The character-creation grid (species/background/...) arrives as a
// ui-push newgame-choice whose button labels get translated to Korean before
// game-view renders them. Capture the ENGLISH names here (keyed by hotkey)
// from the still-English message so the char-select outline can match guide
// keys regardless of whether translation is armed.
const newgameNames = new Map<string, string>()

function hotkeyStr(hk: unknown): string {
  return typeof hk === 'number' ? String.fromCharCode(hk) : String(hk ?? '')
}
function choiceName(label: string): string {
  const plain = label.replace(/<[^>]*>/g, '')
  const dash = plain.indexOf(' - ')
  return (dash >= 0 ? plain.slice(dash + 3) : plain).trim()
}

export function observeNewgameChoice(msg: ServerMsg): void {
  const m = msg as unknown as {
    msg: string; type?: string
    'main-items'?: { buttons?: Array<{ hotkey?: unknown; label?: string; labels?: string[] }> }
    'sub-items'?: { buttons?: Array<{ hotkey?: unknown; label?: string; labels?: string[] }> }
  }
  if (m.msg !== 'ui-push' || m.type !== 'newgame-choice') return
  newgameNames.clear()
  for (const items of [m['main-items'], m['sub-items']]) {
    for (const btn of items?.buttons ?? []) {
      const label = String(btn.labels?.[0] ?? btn.label ?? '')
      const hk = hotkeyStr(btn.hotkey)
      const name = choiceName(label)
      if (hk && name) newgameNames.set(hk, name)
    }
  }
}

// English name of a new-game choice button by hotkey, if captured.
export function newgameChoiceName(hotkey: string): string | undefined {
  return newgameNames.get(hotkey)
}
