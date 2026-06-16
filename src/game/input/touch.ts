import type { ClientMsg } from '../../ws/types'
import {
  CK_UP, CK_DOWN, CK_LEFT, CK_RIGHT,
  CK_HOME, CK_END, CK_PGUP, CK_PGDN,
  CK_SHIFT_UP, CK_SHIFT_DOWN, CK_SHIFT_LEFT, CK_SHIFT_RIGHT,
  CK_SHIFT_HOME, CK_SHIFT_END, CK_SHIFT_PGUP, CK_SHIFT_PGDN,
  CK_CTRL_UP, CK_CTRL_DOWN, CK_CTRL_LEFT, CK_CTRL_RIGHT,
  CK_CTRL_HOME, CK_CTRL_END, CK_CTRL_PGUP, CK_CTRL_PGDN,
  CK_CTRL_BKSP, CAPTURED_CTRL,
} from './keyboard'
import { createShiftToggle } from './shift-state'
import { getPref, setPref, type UiLang } from '../../prefs'
import { actionLabel, ACTION_LABELS, TAB_LABELS, type LabelPair } from './action-labels'
import type { RcControls } from '../rc/rc-options'

type SendFn = (msg: ClientMsg) => void
type TabKey = 'micro' | 'macro' | 'spells'

// Toggled off for testing (2026-06): evaluating whether the horizontal spell
// rail row is sufficient on its own. The z quick-cast tab stays fully wired
// (SpellTabConfig, the grid render, refreshSpellTab — and its tests) so a
// flip back to true is all it takes to surface it again. Exported so the
// tab-visibility test asserts whichever mode is current.
export const ENABLE_SPELL_TAB = false

interface TabButtonDef {
  label: string
  title?: string
  text?: string
  key?: number
}

type DpadDef =
  | { label: string; plain: number; shifted: number; ctrled: number }
  | { label: string; text: string }

// Arrow + numpad keycodes; shift = run-variant; ctrl = open-door / attack-stationary.
// Center is the wait/confirm slot; sends '.' as text so it both waits one turn in
// normal play and accepts the cursor target in X mode.
const DPAD_LAYOUT: DpadDef[][] = [
  [
    { label: '↖', plain: CK_HOME,  shifted: CK_SHIFT_HOME,  ctrled: CK_CTRL_HOME  },
    { label: '↑', plain: CK_UP,    shifted: CK_SHIFT_UP,    ctrled: CK_CTRL_UP    },
    { label: '↗', plain: CK_PGUP,  shifted: CK_SHIFT_PGUP,  ctrled: CK_CTRL_PGUP  },
  ],
  [
    { label: '←', plain: CK_LEFT,  shifted: CK_SHIFT_LEFT,  ctrled: CK_CTRL_LEFT  },
    { label: '·', text: '.' },
    { label: '→', plain: CK_RIGHT, shifted: CK_SHIFT_RIGHT, ctrled: CK_CTRL_RIGHT },
  ],
  [
    { label: '↙', plain: CK_END,   shifted: CK_SHIFT_END,   ctrled: CK_CTRL_END   },
    { label: '↓', plain: CK_DOWN,  shifted: CK_SHIFT_DOWN,  ctrled: CK_CTRL_DOWN  },
    { label: '↘', plain: CK_PGDN,  shifted: CK_SHIFT_PGDN,  ctrled: CK_CTRL_PGDN  },
  ],
]

// game-view owns the spell data (and the tile loader / cast logic), so it
// supplies the grid DOM for the z tab; touch.ts just hosts it in the panel's
// content area and manages tab switching.
export interface SpellTabConfig {
  render: () => HTMLElement | null  // grid for the current spells, or null if none
  hasSpells: () => boolean          // cheap visibility probe — no DOM built
}

export interface TouchControls {
  element: HTMLElement
  enterXMode(): void
  exitXMode(): void
  openKbd(): void
  closeKbd(): void
  refreshSpellTab(): void  // re-render the z tab if it is the active tab
  setMenuMode(on: boolean): void  // relabel context-dependent keys while a menu/overlay is open
}

// Static tabs only; the 'spells' tab renders dynamic content from game-view.
// Shown in the action strip while a menu/overlay is open, replacing the play
// actions (which do nothing useful in a menu). Items are selected by tapping
// the overlay list; these are the meta-keys: page the list, toggle the
// describe view (!), and help (?).
export const MENU_BUTTONS: TabButtonDef[][] = [
  [
    { label: '⇥', title: 'Page down',         key: 9 },
    { label: '!', title: 'Describe / toggle', text: '!' },
    { label: '?', title: 'Menu help',         text: '?' },
  ],
]

export const TAB_BUTTONS: Record<Exclude<TabKey, 'spells'>, TabButtonDef[][]> = {
  micro: [
    [
      { label: 'q',   title: 'Quaff potion',          text: 'q' },
      { label: 'r',   title: 'Read scroll',           text: 'r' },
      { label: 'x',   title: 'Examine surroundings',  text: 'x' },
    ],
    [
      { label: 'G',   title: 'Go to level / branch',  text: 'G' },
      { label: '<',   title: 'Ascend stairs',         text: '<' },
      { label: '>',   title: 'Descend stairs',        text: '>' },
      { label: ',',   title: 'Pick up item',          text: ',' },
    ],
    [
      { label: 'm',   title: 'Skills screen',         text: 'm' },
      { label: 'I',   title: 'List memorised spells', text: 'I' },
      { label: '5',   title: 'Rest until healed',     text: '5' },
    ],
    [
      { label: 'i',   title: 'Inventory',             text: 'i' },
    ],
  ],
  // 운영 + 정보 merged into one "기타" tab — everything that isn't a core action.
  macro: [
    [
      { label: 'w',   title: 'Wield weapon',          text: 'w' },
      { label: 'e',   title: 'Equip / exclude',       text: 'e' },
      { label: 'P',   title: 'Put on jewellery',      text: 'P' },
      { label: 'R',   title: 'Remove jewellery',      text: 'R' },
    ],
    [
      { label: 'd',   title: 'Drop',                  text: 'd' },
      { label: 'f',   title: 'Fire / quivered',       text: 'f' },
      { label: '^F',  title: 'Find feature (Ctrl+F)', key: 6 },
      { label: '^O',  title: 'Dungeon overview (Ctrl+O)', key: 15 },
    ],
    [
      { label: 'X',   title: 'Examine level map',     text: 'X' },
      { label: '@',   title: 'Character status',      text: '@' },
      { label: '%',   title: 'Character overview',    text: '%' },
      { label: 'A',   title: 'Abilities/mutations',   text: 'A' },
    ],
    [
      { label: 'v',   title: 'Evoke item',            text: 'v' },
      { label: 'a',   title: 'Use ability',           text: 'a' },
      { label: '^',   title: 'Religion / deity',      text: '^' },
      { label: 't',   title: 'Tell allies (tt to shout)', text: 't' },
    ],
    [
      { label: '=',   title: 'Reassign inventory/spell letters', text: '=' },
      { label: '}',   title: 'Runes collected',       text: '}' },
      { label: '\\',  title: 'Item knowledge',        text: '\\' },
      { label: '$',   title: 'Gold / shopping list',  text: '$' },
    ],
    [
      { label: 'z',   title: 'Cast spell',            text: 'z' },
      { label: 'M',   title: 'Spell library',         text: 'M' },
      { label: '?',   title: 'Help',                  text: '?' },
    ],
  ],
}

// Reverse map: the key a button sends → its localized label, built from every
// tab's defs. Lets a modifier-shifted key that is itself a known command
// (Shift+r → "R" = Remove jewellery, Ctrl+x → "^X" = save & exit) be relabelled
// in place, so each button keeps its position under a modifier.
const KEY_LABELS: Map<string, LabelPair> = (() => {
  const m = new Map<string, LabelPair>()
  for (const tab of Object.values(TAB_BUTTONS)) {
    for (const row of tab) {
      for (const def of row) {
        const lp = def.title ? ACTION_LABELS[def.title] : undefined
        const keyStr = def.text ?? def.label
        if (lp && keyStr) m.set(keyStr, lp)
      }
    }
  }
  // Modifier-reachable commands with no dedicated button of their own.
  m.set('Q', { ko: '화살집', en: 'Quiver' })          // Shift+q
  m.set('^X', { ko: '저장/종료', en: 'Save & exit' })  // Ctrl+x
  return m
})()

// Virtual QWERTY keyboard overlay. Letter and symbol layers, sticky Shift
// (tap = once, double-tap = locked, tap from lock = off) and one-shot Ctrl,
// [123]/[ABC] toggle. Replaces the touch-controls strip while open.
function buildKeyboardOverlay(send: SendFn): { element: HTMLElement; open: () => void; close: () => void } {
  type Layer = 'letters' | 'symbols'
  let layer: Layer = 'letters'
  let ctrlActive = false

  const overlay = document.createElement('div')
  overlay.id = 'kbd-overlay'
  overlay.style.display = 'none'

  const layerEl = document.createElement('div')
  layerEl.className = 'kbd-layer'
  overlay.appendChild(layerEl)

  const shiftBtns: HTMLButtonElement[] = []
  const ctrlBtns: HTMLButtonElement[] = []

  const shift = createShiftToggle({ onChange: refreshMods })

  function refreshMods(): void {
    for (const b of shiftBtns) {
      b.classList.toggle('active', shift.state === 'once')
      b.classList.toggle('locked', shift.state === 'lock')
    }
    for (const b of ctrlBtns) b.classList.toggle('active', ctrlActive)
    overlay.classList.toggle('shift-on', shift.isOn)
    overlay.classList.toggle('ctrl-on', ctrlActive)
  }

  // Called after each key dispatch. Keeps lock engaged across taps; clears
  // one-shot shift and ctrl.
  function clearOneshot(): void {
    shift.consume()
    if (ctrlActive) {
      ctrlActive = false
      refreshMods()
    }
  }

  function clearAllMods(): void {
    shift.reset()
    if (ctrlActive) {
      ctrlActive = false
      refreshMods()
    }
  }

  // Shift and Ctrl are mutually exclusive on the kbd: arming one disarms the
  // other so a double-mod combo doesn't leave both lit.
  function toggleShift(): void {
    const wasOff = shift.state === 'off'
    shift.tap()
    if (wasOff && ctrlActive) {
      ctrlActive = false
      refreshMods()
    }
  }

  function toggleCtrl(): void {
    ctrlActive = !ctrlActive
    if (ctrlActive) shift.reset()
    refreshMods()
  }

  function activeTextInput(): HTMLInputElement | null {
    return document.querySelector<HTMLInputElement>('.game-text-input, .input-dialog-field')
  }

  // Programmatic value changes don't fire native `input` events, so dispatch
  // one manually — that's how msgwin-get-line gets its ui_state_sync echo.
  function typeIntoInput(input: HTMLInputElement, ch: string): void {
    const value = input.value
    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? value.length
    input.value = value.slice(0, start) + ch + value.slice(end)
    const caret = start + ch.length
    input.setSelectionRange(caret, caret)
    input.focus({ preventScroll: true })
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }

  function backspaceInput(input: HTMLInputElement): void {
    const value = input.value
    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? value.length
    if (start !== end) {
      input.value = value.slice(0, start) + value.slice(end)
      input.setSelectionRange(start, start)
    } else if (start > 0) {
      input.value = value.slice(0, start - 1) + value.slice(end)
      input.setSelectionRange(start - 1, start - 1)
    }
    input.focus({ preventScroll: true })
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }

  function dispatchSpecialToInput(input: HTMLInputElement, key: 'Enter' | 'Escape'): void {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  }

  function dispatchChar(ch: string, shifted?: string): void {
    const shiftOn = shift.isOn
    const input = activeTextInput()
    if (input && !ctrlActive) {
      const out = shiftOn ? (shifted !== undefined ? shifted : ch.toUpperCase()) : ch
      typeIntoInput(input, out)
      clearOneshot()
      return
    }
    if (shiftOn) {
      const out = shifted !== undefined ? shifted : ch.toUpperCase()
      send({ msg: 'input', text: out })
    } else if (ctrlActive) {
      const upper = ch.toUpperCase()
      if (CAPTURED_CTRL.has(upper)) {
        send({ msg: 'key', keycode: upper.charCodeAt(0) - 64 })
      } else {
        send({ msg: 'input', text: ch })
      }
    } else {
      send({ msg: 'input', text: ch })
    }
    clearOneshot()
  }

  function dispatchKey(keycode: number, ctrlKeycode?: number): void {
    const input = activeTextInput()
    if (input) {
      if (keycode === 8) backspaceInput(input)
      else if (keycode === 13) dispatchSpecialToInput(input, 'Enter')
      else if (keycode === 27) dispatchSpecialToInput(input, 'Escape')
      clearOneshot()
      return
    }
    const code = ctrlActive && ctrlKeycode !== undefined ? ctrlKeycode : keycode
    send({ msg: 'key', keycode: code })
    clearOneshot()
  }

  function setLayer(next: Layer): void {
    layer = next
    rebuild()
  }

  function close(): void {
    overlay.style.display = 'none'
    clearAllMods()
  }

  function makeBtn(label: string, classes: string, onTap: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.className = 'kbd-key' + (classes ? ' ' + classes : '')
    b.textContent = label
    b.addEventListener('touchstart', e => { e.preventDefault(); onTap() }, { passive: false })
    b.addEventListener('click', onTap)
    return b
  }

  function makeCharBtn(label: string, ch: string, shifted?: string): HTMLButtonElement {
    return makeBtn(label, '', () => dispatchChar(ch, shifted))
  }

  function makeLetterBtn(ch: string): HTMLButtonElement {
    return makeBtn(ch, 'letter', () => dispatchChar(ch))
  }

  function makeLetterBtnWithCorner(ch: string, corner: string): HTMLButtonElement {
    const b = document.createElement('button')
    b.className = 'kbd-key letter with-corner'
    const sup = document.createElement('span')
    sup.className = 'kbd-corner'
    sup.textContent = corner
    const main = document.createElement('span')
    main.className = 'kbd-main'
    main.textContent = ch
    b.appendChild(sup)
    b.appendChild(main)
    const onTap = () => dispatchChar(ch)
    b.addEventListener('touchstart', e => { e.preventDefault(); onTap() }, { passive: false })
    b.addEventListener('click', onTap)
    return b
  }

  function makeShiftedCharBtn(ch: string, shifted: string): HTMLButtonElement {
    const b = document.createElement('button')
    b.className = 'kbd-key with-shifted'
    const sup = document.createElement('span')
    sup.className = 'kbd-shifted'
    sup.textContent = shifted
    const main = document.createElement('span')
    main.className = 'kbd-main'
    main.textContent = ch
    b.appendChild(sup)
    b.appendChild(main)
    const onTap = () => dispatchChar(ch, shifted)
    b.addEventListener('touchstart', e => { e.preventDefault(); onTap() }, { passive: false })
    b.addEventListener('click', onTap)
    return b
  }

  function addRow(btns: HTMLButtonElement[]): void {
    const r = document.createElement('div')
    r.className = 'kbd-row'
    for (const b of btns) r.appendChild(b)
    layerEl.appendChild(r)
  }

  const LETTER_ROW_1 = ['q','w','e','r','t','y','u','i','o','p']
  const LETTER_ROW_2 = ['a','s','d','f','g','h','j','k','l']
  const LETTER_ROW_3 = ['z','x','c','v','b','n','m']

  const LETTER_DIRS: Record<string, string> = {
    y: '↖', u: '↗', h: '←', j: '↓', k: '↑', l: '→', b: '↙', n: '↘',
  }

  const SYMBOL_ROW_1 = ['~','!','@','#','$','%','^','&','*','(',')','_','+']
  const SYMBOL_ROW_2 = ['`','1','2','3','4','5','6','7','8','9','0','-','=']
  const SYMBOL_ROW_3: Array<[string, string]> = [
    ['[', '{'], [']', '}'], ['\\', '|'], [';', ':'],
    ["'", '"'], [',', '<'], ['.', '>'], ['/', '?'],
  ]

  function buildBottomRow(switchLabel: string, nextLayer: Layer): HTMLButtonElement[] {
    const btns: HTMLButtonElement[] = []
    btns.push(makeBtn('⎋', 'wide flex glyph', () => dispatchKey(27)))
    const cb = makeBtn('⌃', 'mod wide flex glyph', toggleCtrl)
    ctrlBtns.push(cb)
    btns.push(cb)
    btns.push(makeBtn(switchLabel, 'wide flex', () => setLayer(nextLayer)))
    btns.push(makeBtn('⇥', 'wide flex glyph', () => dispatchKey(9)))
    btns.push(makeBtn('⏎', 'wide flex glyph', () => dispatchKey(13)))
    btns.push(makeBtn('abc▾', 'wide flex', close))
    return btns
  }

  function rebuild(): void {
    layerEl.innerHTML = ''
    shiftBtns.length = 0
    ctrlBtns.length = 0

    if (layer === 'letters') {
      addRow(LETTER_ROW_1.map(c => LETTER_DIRS[c] ? makeLetterBtnWithCorner(c, LETTER_DIRS[c]) : makeLetterBtn(c)))
      addRow(LETTER_ROW_2.map(c => LETTER_DIRS[c] ? makeLetterBtnWithCorner(c, LETTER_DIRS[c]) : makeLetterBtn(c)))
      const r3: HTMLButtonElement[] = []
      const sb = makeBtn('⇧', 'mod wide flex glyph', toggleShift)
      shiftBtns.push(sb); r3.push(sb)
      for (const c of LETTER_ROW_3) r3.push(LETTER_DIRS[c] ? makeLetterBtnWithCorner(c, LETTER_DIRS[c]) : makeLetterBtn(c))
      r3.push(makeBtn('⌫', 'wide flex glyph', () => dispatchKey(8, CK_CTRL_BKSP)))
      addRow(r3)
      addRow(buildBottomRow('123', 'symbols'))
    } else {
      addRow(SYMBOL_ROW_1.map(c => makeCharBtn(c, c)))
      addRow(SYMBOL_ROW_2.map(c => makeCharBtn(c, c)))
      const r3: HTMLButtonElement[] = []
      const sb = makeBtn('⇧', 'mod wide flex glyph', toggleShift)
      shiftBtns.push(sb); r3.push(sb)
      for (const [ch, sh] of SYMBOL_ROW_3) r3.push(makeShiftedCharBtn(ch, sh))
      r3.push(makeBtn('⌫', 'wide flex glyph', () => dispatchKey(8, CK_CTRL_BKSP)))
      addRow(r3)
      addRow(buildBottomRow('ABC', 'letters'))
    }
    refreshMods()
  }

  function open(): void {
    layer = 'letters'
    clearAllMods()
    rebuild()
    overlay.style.display = 'flex'
  }

  rebuild()

  return { element: overlay, open, close }
}

const RC_TOGGLES: { key: string; on: string; ko: string; en: string }[] = [
  // DCSS's Korean translation build (CNC/Nemelex) reads `translation_language`.
  // The mainline `language` option only picks joke fake-languages (dwarven, …),
  // so `language = ko` is a no-op and leaves all text in English.
  { key: 'translation_language', on: 'ko', ko: '한국어 (부분)', en: 'Korean (partial)' },
  { key: 'hp_warning',     on: '50', ko: 'HP 경고 50%',        en: 'HP warning 50%' },
  { key: 'autofight_stop', on: '50', ko: '자동전투 50% 정지',  en: 'Autofight stop 50%' },
]

export function buildTouchControls(send: SendFn, opts: { spellTab?: SpellTabConfig; onRequestRebuild?: () => void; rc?: RcControls } = {}): TouchControls {
  let ctrlActive = false
  let activeTab: TabKey = 'micro'
  // True while a menu/overlay is open: Tab pages the list there instead of
  // autofighting, so its button is relabelled to match (see renderContent).
  let menuMode = false
  let lang: UiLang = getPref('uiLang')
  const dpadEnabled = getPref('dpadEnabled')

  // Forward declarations — assigned during DOM construction below
  let shiftBtn!: HTMLButtonElement
  let ctrlBtn!: HTMLButtonElement
  let contentEl!: HTMLDivElement
  let tabsEl!: HTMLDivElement

  const shift = createShiftToggle({ onChange: refreshMods })

  // --- Key dispatch helpers ---

  function refreshMods(): void {
    shiftBtn.classList.toggle('active', shift.state === 'once')
    shiftBtn.classList.toggle('locked', shift.state === 'lock')
    ctrlBtn.classList.toggle('active', ctrlActive)
    // Relabel the action buttons to the modifier's variant (q→Q, o→^O, …).
    if (contentEl) renderTab(activeTab)
  }

  // Called after each key dispatch. Keeps shift lock engaged so the next
  // tap is still shifted (e.g. running in X mode); clears one-shot shift and ctrl.
  function clearOneshot(): void {
    shift.consume()
    if (ctrlActive) {
      ctrlActive = false
      refreshMods()
    }
  }

  function clearAllMods(): void {
    shift.reset()
    if (ctrlActive) {
      ctrlActive = false
      refreshMods()
    }
  }

  function sendTabKey(def: TabButtonDef): void {
    if (def.text !== undefined) {
      let text = def.text
      if (shift.isOn && text.length === 1) text = text.toUpperCase()
      if (ctrlActive && text.length === 1) {
        const upper = text.toUpperCase()
        if (CAPTURED_CTRL.has(upper)) {
          send({ msg: 'key', keycode: upper.charCodeAt(0) - 64 })
          clearOneshot()
          return
        }
      }
      send({ msg: 'input', text })
    } else if (def.key !== undefined) {
      send({ msg: 'key', keycode: def.key })
    }
    clearOneshot()
  }

  function sendDpad(def: DpadDef): void {
    if ('text' in def) {
      send({ msg: 'input', text: def.text })
    } else {
      const code = ctrlActive ? def.ctrled : shift.isOn ? def.shifted : def.plain
      send({ msg: 'key', keycode: code })
    }
    clearOneshot()
  }

  // --- Root element ---

  const root = document.createElement('div')
  root.id = 'touch-controls'
  root.classList.toggle('dpad-on', dpadEnabled)

  // Keyboard overlay (fixed position, renders above everything)
  const { element: kbdEl, open: openKbd, close: closeKbd } = buildKeyboardOverlay(send)
  root.appendChild(kbdEl)

  // --- D-pad (optional, gated by dpadEnabled pref) ---

  let dpadEl: HTMLDivElement | null = null
  if (dpadEnabled) {
    dpadEl = document.createElement('div')
    dpadEl.className = 'tc-dpad'
    root.appendChild(dpadEl)
  }

  // --- Panel ---

  const panel = document.createElement('div')
  panel.className = 'tc-panel'
  root.appendChild(panel)

  // Header row: Esc | tabs | Enter
  const headerEl = document.createElement('div')
  headerEl.className = 'tc-header'
  panel.appendChild(headerEl)

  const escBtn = document.createElement('button')
  escBtn.className = 'tc-esc'
  escBtn.textContent = '⎋'
  escBtn.title = 'Escape'
  escBtn.addEventListener('touchstart', e => { e.preventDefault(); send({ msg: 'key', keycode: 27 }); clearOneshot() }, { passive: false })
  escBtn.addEventListener('click', () => { send({ msg: 'key', keycode: 27 }); clearOneshot() })
  headerEl.appendChild(escBtn)

  // Pinned heavy-use actions — always visible regardless of the active tab.
  // Shown as compact glyphs (⇥ = autofight, O = auto-explore). Appended AFTER
  // the tab strip so they sit at the far right, the thumb's natural reach.
  const fightBtn = document.createElement('button')
  fightBtn.className = 'tc-pin'
  fightBtn.textContent = '⇥'
  fightBtn.title = 'Auto-fight nearest'
  fightBtn.addEventListener('touchstart', e => { e.preventDefault(); send({ msg: 'key', keycode: 9 }); clearOneshot() }, { passive: false })
  fightBtn.addEventListener('click', () => { send({ msg: 'key', keycode: 9 }); clearOneshot() })

  const exploreBtn = document.createElement('button')
  exploreBtn.className = 'tc-pin'
  exploreBtn.textContent = 'O'
  exploreBtn.title = 'Auto-explore'
  exploreBtn.addEventListener('touchstart', e => { e.preventDefault(); send({ msg: 'input', text: 'o' }); clearOneshot() }, { passive: false })
  exploreBtn.addEventListener('click', () => { send({ msg: 'input', text: 'o' }); clearOneshot() })

  tabsEl = document.createElement('div')
  tabsEl.className = 'tc-tabs'
  const tabDefs: { key: TabKey; label: string }[] = [{ key: 'micro', label: TAB_LABELS.micro[lang] }]
  // Quick-cast spells get their own tab (playing client only — spectators have
  // no spells to cast), sitting immediately right of the @ tab. Swaps the
  // content grid like any other tab.
  if (opts.spellTab) tabDefs.push({ key: 'spells', label: TAB_LABELS.spells[lang] })
  tabDefs.push({ key: 'macro', label: TAB_LABELS.macro[lang] })
  // 행동/기타 act as a single toggle: only the active one is shown, and tapping
  // it flips to the other (renderTab hides the inactive twin). Both elements
  // stay in the DOM so the disabled spells tab's harvest/grid wiring — and the
  // tests that click `.tc-tab[data-tab=…]` — keep working unchanged.
  const flipMicroMacro = (): void => renderTab(activeTab === 'micro' ? 'macro' : 'micro')
  for (const td of tabDefs) {
    const btn = document.createElement('button')
    btn.className = 'tc-tab' + (td.key === 'micro' ? ' active' : '')
    if (td.key !== 'spells') btn.classList.add('tc-toggle')  // shows the ⇄ flip hint
    btn.textContent = td.label
    btn.title = td.key
    btn.dataset.tab = td.key
    // The z tab starts hidden; refreshSpellTab() reveals it once a harvest
    // finds spells (and hides it again if the player ends up with none).
    // The macro twin starts hidden too — micro is the initial active tab.
    if (td.key === 'spells' || td.key === 'macro') btn.style.display = 'none'
    // spells navigates to itself (kept for the harvest/grid wiring + tests);
    // micro/macro share one flip handler so the visible one toggles the pair.
    const onTap = td.key === 'spells' ? () => renderTab('spells') : flipMicroMacro
    btn.addEventListener('touchstart', e => { e.preventDefault(); onTap() }, { passive: false })
    btn.addEventListener('click', onTap)
    tabsEl.appendChild(btn)
  }
  headerEl.appendChild(tabsEl)

  // Pins, then Enter, at the far right. Enter is mandatory in play — it confirms
  // spell targeting (fire-at-nearest) — so it stays always-visible.
  headerEl.appendChild(fightBtn)
  headerEl.appendChild(exploreBtn)

  const enterBtn = document.createElement('button')
  enterBtn.className = 'tc-enter'
  enterBtn.textContent = '⏎'
  enterBtn.title = 'Enter'
  enterBtn.addEventListener('touchstart', e => { e.preventDefault(); send({ msg: 'key', keycode: 13 }); clearOneshot() }, { passive: false })
  enterBtn.addEventListener('click', () => { send({ msg: 'key', keycode: 13 }); clearOneshot() })
  headerEl.appendChild(enterBtn)

  // Content area — replaced on tab switch or mode change
  contentEl = document.createElement('div')
  contentEl.className = 'tc-content'
  panel.appendChild(contentEl)

  // Footer row: Shift | Ctrl | Keyboard
  const footerEl = document.createElement('div')
  footerEl.className = 'tc-footer'
  panel.appendChild(footerEl)

  shiftBtn = document.createElement('button')
  shiftBtn.className = 'tc-shift'
  shiftBtn.textContent = '⇧'
  shiftBtn.title = 'Shift modifier (tap = next key, double-tap = lock)'
  function tapShift(): void {
    const wasOff = shift.state === 'off'
    shift.tap()
    if (wasOff && ctrlActive) {
      ctrlActive = false
      refreshMods()
    }
  }
  shiftBtn.addEventListener('touchstart', e => { e.preventDefault(); tapShift() }, { passive: false })
  shiftBtn.addEventListener('click', tapShift)
  footerEl.appendChild(shiftBtn)

  ctrlBtn = document.createElement('button')
  ctrlBtn.className = 'tc-ctrl'
  ctrlBtn.textContent = '⌃'
  ctrlBtn.title = 'Ctrl modifier (next key only)'
  function toggleCtrlMod() {
    ctrlActive = !ctrlActive
    if (ctrlActive) shift.reset()
    refreshMods()
  }
  ctrlBtn.addEventListener('touchstart', e => { e.preventDefault(); toggleCtrlMod() }, { passive: false })
  ctrlBtn.addEventListener('click', toggleCtrlMod)
  footerEl.appendChild(ctrlBtn)

  const kbdBtn = document.createElement('button')
  kbdBtn.className = 'tc-kbd'
  kbdBtn.textContent = 'abc▴'
  kbdBtn.title = 'Open keyboard input'
  kbdBtn.addEventListener('touchstart', e => { e.preventDefault(); openKbd() }, { passive: false })
  kbdBtn.addEventListener('click', () => openKbd())
  footerEl.appendChild(kbdBtn)

  // Settings overlay
  const settingsOverlay = document.createElement('div')
  settingsOverlay.className = 'tc-settings-overlay'
  settingsOverlay.style.display = 'none'
  root.appendChild(settingsOverlay)

  function updateTabLabels(): void {
    tabsEl.querySelectorAll<HTMLElement>('.tc-tab').forEach(el => {
      const key = el.dataset.tab as TabKey | undefined
      if (key && key in TAB_LABELS) el.textContent = TAB_LABELS[key as keyof typeof TAB_LABELS][lang]
    })
  }

  function syncLangBtn(): void {
    const btn = settingsOverlay.querySelector<HTMLButtonElement>('.tc-set-lang')
    if (btn) btn.textContent = lang === 'ko' ? '한' : 'EN'
  }

  function syncDpadBtn(): void {
    const btn = settingsOverlay.querySelector<HTMLButtonElement>('.tc-set-dpad')
    if (btn) btn.textContent = getPref('dpadEnabled') ? '켬/On' : '끔/Off'
  }

  function syncCoachBtn(): void {
    const btn = settingsOverlay.querySelector<HTMLButtonElement>('.tc-set-coach')
    if (btn) btn.textContent = getPref('coachEnabled') ? '켬/On' : '끔/Off'
  }

  function buildSettingsOverlay(): void {
    settingsOverlay.innerHTML = ''

    const title = document.createElement('div')
    title.className = 'tc-settings-title'
    title.textContent = '⚙ Settings / 설정'
    settingsOverlay.appendChild(title)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'tc-settings-close'
    closeBtn.textContent = '✕'
    closeBtn.title = 'Close'
    function closeSettings(): void { settingsOverlay.style.display = 'none' }
    closeBtn.addEventListener('touchstart', e => { e.preventDefault(); closeSettings() }, { passive: false })
    closeBtn.addEventListener('click', closeSettings)
    title.appendChild(closeBtn)

    // Language row
    const langRow = document.createElement('div')
    langRow.className = 'tc-settings-row'
    const langLabel = document.createElement('span')
    langLabel.className = 'tc-settings-label'
    langLabel.textContent = '언어 / Language'
    const langToggleBtn = document.createElement('button')
    langToggleBtn.className = 'tc-settings-btn tc-set-lang'
    langToggleBtn.textContent = lang === 'ko' ? '한' : 'EN'
    function toggleLang(): void {
      lang = lang === 'ko' ? 'en' : 'ko'
      setPref('uiLang', lang)
      syncLangBtn()
      updateTabLabels()
      renderTab(activeTab)
    }
    langToggleBtn.addEventListener('touchstart', e => { e.preventDefault(); toggleLang() }, { passive: false })
    langToggleBtn.addEventListener('click', toggleLang)
    langRow.appendChild(langLabel)
    langRow.appendChild(langToggleBtn)
    settingsOverlay.appendChild(langRow)

    // D-pad row
    const dpadRow = document.createElement('div')
    dpadRow.className = 'tc-settings-row'
    const dpadLabel = document.createElement('span')
    dpadLabel.className = 'tc-settings-label'
    dpadLabel.textContent = '조이스틱 / D-pad'
    const dpadToggleBtn = document.createElement('button')
    dpadToggleBtn.className = 'tc-settings-btn tc-set-dpad'
    dpadToggleBtn.textContent = getPref('dpadEnabled') ? '켬/On' : '끔/Off'
    function toggleDpad(): void {
      setPref('dpadEnabled', !getPref('dpadEnabled'))
      syncDpadBtn()
      opts.onRequestRebuild?.()
    }
    dpadToggleBtn.addEventListener('touchstart', e => { e.preventDefault(); toggleDpad() }, { passive: false })
    dpadToggleBtn.addEventListener('click', toggleDpad)
    dpadRow.appendChild(dpadLabel)
    dpadRow.appendChild(dpadToggleBtn)
    settingsOverlay.appendChild(dpadRow)

    // Beginner Coach row
    const coachRow = document.createElement('div')
    coachRow.className = 'tc-settings-row'
    const coachLabel = document.createElement('span')
    coachLabel.className = 'tc-settings-label'
    coachLabel.textContent = '초보 코치 / Beginner Coach'
    const coachToggleBtn = document.createElement('button')
    coachToggleBtn.className = 'tc-settings-btn tc-set-coach'
    coachToggleBtn.textContent = getPref('coachEnabled') ? '켬/On' : '끔/Off'
    function toggleCoach(): void {
      setPref('coachEnabled', !getPref('coachEnabled'))
      syncCoachBtn()
    }
    coachToggleBtn.addEventListener('touchstart', e => { e.preventDefault(); toggleCoach() }, { passive: false })
    coachToggleBtn.addEventListener('click', toggleCoach)
    coachRow.appendChild(coachLabel)
    coachRow.appendChild(coachToggleBtn)
    settingsOverlay.appendChild(coachRow)

    // RC options section
    const rcSection = document.createElement('div')
    rcSection.className = 'tc-settings-rc-section'

    const rcTitle = document.createElement('div')
    rcTitle.className = 'tc-settings-label tc-settings-rc-title'
    rcTitle.textContent = lang === 'ko'
      ? '게임 옵션 (RC) / Game options'
      : 'Game options (RC) / 게임 옵션'
    rcSection.appendChild(rcTitle)

    if (!opts.rc || !opts.rc.available()) {
      const note = document.createElement('div')
      note.className = 'tc-settings-note'
      note.textContent = lang === 'ko'
        ? '게임에 접속하면 사용할 수 있어요'
        : 'Available once you\'re in a game'
      rcSection.appendChild(note)
    } else {
      const caveat = document.createElement('div')
      caveat.className = 'tc-settings-note'
      caveat.textContent = lang === 'ko'
        ? '다음 캐릭터부터 적용 · 로그인 필요 · 한국어는 부분 번역'
        : 'Applies to your next character · login required · Korean is partial'
      rcSection.appendChild(caveat)

      function refreshRcRows(): void {
        for (const toggle of RC_TOGGLES) {
          const btn = settingsOverlay.querySelector<HTMLButtonElement>(`.tc-set-rc[data-rc-key="${toggle.key}"]`)
          if (!btn) continue
          const current = opts.rc!.getOption(toggle.key)
          const isOn = current === toggle.on
          btn.textContent = isOn ? '켬/On' : '끔/Off'
        }
      }

      opts.rc.onChange(refreshRcRows)

      for (const toggle of RC_TOGGLES) {
        const row = document.createElement('div')
        row.className = 'tc-settings-row'
        const label = document.createElement('span')
        label.className = 'tc-settings-label'
        label.textContent = lang === 'ko' ? toggle.ko : toggle.en
        const btn = document.createElement('button')
        btn.className = 'tc-settings-btn tc-set-rc'
        btn.dataset.rcKey = toggle.key
        const current = opts.rc.getOption(toggle.key)
        btn.textContent = current === toggle.on ? '켬/On' : '끔/Off'
        function makeToggle(t: { key: string; on: string }): () => void {
          return () => {
            const isOn = opts.rc!.getOption(t.key) === t.on
            opts.rc!.setOption(t.key, isOn ? null : t.on)
          }
        }
        const onToggle = makeToggle(toggle)
        btn.addEventListener('touchstart', e => { e.preventDefault(); onToggle() }, { passive: false })
        btn.addEventListener('click', onToggle)
        row.appendChild(label)
        row.appendChild(btn)
        rcSection.appendChild(row)
      }
    }
    settingsOverlay.appendChild(rcSection)
  }

  buildSettingsOverlay()

  // Gear button replaces the standalone language button
  const settingsBtn = document.createElement('button')
  settingsBtn.className = 'tc-settings'
  settingsBtn.textContent = '⚙'
  settingsBtn.title = 'Settings / 설정'
  function openSettings(): void {
    syncLangBtn()
    syncDpadBtn()
    settingsOverlay.style.display = 'flex'
    if (opts.rc?.available()) opts.rc.request()
  }
  settingsBtn.addEventListener('touchstart', e => { e.preventDefault(); openSettings() }, { passive: false })
  settingsBtn.addEventListener('click', openSettings)
  footerEl.appendChild(settingsBtn)

  // --- Render helpers ---

  function buildDpad(): void {
    if (!dpadEl) return
    dpadEl.innerHTML = ''
    for (let r = 0; r < DPAD_LAYOUT.length; r++) {
      for (let c = 0; c < DPAD_LAYOUT[r].length; c++) {
        const def = DPAD_LAYOUT[r][c]
        const btn = document.createElement('button')
        btn.className = 'tc-dpad-btn' + (r === 1 && c === 1 ? ' wait' : '')
        btn.textContent = def.label
        btn.addEventListener('touchstart', e => { e.preventDefault(); sendDpad(def) }, { passive: false })
        btn.addEventListener('click', () => sendDpad(def))
        dpadEl!.appendChild(btn)
      }
    }
  }

  function renderTab(tab: TabKey): void {
    activeTab = tab
    tabsEl.querySelectorAll<HTMLElement>('.tc-tab').forEach(el => {
      const key = el.dataset.tab
      el.classList.toggle('active', key === tab)
      // Toggle the micro/macro pair: show only the active one (the spells tab's
      // visibility stays owned by refreshSpellTab).
      if (key === 'micro' || key === 'macro') el.style.display = key === tab ? '' : 'none'
    })
    // In a menu/overlay the play actions are useless — show menu meta-keys
    // (page / ! / ?) instead, regardless of which tab is active.
    if (menuMode) { renderContent(MENU_BUTTONS); return }
    // The z tab hosts the spell grid game-view builds (it owns the spell data,
    // tile loader, and cast logic); refreshSpellTab fills it. Sticky like any
    // tab — stays until the player switches away, so repeat-casting is one tap
    // each. Other tabs render their static button layout.
    if (tab === 'spells') refreshSpellTab()
    else renderContent(TAB_BUTTONS[tab])
  }

  // Reveal the z tab only when a harvest found spells; hide it otherwise (a
  // non-caster, or after forgetting the last spell). Called by game-view after
  // every (re)harvest. Keeps an open z tab's grid current, and if it just
  // emptied while showing, falls back to the @ tab.
  function refreshSpellTab(): void {
    const tab = tabsEl.querySelector<HTMLElement>('.tc-tab[data-tab="spells"]')
    if (!tab) return  // spectator — there is no z tab
    // Visibility comes from the cheap probe; the grid DOM is built only when
    // the spells tab is the one on screen (render() per harvest was otherwise
    // constructed and immediately discarded). ENABLE_SPELL_TAB gates only the
    // tab's visibility — the grid stays wired (and testable) behind it.
    const has = !!opts.spellTab?.hasSpells()
    tab.style.display = ENABLE_SPELL_TAB && has ? '' : 'none'
    if (activeTab !== 'spells') return
    const grid = has ? opts.spellTab!.render() : null
    if (grid) { contentEl.innerHTML = ''; contentEl.appendChild(grid) }
    else renderTab('micro')
  }

  // Under a held modifier, relabel a letter button in place to the command its
  // modified key triggers (q→화살집, r→장신구해제, x→지도). Returns null when
  // that modified key is a dead key (no command) so the slot renders empty,
  // keeping every other button in its position. Symbols/digits/uppercase/
  // specials are never modified here.
  function modifierLabel(def: TabButtonDef): { text: string; named: boolean } | null | undefined {
    if (!(shift.isOn || ctrlActive)) return undefined  // no modifier — use base label
    if (!def.text || !/^[a-z]$/.test(def.text)) return undefined
    const up = def.text.toUpperCase()
    const sentKey = shift.isOn ? up : (CAPTURED_CTRL.has(up) ? '^' + up : def.text)
    const lp = KEY_LABELS.get(sentKey)
    return lp ? { text: lp[lang], named: true } : null  // null = dead key → empty slot
  }

  function renderContent(rows: TabButtonDef[][]): void {
    contentEl.innerHTML = ''
    const stripEl = document.createElement('div')
    stripEl.className = 'tc-row tc-strip'
    const spacer = (): void => {
      const s = document.createElement('div')
      s.className = 'tc-btn tc-btn-spacer'
      stripEl.appendChild(s)
    }
    for (const def of rows.flat()) {
      if (!def.label) { spacer(); continue }
      const mod = modifierLabel(def)
      if (mod === null) { spacer(); continue }  // dead key under modifier — keep the slot empty
      const btn = document.createElement('button')
      btn.className = 'tc-btn'
      const { text, named } = mod ?? actionLabel(def, lang)
      if (named) btn.classList.add('named')
      else if (/[^\x20-\x7e]/.test(def.label)) btn.classList.add('glyph')
      btn.textContent = text
      if (def.title) { btn.title = def.title; btn.setAttribute('aria-label', def.title) }
      btn.addEventListener('touchstart', e => { e.preventDefault(); sendTabKey(def) }, { passive: false })
      btn.addEventListener('click', () => sendTabKey(def))
      stripEl.appendChild(btn)
    }
    contentEl.appendChild(stripEl)
  }

  function setMenuMode(on: boolean): void {
    if (menuMode === on) return
    menuMode = on
    renderTab(activeTab)  // swap between menu meta-keys and the tab's play actions
  }

  function enterXMode(): void {
    root.classList.add('x-mode')
    clearAllMods()
  }

  function exitXMode(): void {
    root.classList.remove('x-mode')
    clearAllMods()
  }

  // Initial render
  if (dpadEnabled) buildDpad()
  renderContent(TAB_BUTTONS.micro)

  return { element: root, enterXMode, exitXMode, openKbd, closeKbd, refreshSpellTab, setMenuMode }
}
