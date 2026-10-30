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
  // The fire button was pressed (the locked target is aimed at once the
  // engine's targeting cursor appears).
  onFire?(): void
}

// Vi-keys by (dx, dy), the engine's movement letters.
const DIR_KEYS: Record<string, string> = {
  '-1,-1': 'y', '0,-1': 'k', '1,-1': 'u',
  '-1,0': 'h', '1,0': 'l',
  '-1,1': 'b', '0,1': 'j', '1,1': 'n',
}
const TAB_KEYCODE = 9
const PENDING = '?'
// Hold the attack button this long to switch the locked target.
const HOLD_MS = 500
// Launcher names across versions (the engine's English item name).
const LAUNCHER_RE = /\b(short ?bow|long ?bow|bow|crossbow|arbalest|sling|fustibalus|blowgun|hand cannon)\b/i

export function isLauncherName(name: string): boolean {
  return LAUNCHER_RE.test(name)
}

export function isHostile(m: MonsterCell): boolean {
  return !isExcluded(m.mon) && ATTITUDE_CLASSES[m.mon.att ?? 0] === 'hostile'
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

// Hostiles in view, nearest first.
export function hostilesByDistance(
  monsters: ReadonlyMap<string, MonsterCell>, from: { x: number; y: number },
): MonsterCell[] {
  return [...monsters.values()].filter(isHostile)
    .sort((a, b) => distance(a, from) - distance(b, from))
}

export function nearestHostile(
  monsters: ReadonlyMap<string, MonsterCell>, from: { x: number; y: number },
): { target: MonsterCell | null; count: number } {
  const all = hostilesByDistance(monsters, from)
  return { target: all[0] ?? null, count: all.length }
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
    || /^Things that are here:/.test(t) || /^Items here: /.test(t)) return 'here'
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
  private launcher = false
  private lootHere = false
  private lootPos = ''
  private target: MonsterCell | null = null
  // The monster the attack button sticks to (SPD's attack indicator):
  // set by attacking, tapping it on the map, or holding the button to
  // cycle; dropped when it leaves view.
  private lockId: number | null = null
  private hostiles: MonsterCell[] = []
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
    let holdTimer: number | undefined
    let held = false
    this.attack.addEventListener('pointerdown', () => {
      held = false
      holdTimer = window.setTimeout(() => { held = true; this.cycleTarget() }, HOLD_MS)
    })
    const cancelHold = (): void => { if (holdTimer !== undefined) clearTimeout(holdTimer); holdTimer = undefined }
    this.attack.addEventListener('pointerup', cancelHold)
    this.attack.addEventListener('pointerleave', cancelHold)
    this.attack.addEventListener('pointercancel', cancelHold)
    this.attack.addEventListener('contextmenu', (e) => e.preventDefault())
    this.attack.addEventListener('click', () => {
      if (held) { held = false; return }
      const t = this.target
      if (!t) return
      if (!deps.canAct()) return
      this.lockId = t.mon.id ?? null
      // Tab hits the nearest; a farther locked target is walked toward
      // with a click on its cell (the engine paths one step).
      if (distance(t, this.from) > 1 && t !== this.hostiles[0]) {
        deps.send({ msg: 'click_cell', x: t.x, y: t.y, button: 1 })
      } else {
        deps.send(attackInput(t, this.from))
      }
      this.sync()
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
      if (this.target) this.lockId = this.target.mon.id ?? null
      deps.onFire?.()
      // A wielded launcher fires through the primary attack (v): f fires
      // whatever is quivered, and using a targeted ability (Hop, a spell)
      // quivers that instead of the ammo.
      deps.send({ msg: 'input', text: this.launcher ? 'v' : 'f' })
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

  // Whether the wielded weapon is a launcher (bow, crossbow, sling…).
  setLauncher(on: boolean): void {
    this.launcher = on
    this.sync()
  }

  // Lock onto this monster (a map tap on a hostile).
  lockOn(id: number | null | undefined): void {
    if (id == null) return
    this.lockId = id
  }

  // The attack button's current target.
  currentTarget(): MonsterCell | null {
    return this.target
  }

  // Hold on the attack button: the next hostile, by distance.
  private cycleTarget(): void {
    if (this.hostiles.length < 2) return
    const i = this.hostiles.findIndex(m => m === this.target)
    const next = this.hostiles[(i + 1) % this.hostiles.length]
    this.lockId = next.mon.id ?? null
    this.onCycle?.()
  }

  // Repaints after a hold switches the target (set by update()).
  private onCycle: (() => void) | null = null

  private hasQuiver(): boolean {
    return !!this.quiver.trim() && !/nothing (quivered|to fire)|^none$/i.test(this.quiver.trim())
  }

  private sync(): void {
    const posKey = `${this.from.x},${this.from.y}`
    if (this.lootHere && this.lootPos !== PENDING && posKey !== this.lootPos) this.lootHere = false
    this.loot.hidden = !this.lootHere
    this.danger.hidden = !this.target
    this.attack.hidden = !this.target
    this.attack.classList.toggle('locked', !!this.target && this.target.mon.id === this.lockId)
    this.fire.hidden = !this.target || (!this.launcher && !this.hasQuiver())
    if (!this.fire.hidden) this.fire.title = this.launcher ? tr('Fire') : `${tr('Fire')}: ${this.quiver}`
    this.element.hidden = !this.lootHere && !this.target
  }

  update(store: MapStore, loader: TileLoader | null, tiles: boolean): void {
    this.from = store.playerPos
    this.onCycle = () => this.update(store, loader, tiles)
    this.hostiles = hostilesByDistance(store.getMonsters(), this.from)
    const count = this.hostiles.length
    const locked = this.lockId === null ? undefined : this.hostiles.find(m => m.mon.id === this.lockId)
    if (!locked) this.lockId = null
    const target = locked ?? this.hostiles[0] ?? null
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
