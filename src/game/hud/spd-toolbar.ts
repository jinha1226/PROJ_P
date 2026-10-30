// SPD-style bottom toolbar (the "SPD layout" pref): Shattered Pixel
// Dungeon's Toolbar — bag, wait, explore, quickslots — standing in for the
// keypad strip during plain play. The keypad stays one tap away (⌨), and
// game-view brings it back by itself whenever a mode needs its keys (X map,
// targeting, overlays).
//
// While the engine runs a targeting cursor (a wand, a spell, `x`) the bar
// turns into SPD's aim row — cancel, next target, fire — in place of the
// keypad; tapping the map aims as well (game-view's Touch movement).
//
// Every other action is a command-prompt keystroke, so taps are refused (with a
// shake) unless game-view reports the prompt idle: an `o` landing in a
// --more-- or a y/n prompt would answer it instead.

import type { ClientMsg } from '../../ws/types'
import type { InventoryStore } from '../inventory-store'
import { TEX, type TileLoader } from '../tiles/tile-loader'
import { renderTiles } from '../tiles/tile-view'
import { escHtml } from '../dcss-colors'
import { bindPressedClass } from '../input/touch'
import { SpdBag } from './spd-bag'
import {
  KIND_GLYPH, QUICKSLOT_COUNT, QUICKSLOT_PAGE, itemCount, itemKind, itemTile, loadSlots, nameKindGlyph,
  resolveNamed, resolveSlot, saveSlots, shortLabel, useMsg, type AbilityEntry, type EquipState, type QuickSlot,
  type SpellInfo,
} from './spd-quickslots'
import { tr, trText, trTitle } from './spd-i18n'

// Hold to rest / to repick a slot. Longer than the map's describe hold: on
// a button a slow tap must stay a tap.
const HOLD_MS = 500

// Direction-chooser keys (cmd-keys.h): Enter is CMD_TARGET_SELECT (`.` is
// SELECT_ENDPOINT, a different thing), + / - cycle the targets.
const ENTER = 13
const NEXT_TARGET = '+'
const PREV_TARGET = '-'
const ESC = 27

export interface SpdToolbarDeps {
  inventory: InventoryStore
  loader(): TileLoader | null
  spells(): SpellInfo[]
  abilities(): AbilityEntry[] | null
  loadAbilities(pickFor: number | undefined): boolean
  equipped(index: number, letter: string): EquipState | null
  bagOpened(): void
  send(msg: ClientMsg): void
  // At the command prompt with nothing modal up.
  canAct(): boolean
  toggleKeys(): void
  // Host for the bag sheet.
  sheetHost(): HTMLElement
}

export class SpdToolbar {
  readonly element: HTMLElement
  readonly bag: SpdBag
  private readonly slots: (QuickSlot | null)[] = loadSlots()
  private readonly slotEls: HTMLButtonElement[] = []
  private readonly keysBtn: HTMLButtonElement
  private readonly aimLabel: HTMLElement

  constructor(private readonly deps: SpdToolbarDeps) {
    this.bag = new SpdBag({
      inventory: deps.inventory,
      loader: deps.loader,
      spells: deps.spells,
      abilities: deps.abilities,
      loadAbilities: deps.loadAbilities,
      equipped: deps.equipped,
      opened: deps.bagOpened,
      send: deps.send,
      canAct: deps.canAct,
      host: deps.sheetHost,
      assignSlot: (i, slot) => {
        this.slots[i] = slot
        saveSlots(this.slots)
        this.refresh()
      },
      slotFilled: (i) => this.slots[i] !== null,
    })

    const bar = document.createElement('div')
    bar.id = 'spd-toolbar'
    this.element = bar

    bar.appendChild(this.actionButton('spd-bag', '🎒', 'Bag', 'Backpack', () => {
      if (!deps.canAct()) return false
      this.bag.open()
    }))
    bar.appendChild(this.actionButton('spd-wait', '⏳', 'Wait', 'Wait a turn — hold to rest',
      () => this.key('s'), () => this.key('5')))
    bar.appendChild(this.actionButton('spd-explore', '🧭', 'Explore', 'Auto-explore', () => this.key('o')))

    // Pages of QUICKSLOT_PAGE, side by side in a snapping scroller: swipe
    // for the next page; the dots show which one is up.
    const slotRow = document.createElement('div')
    slotRow.className = 'spd-slots'
    const pages = document.createElement('div')
    pages.className = 'spd-slot-pages'
    let page: HTMLElement | null = null
    for (let i = 0; i < QUICKSLOT_COUNT; i++) {
      if (i % QUICKSLOT_PAGE === 0) {
        page = document.createElement('div')
        page.className = 'spd-slot-page'
        pages.appendChild(page)
      }
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'spd-btn spd-slot'
      b.dataset.slot = String(i)
      this.bindPress(b, () => this.useSlot(i), () => this.bag.open(i))
      this.slotEls.push(b)
      page!.appendChild(b)
    }
    const dots = document.createElement('div')
    dots.className = 'spd-slot-dots'
    const pageCount = Math.ceil(QUICKSLOT_COUNT / QUICKSLOT_PAGE)
    for (let p = 0; p < pageCount; p++) dots.appendChild(document.createElement('span'))
    const syncDots = (): void => {
      const w = pages.clientWidth || 1
      const cur = Math.round(pages.scrollLeft / w)
      dots.querySelectorAll('span').forEach((d, p) => d.classList.toggle('on', p === cur))
    }
    pages.addEventListener('scroll', syncDots, { passive: true })
    syncDots()
    slotRow.append(pages, dots)
    bar.appendChild(slotRow)

    this.keysBtn = this.actionButton('spd-keys', '⌨', 'Keys', 'Show the keypad', () => deps.toggleKeys())
    bar.appendChild(this.keysBtn)

    // The aim row (CSS swaps it in under .targeting).
    bar.appendChild(this.actionButton('spd-tgt spd-tgt-cancel', '✕', 'Cancel', 'Cancel targeting',
      () => deps.send({ msg: 'key', keycode: ESC })))
    bar.appendChild(this.actionButton('spd-tgt spd-tgt-prev', '◀', 'Prev', 'Previous target',
      () => deps.send({ msg: 'input', text: PREV_TARGET })))
    this.aimLabel = document.createElement('div')
    this.aimLabel.className = 'spd-tgt spd-tgt-label'
    bar.appendChild(this.aimLabel)
    bar.appendChild(this.actionButton('spd-tgt spd-tgt-next', '▶', 'Next', 'Next target',
      () => deps.send({ msg: 'input', text: NEXT_TARGET })))
    bar.appendChild(this.actionButton('spd-tgt spd-tgt-fire', '◎', 'Fire', 'Fire at the target',
      () => deps.send({ msg: 'key', keycode: ENTER })))
    this.refresh()
  }

  // What the aim cursor is on (a monster's name), or null for a bare cell.
  setAimTarget(name: string | null): void {
    this.aimLabel.textContent = name ? `🎯 ${name}` : '🎯'
  }

  setTargeting(on: boolean): void {
    this.element.classList.toggle('targeting', on)
    if (on) this.bag.close()
  }

  // Re-resolve the slot faces against the current inventory and lists.
  refresh(): void {
    const items = this.deps.inventory.items
    const loader = this.deps.loader()
    this.slots.forEach((slot, i) => {
      const el = this.slotEls[i]
      el.textContent = ''
      el.classList.remove('empty', 'missing')
      if (!slot) {
        el.classList.add('empty')
        el.innerHTML = '<span class="spd-plus">+</span>'
        el.title = tr('Empty quickslot — tap to assign')
        return
      }
      if (slot.type === 'spell' || slot.type === 'ability') {
        const tile = !loader ? null
          : slot.type === 'spell' ? renderTiles(loader, [{ t: slot.tile, tex: TEX.GUI }], 1)
          : slot.tiles.length ? renderTiles(loader, slot.tiles, 1) : null
        if (tile) el.appendChild(tile)
        else el.insertAdjacentHTML('beforeend', `<span class="spd-glyph">${slot.type === 'spell' ? '✦' : '★'}</span>`)
        el.insertAdjacentHTML('beforeend', `<span class="spd-cap">${escHtml(shortLabel(slot.name))}</span>`)
        el.title = `${slot.name} — ${tr('hold to change')}`
        return
      }
      const hit = resolveSlot(slot, items)
      el.classList.toggle('missing', !hit)
      const tile = hit ? itemTile(loader, hit.item) : null
      if (tile) el.appendChild(tile)
      else {
        const glyph = hit ? KIND_GLYPH[itemKind(hit.item)] : nameKindGlyph(slot)
        el.insertAdjacentHTML('beforeend', `<span class="spd-glyph fg${hit?.item.col ?? 8}">${escHtml(glyph)}</span>`)
      }
      const name = hit ? hit.item.name : slot.name
      if (!tile) el.insertAdjacentHTML('beforeend', `<span class="spd-cap">${escHtml(shortLabel(name))}</span>`)
      const n = hit ? itemCount(hit.item) : 0
      if (n > 1) el.insertAdjacentHTML('beforeend', `<span class="spd-qty">${n}</span>`)
      el.title = `${name} — ${tr('hold to change')}`
      if (hit) { slot.letter = hit.letter; slot.index = hit.index }
    })
  }

  setKeysOpen(open: boolean): void {
    this.keysBtn.classList.toggle('active', open)
  }

  closeSheets(): boolean {
    return this.bag.close()
  }

  private key(text: string): boolean {
    if (!this.deps.canAct()) return false
    this.deps.send({ msg: 'input', text })
    return true
  }

  private useSlot(i: number): boolean {
    const slot = this.slots[i]
    if (!slot) {
      this.bag.open(i)
      return true
    }
    if (slot.type === 'spell') {
      const known = this.deps.spells().map(sp => ({ letter: sp.letter, name: sp.title }))
      return this.key('z' + resolveNamed(slot, known))
    }
    if (slot.type === 'ability') {
      return this.key('a' + resolveNamed(slot, this.deps.abilities() ?? []))
    }
    const hit = resolveSlot(slot, this.deps.inventory.items)
    if (!hit) return false
    if (!this.deps.canAct()) return false
    this.deps.send(useMsg(hit))
    return true
  }

  private actionButton(
    cls: string, icon: string, label: string, title: string,
    tap: () => boolean | void, hold?: () => boolean | void,
  ): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `spd-btn ${cls}`
    trTitle(b, title)
    b.innerHTML = `<span class="spd-icon">${icon}</span>`
    const cap = document.createElement('span')
    cap.className = 'spd-cap'
    b.appendChild(trText(cap, label))
    this.bindPress(b, tap, hold)
    return b
  }

  // Tap / long-press on one button. A refused action (false) shakes it.
  private bindPress(b: HTMLButtonElement, tap: () => boolean | void, hold?: () => boolean | void): void {
    bindPressedClass(b)
    let timer: number | undefined
    let held = false
    const run = (fn: () => boolean | void): void => {
      if (fn() === false) {
        b.classList.remove('refused')
        void b.offsetWidth
        b.classList.add('refused')
      }
    }
    b.addEventListener('pointerdown', () => {
      held = false
      if (!hold) return
      timer = window.setTimeout(() => { held = true; run(hold) }, HOLD_MS)
    })
    const cancel = (): void => { if (timer !== undefined) clearTimeout(timer); timer = undefined }
    b.addEventListener('pointerup', cancel)
    b.addEventListener('pointerleave', cancel)
    b.addEventListener('pointercancel', cancel)
    b.addEventListener('contextmenu', (e) => e.preventDefault())
    b.addEventListener('click', (e) => {
      e.preventDefault()
      if (held) { held = false; return }
      run(tap)
    })
  }
}
