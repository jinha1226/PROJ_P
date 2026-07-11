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
