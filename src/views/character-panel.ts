import type { ClientMsg, ServerMsg } from '../ws/types'

export type CharacterCommand = '%' | 'A' | 'm' | 'i' | 'I' | 'M' | 'q' | 'r' | 'V' | 'F'
export const USE_COMMANDS: readonly string[] = ['q', 'r', 'V', 'F']
export const CHARACTER_COMMANDS: readonly string[] = ['%', 'A', 'm', 'i', 'I', 'M']
interface Hooks {
  send: (msg: ClientMsg) => void
  idle: () => boolean
  hasOverlay: () => boolean
  depth: () => number
  restore: () => void
  language: () => 'ko' | 'en'
}

// One live server menu. The other spell half is an explicitly read-only snapshot.
// Switching waits for an acknowledged close AND command-mode readiness; no Esc+key macros.
export class CharacterPanel {
  readonly element = document.createElement('section')
  readonly openButton = document.createElement('button')
  private tabs = document.createElement('nav')
  private notice = document.createElement('div')
  private body = document.createElement('div')
  private single = document.createElement('div')
  private split = document.createElement('div')
  private sections = new Map<'I' | 'M', { header: HTMLButtonElement; body: HTMLElement }>()
  private tabButtons = new Map<CharacterCommand, HTMLButtonElement>()
  private snapshots = new Map<CharacterCommand, HTMLElement>()
  private active: CharacterCommand = '%'
  private desired: CharacterCommand | null = null
  private phase: 'off' | 'opening' | 'ready' | 'closing' = 'off'
  private acknowledgedClose = false
  private fetchBoth = false
  private responseText = ''
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(private overlay: HTMLElement, private home: HTMLElement, private hooks: Hooks, private kind: 'character' | 'use' = 'character') {
    this.element.className = 'character-panel' + (kind === 'use' ? ' use-panel' : '')
    this.element.hidden = true
    this.element.setAttribute('aria-label', kind === 'use' ? 'Use items / 아이템 사용' : 'Character / 캐릭터')
    this.openButton.className = 'character-open'
    this.openButton.textContent = this.ko ? '상태창' : 'Character'
    this.openButton.addEventListener('click', () => this.select(kind === 'use' ? 'q' : '%'))
    this.tabs.className = 'character-tabs'
    this.tabs.setAttribute('aria-label', 'Character sections')
    const names = kind === 'use'
      ? (this.ko ? ['물약', '스크롤', '완드', '투척'] : ['Potions', 'Scrolls', 'Wands', 'Throw'])
      : (this.ko ? ['상태 %', '능력·변이 A', '스킬 m', '가방 i', '주문']
        : ['Status %', 'Traits A', 'Skills m', 'Bag i', 'Spells'])
    const keys: CharacterCommand[] = kind === 'use' ? ['q', 'r', 'V', 'F'] : ['%', 'A', 'm', 'i', 'I']
    keys.forEach((key, i) => {
      const b = document.createElement('button')
      b.textContent = names[i]; b.dataset.command = key
      b.addEventListener('click', () => this.select(key))
      this.tabs.appendChild(b); this.tabButtons.set(key, b)
    })
    const close = document.createElement('button')
    close.className = 'character-close'; close.textContent = '×'
    close.setAttribute('aria-label', this.ko ? '창 닫기' : 'Close panel')
    close.addEventListener('click', () => this.close())
    this.tabs.appendChild(close)
    this.notice.className = 'character-notice'; this.notice.setAttribute('role', 'status')
    this.body.className = 'character-body'
    this.single.className = 'character-single'
    this.split.className = 'character-spells'
    for (const key of ['I', 'M'] as const) {
      const section = document.createElement('section')
      section.className = 'character-spell-section'; section.dataset.command = key
      const header = document.createElement('button')
      header.className = 'character-spell-heading'
      header.addEventListener('click', () => this.select(key))
      const body = document.createElement('div'); body.className = 'character-spell-body'
      section.append(header, body); this.split.appendChild(section)
      this.sections.set(key, { header, body })
    }
    this.body.append(this.single, this.split)
    this.element.append(this.tabs, this.notice, this.body)
  }
  private get ko(): boolean { return this.hooks.language() === 'ko' }
  get isOpen(): boolean { return this.phase !== 'off' }
  get busy(): boolean { return this.phase === 'opening' || this.phase === 'closing' }

  select(key: CharacterCommand): boolean {
    if (!(this.kind === 'use' ? USE_COMMANDS : CHARACTER_COMMANDS).includes(key)) return false
    if (!this.isOpen) {
      if (!this.hooks.idle()) return false
      this.snapshots.clear()
      this.element.hidden = false
      this.fetchBoth = key === 'I' || key === 'M'
      this.start(this.fetchBoth ? 'I' : key)
      return true
    }
    if (key === this.active && this.phase === 'ready') return true
    const enteringSpells = (key === 'I' || key === 'M') && this.active !== 'I' && this.active !== 'M'
    if (enteringSpells) { this.snapshots.delete('I'); this.snapshots.delete('M') }
    this.fetchBoth = enteringSpells
    this.desired = enteringSpells ? 'I' : key
    if (this.phase === 'ready') {
      if (this.hooks.idle()) this.start(this.desired!)
      else this.beginClose()
    }
    // Opening/closing: retain the latest tab request without injecting more input.
    return true
  }
  close(): void {
    if (!this.isOpen) return
    this.fetchBoth = false; this.desired = null
    if (this.phase === 'ready') {
      if (this.hooks.idle()) this.reset()
      else this.beginClose()
    }
    else if (this.phase === 'opening') {
      // Wait for the requested menu before Esc; it may still be in flight.
      this.cancelOpening = true
      this.notice.textContent = this.ko ? '응답 후 닫는 중…' : 'Closing after server response…'
    }
  }
  private cancelOpening = false
  private start(key: CharacterCommand): void {
    this.active = key; this.desired = null; this.cancelOpening = false; this.responseText = ''
    this.phase = 'opening'; this.acknowledgedClose = false
    this.layout()
    this.overlay.inert = true
    this.notice.textContent = this.ko ? '서버에서 불러오는 중…' : 'Loading from server…'
    this.armTimeout()
    this.hooks.send({ msg: 'input', text: key })
  }
  private beginClose(): void {
    this.capture()
    this.phase = 'closing'; this.acknowledgedClose = false
    this.overlay.inert = true
    this.notice.textContent = this.ko ? '메뉴 전환 중…' : 'Switching menu…'
    this.armTimeout()
    this.hooks.send({ msg: 'key', keycode: 27 })
  }
  private armTimeout(): void {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      if (this.busy) this.notice.textContent = this.ko
        ? '서버 응답이 늦습니다. 추가 명령 없이 기다리는 중입니다.'
        : 'Waiting for the server; no extra commands have been sent.'
    }, 5000)
  }
  private capture(): void {
    if (!this.hooks.hasOverlay() || this.hooks.depth() > 1) return
    const snapshot = this.overlay.cloneNode(true) as HTMLElement
    snapshot.removeAttribute('id'); snapshot.removeAttribute('style')
    snapshot.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'))
    snapshot.className = 'character-snapshot'; snapshot.inert = true
    this.snapshots.set(this.active, snapshot)
  }
  private layout(): void {
    const spells = this.active === 'I' || this.active === 'M'
    this.single.hidden = spells; this.split.hidden = !spells
    for (const [key, b] of this.tabButtons) {
      const selected = spells ? key === 'I' : key === this.active
      b.classList.toggle('active', selected); b.setAttribute('aria-pressed', String(selected))
    }
    if (!spells) { this.single.appendChild(this.overlay); return }
    for (const [key, section] of this.sections) {
      const live = key === this.active
      const title = key === 'I' ? (this.ko ? '배운 주문 I' : 'Known spells I') : (this.ko ? '주문 암기 M' : 'Memorise M')
      section.header.textContent = title + (live ? (this.ko ? ' · 선택됨' : ' · Active') : (this.ko ? ' · 눌러서 선택' : ' · Tap to activate'))
      section.header.setAttribute('aria-pressed', String(live))
      section.body.replaceChildren()
      if (live) section.body.appendChild(this.overlay)
      else if (this.snapshots.has(key)) section.body.appendChild(this.snapshots.get(key)!.cloneNode(true))
      else section.body.textContent = this.ko ? '목록을 불러오면 여기에 표시됩니다.' : 'The list will appear here after loading.'
    }
  }
  observe(msg: ServerMsg): void {
    if (!this.isOpen) return
    if (['go_lobby', 'close', 'game_ended'].includes(msg.msg)) { this.reset(false); return }
    // Item selection can lead straight to targeting or a confirmation. Hand
    // ownership back without Escape, tab commands, or automatic confirmation.
    if (this.kind === 'use' && msg.msg === 'input_mode' && [2, 3, 4, 8].includes(msg.mode)) {
      this.reset(!this.hooks.hasOverlay()); return
    }
    const closeAck = ['close_menu', 'ui-pop', 'close_all_menus'].includes(msg.msg)
      || ((msg.msg === 'layer' || msg.msg === 'set_layer') && msg.layer === 'game')
    if (this.phase === 'opening') {
      if (this.hooks.hasOverlay() && ['menu', 'ui-push', 'txt', 'ui-state'].includes(msg.msg)) {
        this.phase = 'ready'; clearTimeout(this.timer); this.overlay.inert = false
        this.notice.textContent = ''
        this.capture(); this.layout()
        if (this.cancelOpening || this.desired !== null) this.beginClose()
        else if (this.fetchBoth && this.active === 'I') {
          this.fetchBoth = false; this.desired = 'M'; this.beginClose()
        }
      } else if ((msg.msg === 'msgs' || msg.msg === 'input_mode') && this.hooks.idle()) {
        if (msg.msg === 'msgs') this.responseText = (msg.messages ?? []).map(m => (m.text ?? '').replace(/<[^>]*>/g, '')).join('\n')
        const text = this.responseText || (this.ko ? '표시할 목록이 없습니다.' : 'No list available.')
        // These commands can return a message instead of a menu. Never infer
        // an empty menu merely from elapsed time or an unrelated message.
        if ((msg.msg === 'input_mode' && msg.mode === 1) || (this.kind === 'use' && /aren.t carrying|don.t have|have no|cannot (drink|read|evoke)|nothing to|없/.test(text)) || /don't know any spells|no spells|not carrying anything|memorise any|memorize any|주문.*없|마법.*없/.test(text)) {
          const empty = document.createElement('div'); empty.className = 'character-snapshot'
          empty.textContent = text; this.snapshots.set(this.active, empty)
          if (this.cancelOpening) { this.reset(); return }
          const next = this.desired ?? (this.fetchBoth && this.active === 'I' ? 'M' : null)
          this.fetchBoth = false
          if (next) this.start(next)
          else { this.phase = 'ready'; clearTimeout(this.timer); this.notice.textContent = text; this.layout() }
        }
      }
      return
    }
    if (this.phase === 'closing') {
      if (closeAck) this.acknowledgedClose = true
      if (this.acknowledgedClose && this.hooks.idle()) {
        const next = this.desired
        if (next) this.start(next)
        else this.reset()
      } else if (closeAck && this.hooks.hasOverlay()) {
        // A close may emit several pop messages in one batch. Do not send
        // another Escape speculatively; let the user close the remaining layer.
        this.phase = 'ready'; this.desired = null; this.overlay.inert = false
        clearTimeout(this.timer)
        this.notice.textContent = this.ko ? '세부 창을 닫았습니다. 원하는 탭을 다시 선택하세요.' : 'Detail closed. Select the desired tab again.'
      }
      return
    }
    if (this.phase === 'ready') {
      if (this.hooks.idle() && (closeAck || msg.msg === 'input_mode')) this.reset()
      else if (this.hooks.hasOverlay()) this.capture()
    }
  }
  reset(restore = true): void {
    clearTimeout(this.timer)
    this.phase = 'off'; this.desired = null; this.fetchBoth = false; this.cancelOpening = false
    this.element.hidden = true; this.overlay.inert = false
    this.home.appendChild(this.overlay)
    this.snapshots.clear()
    if (restore) this.hooks.restore()
  }
}
