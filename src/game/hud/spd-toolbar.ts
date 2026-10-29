// SPD-style bottom toolbar (the "SPD layout" pref): Shattered Pixel
// Dungeon's Toolbar — bag, wait, explore, quickslots — standing in for the
// keypad strip during plain play. The keypad stays one tap away (⌨), and
// game-view brings it back by itself whenever a mode needs its keys (X map,
// targeting, overlays).
//
// Every action is a command-prompt keystroke, so taps are refused (with a
// shake) unless game-view reports the prompt idle: an `o` landing in a
// --more-- or a y/n prompt would answer it instead.

import type { ClientMsg } from '../../ws/types'
import type { InventoryStore } from '../inventory-store'
import type { TileLoader } from '../tiles/tile-loader'
import { escHtml } from '../dcss-colors'
import { bindPressedClass } from '../input/touch'
import { SpdBag } from './spd-bag'
import {
  KIND_GLYPH, QUICKSLOT_COUNT, itemCount, itemKind, itemTile, loadSlots, makeSlot, nameKindGlyph,
  resolveSlot, saveSlots, shortLabel, useKeys, type QuickSlot,
} from './spd-quickslots'

// Hold to rest / to repick a slot. Longer than the map's describe hold: on
// a button a slow tap must stay a tap.
const HOLD_MS = 500

export interface SpdToolbarDeps {
  inventory: InventoryStore
  loader(): TileLoader | null
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

  constructor(private readonly deps: SpdToolbarDeps) {
    this.bag = new SpdBag({
      inventory: deps.inventory,
      loader: deps.loader,
      send: deps.send,
      canAct: deps.canAct,
      host: deps.sheetHost,
      assignSlot: (i, live) => {
        this.slots[i] = live ? makeSlot(live) : null
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

    const slotRow = document.createElement('div')
    slotRow.className = 'spd-slots'
    for (let i = 0; i < QUICKSLOT_COUNT; i++) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'spd-btn spd-slot'
      this.bindPress(b, () => this.useSlot(i), () => this.bag.open(i))
      this.slotEls.push(b)
      slotRow.appendChild(b)
    }
    bar.appendChild(slotRow)

    this.keysBtn = this.actionButton('spd-keys', '⌨', 'Keys', 'Show the keypad', () => deps.toggleKeys())
    bar.appendChild(this.keysBtn)
    this.refresh()
  }

  // Re-resolve the slot faces against the current inventory.
  refresh(): void {
    const items = this.deps.inventory.items
    const loader = this.deps.loader()
    this.slots.forEach((slot, i) => {
      const el = this.slotEls[i]
      const hit = slot ? resolveSlot(slot, items) : null
      el.classList.toggle('empty', !slot)
      el.classList.toggle('missing', !!slot && !hit)
      el.textContent = ''
      if (!slot) {
        el.innerHTML = '<span class="spd-plus">+</span>'
        el.title = 'Empty quickslot — tap to assign'
        return
      }
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
      el.title = `${name} — hold to change`
      if (hit) slot.letter = hit.letter
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
    const hit = resolveSlot(slot, this.deps.inventory.items)
    if (!hit) return false
    return this.key(useKeys(hit.item, hit.letter))
  }

  private actionButton(
    cls: string, icon: string, label: string, title: string,
    tap: () => boolean | void, hold?: () => boolean | void,
  ): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `spd-btn ${cls}`
    b.title = title
    b.setAttribute('aria-label', title)
    b.innerHTML = `<span class="spd-icon">${icon}</span><span class="spd-cap">${label}</span>`
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
