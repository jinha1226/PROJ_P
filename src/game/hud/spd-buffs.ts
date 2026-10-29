// SPD-style status icons (the "SPD layout" pref): Shattered Pixel Dungeon's
// BuffIndicator — a row of small icons under the status pane, tap one for
// its description. DCSS sends statuses as text lights (Hasted, Poisoned, …)
// with no icon ids, so the icon comes from the engine's English light
// (captured before DWEM translates it — game-view's raw hook) and the
// description shown is the translated text. Unknown lights fall back to
// their first letters on the status colour.

import type { PlayerStatus } from '../../ws/types'
import { statusColor } from '../map/colors'
import { dcssToHtml, escHtml, stripDcss } from '../dcss-colors'
import { bindPressedClass } from '../input/touch'

// First match wins: put the specific before the general.
const ICONS: ReadonlyArray<[RegExp, string]> = [
  [/berserk|rage/i, '😡'],
  [/^hast|quick|swift/i, '⚡'],
  [/^slow/i, '🐌'],
  [/pois|venom/i, '☠'],
  [/might|strong/i, '💪'],
  [/brill|clever/i, '🧠'],
  [/agil/i, '🤸'],
  [/regen|heal/i, '💗'],
  [/invis/i, '👻'],
  [/fly|lev/i, '🪶'],
  [/conf|daze|vertigo/i, '💫'],
  [/fear|afraid|terr/i, '😱'],
  [/corr|acid/i, '🧪'],
  [/weak|frail/i, '🥀'],
  [/tele|tloc|translo/i, '🌀'],
  [/mesm|fasc|charm/i, '👁'],
  [/stone ?skin/i, '🛡'],
  [/para|petr|stone/i, '🗿'],
  [/sick|disea|nause/i, '🤢'],
  [/silen/i, '🔇'],
  [/torn|vortex|wind/i, '🌪'],
  [/fire|burn|flame|sticky/i, '🔥'],
  [/froz|cold|chill|ice/i, '❄'],
  [/drain|bleed|blood/i, '🩸'],
  [/mark|target/i, '🎯'],
  [/held|net|web|constr|grab|caught/i, '🕸'],
  [/barb|spike|thorn/i, '📌'],
  [/contam|glow|radia/i, '☢'],
  [/doom|death/i, '💀'],
  [/exhaust|fatig|tired|breath/i, '😮'],
  [/swim|water|wet/i, '🌊'],
  [/pray|recite|god|divine|sanct/i, '🙏'],
  [/shield|protect|armou?r|ward|stone ?skin/i, '🛡'],
  [/stealth|shadow|dark/i, '🌑'],
  [/light|bright|halo/i, '✨'],
  [/lucky|luck/i, '🍀'],
  [/hunger|starv|hungry/i, '🍖'],
  [/spirit|magic|mana|mp/i, '🔮'],
]

export function buffIcon(englishLight: string): string | null {
  const plain = stripDcss(englishLight)
  for (const [re, icon] of ICONS) if (re.test(plain)) return icon
  return null
}

export class SpdBuffs {
  readonly element: HTMLElement
  private readonly row: HTMLElement
  private readonly pop: HTMLElement
  private statuses: PlayerStatus[] = []
  private open = -1

  constructor() {
    this.element = document.createElement('div')
    this.element.id = 'spd-buffs'
    this.row = document.createElement('div')
    this.row.className = 'spd-buff-row'
    this.pop = document.createElement('div')
    this.pop.className = 'spd-buff-pop'
    this.pop.hidden = true
    this.pop.addEventListener('click', () => this.toggle(-1))
    this.element.append(this.row, this.pop)
  }

  // `raw`: the same statuses' lights before translation (same order).
  update(statuses: PlayerStatus[], raw: string[]): void {
    this.statuses = statuses.filter(s => s.light)
    const rawLit = raw.length === statuses.length
      ? statuses.map((s, i) => [s, raw[i]] as const).filter(([s]) => s.light).map(([, r]) => r)
      : this.statuses.map(s => s.light)
    this.row.textContent = ''
    this.statuses.forEach((s, i) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'spd-buff'
      const color = statusColor(s.col)
      b.style.borderColor = color
      const icon = buffIcon(rawLit[i] ?? s.light)
      if (icon) b.textContent = icon
      else {
        b.classList.add('text')
        b.style.color = color
        b.textContent = Array.from(stripDcss(s.light)).slice(0, 2).join('')
      }
      b.title = stripDcss(s.text ?? s.light)
      b.setAttribute('aria-label', b.title)
      bindPressedClass(b)
      b.addEventListener('click', () => this.toggle(i))
      this.row.appendChild(b)
    })
    if (this.open >= this.statuses.length) this.open = -1
    this.renderPop()
  }

  private toggle(i: number): void {
    this.open = this.open === i ? -1 : i
    this.renderPop()
  }

  private renderPop(): void {
    const s = this.statuses[this.open]
    this.row.querySelectorAll('.spd-buff').forEach((b, i) => b.classList.toggle('active', i === this.open))
    if (!s) { this.pop.hidden = true; return }
    const light = s.use_html ? dcssToHtml(s.light) : escHtml(s.light)
    const text = s.text && stripDcss(s.text) !== stripDcss(s.light) ? `<div class="spd-buff-text">${escHtml(stripDcss(s.text))}</div>` : ''
    const desc = s.desc ? `<div class="spd-buff-desc">${escHtml(stripDcss(s.desc))}</div>` : ''
    this.pop.innerHTML = `<div class="spd-buff-light" style="color:${statusColor(s.col)}">${light}</div>${text}${desc}`
    this.pop.hidden = false
  }
}
