// SPD-style hero window (the "SPD layout" pref): Shattered Pixel Dungeon
// opens WndHero from the status pane; here a HUD tap opens the engine's own
// character screens — `%` overview, `m` skills, `I` spells, `M` memorise,
// `a` abilities, `A` traits — with a client tab strip floating over
// whichever one is up.
//
// The screens stay server menus (PocketZot already renders them for a
// phone), so a tab switch is a round trip: Esc the current screen, wait
// until the engine is back at the command prompt, then send the next key.
// Never more than one Esc per switch — a deeper layer the player opened
// (a skill description) is theirs to close; the switch waits for it.

import type { ClientMsg, ServerMsg } from '../../ws/types'
import { bindPressedClass } from '../input/touch'
import { tr } from './spd-i18n'

export interface HeroTab { key: string; label: string }

export const HERO_TABS: readonly HeroTab[] = [
  { key: '%', label: 'Status' },
  { key: 'm', label: 'Skills' },
  { key: 'I', label: 'Spells' },
  { key: 'M', label: 'Memorise' },
  { key: 'a', label: 'Abilities' },
  { key: 'A', label: 'Traits' },
]

const ESC = 27

export interface HeroTabsDeps {
  send(msg: ClientMsg): void
  // At the command prompt with nothing modal up.
  idle(): boolean
  // A server overlay (menu, layout, CRT) is on screen.
  overlayShown(): boolean
  // The strip appeared or went away (game-view makes room under it).
  onShownChange(shown: boolean): void
}

export class SpdHeroTabs {
  readonly element: HTMLElement
  private readonly buttons = new Map<string, HTMLButtonElement>()
  // The session: the tab whose screen is (or is about to be) up. null = off.
  private active: string | null = null
  // A switch waiting for the prompt after its Esc.
  private pending: string | null = null
  // Sent a key; its screen hasn't shown yet.
  private awaiting = false
  private shown = false

  constructor(private readonly deps: HeroTabsDeps) {
    const strip = document.createElement('nav')
    strip.id = 'spd-hero-tabs'
    strip.setAttribute('aria-label', tr('Hero'))
    for (const tab of HERO_TABS) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'spd-hero-tab'
      b.textContent = tr(tab.label)
      b.dataset.key = tab.key
      bindPressedClass(b)
      b.addEventListener('click', () => this.select(tab.key))
      this.buttons.set(tab.key, b)
      strip.appendChild(b)
    }
    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'spd-hero-tab spd-hero-close'
    close.textContent = '×'
    close.setAttribute('aria-label', tr('Close'))
    close.addEventListener('click', () => this.close())
    strip.appendChild(close)
    this.element = strip
    this.render()
  }

  get isOpen(): boolean { return this.active !== null }

  // Start a session on `key` (the HUD tap opens Status). Refused unless idle.
  open(key = '%'): boolean {
    if (!this.deps.idle()) return false
    this.sendTab(key)
    return true
  }

  select(key: string): void {
    if (this.active === null) { this.open(key); return }
    if (key === this.active && !this.pending) return
    if (this.deps.idle()) { this.pending = null; this.sendTab(key); return }
    const escNeeded = this.pending === null
    this.pending = key
    this.render()
    if (escNeeded) this.deps.send({ msg: 'key', keycode: ESC })
  }

  close(): void {
    if (this.active === null) return
    this.pending = null
    if (this.deps.overlayShown()) this.deps.send({ msg: 'key', keycode: ESC })
    else this.end()
  }

  // Call once per server message, after game-view has applied it.
  afterMessage(msg: ServerMsg): void {
    if (this.active === null) return
    if (msg.msg === 'game_ended' || msg.msg === 'go_lobby') { this.end(); return }
    if (this.deps.overlayShown()) {
      this.awaiting = false
      this.render()
      return
    }
    if (!this.deps.idle()) return
    if (this.pending) {
      const next = this.pending
      this.pending = null
      this.sendTab(next)
      return
    }
    // Back at the prompt with nothing up: the player closed the screen, or
    // the command answered with a message instead (no spells to list). Wait
    // for an actual answer before deciding the latter.
    if (this.awaiting && msg.msg !== 'msgs' && msg.msg !== 'input_mode') return
    this.end()
  }

  private sendTab(key: string): void {
    this.active = key
    this.awaiting = true
    this.render()
    this.deps.send({ msg: 'input', text: key })
  }

  private end(): void {
    this.active = null
    this.pending = null
    this.awaiting = false
    this.render()
  }

  private render(): void {
    const current = this.pending ?? this.active
    for (const [key, b] of this.buttons) {
      b.classList.toggle('active', key === current)
      b.setAttribute('aria-pressed', String(key === current))
    }
    const shown = this.active !== null && (this.deps.overlayShown() || this.pending !== null)
    this.element.style.display = shown ? '' : 'none'
    if (shown !== this.shown) {
      this.shown = shown
      this.deps.onShownChange(shown)
    }
  }
}
