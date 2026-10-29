// SPD-style bag (the "SPD layout" pref): Shattered Pixel Dungeon's WndBag —
// the pack as a grid of item cells — and WndUseItem, the action row that
// tapping one opens. A client sheet over the game, built from the
// inventory the `player` messages carry; every action is a keystroke pair
// sent at the command prompt (spd-quickslots.ts useKeys), and "Info" opens
// the engine's own describe screen, which lists whatever else the item
// allows.
//
// Pick mode is the same grid choosing an item for a quickslot.

import type { ClientMsg } from '../../ws/types'
import type { InventoryStore } from '../inventory-store'
import type { TileLoader } from '../tiles/tile-loader'
import { escHtml } from '../dcss-colors'
import {
  KIND_GLYPH, QUICKSLOT_COUNT, itemCount, itemKind, itemTile, liveItems, useKeys, useLabel,
  type LiveItem,
} from './spd-quickslots'

export interface SpdBagDeps {
  inventory: InventoryStore
  loader(): TileLoader | null
  send(msg: ClientMsg): void
  canAct(): boolean
  host(): HTMLElement
  // Pin `live` to quickslot i (null clears it).
  assignSlot(i: number, live: LiveItem | null): void
  slotFilled(i: number): boolean
}

export class SpdBag {
  private sheet: HTMLElement | null = null
  private detail: HTMLElement | null = null
  private selected: string | null = null  // letter

  constructor(private readonly deps: SpdBagDeps) {}

  get isOpen(): boolean { return this.sheet !== null }

  // pickFor: choosing an item for that quickslot instead of using one.
  open(pickFor?: number): void {
    this.close()
    this.selected = null
    const sheet = document.createElement('div')
    sheet.className = 'spd-sheet'
    sheet.addEventListener('click', (e) => { if (e.target === sheet) this.close() })
    const card = document.createElement('div')
    card.className = 'spd-sheet-card spd-bag'

    const head = document.createElement('div')
    head.className = 'spd-sheet-title'
    const title = document.createElement('span')
    title.textContent = pickFor === undefined ? 'Backpack' : `Quickslot ${pickFor + 1} — pick an item`
    head.appendChild(title)
    const x = this.button('×', 'spd-sheet-x', () => this.close())
    x.setAttribute('aria-label', 'Close')
    head.appendChild(x)
    card.appendChild(head)

    const grid = document.createElement('div')
    grid.className = 'spd-bag-grid'
    const items = liveItems(this.deps.inventory.items)
    for (const live of items) grid.appendChild(this.cell(live, pickFor))
    if (items.length === 0) {
      const none = document.createElement('div')
      none.className = 'spd-sheet-empty'
      none.textContent = 'Your pack is empty.'
      grid.appendChild(none)
    }
    card.appendChild(grid)

    const detail = document.createElement('div')
    detail.className = 'spd-bag-detail'
    card.appendChild(detail)
    this.detail = detail

    const foot = document.createElement('div')
    foot.className = 'spd-sheet-foot'
    if (pickFor !== undefined && this.deps.slotFilled(pickFor)) {
      foot.appendChild(this.button('Clear slot', 'spd-sheet-btn', () => {
        this.deps.assignSlot(pickFor, null)
        this.close()
      }))
    }
    if (pickFor === undefined) {
      foot.appendChild(this.button('Full list', 'spd-sheet-btn', () => this.act('i')))
    }
    card.appendChild(foot)

    sheet.appendChild(card)
    this.deps.host().appendChild(sheet)
    this.sheet = sheet
    if (pickFor === undefined) this.renderDetail()
  }

  close(): boolean {
    if (!this.sheet) return false
    this.sheet.remove()
    this.sheet = null
    this.detail = null
    return true
  }

  private cell(live: LiveItem, pickFor: number | undefined): HTMLElement {
    const { item, letter } = live
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'spd-bag-cell'
    b.dataset.letter = letter
    b.title = item.name
    const tile = itemTile(this.deps.loader(), item)
    if (tile) b.appendChild(tile)
    else b.insertAdjacentHTML('beforeend', `<span class="spd-glyph fg${item.col}">${escHtml(KIND_GLYPH[itemKind(item)])}</span>`)
    b.insertAdjacentHTML('beforeend', `<span class="spd-bag-letter">${escHtml(letter)}</span>`)
    const n = itemCount(item)
    if (n > 1) b.insertAdjacentHTML('beforeend', `<span class="spd-qty">${n}</span>`)
    b.addEventListener('click', () => {
      if (pickFor !== undefined) {
        this.deps.assignSlot(pickFor, live)
        this.close()
        return
      }
      this.selected = letter
      this.sheet?.querySelectorAll('.spd-bag-cell').forEach(c =>
        c.classList.toggle('selected', (c as HTMLElement).dataset.letter === letter))
      this.renderDetail()
    })
    return b
  }

  private renderDetail(): void {
    const detail = this.detail
    if (!detail) return
    detail.textContent = ''
    const live = this.selected
      ? liveItems(this.deps.inventory.items).find(l => l.letter === this.selected)
      : undefined
    if (!live) {
      detail.innerHTML = '<div class="spd-bag-hint">Tap an item.</div>'
      return
    }
    const { item, letter } = live
    const name = document.createElement('div')
    name.className = `spd-bag-name fg${item.col}`
    name.textContent = `${letter} - ${item.name}`
    detail.appendChild(name)

    const row = document.createElement('div')
    row.className = 'spd-bag-actions'
    const kind = itemKind(item)
    if (kind !== 'other') {
      const primary = this.button(useLabel(item), 'spd-sheet-btn primary', () => this.act(useKeys(item, letter)))
      row.appendChild(primary)
    }
    if (kind === 'equip') row.appendChild(this.button('Take off', 'spd-sheet-btn', () => this.act('c' + letter)))
    row.appendChild(this.button('Drop', 'spd-sheet-btn', () => this.act('d' + letter)))
    row.appendChild(this.button('Info', 'spd-sheet-btn', () => this.act('i' + letter)))
    detail.appendChild(row)

    const slots = document.createElement('div')
    slots.className = 'spd-bag-actions spd-bag-slots'
    const label = document.createElement('span')
    label.className = 'spd-bag-hint'
    label.textContent = 'Quickslot'
    slots.appendChild(label)
    for (let i = 0; i < QUICKSLOT_COUNT; i++) {
      slots.appendChild(this.button(String(i + 1), 'spd-sheet-btn', () => {
        this.deps.assignSlot(i, live)
        this.close()
      }))
    }
    detail.appendChild(slots)
  }

  // Send `keys` and close, unless the prompt is busy (then shake the sheet).
  private act(keys: string): void {
    if (!this.deps.canAct()) {
      const card = this.sheet?.querySelector('.spd-sheet-card')
      card?.classList.remove('refused')
      void (card as HTMLElement | undefined)?.offsetWidth
      card?.classList.add('refused')
      return
    }
    this.close()
    this.deps.send({ msg: 'input', text: keys })
  }

  private button(text: string, cls: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = cls
    b.textContent = text
    b.addEventListener('click', onClick)
    return b
  }
}
