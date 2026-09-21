// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { CombatEffects, hpLoss, worsened, wounds } from './combat-effects'
import { MapStore } from '../map/map-store'
import { FG_MDAM_LIGHT_LO, FG_MDAM_HEAVY_LO } from '../map/cell-flags'
afterEach(() => { vi.useRealTimers(); document.body.replaceChildren() })
describe('server-confirmed combat feedback', () => {
  it('does not invent damage from first snapshot, healing, or max-HP changes', () => {
    expect(hpLoss({}, { hp: 20, hp_max: 30 })).toBe(0)
    expect(hpLoss({ hp: 20, hp_max: 30 }, { hp: 25 })).toBe(0)
    expect(hpLoss({ hp: 20, hp_max: 30 }, { hp: 10, hp_max: 15 })).toBe(0)
    expect(hpLoss({ hp: 20, hp_max: 30 }, { hp: 13 })).toBe(7)
    expect(hpLoss({ hp: 20, hp_max: 30 }, { hp: 0 })).toBe(20)
  })
  it('compares monster identity across movement, ignoring first sightings and disappearances', () => {
    const store = new MapStore()
    store.merge([{ x: 0, y: 0, g: 'k', col: 7, t: { fg: FG_MDAM_LIGHT_LO }, mon: { id: 7, name: 'kobold' } }])
    const before = wounds(store)
    store.merge([{ x: 0, y: 0, mon: null }, { x: 1, y: 0, g: 'k', col: 7, t: { fg: FG_MDAM_HEAVY_LO }, mon: { id: 7, name: 'kobold' } }])
    expect(worsened(before, wounds(store))).toEqual([{ x: 1, y: 0, tier: 3 }])
    expect(worsened(new Map(), wounds(store))).toEqual([])
    expect(worsened(before, new Map())).toEqual([])
    expect(worsened(wounds(store), before)).toEqual([])
    expect(worsened(before, before)).toEqual([])
  })
  it('bounds effects, cleans up timers, and ignores off-screen targets', () => {
    vi.useFakeTimers()
    const host = document.createElement('div')
    document.body.appendChild(host)
    host.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 500 }) as DOMRect
    const fx = new CombatEffects(host, p => p.x < 0 ? null : p)
    fx.show({ x: -1, y: 0 })
    expect(host.querySelectorAll('.combat-impact')).toHaveLength(0)
    for (let i = 0; i < 20; i++) fx.show({ x: 100, y: 100 }, true)
    expect(host.querySelectorAll('.combat-impact')).toHaveLength(12)
    expect(host.querySelectorAll('.combat-impact-player')).toHaveLength(12)
    expect(host.textContent).toBe('')  // ring only — no damage number
    vi.advanceTimersByTime(460)
    expect(host.querySelectorAll('.combat-impact')).toHaveLength(0)
    fx.show({ x: 100, y: 100 })
    fx.clear()
    expect(vi.getTimerCount()).toBe(0)
  })
})
