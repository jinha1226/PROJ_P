// User-customized touch layout: pure types, validation, and serialization.
// No DOM and no prefs access here — touch-catalog.ts binds this to the
// command catalog and prefs; game-view.ts binds it to the RC backup line.

export type Slot = { cmd: string } | { raw: string } | null

export interface TouchLayout {
  v: 1
  dpad: { side: 'left' | 'right'; size: 'sm' | 'md' | 'lg' }
  tabs: { micro: Slot[][]; macro: Slot[][] }
}

const SIDES = ['left', 'right']
const SIZES = ['sm', 'md', 'lg']

// Rows are capped at 4 (screen height); columns fixed at 4 (grid invariant).
const MAX_ROWS = 4
const COLS = 4

// Raw slots hold exactly one printable-ASCII char — that keeps the base64
// backup line btoa-safe and matches what the capture keyboard can produce.
const RAW_RE = /^[\x20-\x7e]$/

function validSlot(s: unknown, knownCmd: (id: string) => boolean): Slot | undefined {
  if (s === null) return null
  if (typeof s !== 'object') return undefined
  const o = s as Record<string, unknown>
  if (typeof o.cmd === 'string') return knownCmd(o.cmd) ? { cmd: o.cmd } : null // unknown cmd → empty slot
  if (typeof o.raw === 'string') return RAW_RE.test(o.raw) ? { raw: o.raw } : undefined
  return undefined
}

function validRows(rows: unknown, knownCmd: (id: string) => boolean): Slot[][] | null {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_ROWS) return null
  const out: Slot[][] = []
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== COLS) return null
    const slots: Slot[] = []
    for (const s of row) {
      const v = validSlot(s, knownCmd)
      if (v === undefined) return null
      slots.push(v)
    }
    out.push(slots)
  }
  return out
}

export function validateLayout(x: unknown, knownCmd: (id: string) => boolean): TouchLayout | null {
  if (typeof x !== 'object' || x === null) return null
  const o = x as Record<string, unknown>
  if (o.v !== 1) return null
  const dpad = o.dpad as Record<string, unknown> | undefined
  if (!dpad || !SIDES.includes(dpad.side as string) || !SIZES.includes(dpad.size as string)) return null
  const tabs = o.tabs as Record<string, unknown> | undefined
  if (!tabs) return null
  const micro = validRows(tabs.micro, knownCmd)
  const macro = validRows(tabs.macro, knownCmd)
  if (!micro || !macro) return null
  return {
    v: 1,
    dpad: { side: dpad.side as 'left' | 'right', size: dpad.size as 'sm' | 'md' | 'lg' },
    tabs: { micro, macro },
  }
}

export function encodeLayout(l: TouchLayout): string {
  return btoa(JSON.stringify(l)) // layout JSON is ASCII-only (RAW_RE), so btoa is safe
}

export function decodeLayout(b64: string, knownCmd: (id: string) => boolean): TouchLayout | null {
  try {
    return validateLayout(JSON.parse(atob(b64)), knownCmd)
  } catch {
    return null
  }
}

// Sync decision between the local pref and the RC-comment backup. Local wins
// on conflict (the device you just edited on is the freshest).
export function planLayoutSync(local: TouchLayout | null, remote: TouchLayout | null): 'backup' | 'restore' | 'none' {
  if (local !== null) return JSON.stringify(local) === JSON.stringify(remote) ? 'none' : 'backup'
  return remote !== null ? 'restore' : 'none'
}
