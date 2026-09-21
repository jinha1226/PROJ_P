import type { MapStore } from '../map/map-store'
import { decodeMdam, mdamTier } from './monster-style'

type Point = { x: number; y: number }
type Target = Point & { tier: number }
export type Wounds = Map<number, Target>
export function wounds(store: MapStore): Wounds {
  const result: Wounds = new Map()
  for (const m of store.getMonsters().values()) {
    const cell = store.get(m.x, m.y)
    if (cell) result.set(m.mon.id, { x: m.x, y: m.y, tier: mdamTier(decodeMdam(cell.fg)) })
  }
  return result
}
// A changed wound tier proves worsening condition, not damage amount or attacker.
export function worsened(before: Wounds, after: Wounds): Target[] {
  return [...after].filter(([id, next]) => before.has(id) && next.tier > before.get(id)!.tier)
    .map(([, target]) => target)
}
export function hpLoss(previous: { hp?: number; hp_max?: number }, next: { hp?: number; hp_max?: number }): number {
  if (previous.hp === undefined || next.hp === undefined) return 0
  if (next.hp_max !== undefined && next.hp_max !== previous.hp_max) return 0
  return Math.max(0, previous.hp - next.hp)
}

// Bounded, purely visual overlay: an impact ring at the hit cell, nothing
// else. No damage numbers or wound labels — the map stays uncluttered and the
// HUD/monster list carry the exact figures. No commands, simulated hits, or
// animation locks.
export class CombatEffects {
  private layer = document.createElement('div')
  private timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>()
  constructor(private host: HTMLElement, private project: (p: Point) => Point | null) {
    this.layer.className = 'combat-effects'
    this.layer.setAttribute('aria-hidden', 'true')
    host.appendChild(this.layer)
  }
  show(at: Point, player = false): void {
    const point = this.project(at)
    if (!point) return
    const bounds = this.host.getBoundingClientRect()
    const x = point.x - bounds.left, y = point.y - bounds.top
    if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) return
    if (this.timers.size >= 12) this.remove(this.timers.keys().next().value!)
    const el = document.createElement('span')
    el.className = `combat-impact${player ? ' combat-impact-player' : ''}`
    el.style.left = `${x}px`; el.style.top = `${y}px`
    this.layer.appendChild(el)
    this.timers.set(el, setTimeout(() => this.remove(el), 460))
  }
  clear(): void { for (const el of this.timers.keys()) this.remove(el) }
  private remove(el: HTMLElement): void {
    clearTimeout(this.timers.get(el)); this.timers.delete(el); el.remove()
  }
}
