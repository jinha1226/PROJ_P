// SPD-style map-edge indicators (the "SPD layout" pref), after Shattered
// Pixel Dungeon's DangerIndicator and AttackIndicator:
//   - danger: how many hostiles are in view; tap opens the monster panel.
//   - attack: the nearest hostile's portrait; tap attacks it — a direction
//     key when adjacent (deterministic: always that monster), else Tab,
//     the engine's auto-fight, which picks the nearest target itself.
// Both hide when nothing hostile is in view. Input gating is game-view's
// canAct, as for the toolbar.

import type { ClientMsg } from '../../ws/types'
import type { MapStore, MonsterCell } from '../map/map-store'
import type { TileLoader } from '../tiles/tile-loader'
import { appendMonsterActor } from '../tiles/tile-view'
import { ATTITUDE_CLASSES, isExcluded, nameColor } from './monster-style'
import { escHtml } from '../dcss-colors'
import { bindPressedClass } from '../input/touch'

export interface SpdIndicatorDeps {
  send(msg: ClientMsg): void
  canAct(): boolean
  openMonsters(): void
}

// Vi-keys by (dx, dy), the engine's movement letters.
const DIR_KEYS: Record<string, string> = {
  '-1,-1': 'y', '0,-1': 'k', '1,-1': 'u',
  '-1,0': 'h', '1,0': 'l',
  '-1,1': 'b', '0,1': 'j', '1,1': 'n',
}
const TAB_KEYCODE = 9

export function nearestHostile(
  monsters: ReadonlyMap<string, MonsterCell>, from: { x: number; y: number },
): { target: MonsterCell | null; count: number } {
  let target: MonsterCell | null = null
  let best = Infinity
  let count = 0
  for (const m of monsters.values()) {
    if (isExcluded(m.mon) || ATTITUDE_CLASSES[m.mon.att ?? 0] !== 'hostile') continue
    count++
    const d = Math.max(Math.abs(m.x - from.x), Math.abs(m.y - from.y))
    if (d < best) { best = d; target = m }
  }
  return { target, count }
}

export function attackInput(target: { x: number; y: number }, from: { x: number; y: number }): ClientMsg {
  const dx = target.x - from.x
  const dy = target.y - from.y
  const dir = DIR_KEYS[`${dx},${dy}`]
  return dir ? { msg: 'input', text: dir } : { msg: 'key', keycode: TAB_KEYCODE }
}

export class SpdIndicators {
  readonly element: HTMLElement
  private readonly danger: HTMLButtonElement
  private readonly attack: HTMLButtonElement
  private target: MonsterCell | null = null
  private from = { x: 0, y: 0 }
  private shownKey = ''

  constructor(deps: SpdIndicatorDeps) {
    const root = document.createElement('div')
    root.id = 'spd-indicators'
    this.element = root

    this.danger = document.createElement('button')
    this.danger.type = 'button'
    this.danger.className = 'spd-ind spd-danger'
    this.danger.title = 'Hostiles in view'
    bindPressedClass(this.danger)
    this.danger.addEventListener('click', () => deps.openMonsters())

    this.attack = document.createElement('button')
    this.attack.type = 'button'
    this.attack.className = 'spd-ind spd-attack'
    bindPressedClass(this.attack)
    this.attack.addEventListener('click', () => {
      if (!this.target) return
      if (!deps.canAct()) return
      deps.send(attackInput(this.target, this.from))
    })

    root.appendChild(this.danger)
    root.appendChild(this.attack)
    root.hidden = true
  }

  update(store: MapStore, loader: TileLoader | null, tiles: boolean): void {
    this.from = store.playerPos
    const { target, count } = nearestHostile(store.getMonsters(), this.from)
    this.target = target
    this.element.hidden = !target
    if (!target) { this.shownKey = ''; return }

    this.danger.innerHTML = `<span class="spd-ind-icon">☠</span><span class="spd-ind-count">${count}</span>`
    this.attack.title = `Attack ${target.mon.name ?? 'monster'}`
    const adjacent = Math.max(Math.abs(target.x - this.from.x), Math.abs(target.y - this.from.y)) <= 1
    this.attack.classList.toggle('adjacent', adjacent)

    // Repaint the portrait only when the target or its look changes.
    const cell = store.get(target.x, target.y)
    const key = `${target.mon.id}|${tiles && loader ? JSON.stringify([cell?.fg, cell?.doll, cell?.mcache]) : cell?.g ?? target.g}`
    if (key === this.shownKey) return
    this.shownKey = key
    this.attack.textContent = ''
    const face = document.createElement('div')
    face.className = 'spd-attack-face'
    if (tiles && loader) {
      face.classList.add('tile-stack')
      appendMonsterActor(loader, face, cell, 1.25)
    } else {
      face.innerHTML = `<span style="color:${nameColor(target.mon.att ?? 0, target.mon.threat ?? 3)}">${escHtml(cell?.g ?? target.g)}</span>`
    }
    this.attack.appendChild(face)
  }
}
