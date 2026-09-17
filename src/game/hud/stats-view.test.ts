// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { StatsView } from './stats-view'
import { StatusView } from './status-view'
import { InventoryStore } from '../inventory-store'

describe('compact combat HUD', () => {
  it('keeps defenses, experience and location together and retains values across delta updates', () => {
    const hud = new StatsView(new InventoryStore())
    hud.update({ hp: 30, hp_max: 40, mp: 8, mp_max: 12, ac: 9, ev: 15, sh: 4, xl: 7, progress: 42, place: 'D', depth: 5, str: 12, int: 14, dex: 16 })
    const row = hud.element.querySelector('.hg-summary-row')!
    expect(row.textContent).toContain('AC 9 EV 15 SH 4')
    expect(row.textContent).toContain('XP 7 (42%) @D:5')
    expect(hud.element.querySelector('#hud-str, #hud-int, #hud-dex')).toBeNull()
    hud.update({ hp: 21, progress: 49 })
    expect(hud.element.querySelector('#hud-hp')?.textContent).toBe('21/40')
    expect(hud.element.querySelector('#hud-mp')?.textContent).toBe('8/12')
    expect(row.textContent).toContain('XP 7 (49%) @D:5')
  })
  it('preserves long quivered text and danger statuses alongside the equipment row', () => {
    const hud = new StatsView(new InventoryStore()), status = new StatusView()
    hud.setStatusEl(status.element)
    const quiver = 'a very long quivered action description'
    hud.update({ quiver_desc: quiver })
    const row = hud.element.querySelector('.hg-equipment-row')!
    expect(row.querySelector('#hud-wq')).not.toBeNull()
    expect(row.querySelector('#hud-wq-offhand')).not.toBeNull()
    expect(row.querySelector('#hud-quiver')?.textContent).toBe(quiver)
    status.update([{ light: 'Poison', text: 'poisoned', col: 4 }])
    expect(hud.element.querySelector('.hg-alert-row')?.textContent).toContain('Poison')
  })
})
