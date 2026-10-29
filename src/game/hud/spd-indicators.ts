// SPD-style map-edge indicators (the "SPD layout" pref), after Shattered
// Pixel Dungeon's DangerIndicator, AttackIndicator and LootIndicator:
//   - loot: something lies underfoot; tap picks it up (`g`).
//   - fire: the quivered action (a launcher's ammo, a throwable, a wand);
//     tap sends `f`, which opens the direction chooser — the toolbar's aim
//     row then picks the target.
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
import { tr, trText, trTitle } from './spd-i18n'

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
const PENDING = '?'

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

// Whether a log line says items lie underfoot ('here'), or that they're
// gone ('gone' — picked up, or nothing left). The map can't tell: the
// player's own cell carries the player sprite, not the floor items under it.
export function lootSignal(text: string): 'here' | 'gone' | null {
  const t = text.trim()
  if (/^You see here /.test(t) || /^There are (several|many) (objects|items) here/.test(t)
    || /^Things that are here:/.test(t)) return 'here'
  if (/^[a-zA-Z] - /.test(t) || /^You (now have|pick up) /.test(t)
    || /^There (are no objects|is nothing) /.test(t)) return 'gone'
  return null
}

export class SpdIndicators {
  readonly element: HTMLElement
  private readonly danger: HTMLButtonElement
  private readonly attack: HTMLButtonElement
  private readonly loot: HTMLButtonElement
  private readonly fire: HTMLButtonElement
  private quiver = ''
  private lootHere = false
  private lootPos = ''
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
    trTitle(this.danger, 'Hostiles in view')
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

    this.loot = document.createElement('button')
    this.loot.type = 'button'
    this.loot.className = 'spd-ind spd-loot'
    trTitle(this.loot, 'Pick up')
    this.loot.innerHTML = '<span class="spd-ind-icon">✋</span>'
    this.loot.appendChild(trText(document.createElement('span'), 'Pick up'))
    bindPressedClass(this.loot)
    this.loot.addEventListener('click', () => {
      if (!deps.canAct()) return
      deps.send({ msg: 'input', text: 'g' })
    })

    this.fire = document.createElement('button')
    this.fire.type = 'button'
    this.fire.className = 'spd-ind spd-fire'
    this.fire.innerHTML = '<span class="spd-ind-icon">🏹</span>'
    trTitle(this.fire, 'Fire')
    bindPressedClass(this.fire)
    this.fire.addEventListener('click', () => {
      if (!deps.canAct()) return
      deps.send({ msg: 'input', text: 'f' })
    })

    root.appendChild(this.loot)
    root.appendChild(this.danger)
    root.appendChild(this.fire)
    root.appendChild(this.attack)
    this.sync()
  }

  // One log line (markup stripped). The line may precede the move that
  // put the player there within one server batch, so the spot is pinned at
  // the batch's end (a microtask, after the batch's update() calls); any
  // later move clears it.
  onMessage(text: string): void {
    const sig = lootSignal(text)
    if (!sig) return
    this.lootHere = sig === 'here'
    this.lootPos = PENDING
    queueMicrotask(() => {
      if (this.lootPos !== PENDING) return
      this.lootPos = `${this.from.x},${this.from.y}`
      this.sync()
    })
    this.sync()
  }

  // The engine's quiver line (untranslated, markup stripped).
  setQuiver(desc: string): void {
    this.quiver = desc
    this.sync()
  }

  private hasQuiver(): boolean {
    return !!this.quiver.trim() && !/nothing (quivered|to fire)|^none$/i.test(this.quiver.trim())
  }

  private sync(): void {
    const posKey = `${this.from.x},${this.from.y}`
    if (this.lootHere && this.lootPos !== PENDING && posKey !== this.lootPos) this.lootHere = false
    this.loot.hidden = !this.lootHere
    this.danger.hidden = !this.target
    this.attack.hidden = !this.target
    this.fire.hidden = !this.target || !this.hasQuiver()
    if (!this.fire.hidden) this.fire.title = `${tr('Fire')}: ${this.quiver}`
    this.element.hidden = !this.lootHere && !this.target
  }

  update(store: MapStore, loader: TileLoader | null, tiles: boolean): void {
    this.from = store.playerPos
    const { target, count } = nearestHostile(store.getMonsters(), this.from)
    this.target = target
    this.sync()
    if (!target) { this.shownKey = ''; return }

    this.danger.innerHTML = `<span class="spd-ind-icon">☠</span><span class="spd-ind-count">${count}</span>`
    this.attack.title = `${tr('Attack')} ${target.mon.name ?? ''}`.trim()
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
