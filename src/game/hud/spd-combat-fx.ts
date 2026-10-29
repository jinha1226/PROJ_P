// SPD-style combat numbers over monsters (the "SPD layout" pref). Shattered
// Pixel Dungeon pops the damage of every hit; DCSS never sends a monster's
// HP, only its wound tier (mon-util.cc mons_get_damage_level: hp at most
// 4/5, 3/5, 2/5, 1/5 of max) and its type's average HP (typedata.avghp).
// So the numbers here are ESTIMATES, marked `~`: a tier drop of a monster
// whose type averages 30 HP shows −~6 per tier. A hit that stays inside a
// tier shows as a plain hit mark, a miss as a miss, a kill as the HP the
// last tier implied was left.
//
// Hits, misses and kills come from the engine's English log (read ahead of
// DWEM's translation by game-view's raw hook), matched to a visible
// monster by name, nearest the player first. Events are collected over one
// server batch and shown at its end, so a hit line and the tier change it
// caused in the same batch become one number.

import type { MonsterCell } from '../map/map-store'
import { decodeMdam, mdamTier } from './monster-style'
import { tr } from './spd-i18n'

// Midpoint of each tier's HP band, uninjured … almost dead.
const TIER_MID = [1, 0.9, 0.7, 0.5, 0.3, 0.1]

export function estimateDamage(avghp: number | undefined, prevTier: number, nowTier: number): number {
  if (!avghp || nowTier <= prevTier) return 0
  return Math.max(1, Math.round(avghp * (TIER_MID[prevTier] - TIER_MID[nowTier])))
}

export function estimateRemaining(avghp: number | undefined, tier: number): number {
  return avghp ? Math.max(1, Math.round(avghp * TIER_MID[tier])) : 0
}

export type CombatKind = 'hit' | 'miss' | 'kill' | 'nodmg'

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Which of `names` a log line attacks, and how. The attacker must be the
// player ("You …", "Your …") or a missile/spell ("The dart …") rather than
// another monster on the list.
export function parseCombatLine(line: string, names: Iterable<string>): { kind: CombatKind; target: string } | null {
  const text = line.trim()
  if (!/^(You|Your|The) /.test(text)) return null
  for (const name of names) {
    if (!name) continue
    const m = new RegExp(`^(.*?)\\b(?:the |an? )?${escapeRe(name)}\\b`, 'i').exec(text)
    if (!m || !m[1].trim()) continue
    const prefix = m[1]
    if (!/^You|^Your/.test(text)) {
      // "The goblin hits the rat": monster on monster, not ours to score.
      if ([...names].some(n => n && n !== name && prefix.toLowerCase().includes(n.toLowerCase()))) return null
      if (prefix.toLowerCase().startsWith(`the ${name.toLowerCase()}`)) return null
    }
    if (/\bmiss/i.test(prefix)) return { kind: 'miss', target: name }
    if (/^You (kill|destroy|slay|dispatch|blow up)\b/i.test(text) || /\bis (killed|destroyed)\b/i.test(text)) {
      return { kind: 'kill', target: name }
    }
    if (/but (do|does) no damage/i.test(text)) return { kind: 'nodmg', target: name }
    return { kind: 'hit', target: name }
  }
  return null
}

interface Seen {
  name: string
  x: number
  y: number
  tier: number
  avghp?: number
}

export interface SpdCombatFxDeps {
  // Client point of a cell's centre, or null off-view.
  cellPoint(x: number, y: number): { x: number; y: number } | null
  playerPos(): { x: number; y: number }
  show(text: string, at: { x: number; y: number }, cls: string): void
}

export class SpdCombatFx {
  private seen = new Map<number, Seen>()
  private lines: string[] = []
  private drops = new Map<number, number>()   // id → estimated damage
  private flushQueued = false

  constructor(private readonly deps: SpdCombatFxDeps) {}

  // One English log line.
  onLine(text: string): void {
    this.lines.push(text)
    this.queueFlush()
  }

  // The visible monsters after a map update; `fg` reads a cell's flags.
  onMonsters(monsters: ReadonlyMap<string, MonsterCell>, fg: (x: number, y: number) => number | number[] | undefined): void {
    const next = new Map<number, Seen>()
    for (const m of monsters.values()) {
      const tier = mdamTier(decodeMdam(fg(m.x, m.y)))
      const prev = this.seen.get(m.mon.id)
      const avghp = m.mon.typedata?.avghp ?? prev?.avghp
      if (prev && tier > prev.tier) {
        this.drops.set(m.mon.id, (this.drops.get(m.mon.id) ?? 0) + estimateDamage(avghp, prev.tier, tier))
      }
      next.set(m.mon.id, { name: m.mon.name ?? prev?.name ?? '', x: m.x, y: m.y, tier, avghp })
    }
    // Keep the vanished for this batch: a kill line names one of them.
    for (const [id, s] of this.seen) if (!next.has(id)) next.set(id, s.tier < 0 ? s : { ...s, tier: -1 - s.tier })
    this.seen = next
    if (this.drops.size) this.queueFlush()
  }

  reset(): void {
    this.seen.clear()
    this.lines = []
    this.drops.clear()
  }

  private queueFlush(): void {
    if (this.flushQueued) return
    this.flushQueued = true
    queueMicrotask(() => {
      this.flushQueued = false
      this.flush()
    })
  }

  private nearest(name: string, gone: boolean): [number, Seen] | null {
    const p = this.deps.playerPos()
    let best: [number, Seen] | null = null
    let bestD = Infinity
    for (const [id, s] of this.seen) {
      if (s.name.toLowerCase() !== name.toLowerCase()) continue
      if (gone !== s.tier < 0) continue
      const d = Math.max(Math.abs(s.x - p.x), Math.abs(s.y - p.y))
      if (d < bestD) { bestD = d; best = [id, s] }
    }
    return best
  }

  private flush(): void {
    const names = new Set([...this.seen.values()].map(s => s.name).filter(Boolean))
    // Longest first: "goblin conjurer" before "goblin".
    const ordered = [...names].sort((a, b) => b.length - a.length)
    const shown = new Set<number>()
    for (const line of this.lines) {
      const ev = parseCombatLine(line, ordered)
      if (!ev) continue
      const hit = ev.kind === 'kill'
        ? this.nearest(ev.target, true) ?? this.nearest(ev.target, false)
        : this.nearest(ev.target, false)
      if (!hit) continue
      const [id, s] = hit
      if (ev.kind === 'kill') {
        const tier = s.tier < 0 ? -1 - s.tier : s.tier
        const left = estimateRemaining(s.avghp, tier)
        this.pop(s, left ? `−~${left} ✝` : '✝', 'kill')
        shown.add(id)
        continue
      }
      if (ev.kind === 'miss') { this.pop(s, tr('miss'), 'miss'); continue }
      if (ev.kind === 'nodmg') { this.pop(s, '0', 'miss'); continue }
      // The batch's tier drop rides its first hit; further hits just mark.
      const dmg = shown.has(id) ? 0 : this.drops.get(id)
      this.pop(s, dmg ? `−~${dmg}` : tr('hit'), dmg ? 'dmg' : 'hit')
      shown.add(id)
    }
    // Tier drops with no line of ours (allies, clouds, a hit we didn't parse).
    for (const [id, dmg] of this.drops) {
      if (shown.has(id)) continue
      const s = this.seen.get(id)
      if (s && s.tier >= 0) this.pop(s, `−~${dmg}`, 'dmg')
    }
    this.lines = []
    this.drops.clear()
    // Forget the vanished now that their batch is done.
    for (const [id, s] of this.seen) if (s.tier < 0) this.seen.delete(id)
  }

  private pop(s: Seen, text: string, cls: string): void {
    const at = this.deps.cellPoint(s.x, s.y)
    if (at) this.deps.show(text, at, cls)
  }
}
