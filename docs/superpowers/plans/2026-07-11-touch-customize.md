# Touch Controls Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user customize the touch HUD from settings: swap any action-grid slot's command (catalog pick / raw key / empty), add/remove grid rows (1–4), and set d-pad side (left/right) + size (sm/md/lg), persisted in prefs with an RC-file comment backup for incognito sessions.

**Architecture:** A pure layout module (`custom-layout.ts`) owns the `TouchLayout` type, validation, base64 serialization, and the backup-sync decision. A catalog module (`touch-catalog.ts`) owns every known command (id → label/key) and becomes the single source for the default `TAB_BUTTONS`. `touch.ts` renders from the resolved layout and gains an in-place edit mode + command picker. `rc-options.ts` gains managed `# pocketzot:` comment lines; `game-view.ts` syncs prefs ↔ RC comment when the RC file arrives.

**Tech Stack:** TypeScript, Vite, vitest (happy-dom for DOM tests), no new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-touch-customize-design.md`.
- Settings toggles use **click-only** listeners (touchstart+click double-fires — see `langToggleBtn` comment in touch.ts).
- Grid is always exactly **4 columns**; rows limited to **1–4**.
- Any invalid stored layout falls back to the default; a single unknown `cmd` degrades to an empty slot only.
- All UI copy is bilingual ko/en like existing settings rows (`'켬/On'` style).
- Test command: `npx vitest run <file>` from repo root. Full suite must stay green (391 passing baseline).
- Commit after every task; message style `feat(touch): …` / `test(touch): …` per repo history, ending with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Layout types, validation, serialization, sync planner + prefs field

**Files:**
- Create: `src/game/input/custom-layout.ts`
- Create: `src/game/input/custom-layout.test.ts`
- Modify: `src/prefs.ts` (add `touchLayout` field)

**Interfaces:**
- Consumes: nothing (pure module; prefs.ts only takes a type import).
- Produces:
  - `type Slot = { cmd: string } | { raw: string } | null`
  - `interface TouchLayout { v: 1; dpad: { side: 'left'|'right'; size: 'sm'|'md'|'lg' }; tabs: { micro: Slot[][]; macro: Slot[][] } }`
  - `validateLayout(x: unknown, knownCmd: (id: string) => boolean): TouchLayout | null`
  - `encodeLayout(l: TouchLayout): string` / `decodeLayout(b64: string, knownCmd: (id: string) => boolean): TouchLayout | null`
  - `planLayoutSync(local: TouchLayout | null, remote: TouchLayout | null): 'backup' | 'restore' | 'none'`
  - prefs: `touchLayout: TouchLayout | null` (default `null`)

- [ ] **Step 1: Write the failing test**

Create `src/game/input/custom-layout.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateLayout, encodeLayout, decodeLayout, planLayoutSync, type TouchLayout } from './custom-layout'

const known = (id: string): boolean => id === 'quaff' || id === 'fire'

function goodLayout(): TouchLayout {
  return {
    v: 1,
    dpad: { side: 'left', size: 'md' },
    tabs: {
      micro: [[{ cmd: 'quaff' }, { raw: 'x' }, null, { cmd: 'fire' }]],
      macro: [[null, null, null, null]],
    },
  }
}

describe('validateLayout', () => {
  it('accepts a well-formed layout', () => {
    expect(validateLayout(goodLayout(), known)).toEqual(goodLayout())
  })

  it('rejects garbage, wrong version, and bad dpad values', () => {
    expect(validateLayout(null, known)).toBeNull()
    expect(validateLayout({ ...goodLayout(), v: 2 }, known)).toBeNull()
    expect(validateLayout({ ...goodLayout(), dpad: { side: 'up', size: 'md' } }, known)).toBeNull()
    expect(validateLayout({ ...goodLayout(), dpad: { side: 'left', size: 'xl' } }, known)).toBeNull()
  })

  it('rejects row counts outside 1–4 and rows not exactly 4 wide', () => {
    const l = goodLayout()
    l.tabs.micro = []
    expect(validateLayout(l, known)).toBeNull()
    const l2 = goodLayout()
    l2.tabs.macro = [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]]
    expect(validateLayout(l2, known)).toBeNull()
    const l3 = goodLayout()
    l3.tabs.micro = [[null, null, null]]
    expect(validateLayout(l3, known)).toBeNull()
  })

  it('degrades an unknown cmd to an empty slot, not a rejection', () => {
    const l = goodLayout()
    l.tabs.micro[0][0] = { cmd: 'no-such' }
    const out = validateLayout(l, known)
    expect(out).not.toBeNull()
    expect(out!.tabs.micro[0][0]).toBeNull()
  })

  it('rejects raw slots that are not one printable ASCII char', () => {
    const bad = (raw: string): unknown => {
      const l = goodLayout()
      l.tabs.micro[0][1] = { raw }
      return l
    }
    expect(validateLayout(bad(''), known)).toBeNull()
    expect(validateLayout(bad('ab'), known)).toBeNull()
    expect(validateLayout(bad('한'), known)).toBeNull()
    expect(validateLayout(bad('~'), known)).not.toBeNull()
  })
})

describe('encode/decode round-trip', () => {
  it('round-trips through base64', () => {
    const b64 = encodeLayout(goodLayout())
    expect(b64).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(decodeLayout(b64, known)).toEqual(goodLayout())
  })

  it('returns null on corrupt base64 or non-layout JSON', () => {
    expect(decodeLayout('%%%', known)).toBeNull()
    expect(decodeLayout(btoa('{"v":9}'), known)).toBeNull()
  })
})

describe('planLayoutSync', () => {
  it('backs up when local exists and differs from remote', () => {
    expect(planLayoutSync(goodLayout(), null)).toBe('backup')
    const remote = goodLayout()
    remote.dpad.side = 'right'
    expect(planLayoutSync(goodLayout(), remote)).toBe('backup')
  })

  it('restores when local is empty and remote exists', () => {
    expect(planLayoutSync(null, goodLayout())).toBe('restore')
  })

  it('does nothing when both empty or identical', () => {
    expect(planLayoutSync(null, null)).toBe('none')
    expect(planLayoutSync(goodLayout(), goodLayout())).toBe('none')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/input/custom-layout.test.ts`
Expected: FAIL — cannot resolve `./custom-layout`.

- [ ] **Step 3: Write the implementation**

Create `src/game/input/custom-layout.ts`:

```ts
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
```

In `src/prefs.ts`, add the type import at the top:

```ts
import type { TouchLayout } from './game/input/custom-layout'
```

Add to `interface Prefs` (after `hiddenSpells`):

```ts
  // User-customized touch HUD layout (slots + dpad side/size). null = default.
  // Validated on read by touch-catalog.ts, not here.
  touchLayout: TouchLayout | null
```

Add to `DEFAULTS`:

```ts
  touchLayout: null,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/input/custom-layout.test.ts`
Expected: PASS (all). Then `npx vitest run` — full suite still green.

- [ ] **Step 5: Commit**

```bash
git add src/game/input/custom-layout.ts src/game/input/custom-layout.test.ts src/prefs.ts
git commit -m "feat(touch): custom-layout types, validation, base64 codec, sync planner

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Command catalog as the single source for TAB_BUTTONS

**Files:**
- Create: `src/game/input/touch-catalog.ts`
- Create: `src/game/input/touch-catalog.test.ts`
- Modify: `src/game/input/touch.ts` (derive `TAB_BUTTONS` and `KEY_LABELS` from the catalog; move the `TabButtonDef` interface to the catalog)

**Interfaces:**
- Consumes: `Slot`, `TouchLayout`, `validateLayout` from `./custom-layout`; `getPref` from `../../prefs`; `ACTION_LABELS` from `./action-labels`.
- Produces:
  - `interface TabButtonDef { label: string; title?: string; text?: string; key?: number }` (moved here; touch.ts re-imports)
  - `type CatalogGroup = 'consume' | 'move' | 'combat' | 'info' | 'misc'`
  - `interface CatalogEntry extends TabButtonDef { id: string; group: CatalogGroup }`
  - `CATALOG: CatalogEntry[]`, `CATALOG_BY_ID: Map<string, CatalogEntry>`
  - `GROUP_LABELS: Record<CatalogGroup, { ko: string; en: string }>`
  - `DEFAULT_TAB_IDS: { micro: string[][]; macro: string[][] }`
  - `defaultLayout(): TouchLayout`
  - `validateStoredLayout(x: unknown): TouchLayout | null` (validateLayout bound to catalog ids)
  - `customLayout(): TouchLayout | null` (validated pref, or null)
  - `currentLayout(): TouchLayout` (customLayout() ?? defaultLayout())
  - `slotToDef(slot: Slot): TabButtonDef` (null slot → `{ label: '' }` spacer, matching renderContent's existing spacer check)

- [ ] **Step 1: Write the failing test**

Create `src/game/input/touch-catalog.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  CATALOG, CATALOG_BY_ID, DEFAULT_TAB_IDS,
  defaultLayout, validateStoredLayout, customLayout, currentLayout, slotToDef,
} from './touch-catalog'
import { ACTION_LABELS } from './action-labels'
import { TAB_BUTTONS } from './touch'

beforeEach(() => { localStorage.clear() })

describe('catalog', () => {
  it('has unique ids and every entry sends something', () => {
    const ids = CATALOG.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of CATALOG) expect(e.text !== undefined || e.key !== undefined).toBe(true)
  })

  it('every titled entry resolves a ko/en label', () => {
    for (const e of CATALOG) {
      if (e.title) expect(ACTION_LABELS[e.title], `label for ${e.id}`).toBeDefined()
    }
  })

  it('DEFAULT_TAB_IDS reproduces the shipped TAB_BUTTONS grids', () => {
    for (const tab of ['micro', 'macro'] as const) {
      const derived = DEFAULT_TAB_IDS[tab].map(row => row.map(id => {
        const e = CATALOG_BY_ID.get(id)!
        return { label: e.label, title: e.title, text: e.text, key: e.key }
      }))
      const shipped = TAB_BUTTONS[tab].map(row => row.map(d => ({
        label: d.label, title: d.title, text: d.text, key: d.key,
      })))
      expect(derived).toEqual(shipped)
    }
  })
})

describe('layout resolution', () => {
  it('currentLayout falls back to defaultLayout when pref is null or invalid', () => {
    expect(customLayout()).toBeNull()
    expect(currentLayout()).toEqual(defaultLayout())
    localStorage.setItem('pocketzot:prefs', JSON.stringify({ touchLayout: { v: 9 } }))
    expect(customLayout()).toBeNull()
    expect(currentLayout()).toEqual(defaultLayout())
  })

  it('currentLayout returns a valid stored layout', () => {
    const l = defaultLayout()
    l.dpad.side = 'right'
    localStorage.setItem('pocketzot:prefs', JSON.stringify({ touchLayout: l }))
    expect(customLayout()).toEqual(l)
    expect(currentLayout()).toEqual(l)
  })

  it('validateStoredLayout knows catalog ids', () => {
    const l = defaultLayout()
    expect(validateStoredLayout(l)).toEqual(l)
  })
})

describe('slotToDef', () => {
  it('maps cmd slots to their catalog def, raw slots to a bare key, null to a spacer', () => {
    expect(slotToDef({ cmd: 'quaff' })).toEqual(CATALOG_BY_ID.get('quaff'))
    expect(slotToDef({ raw: '&' })).toEqual({ label: '&', text: '&' })
    expect(slotToDef(null)).toEqual({ label: '' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/input/touch-catalog.test.ts`
Expected: FAIL — cannot resolve `./touch-catalog`.

- [ ] **Step 3: Write the implementation**

Create `src/game/input/touch-catalog.ts`:

```ts
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
    dpad: { side: 'left', size: 'md' },
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
```

In `src/game/input/touch.ts`:

1. Delete the local `interface TabButtonDef { … }` block (lines 26–31) and add to the imports:

```ts
import { CATALOG, CATALOG_BY_ID, DEFAULT_TAB_IDS, type TabButtonDef } from './touch-catalog'
```

2. Replace the entire hardcoded `TAB_BUTTONS` literal (the `export const TAB_BUTTONS: Record<…> = { micro: […], macro: […] }` block, keeping its explanatory comments condensed) with:

```ts
// Derived from the catalog so the shipped grid and the picker share one
// definition. Kept exported under the old name/shape for the label tests
// and KEY_LABELS below.
export const TAB_BUTTONS: Record<Exclude<TabKey, 'spells'>, TabButtonDef[][]> = {
  micro: DEFAULT_TAB_IDS.micro.map(row => row.map(id => CATALOG_BY_ID.get(id)!)),
  macro: DEFAULT_TAB_IDS.macro.map(row => row.map(id => CATALOG_BY_ID.get(id)!)),
}
```

3. In the `KEY_LABELS` IIFE, replace the nested `for (const tab of Object.values(TAB_BUTTONS)) { for (const row of tab) { for (const def of row) { … } } }` loops with a single loop over the whole catalog (so custom-assigned commands also get modifier relabels):

```ts
  for (const def of CATALOG) {
    const lp = def.title ? ACTION_LABELS[def.title] : undefined
    const keyStr = def.text ?? def.label
    if (lp && keyStr) m.set(keyStr, lp)
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/input/`
Expected: PASS — including all pre-existing touch tests (the derived TAB_BUTTONS is shape-identical).

- [ ] **Step 5: Commit**

```bash
git add src/game/input/touch-catalog.ts src/game/input/touch-catalog.test.ts src/game/input/touch.ts
git commit -m "feat(touch): command catalog as single source for tab grids + modifier labels

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Render from the stored layout; apply d-pad side & size

**Files:**
- Modify: `src/game/input/touch.ts`
- Modify: `src/style.css` (dpad-right rule)
- Create: `src/game/input/touch-custom-render.test.ts`

**Interfaces:**
- Consumes: `currentLayout`, `slotToDef` from `./touch-catalog`.
- Produces: `buildTouchControls` renders `layout.tabs` instead of `TAB_BUTTONS`; root element gets `.dpad-right` class and an inline `--tc-dpad` size. Internal helper `layoutDefs(tab: 'micro'|'macro'): TabButtonDef[][]` and module-level `let layout = currentLayout()` inside `buildTouchControls` that Task 5's edit mode mutates and re-reads.

- [ ] **Step 1: Write the failing test**

Create `src/game/input/touch-custom-render.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { buildTouchControls } from './touch'
import { defaultLayout } from './touch-catalog'

beforeEach(() => { localStorage.clear() })

function saveLayout(mut: (l: ReturnType<typeof defaultLayout>) => void): void {
  const l = defaultLayout()
  mut(l)
  localStorage.setItem('pocketzot:prefs', JSON.stringify({ touchLayout: l }))
}

describe('custom layout rendering', () => {
  it('renders a replaced slot, a raw slot, and an empty slot', () => {
    saveLayout(l => {
      l.tabs.micro[0][0] = { cmd: 'evoke' }   // default was quaff
      l.tabs.micro[0][1] = { raw: '&' }
      l.tabs.micro[0][2] = null                // default was inventory
    })
    const tc = buildTouchControls(() => {})
    const strip = tc.element.querySelector('.tc-strip')!
    const cells = strip.querySelectorAll('.tc-btn')
    expect(cells[0].textContent).toContain('(v)')          // 발동(v)/Evoke(v)
    expect(cells[1].textContent).toBe('&')
    expect(cells[2].classList.contains('tc-btn-spacer')).toBe(true)
  })

  it('renders a custom row count', () => {
    saveLayout(l => { l.tabs.micro = [l.tabs.micro[0]] })
    const tc = buildTouchControls(() => {})
    expect(tc.element.querySelectorAll('.tc-strip .tc-btn').length).toBe(4)
  })

  it('applies dpad side and size', () => {
    saveLayout(l => { l.dpad = { side: 'right', size: 'lg' } })
    const tc = buildTouchControls(() => {})
    expect(tc.element.classList.contains('dpad-right')).toBe(true)
    expect(tc.element.style.getPropertyValue('--tc-dpad')).toBe('3rem')
  })

  it('defaults stay identical with no stored layout', () => {
    const tc = buildTouchControls(() => {})
    expect(tc.element.classList.contains('dpad-right')).toBe(false)
    const cells = tc.element.querySelectorAll('.tc-strip .tc-btn')
    expect(cells.length).toBe(12)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/input/touch-custom-render.test.ts`
Expected: FAIL — cells[0] still renders quaff; no `dpad-right` class.

- [ ] **Step 3: Implement**

In `src/game/input/touch.ts`, inside `buildTouchControls`:

1. Add imports: `currentLayout`, `slotToDef` (extend the Task 2 import line).

2. After `const dpadEnabled = getPref('dpadEnabled')` add:

```ts
  let layout = currentLayout()

  // Resolve the (possibly customized) grid for a tab. Slots resolve through
  // the catalog; null slots become spacers via slotToDef's empty label.
  function layoutDefs(tab: Exclude<TabKey, 'spells'>): TabButtonDef[][] {
    return layout.tabs[tab].map(row => row.map(slotToDef))
  }
```

3. After `root.classList.toggle('dpad-on', dpadEnabled)` add:

```ts
  const DPAD_SIZE_REM: Record<'sm' | 'md' | 'lg', string> = { sm: '2.1rem', md: '2.55rem', lg: '3rem' }
  root.classList.toggle('dpad-right', layout.dpad.side === 'right')
  root.style.setProperty('--tc-dpad', DPAD_SIZE_REM[layout.dpad.size])
```

4. In `renderTab`, change `else renderContent(TAB_BUTTONS[tab])` to `else renderContent(layoutDefs(tab))`.

5. At the bottom, change the initial render `renderContent(TAB_BUTTONS.micro)` to `renderContent(layoutDefs('micro'))`.

In `src/style.css`, after the `#touch-controls.dpad-on` block (line ~2340):

```css
/* User pref: d-pad on the right — mirror the row so the panel takes the left. */
#touch-controls.dpad-on.dpad-right {
  flex-direction: row-reverse;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/input/`
Expected: PASS, including all pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/input/touch.ts src/game/input/touch-custom-render.test.ts src/style.css
git commit -m "feat(touch): render action grid from stored layout; dpad side + size

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Settings rows — d-pad side, d-pad size, edit-mode entry

**Files:**
- Modify: `src/game/input/touch.ts` (settings overlay rows)
- Modify: `src/game/input/touch-settings.test.ts` (new cases appended)

**Interfaces:**
- Consumes: `currentLayout`, plus `setPref('touchLayout', …)`.
- Produces: settings rows `.tc-set-dpad-side`, `.tc-set-dpad-size`, `.tc-set-edit`; internal `updateLayout(mut: (l: TouchLayout) => void): void` helper (also used by Task 5); internal `enterEditMode()` stub called by `.tc-set-edit` (full behavior in Task 5 — this task only wires the row and closes the overlay).

- [ ] **Step 1: Write the failing test**

Append to `src/game/input/touch-settings.test.ts`:

```ts
describe('layout settings rows', () => {
  it('has dpad side/size rows and an edit-mode row', () => {
    const tc = buildTouchControls(() => {})
    ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
    expect(tc.element.querySelector('.tc-set-dpad-side')).not.toBeNull()
    expect(tc.element.querySelector('.tc-set-dpad-size')).not.toBeNull()
    expect(tc.element.querySelector('.tc-set-edit')).not.toBeNull()
  })

  it('side toggle persists and requests a rebuild', () => {
    let rebuilds = 0
    const tc = buildTouchControls(() => {}, { onRequestRebuild: () => { rebuilds++ } })
    ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
    ;(tc.element.querySelector('.tc-set-dpad-side') as HTMLButtonElement).click()
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"side":"right"')
    expect(rebuilds).toBe(1)
  })

  it('size cycles sm → md → lg → sm and persists', () => {
    let rebuilds = 0
    const tc = buildTouchControls(() => {}, { onRequestRebuild: () => { rebuilds++ } })
    ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
    const btn = tc.element.querySelector('.tc-set-dpad-size') as HTMLButtonElement
    btn.click() // md → lg
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"size":"lg"')
    btn.click() // lg → sm
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"size":"sm"')
    expect(rebuilds).toBe(2)
  })

  it('edit row closes the settings overlay and enters edit mode', () => {
    const tc = buildTouchControls(() => {})
    ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
    ;(tc.element.querySelector('.tc-set-edit') as HTMLButtonElement).click()
    const overlay = tc.element.querySelector('.tc-settings-overlay') as HTMLElement
    expect(overlay.style.display).toBe('none')
    expect(tc.element.classList.contains('tc-editing')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/input/touch-settings.test.ts`
Expected: FAIL — `.tc-set-dpad-side` etc. not found.

- [ ] **Step 3: Implement**

In `src/game/input/touch.ts`:

1. Extend the Task 2/3 import from `./touch-catalog` with nothing new; add `import type { TouchLayout } from './custom-layout'`.

2. Inside `buildTouchControls`, after the `layoutDefs` helper, add:

```ts
  // Clone-mutate-persist. Reload `layout` so the next render sees the change.
  function updateLayout(mut: (l: TouchLayout) => void): void {
    const next = structuredClone(layout)
    mut(next)
    setPref('touchLayout', next)
    layout = currentLayout()
  }
```

3. Add an edit-mode entry stub near the top of `buildTouchControls` state (full version replaces it in Task 5):

```ts
  function enterEditMode(): void {
    root.classList.add('tc-editing')
  }
```

4. In `buildSettingsOverlay()`, after the D-pad on/off row and before the coach row, add (labels bilingual, click-only listeners — same pattern as `dpadToggleBtn`):

```ts
    // D-pad side row
    const sideRow = document.createElement('div')
    sideRow.className = 'tc-settings-row'
    const sideLabel = document.createElement('span')
    sideLabel.className = 'tc-settings-label'
    sideLabel.textContent = '조이스틱 위치 / D-pad side'
    const sideBtn = document.createElement('button')
    sideBtn.className = 'tc-settings-btn tc-set-dpad-side'
    const sideText = (): string => layout.dpad.side === 'left' ? '왼쪽/Left' : '오른쪽/Right'
    sideBtn.textContent = sideText()
    sideBtn.addEventListener('click', () => {  // click only — see langToggleBtn
      updateLayout(l => { l.dpad.side = l.dpad.side === 'left' ? 'right' : 'left' })
      sideBtn.textContent = sideText()
      opts.onRequestRebuild?.()
    })
    sideRow.appendChild(sideLabel)
    sideRow.appendChild(sideBtn)
    settingsOverlay.appendChild(sideRow)

    // D-pad size row (cycles through the 3 steps)
    const SIZE_ORDER: Array<TouchLayout['dpad']['size']> = ['sm', 'md', 'lg']
    const SIZE_TEXT: Record<TouchLayout['dpad']['size'], string> = { sm: '작게/S', md: '보통/M', lg: '크게/L' }
    const sizeRow = document.createElement('div')
    sizeRow.className = 'tc-settings-row'
    const sizeLabel = document.createElement('span')
    sizeLabel.className = 'tc-settings-label'
    sizeLabel.textContent = '조이스틱 크기 / D-pad size'
    const sizeBtn = document.createElement('button')
    sizeBtn.className = 'tc-settings-btn tc-set-dpad-size'
    sizeBtn.textContent = SIZE_TEXT[layout.dpad.size]
    sizeBtn.addEventListener('click', () => {  // click only — see langToggleBtn
      const next = SIZE_ORDER[(SIZE_ORDER.indexOf(layout.dpad.size) + 1) % SIZE_ORDER.length]
      updateLayout(l => { l.dpad.size = next })
      sizeBtn.textContent = SIZE_TEXT[next]
      opts.onRequestRebuild?.()
    })
    sizeRow.appendChild(sizeLabel)
    sizeRow.appendChild(sizeBtn)
    settingsOverlay.appendChild(sizeRow)

    // Button-edit entry row
    const editRow = document.createElement('div')
    editRow.className = 'tc-settings-row'
    const editLabel = document.createElement('span')
    editLabel.className = 'tc-settings-label'
    editLabel.textContent = '버튼 편집 / Edit buttons'
    const editBtn = document.createElement('button')
    editBtn.className = 'tc-settings-btn tc-set-edit'
    editBtn.textContent = '시작/Start'
    editBtn.addEventListener('click', () => {  // click only — see langToggleBtn
      settingsOverlay.style.display = 'none'
      enterEditMode()
    })
    editRow.appendChild(editLabel)
    editRow.appendChild(editBtn)
    settingsOverlay.appendChild(editRow)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/input/touch-settings.test.ts` then `npx vitest run src/game/input/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/input/touch.ts src/game/input/touch-settings.test.ts
git commit -m "feat(touch): settings rows for dpad side/size and edit-mode entry

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: In-place edit mode — banner, slot picker, row add/remove, reset

**Files:**
- Modify: `src/game/input/touch.ts`
- Modify: `src/style.css` (edit banner + picker styles)
- Create: `src/game/input/touch-edit.test.ts`

**Interfaces:**
- Consumes: `updateLayout`, `layoutDefs`, `enterEditMode` stub (replaced here), `CATALOG`, `GROUP_LABELS`, `defaultLayout`, `actionLabel`.
- Produces: DOM contract used by tests — root class `tc-editing`; banner `.tc-edit-banner` with buttons `.tc-edit-addrow`, `.tc-edit-delrow`, `.tc-edit-reset`, `.tc-edit-done`; picker `.tc-picker-overlay` with `.tc-pick[data-id="<catalog id>"]`, `.tc-pick-raw`, `.tc-pick-empty`, `.tc-pick-cancel`. Also `requestRawCapture(cb)` hook consumed by Task 6 (this task wires `.tc-pick-raw` to it; here it is a stub `let onRawPick: ((assign: (raw: string) => void) => void) | null = null`).

- [ ] **Step 1: Write the failing test**

Create `src/game/input/touch-edit.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { buildTouchControls } from './touch'

beforeEach(() => { localStorage.clear() })

function enterEdit(tc: ReturnType<typeof buildTouchControls>): void {
  ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
  ;(tc.element.querySelector('.tc-set-edit') as HTMLButtonElement).click()
}

describe('edit mode', () => {
  it('shows the banner and taps do not send to the game', () => {
    const sent: unknown[] = []
    const tc = buildTouchControls(m => sent.push(m))
    enterEdit(tc)
    expect(tc.element.querySelector('.tc-edit-banner')).not.toBeNull()
    ;(tc.element.querySelector('.tc-strip .tc-btn') as HTMLButtonElement).click()
    expect(sent).toEqual([])                                    // no key left the client
    expect(tc.element.querySelector('.tc-picker-overlay')).not.toBeNull()
  })

  it('picking a command reassigns the slot and persists', () => {
    const tc = buildTouchControls(() => {})
    enterEdit(tc)
    ;(tc.element.querySelector('.tc-strip .tc-btn') as HTMLButtonElement).click() // slot 0,0 (quaff)
    ;(tc.element.querySelector('.tc-pick[data-id="evoke"]') as HTMLButtonElement).click()
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"cmd":"evoke"')
    const first = tc.element.querySelector('.tc-strip .tc-btn') as HTMLElement
    expect(first.textContent).toContain('(v)')
  })

  it('picking empty clears the slot', () => {
    const tc = buildTouchControls(() => {})
    enterEdit(tc)
    ;(tc.element.querySelector('.tc-strip .tc-btn') as HTMLButtonElement).click()
    ;(tc.element.querySelector('.tc-pick-empty') as HTMLButtonElement).click()
    const first = tc.element.querySelector('.tc-strip .tc-btn') as HTMLElement
    expect(first.classList.contains('tc-btn-spacer')).toBe(false) // editable placeholder, not dead
    expect(first.textContent).toBe('＋')
  })

  it('adds and removes rows within 1–4', () => {
    const tc = buildTouchControls(() => {})
    enterEdit(tc)
    const count = (): number => tc.element.querySelectorAll('.tc-strip .tc-btn').length
    expect(count()).toBe(12)
    ;(tc.element.querySelector('.tc-edit-addrow') as HTMLButtonElement).click()
    expect(count()).toBe(16)
    ;(tc.element.querySelector('.tc-edit-addrow') as HTMLButtonElement).click() // at max 4 → no-op
    expect(count()).toBe(16)
    const del = tc.element.querySelector('.tc-edit-delrow') as HTMLButtonElement
    del.click(); del.click(); del.click()
    expect(count()).toBe(4)
    del.click() // at min 1 → no-op
    expect(count()).toBe(4)
  })

  it('reset needs a confirm tap and restores defaults', () => {
    const tc = buildTouchControls(() => {})
    enterEdit(tc)
    ;(tc.element.querySelector('.tc-strip .tc-btn') as HTMLButtonElement).click()
    ;(tc.element.querySelector('.tc-pick[data-id="evoke"]') as HTMLButtonElement).click()
    const reset = tc.element.querySelector('.tc-edit-reset') as HTMLButtonElement
    reset.click()
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"cmd":"evoke"') // armed, not yet
    reset.click()
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"touchLayout":null')
  })

  it('done exits edit mode and taps send again', () => {
    const sent: unknown[] = []
    const tc = buildTouchControls(m => sent.push(m))
    enterEdit(tc)
    ;(tc.element.querySelector('.tc-edit-done') as HTMLButtonElement).click()
    expect(tc.element.classList.contains('tc-editing')).toBe(false)
    expect(tc.element.querySelector('.tc-edit-banner')).toBeNull()
    ;(tc.element.querySelector('.tc-strip .tc-btn') as HTMLButtonElement).click()
    expect(sent.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/input/touch-edit.test.ts`
Expected: FAIL — banner/picker not found; first tap sends a key.

- [ ] **Step 3: Implement**

In `src/game/input/touch.ts`:

1. Extend the `./touch-catalog` import with `CATALOG, GROUP_LABELS, defaultLayout` and the `./custom-layout` import with `type Slot`.

2. Add state near `let menuMode = false`:

```ts
  let editMode = false
  let resetArmed = false
  // Task 6 replaces this stub with the kbd-overlay capture hook.
  let onRawPick: ((assign: (raw: string) => void) => void) | null = null
```

3. Add the picker + banner elements after the settings overlay construction:

```ts
  // Command picker (edit mode): tap a slot → pick its new command here.
  const pickerOverlay = document.createElement('div')
  pickerOverlay.className = 'tc-picker-overlay'
  pickerOverlay.style.display = 'none'
  root.appendChild(pickerOverlay)

  function closePicker(): void { pickerOverlay.style.display = 'none' }

  function openPicker(row: number, col: number): void {
    pickerOverlay.innerHTML = ''
    const assign = (slot: Slot): void => {
      updateLayout(l => { l.tabs[activeTab as 'micro' | 'macro'][row][col] = slot })
      closePicker()
      renderTab(activeTab)
    }
    for (const [group, glabel] of Object.entries(GROUP_LABELS) as Array<[keyof typeof GROUP_LABELS, { ko: string; en: string }]>) {
      const h = document.createElement('div')
      h.className = 'tc-picker-group'
      h.textContent = glabel[lang]
      pickerOverlay.appendChild(h)
      const grid = document.createElement('div')
      grid.className = 'tc-picker-grid'
      for (const e of CATALOG.filter(c => c.group === group)) {
        const b = document.createElement('button')
        b.className = 'tc-btn named tc-pick'
        b.dataset.id = e.id
        b.textContent = actionLabel(e, lang).text
        b.addEventListener('click', () => assign({ cmd: e.id }))  // click only — edit mode is not latency-critical
        grid.appendChild(b)
      }
      pickerOverlay.appendChild(grid)
    }
    const special = document.createElement('div')
    special.className = 'tc-picker-grid tc-picker-special'
    const rawBtn = document.createElement('button')
    rawBtn.className = 'tc-btn tc-pick-raw'
    rawBtn.textContent = lang === 'ko' ? '직접 입력' : 'Type a key'
    rawBtn.addEventListener('click', () => {
      closePicker()
      onRawPick?.(raw => assign({ raw }))
    })
    const emptyBtn = document.createElement('button')
    emptyBtn.className = 'tc-btn tc-pick-empty'
    emptyBtn.textContent = lang === 'ko' ? '빈 칸' : 'Empty'
    emptyBtn.addEventListener('click', () => assign(null))
    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'tc-btn tc-pick-cancel'
    cancelBtn.textContent = lang === 'ko' ? '취소' : 'Cancel'
    cancelBtn.addEventListener('click', closePicker)
    special.appendChild(rawBtn)
    special.appendChild(emptyBtn)
    special.appendChild(cancelBtn)
    pickerOverlay.appendChild(special)
    pickerOverlay.style.display = 'flex'
  }

  // Edit banner: lives between header and content while editing.
  const bannerEl = document.createElement('div')
  bannerEl.className = 'tc-edit-banner'
  bannerEl.style.display = 'none'
  panel.insertBefore(bannerEl, contentEl)

  function buildBanner(): void {
    bannerEl.innerHTML = ''
    const hint = document.createElement('span')
    hint.className = 'tc-edit-hint'
    hint.textContent = lang === 'ko' ? '슬롯을 탭해 교체' : 'Tap a slot to change'
    bannerEl.appendChild(hint)
    const mk = (cls: string, text: string, onTap: () => void): HTMLButtonElement => {
      const b = document.createElement('button')
      b.className = 'tc-settings-btn ' + cls
      b.textContent = text
      b.addEventListener('click', onTap)  // click only — see langToggleBtn
      bannerEl.appendChild(b)
      return b
    }
    mk('tc-edit-addrow', '＋행', () => {
      if (layout.tabs[activeTab as 'micro' | 'macro'].length >= 4) return
      updateLayout(l => { l.tabs[activeTab as 'micro' | 'macro'].push([null, null, null, null]) })
      renderTab(activeTab)
    })
    mk('tc-edit-delrow', '－행', () => {
      if (layout.tabs[activeTab as 'micro' | 'macro'].length <= 1) return
      updateLayout(l => { l.tabs[activeTab as 'micro' | 'macro'].pop() })
      renderTab(activeTab)
    })
    const resetBtn = mk('tc-edit-reset', lang === 'ko' ? '초기화' : 'Reset', () => {
      if (!resetArmed) {
        resetArmed = true
        resetBtn.textContent = lang === 'ko' ? '한 번 더 탭' : 'Tap again'
        return
      }
      resetArmed = false
      setPref('touchLayout', null)
      layout = currentLayout()
      buildBanner()
      renderTab(activeTab)
    })
    mk('tc-edit-done', lang === 'ko' ? '완료' : 'Done', exitEditMode)
  }
```

4. Replace the Task 4 `enterEditMode` stub with:

```ts
  function enterEditMode(): void {
    editMode = true
    resetArmed = false
    root.classList.add('tc-editing')
    if (activeTab === 'spells') renderTab('micro')
    buildBanner()
    bannerEl.style.display = 'flex'
    renderTab(activeTab)
  }

  function exitEditMode(): void {
    editMode = false
    root.classList.remove('tc-editing')
    bannerEl.style.display = 'none'
    closePicker()
    renderTab(activeTab)
    opts.onRequestRebuild?.()
  }
```

5. In `renderContent`, make edit mode intercept taps and make empty slots editable. Change the loop body: compute `const i = idx` (track a running index over `rows.flat()`), and:
   - Where a spacer is emitted (`!def.label` branch and the dead-key branch), in edit mode emit instead a button `tc-btn tc-btn-empty` with textContent `'＋'` wired to `openPicker(Math.floor(i / 4), i % 4)`.
   - For normal buttons, wrap the tap handlers: `const onTap = editMode ? () => openPicker(Math.floor(i / 4), i % 4) : () => sendTabKey(def)` and use `onTap` for both touchstart and click listeners.
   The concrete rewrite of the `for` loop:

```ts
    const flat = rows.flat()
    for (let i = 0; i < flat.length; i++) {
      const def = flat[i]
      const editTap = (): void => openPicker(Math.floor(i / 4), i % 4)
      if (!def.label) {
        if (editMode) {
          const b = document.createElement('button')
          b.className = 'tc-btn tc-btn-empty'
          b.textContent = '＋'
          b.addEventListener('click', editTap)
          stripEl.appendChild(b)
        } else spacer()
        continue
      }
      const mod = modifierLabel(def)
      if (mod === null) {
        if (fillCtrlSlot()) continue
        spacer(); continue
      }
      const btn = document.createElement('button')
      btn.className = 'tc-btn'
      const { text, named } = mod ?? actionLabel(def, lang)
      if (named) btn.classList.add('named')
      else if (/[^\x20-\x7e]/.test(def.label)) btn.classList.add('glyph')
      btn.textContent = text
      if (def.title) { btn.title = def.title; btn.setAttribute('aria-label', def.title) }
      const onTap = (): void => { if (editMode) editTap(); else sendTabKey(def) }
      btn.addEventListener('touchstart', e => { e.preventDefault(); onTap() }, { passive: false })
      btn.addEventListener('click', () => onTap())
      stripEl.appendChild(btn)
    }
```

In `src/style.css`, after the `.tc-settings-overlay` styles block:

```css
/* Edit mode: banner between header and grid; picker overlay mirrors the
   settings overlay's fixed positioning. Dim the parts that aren't editable. */
.tc-edit-banner {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.1rem;
}
.tc-edit-hint { color: var(--tc-label-dim); font-size: 0.75rem; margin-right: auto; }
#touch-controls.tc-editing .tc-dpad,
#touch-controls.tc-editing .tc-header,
#touch-controls.tc-editing .tc-footer { opacity: 0.35; pointer-events: none; }
.tc-btn.tc-btn-empty { border-style: dashed; color: var(--tc-label-dim); }
.tc-picker-overlay {
  position: fixed;
  inset: auto 0 0 0;
  max-height: 70vh;
  overflow-y: auto;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.5rem;
  background: var(--bg);
  border-top: 1px solid var(--accent);
  z-index: 40;
}
.tc-picker-group { color: var(--tc-label-dim); font-size: 0.75rem; margin-top: 0.3rem; }
.tc-picker-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; }
.tc-picker-grid .tc-btn { min-height: 2.2rem; }
```

Note: the header dim means tab switching happens via the banner-less flow — but the spec wants both tabs editable. Keep `.tc-tabs` interactive: add exception rule right after the dim rule:

```css
#touch-controls.tc-editing .tc-header .tc-tabs { opacity: 1; pointer-events: auto; }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/input/`
Expected: PASS — new edit tests and all prior tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/input/touch.ts src/game/input/touch-edit.test.ts src/style.css
git commit -m "feat(touch): in-place edit mode with command picker, row add/remove, reset

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Raw-key capture via the keyboard overlay

**Files:**
- Modify: `src/game/input/touch.ts`
- Modify: `src/game/input/touch-edit.test.ts` (append cases)

**Interfaces:**
- Consumes: `buildKeyboardOverlay` (already built inside `buildTouchControls`), the `onRawPick` stub from Task 5.
- Produces: tapping `.tc-pick-raw` opens the kbd overlay in capture mode; the next single-char key becomes the slot's `{ raw }`; Esc cancels. No message reaches the game while capturing.

- [ ] **Step 1: Write the failing test**

Append to `src/game/input/touch-edit.test.ts`:

```ts
describe('raw key capture', () => {
  it('captures one kbd char into the slot without sending it', () => {
    const sent: unknown[] = []
    const tc = buildTouchControls(m => sent.push(m))
    enterEdit(tc)
    ;(tc.element.querySelector('.tc-strip .tc-btn') as HTMLButtonElement).click()
    ;(tc.element.querySelector('.tc-pick-raw') as HTMLButtonElement).click()
    const kbd = tc.element.querySelector('#kbd-overlay') as HTMLElement
    expect(kbd.style.display).not.toBe('none')
    // Tap the 'q' key on the letters layer.
    const q = Array.from(kbd.querySelectorAll<HTMLButtonElement>('.kbd-key.letter')).find(b => b.textContent === 'q')!
    q.click()
    expect(sent).toEqual([])
    expect(kbd.style.display).toBe('none')
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"raw":"q"')
  })

  it('esc cancels capture without assigning', () => {
    const tc = buildTouchControls(() => {})
    enterEdit(tc)
    ;(tc.element.querySelector('.tc-strip .tc-btn') as HTMLButtonElement).click()
    ;(tc.element.querySelector('.tc-pick-raw') as HTMLButtonElement).click()
    const kbd = tc.element.querySelector('#kbd-overlay') as HTMLElement
    const esc = Array.from(kbd.querySelectorAll<HTMLButtonElement>('.kbd-key')).find(b => b.textContent === '⎋')!
    esc.click()
    expect(kbd.style.display).toBe('none')
    expect(localStorage.getItem('pocketzot:prefs') ?? '').not.toContain('"raw"')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/input/touch-edit.test.ts`
Expected: FAIL — the q tap is sent to the game (sent.length 1) and no `"raw"` stored.

- [ ] **Step 3: Implement**

In `src/game/input/touch.ts`, inside `buildTouchControls`:

1. Replace the direct kbd construction line:

```ts
  const { element: kbdEl, open: openKbdLayer, close: closeKbd } = buildKeyboardOverlay(send)
```

with a capture-aware wrapper:

```ts
  // While capturing (edit mode's 직접 입력), the kbd's output is diverted to
  // the pending slot assignment instead of the game. Esc cancels.
  let captureCb: ((raw: string) => void) | null = null
  const kbdSend: SendFn = msg => {
    if (captureCb) {
      const cb = captureCb
      if (msg.msg === 'input' && msg.text.length === 1 && /^[\x20-\x7e]$/.test(msg.text)) {
        captureCb = null
        closeKbd()
        cb(msg.text)
      } else if (msg.msg === 'key' && msg.keycode === 27) {
        captureCb = null
        closeKbd()
      }
      return // swallow everything else (Enter, Tab, multi-char) while capturing
    }
    send(msg)
  }
  const { element: kbdEl, open: openKbdLayer, close: closeKbd } = buildKeyboardOverlay(kbdSend)
```

(`closeKbd` is referenced before its declaration inside `kbdSend`'s closure — that's fine, the callback only runs after construction. If TS complains about use-before-assign, declare `let closeKbd: () => void` first and destructure with assignment.)

Concretely, to keep TS happy use:

```ts
  let captureCb: ((raw: string) => void) | null = null
  let closeKbdRef: () => void = () => {}
  const kbdSend: SendFn = msg => {
    if (captureCb) {
      const cb = captureCb
      if (msg.msg === 'input' && msg.text.length === 1 && /^[\x20-\x7e]$/.test(msg.text)) {
        captureCb = null
        closeKbdRef()
        cb(msg.text)
      } else if (msg.msg === 'key' && msg.keycode === 27) {
        captureCb = null
        closeKbdRef()
      }
      return
    }
    send(msg)
  }
  const { element: kbdEl, open: openKbdLayer, close: closeKbd } = buildKeyboardOverlay(kbdSend)
  closeKbdRef = closeKbd
```

2. Replace the Task 5 stub `let onRawPick … = null` with:

```ts
  const onRawPick = (assign: (raw: string) => void): void => {
    captureCb = assign
    openKbd()
  }
```

(and change its call site `onRawPick?.(…)` to `onRawPick(…)`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/input/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/input/touch.ts src/game/input/touch-edit.test.ts
git commit -m "feat(touch): raw-key capture through the kbd overlay for custom slots

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: RC comment line management

**Files:**
- Modify: `src/game/rc/rc-options.ts`
- Modify: `src/game/input/touch-rc.test.ts` — do NOT touch; create new test file instead.
- Create: `src/game/rc/rc-comment.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `getRcComment(text: string, key: string): string | null` — value of a managed `# pocketzot:<key> <value>` line.
  - `setRcComment(text: string, key: string, value: string | null): string` — upsert/remove that line, preserving everything else (same trailing-newline behavior as `setRcOption`).

- [ ] **Step 1: Write the failing test**

Create `src/game/rc/rc-comment.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getRcComment, setRcComment, getRcOption } from './rc-options'

describe('managed pocketzot comment lines', () => {
  it('round-trips a value', () => {
    const out = setRcComment('hp_warning = 50\n', 'layout', 'AAAA')
    expect(out).toContain('# pocketzot:layout AAAA')
    expect(getRcComment(out, 'layout')).toBe('AAAA')
    expect(getRcOption(out, 'hp_warning')).toBe('50') // options untouched
  })

  it('replaces an existing line instead of appending a second', () => {
    let text = setRcComment('', 'layout', 'AAAA')
    text = setRcComment(text, 'layout', 'BBBB')
    expect(text.match(/pocketzot:layout/g)?.length).toBe(1)
    expect(getRcComment(text, 'layout')).toBe('BBBB')
  })

  it('removes the line when value is null', () => {
    const text = setRcComment('a = 1\n', 'layout', 'AAAA')
    const out = setRcComment(text, 'layout', null)
    expect(out).not.toContain('pocketzot:layout')
    expect(getRcOption(out, 'a')).toBe('1')
  })

  it('returns null when absent and ignores ordinary comments', () => {
    expect(getRcComment('# just a note\nx = 1\n', 'layout')).toBeNull()
  })

  it('does not collide across keys', () => {
    let text = setRcComment('', 'layout', 'AAAA')
    text = setRcComment(text, 'other', 'ZZZZ')
    expect(getRcComment(text, 'layout')).toBe('AAAA')
    expect(getRcComment(text, 'other')).toBe('ZZZZ')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/rc/rc-comment.test.ts`
Expected: FAIL — `getRcComment` not exported.

- [ ] **Step 3: Implement**

Append to `src/game/rc/rc-options.ts`:

```ts
// Managed comment lines: `# pocketzot:<key> <value>`. DCSS ignores comments
// entirely (no unknown-option warning) and the option editor above skips
// them, so this is a safe side-channel for client-only state — e.g. the
// custom touch layout backed up for incognito sessions.
function commentPrefix(key: string): string {
  return `# pocketzot:${key} `
}

export function getRcComment(text: string, key: string): string | null {
  const prefix = commentPrefix(key)
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (t.startsWith(prefix)) return t.slice(prefix.length).trim()
  }
  return null
}

export function setRcComment(text: string, key: string, value: string | null): string {
  const prefix = commentPrefix(key)
  const lines = text.split('\n')
  const hadTrailingNewline = lines.length > 0 && lines[lines.length - 1] === ''
  if (hadTrailingNewline) lines.pop()

  let replaced = false
  const out: string[] = []
  for (const line of lines) {
    if (line.trim().startsWith(prefix)) {
      if (value === null) continue
      out.push(prefix + value)
      replaced = true
    } else {
      out.push(line)
    }
  }
  if (value !== null && !replaced) out.push(prefix + value)

  let result = out.join('\n')
  if (out.length > 0) result += '\n'
  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/rc/ src/game/input/touch-rc.test.ts`
Expected: PASS — new tests and the existing RC option tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/rc/rc-options.ts src/game/rc/rc-comment.test.ts
git commit -m "feat(rc): managed pocketzot comment lines for client-state backup

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: RC layout sync in game-view

**Files:**
- Modify: `src/views/game-view.ts` (`rcfile_contents` case at ~line 1586; RC request after touch controls are built at ~line 789)
- Create: `src/game/input/touch-rc-sync.test.ts`

**Interfaces:**
- Consumes: `planLayoutSync`, `encodeLayout`, `decodeLayout` (`custom-layout.ts`); `customLayout`, `validateStoredLayout` (`touch-catalog.ts`); `getRcComment`, `setRcComment` (`rc-options.ts`); `setPref`.
- Produces: a pure helper exported from `custom-layout.ts` so the wiring is testable without game-view:
  - `applyLayoutSync(rcText: string, local: TouchLayout | null, knownCmd: (id: string) => boolean): { newRcText: string | null; restored: TouchLayout | null }` — `newRcText` non-null ⇒ send `set_rc`; `restored` non-null ⇒ `setPref('touchLayout', restored)` + rebuild.

- [ ] **Step 1: Write the failing test**

Create `src/game/input/touch-rc-sync.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyLayoutSync, encodeLayout, type TouchLayout } from './custom-layout'
import { getRcComment, setRcComment } from '../rc/rc-options'
import { defaultLayout, CATALOG_BY_ID } from './touch-catalog'

const known = (id: string): boolean => CATALOG_BY_ID.has(id)

function customized(): TouchLayout {
  const l = defaultLayout()
  l.dpad.side = 'right'
  return l
}

describe('applyLayoutSync', () => {
  it('backs up a local layout into the RC comment', () => {
    const { newRcText, restored } = applyLayoutSync('hp_warning = 50\n', customized(), known)
    expect(restored).toBeNull()
    expect(newRcText).not.toBeNull()
    expect(getRcComment(newRcText!, 'layout')).toBe(encodeLayout(customized()))
  })

  it('restores from RC when local is empty', () => {
    const rc = setRcComment('', 'layout', encodeLayout(customized()))
    const { newRcText, restored } = applyLayoutSync(rc, null, known)
    expect(newRcText).toBeNull()
    expect(restored).toEqual(customized())
  })

  it('no-ops when both match or both empty', () => {
    const rc = setRcComment('', 'layout', encodeLayout(customized()))
    expect(applyLayoutSync(rc, customized(), known)).toEqual({ newRcText: null, restored: null })
    expect(applyLayoutSync('x = 1\n', null, known)).toEqual({ newRcText: null, restored: null })
  })

  it('treats a corrupt RC backup as absent (re-backs-up local)', () => {
    const rc = setRcComment('', 'layout', '!!!corrupt!!!')
    const { newRcText } = applyLayoutSync(rc, customized(), known)
    expect(getRcComment(newRcText!, 'layout')).toBe(encodeLayout(customized()))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/input/touch-rc-sync.test.ts`
Expected: FAIL — `applyLayoutSync` not exported.

- [ ] **Step 3: Implement**

Append to `src/game/input/custom-layout.ts` (this module may import rc-options — both are pure):

```ts
import { getRcComment, setRcComment } from '../rc/rc-options'

// One sync pass, run when the RC file arrives. Local (prefs) wins conflicts;
// restore only fills an empty local — the incognito-new-session case.
export function applyLayoutSync(
  rcText: string,
  local: TouchLayout | null,
  knownCmd: (id: string) => boolean,
): { newRcText: string | null; restored: TouchLayout | null } {
  const b64 = getRcComment(rcText, 'layout')
  const remote = b64 ? decodeLayout(b64, knownCmd) : null
  const action = planLayoutSync(local, remote)
  if (action === 'backup') return { newRcText: setRcComment(rcText, 'layout', encodeLayout(local!)), restored: null }
  if (action === 'restore') return { newRcText: null, restored: remote }
  return { newRcText: null, restored: null }
}
```

(Move the `import` to the top of the file with the others.)

In `src/views/game-view.ts`:

1. Add imports:

```ts
import { applyLayoutSync } from '../game/input/custom-layout'
import { customLayout, CATALOG_BY_ID } from '../game/input/touch-catalog'
import { setPref } from '../prefs'
```

(Check the existing prefs import near the top — extend it rather than duplicating if `setPref` or others are already imported.)

2. In the `case 'rcfile_contents':` block, after `rcText = msg.contents` and before the `rcListeners` loop, add:

```ts
        // Touch-layout backup sync: back up a local custom layout into an RC
        // comment, or restore one into prefs on a fresh (incognito) session.
        if (!spectating) {
          const sync = applyLayoutSync(rcText, customLayout(), id => CATALOG_BY_ID.has(id))
          const gameId = getCurrentGameId()
          if (sync.newRcText !== null && gameId) {
            rcText = sync.newRcText
            conn.send({ msg: 'set_rc', game_id: gameId, contents: rcText })
          } else if (sync.restored !== null) {
            setPref('touchLayout', sync.restored)
            rebuildTouchControls()
          }
        }
```

3. After the `rebuildTouchControls` function definition (~line 794), request the RC once at startup so the sync runs without opening settings:

```ts
  // Fetch the RC as soon as we're in a real game: the touch-layout backup
  // sync (rcfile_contents handler) and the settings RC rows both need it.
  if (!spectating && rc.available()) rc.request()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: full suite PASS (baseline 391 + all new tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/input/custom-layout.ts src/game/input/touch-rc-sync.test.ts src/views/game-view.ts
git commit -m "feat(touch): sync custom layout to an RC comment backup on game connect

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Full verification + changelog

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Full test suite + typecheck + build**

Run: `npx vitest run && npx tsc --noEmit && npx vite build`
Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 2: Manual smoke check (dev server)**

Run: `npx vite --host` and on the phone (or devtools mobile emulation):
1. ⚙ → 조이스틱 위치/크기 변경 → 디패드가 오른쪽/크게로 재구축되는지.
2. ⚙ → 버튼 편집 → 슬롯 탭 → 명령 선택 → 라벨 즉시 반영, [완료] 후 정상 전송.
3. 직접 입력으로 키 하나 배정 → 플레이 중 그 키가 전송되는지.
4. ＋행/－행, 초기화 2-tap 동작.
5. 로그인 게임 접속 → RC 파일에 `# pocketzot:layout …` 라인 생성 확인(⚙ RC 옵션이 로드된 상태에서 서버 RC 편집 화면 또는 재접속 복원으로 확인).

- [ ] **Step 3: Changelog entry**

Prepend to the top section of `CHANGELOG.md` following its existing entry format (check the file's style first):

```markdown
- 터치 컨트롤 커스터마이즈: 설정에서 버튼 편집(슬롯별 명령 교체·행 추가/삭제),
  디패드 좌/우 위치·크기 3단 조절. 레이아웃은 서버 RC 주석 라인에 백업되어
  시크릿 모드에서도 유지.
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for touch-controls customization

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** data model (Task 1), catalog+picker source (Task 2), layout-driven render + dpad side/size (Task 3), settings rows (Task 4), edit mode + picker + rows + reset (Task 5), 직접 입력 capture (Task 6), RC comment channel (Task 7), sync rules + connect-time request (Task 8), verification (Task 9). All spec sections mapped.
- **Type consistency:** `TouchLayout`/`Slot` defined once in custom-layout.ts; `TabButtonDef` moved to touch-catalog.ts and re-imported by touch.ts; `applyLayoutSync` lives in custom-layout.ts importing rc-options (no cycle: rc-options imports nothing).
- **Known risk:** `structuredClone` needs happy-dom ≥ 9 / Node ≥ 17 — the repo's vitest already runs on Node ≥ 18. If `structuredClone` is unavailable in the test env, substitute `JSON.parse(JSON.stringify(layout))` (layout is plain JSON data).
