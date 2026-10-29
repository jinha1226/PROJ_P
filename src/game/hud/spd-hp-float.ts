// SPD-style floating HP numbers (the "SPD layout" pref): Shattered Pixel
// Dungeon pops damage and healing as numbers over the hero. DCSS reports
// only the player's HP (monsters come as wound tiers), so this shows the
// player's net HP change between two `player` messages — several hits,
// poison and regeneration in one turn all fold into one number. Purely
// visual: pointer-events none, nothing waits on it.

const LIFETIME_MS = 1100
const MAX_LIVE = 10
// Regeneration trickles +1 most turns; SPD-style noise without information.
const MIN_GAIN = 2

export interface HpSnapshot { hp?: number; hp_max?: number }

// The change to show for this message, or 0. Not on the first snapshot,
// nor when max HP moves in the same message (level up, a form change:
// hp follows max, which is not damage or healing).
export function hpChange(prev: HpSnapshot, next: HpSnapshot): number {
  if (prev.hp === undefined || next.hp === undefined) return 0
  if (next.hp_max !== undefined && prev.hp_max !== undefined && next.hp_max !== prev.hp_max) return 0
  const d = next.hp - prev.hp
  if (d > 0 && d < MIN_GAIN) return 0
  return d
}

export class SpdHpFloat {
  readonly element: HTMLElement

  constructor() {
    this.element = document.createElement('div')
    this.element.id = 'spd-hp-float'
    this.element.setAttribute('aria-hidden', 'true')
  }

  // `at`: client point of the player's cell centre.
  show(delta: number, at: { x: number; y: number }): void {
    if (!delta) return
    this.showText(delta < 0 ? `−${-delta}` : `+${delta}`, at, delta < 0 ? 'loss' : 'gain')
  }

  // A floating label; `cls` styles it.
  showText(text: string, at: { x: number; y: number }, cls: string): void {
    while (this.element.childElementCount >= MAX_LIVE) this.element.firstElementChild?.remove()
    const n = document.createElement('span')
    n.className = `spd-hp-num ${cls}`
    n.textContent = text
    n.style.left = `${at.x}px`
    n.style.top = `${at.y}px`
    this.element.appendChild(n)
    window.setTimeout(() => n.remove(), LIFETIME_MS)
  }
}
