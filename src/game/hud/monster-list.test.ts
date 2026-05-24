// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest'
import { MonsterListView } from './monster-list'
import { MapStore } from '../map/map-store'

describe('MonsterListView gutter bar', () => {
  it('suppresses the gutter bar on non-hostile clientid monsters', () => {
    // Regression: spectrals / zombies / bound souls all carry a clientid
    // (DCSS uses it as a per-entity sort key, not a uniqueness marker), so
    // `isNamed` alone would paint a bar on every ally row — including a
    // red bar on an allied iron troll zombie whose threat tier is 3 by HD.
    const store = new MapStore()
    store.merge([
      // Friendly named (bound soul) — would have triggered isNamed.
      { x: 1, y: 1, g: '@', mon: {
        id: 1, name: 'Zenata the bound human', att: 4, type: 1,
        typedata: { avghp: 60 }, threat: 2, clientid: 7,
      } },
      // Friendly threat-3 zombie — would have triggered isNasty.
      { x: 2, y: 2, g: 'Z', mon: {
        id: 2, name: 'iron troll zombie', att: 4, type: 2,
        typedata: { avghp: 90 }, threat: 3, clientid: 8,
      } },
      // Hostile threat-3 — control: SHOULD still get a bar.
      { x: 3, y: 3, g: 'L', mon: {
        id: 3, name: 'lich', att: 0, type: 3,
        typedata: { avghp: 80 }, threat: 3, clientid: 9,
      } },
    ])

    const view = new MonsterListView(store)
    view.update(store.getMonsters())
    // monsterSort orders by attitude ASC, so hostile lich comes first,
    // then the friendlies; iron troll zombie outranks Zenata on avghp.
    const rows = Array.from(view.element.querySelectorAll('.ml-row'))
    const labels = rows.map((r) => r.querySelector('.ml-name')?.textContent)
    expect(labels).toEqual(['lich', 'iron troll zombie', 'Zenata the bound human'])
    expect(rows[0].classList.contains('ml-bar')).toBe(true)   // hostile
    expect(rows[1].classList.contains('ml-bar')).toBe(false)  // ally
    expect(rows[2].classList.contains('ml-bar')).toBe(false)  // ally
  })
})
