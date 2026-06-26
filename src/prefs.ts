import { SPECTATE_SERVERS } from './servers'

const KEY = 'pocketzot:prefs'

export type UiLang = 'ko' | 'en'

export interface Prefs {
  lastGuestSpectateWsUrl: string | null
  monsterListCollapsed: boolean
  mapRenderMode: 'ascii' | 'tiles'
  uiLang: UiLang
  dpadEnabled: boolean
  coachEnabled: boolean
  // User map-zoom level (index into ZOOM_LEVELS). null = never set, so each
  // renderer falls back to its mode default (ASCII normal, tiles zoomed-in).
  mapZoomLevel: number | null
  // Spell titles the user hid from the quick-cast surfaces (rail + z tab).
  hiddenSpells: string[]
}

const DEFAULTS: Prefs = {
  lastGuestSpectateWsUrl: null,
  monsterListCollapsed: false,
  mapRenderMode: 'ascii',
  uiLang: 'ko',
  dpadEnabled: true,
  coachEnabled: false,
  mapZoomLevel: null,
  hiddenSpells: [],
}

// Session fallback for values whose localStorage write failed (private mode,
// "block all cookies", or storage disabled all throw on setItem). Without this
// a blocked write was silently swallowed and getPref kept returning the old
// value, so a toggle (e.g. the coach) appeared to "not turn off" at all. These
// still won't survive a reload — only fixing the browser's storage, or shipping
// a different default, can do that — but the setting works for the session.
const memOverride: Partial<Prefs> = {}

function load(): Prefs {
  let stored: Partial<Prefs> = {}
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) stored = JSON.parse(raw) as Partial<Prefs>
  } catch {}
  return { ...DEFAULTS, ...stored, ...memOverride }
}

export function getPref<K extends keyof Prefs>(k: K): Prefs[K] {
  return load()[k]
}

export function setPref<K extends keyof Prefs>(k: K, v: Prefs[K]): void {
  const next = { ...load(), [k]: v }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
    delete memOverride[k]   // persisted for real — drop any stale session override
  } catch {
    memOverride[k] = v      // storage blocked — keep it live for this session
  }
}

export function getLastSpectateServer(): string | null {
  const v = getPref('lastGuestSpectateWsUrl')
  return v && SPECTATE_SERVERS.some(s => s.wsUrl === v) ? v : null
}

export function setLastSpectateServer(wsUrl: string): void {
  setPref('lastGuestSpectateWsUrl', wsUrl)
}
