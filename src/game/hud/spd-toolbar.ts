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
import { escHtml } from '../dcss-colors'
import { LONG_PRESS_MS } from '../input/map-tap'
import { bindPressedClass } from '../input/touch'
import {
  KIND_GLYPH, QUICKSLOT_COUNT, indexLetter, itemCount, itemKind, loadSlots, resolveSlot,
  saveSlots, shortLabel, slotName, useKeys, type QuickSlot,
} from './spd-quickslots'

export interface SpdToolbarDeps {
  inventory: InventoryStore
  send(msg: ClientMsg): void
  // At the command prompt with nothing modal up.
  canAct(): boolean
  toggleKeys(): void
  // Host for the quickslot picker sheet.
  sheetHost(): HTMLElement
}

export class SpdToolbar {
  readonly element: HTMLElement
  private readonly slots: (QuickSlot | null)[] = loadSlots()
  private readonly slotEls: HTMLButtonElement[] = []
  private readonly keysBtn: HTMLButtonElement
  private sheet: HTMLElement | null = null

  constructor(private readonly deps: SpdToolbarDeps) {
    const bar = document.createElement('div')
    bar.id = 'spd-toolbar'
    this.element = bar

    bar.appendChild(this.actionButton('spd-bag', '🎒', 'Bag', 'Inventory', () => this.key('i')))
    bar.appendChild(this.actionButton('spd-wait', '⏳', 'Wait', 'Wait a turn — hold to rest',
      () => this.key('s'), () => this.key('5')))
    bar.appendChild(this.actionButton('spd-explore', '🧭', 'Explore', 'Auto-explore', () => this.key('o')))

    const slotRow = document.createElement('div')
    slotRow.className = 'spd-slots'
    for (let i = 0; i < QUICKSLOT_COUNT; i++) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'spd-btn spd-slot'
      this.bindPress(b, () => this.useSlot(i), () => this.openPicker(i))
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
    this.slots.forEach((slot, i) => {
      const el = this.slotEls[i]
      const hit = slot ? resolveSlot(slot, items) : null
      el.classList.toggle('empty', !slot)
      el.classList.toggle('missing', !!slot && !hit)
      if (!slot) {
        el.innerHTML = '<span class="spd-plus">+</span>'
        el.title = 'Empty quickslot — tap to assign'
        return
      }
      const name = hit ? hit.item.name : slot.name
      const n = hit ? itemCount(hit.item.name) : 0
      const col = hit?.item.col ?? 8
      el.innerHTML = `<span class="spd-glyph fg${col}">${escHtml(KIND_GLYPH[itemKind(name)])}</span>`
        + `<span class="spd-cap">${escHtml(shortLabel(name))}</span>`
        + (n > 1 ? `<span class="spd-qty">${n}</span>` : '')
      el.title = `${name} — hold to change`
      if (hit) slot.letter = hit.letter
    })
  }

  setKeysOpen(open: boolean): void {
    this.keysBtn.classList.toggle('active', open)
  }

  private key(text: string): boolean {
    if (!this.deps.canAct()) return false
    this.deps.send({ msg: 'input', text })
    return true
  }

  private useSlot(i: number): boolean {
    const slot = this.slots[i]
    if (!slot) { this.openPicker(i); return true }
    const hit = resolveSlot(slot, this.deps.inventory.items)
    if (!hit) return false
    return this.key(useKeys(hit.item.name, hit.letter))
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
      timer = window.setTimeout(() => { held = true; run(hold) }, LONG_PRESS_MS)
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

  // --- quickslot picker -----------------------------------------------------

  closePicker(): boolean {
    if (!this.sheet) return false
    this.sheet.remove()
    this.sheet = null
    return true
  }

  private openPicker(i: number): void {
    this.closePicker()
    const sheet = document.createElement('div')
    sheet.className = 'spd-sheet'
    sheet.addEventListener('click', (e) => { if (e.target === sheet) this.closePicker() })
    const card = document.createElement('div')
    card.className = 'spd-sheet-card'
    const title = document.createElement('div')
    title.className = 'spd-sheet-title'
    title.textContent = `Quickslot ${i + 1}`
    card.appendChild(title)

    const list = document.createElement('div')
    list.className = 'spd-sheet-list'
    const entries = [...this.deps.inventory.items.entries()]
      .filter(([, it]) => it.name)
      .sort(([a], [b]) => a - b)
    for (const [idx, item] of entries) {
      const letter = indexLetter(idx)
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'spd-sheet-row'
      row.innerHTML = `<span class="spd-glyph fg${item.col}">${escHtml(KIND_GLYPH[itemKind(item.name)])}</span>`
        + `<span class="spd-row-letter">${letter}</span>`
        + `<span class="spd-row-name fg${item.col}">${escHtml(item.name)}</span>`
      row.addEventListener('click', () => {
        this.slots[i] = { name: slotName(item.name), letter }
        this.commit()
      })
      list.appendChild(row)
    }
    if (entries.length === 0) {
      const none = document.createElement('div')
      none.className = 'spd-sheet-empty'
      none.textContent = 'Your pack is empty.'
      list.appendChild(none)
    }
    card.appendChild(list)

    const foot = document.createElement('div')
    foot.className = 'spd-sheet-foot'
    if (this.slots[i]) {
      const clear = document.createElement('button')
      clear.type = 'button'
      clear.className = 'spd-sheet-btn'
      clear.textContent = 'Clear slot'
      clear.addEventListener('click', () => { this.slots[i] = null; this.commit() })
      foot.appendChild(clear)
    }
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'spd-sheet-btn'
    cancel.textContent = 'Cancel'
    cancel.addEventListener('click', () => this.closePicker())
    foot.appendChild(cancel)
    card.appendChild(foot)

    sheet.appendChild(card)
    this.deps.sheetHost().appendChild(sheet)
    this.sheet = sheet
  }

  private commit(): void {
    saveSlots(this.slots)
    this.closePicker()
    this.refresh()
  }
}
