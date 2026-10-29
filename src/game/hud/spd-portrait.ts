// SPD-style hero portrait (the "SPD layout" pref): the small character
// picture at the left of Shattered Pixel Dungeon's status pane, with the
// level badge. Drawn from the player's own map cell — the doll with its
// equipment in tiles, `@` without a tile loader. Tapping it opens the hero
// window (spd-hero-tabs.ts), the same as the rest of the HUD.

import type { MapStore } from '../map/map-store'
import type { TileLoader } from '../tiles/tile-loader'
import { appendMonsterActor } from '../tiles/tile-view'
import { bindPressedClass } from '../input/touch'

export class SpdPortrait {
  readonly element: HTMLButtonElement
  private readonly face: HTMLElement
  private readonly badge: HTMLElement
  private shownKey = ''

  constructor(onTap: () => void) {
    const b = document.createElement('button')
    b.type = 'button'
    b.id = 'spd-portrait'
    b.title = 'Hero'
    b.setAttribute('aria-label', 'Hero')
    bindPressedClass(b)
    b.addEventListener('click', (e) => {
      // The HUD's own tap handler would open the window a second time.
      e.stopPropagation()
      onTap()
    })
    this.face = document.createElement('div')
    this.face.className = 'spd-portrait-face'
    this.badge = document.createElement('span')
    this.badge.className = 'spd-portrait-xl'
    b.append(this.face, this.badge)
    this.element = b
  }

  setLevel(xl: number): void {
    this.badge.textContent = String(xl)
  }

  update(store: MapStore, loader: TileLoader | null): void {
    const cell = store.get(store.playerPos.x, store.playerPos.y)
    const key = loader && cell
      ? JSON.stringify([cell.fg, cell.doll, cell.mcache, cell.t_bg])
      : '@'
    if (key === this.shownKey) return
    this.shownKey = key
    this.face.textContent = ''
    if (loader && cell && (cell.doll?.length || cell.mcache?.length || cell.fg)) {
      this.face.classList.add('tile-stack')
      appendMonsterActor(loader, this.face, cell, 1.25)
    } else {
      this.face.classList.remove('tile-stack')
      this.face.innerHTML = '<span class="fg15">@</span>'
    }
  }
}
