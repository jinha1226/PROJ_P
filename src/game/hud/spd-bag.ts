// SPD-style bag (the "SPD layout" pref): Shattered Pixel Dungeon's WndBag —
// the pack as a grid of item cells under category tabs — and WndUseItem,
// the action row that tapping one opens. A client sheet over the game,
// built from the inventory the `player` messages carry; every action is a
// keystroke pair sent at the command prompt (spd-quickslots.ts useKeys),
// and "Info" opens the engine's own describe screen, which lists whatever
// else the item allows.
//
// Two more tabs hold what else a quickslot can pin: memorised spells (the
// silent harvest's list) and abilities, god powers included. Abilities are
// never pushed by the engine, so that tab offers a Load that runs the `a`
// menu unseen (game-view's ability probe) and reopens here.
//
// Pick mode is the same sheet choosing what goes in a quickslot.

import type { ClientMsg } from '../../ws/types'
import type { InventoryStore } from '../inventory-store'
import { TEX, type TileLoader } from '../tiles/tile-loader'
import { renderTiles } from '../tiles/tile-view'
import { escHtml } from '../dcss-colors'
import {
  KIND_GLYPH, QUICKSLOT_COUNT, itemCount, itemKind, itemTab, itemTile, makeSlot, sortedItems,
  useKeys, useLabel, type AbilityEntry, type BagTab, type LiveItem, type QuickSlot, type SpellInfo,
} from './spd-quickslots'

export interface SpdBagDeps {
  inventory: InventoryStore
  loader(): TileLoader | null
  spells(): SpellInfo[]
  abilities(): AbilityEntry[] | null  // null = never loaded
  // Run the ability menu unseen; the probe reopens the bag on its answer.
  loadAbilities(pickFor: number | undefined): boolean
  send(msg: ClientMsg): void
  canAct(): boolean
  host(): HTMLElement
  assignSlot(i: number, slot: QuickSlot | null): void
  slotFilled(i: number): boolean
}

const TABS: ReadonlyArray<{ tab: BagTab; label: string }> = [
  { tab: 'all', label: 'All' },
  { tab: 'gear', label: '[ Gear' },
  { tab: 'potions', label: '! Potions' },
  { tab: 'scrolls', label: '? Scrolls' },
  { tab: 'wands', label: '/ Wands' },
  { tab: 'misc', label: '* Misc' },
  { tab: 'spells', label: '✦ Spells' },
  { tab: 'abilities', label: '★ Abilities' },
]

type Entry =
  | { kind: 'item'; key: string; live: LiveItem }
  | { kind: 'spell'; key: string; spell: SpellInfo }
  | { kind: 'ability'; key: string; ability: AbilityEntry }

export class SpdBag {
  private sheet: HTMLElement | null = null
  private grid: HTMLElement | null = null
  private detail: HTMLElement | null = null
  private tabsEl: HTMLElement | null = null
  private selected: string | null = null
  private tab: BagTab = 'all'
  private pickFor: number | undefined

  constructor(private readonly deps: SpdBagDeps) {}

  get isOpen(): boolean { return this.sheet !== null }

  // pickFor: choosing what goes in that quickslot instead of using it.
  open(pickFor?: number, tab?: BagTab): void {
    this.close()
    this.pickFor = pickFor
    this.selected = null
    if (tab) this.tab = tab
    const sheet = document.createElement('div')
    sheet.className = 'spd-sheet'
    sheet.addEventListener('click', (e) => { if (e.target === sheet) this.close() })
    const card = document.createElement('div')
    card.className = 'spd-sheet-card spd-bag-card'

    const head = document.createElement('div')
    head.className = 'spd-sheet-title'
    const title = document.createElement('span')
    title.textContent = pickFor === undefined ? 'Backpack' : `Quickslot ${pickFor + 1} — pick one`
    head.appendChild(title)
    const x = this.button('×', 'spd-sheet-x', () => this.close())
    x.setAttribute('aria-label', 'Close')
    head.appendChild(x)
    card.appendChild(head)

    const tabs = document.createElement('div')
    tabs.className = 'spd-bag-tabs'
    for (const { tab: t, label } of TABS) {
      const b = this.button(label, 'spd-bag-tab', () => {
        this.tab = t
        this.selected = null
        this.renderBody()
      })
      b.dataset.tab = t
      tabs.appendChild(b)
    }
    card.appendChild(tabs)
    this.tabsEl = tabs

    this.grid = document.createElement('div')
    this.grid.className = 'spd-bag-grid'
    card.appendChild(this.grid)

    this.detail = document.createElement('div')
    this.detail.className = 'spd-bag-detail'
    card.appendChild(this.detail)

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
    this.renderBody()
  }

  close(): boolean {
    if (!this.sheet) return false
    this.sheet.remove()
    this.sheet = this.grid = this.detail = this.tabsEl = null
    return true
  }

  private entries(tab: BagTab): Entry[] {
    if (tab === 'spells') return this.deps.spells().map(spell => ({ kind: 'spell', key: `z${spell.letter}`, spell }))
    if (tab === 'abilities') return (this.deps.abilities() ?? []).map(ability => ({ kind: 'ability', key: `a${ability.letter}`, ability }))
    return sortedItems(this.deps.inventory.items)
      .filter(live => tab === 'all' || itemTab(live.item) === tab)
      .map(live => ({ kind: 'item', key: `i${live.letter}`, live }))
  }

  private renderBody(): void {
    const grid = this.grid
    if (!grid || !this.tabsEl) return
    for (const b of this.tabsEl.querySelectorAll<HTMLElement>('.spd-bag-tab')) {
      const t = b.dataset.tab as BagTab
      b.classList.toggle('active', t === this.tab)
      // Empty item categories stay visible (SPD keeps its pouches) but dim.
      b.classList.toggle('empty', t !== 'abilities' && this.entries(t).length === 0)
    }
    grid.textContent = ''
    const entries = this.entries(this.tab)
    for (const e of entries) grid.appendChild(this.cell(e))
    if (entries.length === 0) {
      const none = document.createElement('div')
      none.className = 'spd-sheet-empty'
      none.textContent = this.tab === 'spells' ? 'No spells memorised.'
        : this.tab === 'abilities' ? (this.deps.abilities() ? 'No abilities.' : 'Abilities not loaded yet.')
        : 'Nothing here.'
      grid.appendChild(none)
    }
    if (this.tab === 'abilities') {
      const load = this.button(this.deps.abilities() ? '↻ Reload abilities' : 'Load abilities', 'spd-sheet-btn spd-bag-load', () => {
        if (!this.deps.loadAbilities(this.pickFor)) this.shake()
      })
      grid.appendChild(load)
    }
    this.renderDetail()
  }

  private cell(e: Entry): HTMLElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'spd-bag-cell'
    b.dataset.key = e.key
    const loader = this.deps.loader()
    let face: HTMLElement | null = null
    let glyph = '*'
    let col = 7
    let corner = ''
    let count = 0
    if (e.kind === 'item') {
      const { item, letter } = e.live
      b.title = item.name
      face = itemTile(loader, item)
      glyph = KIND_GLYPH[itemKind(item)]
      col = item.col
      corner = letter
      count = itemCount(item)
    } else if (e.kind === 'spell') {
      b.title = e.spell.title
      face = loader ? renderTiles(loader, [{ t: e.spell.tile, tex: TEX.GUI }], 1) : null
      glyph = '✦'
      corner = e.spell.letter
    } else {
      b.title = e.ability.name
      face = loader && e.ability.tiles.length ? renderTiles(loader, e.ability.tiles, 1) : null
      glyph = '★'
      col = e.ability.colour ?? 7
      corner = e.ability.letter
    }
    if (face) b.appendChild(face)
    else b.insertAdjacentHTML('beforeend', `<span class="spd-glyph fg${col}">${escHtml(glyph)}</span>`)
    b.insertAdjacentHTML('beforeend', `<span class="spd-bag-letter">${escHtml(corner)}</span>`)
    if (count > 1) b.insertAdjacentHTML('beforeend', `<span class="spd-qty">${count}</span>`)
    if (e.kind !== 'item') b.insertAdjacentHTML('beforeend', `<span class="spd-bag-cap">${escHtml(b.title)}</span>`)
    b.addEventListener('click', () => {
      if (this.pickFor !== undefined) {
        this.deps.assignSlot(this.pickFor, this.slotFor(e))
        this.close()
        return
      }
      this.selected = e.key
      this.renderDetail()
    })
    return b
  }

  private slotFor(e: Entry): QuickSlot {
    if (e.kind === 'item') return makeSlot(e.live)
    if (e.kind === 'spell') return { type: 'spell', name: e.spell.title, letter: e.spell.letter, tile: e.spell.tile }
    return { type: 'ability', name: e.ability.name, letter: e.ability.letter, tiles: e.ability.tiles }
  }

  private renderDetail(): void {
    const detail = this.detail
    if (!detail) return
    this.grid?.querySelectorAll<HTMLElement>('.spd-bag-cell').forEach(c =>
      c.classList.toggle('selected', c.dataset.key === this.selected))
    detail.textContent = ''
    if (this.pickFor !== undefined) {
      detail.innerHTML = '<div class="spd-bag-hint">Tap to pin it to the slot.</div>'
      return
    }
    const e = this.selected ? this.entries(this.tab).find(x => x.key === this.selected) : undefined
    if (!e) {
      detail.innerHTML = '<div class="spd-bag-hint">Tap an entry.</div>'
      return
    }
    const name = document.createElement('div')
    name.className = 'spd-bag-name'
    const row = document.createElement('div')
    row.className = 'spd-bag-actions'
    if (e.kind === 'item') {
      const { item, letter } = e.live
      name.classList.add(`fg${item.col}`)
      name.textContent = `${letter} - ${item.name}`
      const kind = itemKind(item)
      if (kind !== 'other') row.appendChild(this.button(useLabel(item), 'spd-sheet-btn primary', () => this.act(useKeys(item, letter))))
      if (kind === 'equip') row.appendChild(this.button('Take off', 'spd-sheet-btn', () => this.act('c' + letter)))
      row.appendChild(this.button('Drop', 'spd-sheet-btn', () => this.act('d' + letter)))
      row.appendChild(this.button('Info', 'spd-sheet-btn', () => this.act('i' + letter)))
    } else if (e.kind === 'spell') {
      name.textContent = `${e.spell.letter} - ${e.spell.title}${e.spell.fail ? ` (${e.spell.fail} fail)` : ''}`
      row.appendChild(this.button('Cast', 'spd-sheet-btn primary', () => this.act('z' + e.spell.letter)))
    } else {
      const a = e.ability
      name.textContent = `${a.letter} - ${a.name}${a.cost ? ` · ${a.cost}` : ''}${a.fail ? ` · ${a.fail}` : ''}`
      row.appendChild(this.button('Use', 'spd-sheet-btn primary', () => this.act('a' + a.letter)))
    }
    detail.appendChild(name)
    detail.appendChild(row)

    const slots = document.createElement('div')
    slots.className = 'spd-bag-actions spd-bag-slots'
    const label = document.createElement('span')
    label.className = 'spd-bag-hint'
    label.textContent = 'Quickslot'
    slots.appendChild(label)
    for (let i = 0; i < QUICKSLOT_COUNT; i++) {
      slots.appendChild(this.button(String(i + 1), 'spd-sheet-btn', () => {
        this.deps.assignSlot(i, this.slotFor(e))
        this.close()
      }))
    }
    detail.appendChild(slots)
  }

  // Send `keys` and close, unless the prompt is busy (then shake the sheet).
  private act(keys: string): void {
    if (!this.deps.canAct()) { this.shake(); return }
    this.close()
    this.deps.send({ msg: 'input', text: keys })
  }

  private shake(): void {
    const card = this.sheet?.querySelector<HTMLElement>('.spd-sheet-card')
    if (!card) return
    card.classList.remove('refused')
    void card.offsetWidth
    card.classList.add('refused')
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
