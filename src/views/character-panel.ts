import type { ClientMsg, ServerMsg } from '../ws/types'

export type CharacterCommand = '%' | 'A' | 'm' | 'i' | 'I' | 'M' | 'q' | 'r' | 'V' | 'F'
export const USE_COMMANDS: readonly string[] = ['q', 'r', 'V', 'F']
export const CHARACTER_COMMANDS: readonly string[] = ['%', 'A', 'm', 'i', 'I', 'M']
interface Hooks {
  send: (msg: ClientMsg) => void
  idle: () => boolean
  hasOverlay: () => boolean
  restore: () => void
  language: () => 'ko' | 'en'
}

// One live server menu at a time; every tab (including the I / M spell tabs)
// is its own command. Switching waits for an acknowledged close AND
// command-mode readiness; no Esc+key macros.
export class CharacterPanel {
  readonly element = document.createElement('section')
  readonly openButton = document.createElement('button')
  private tabs = document.createElement('nav')
  private notice = document.createElement('div')
  private body = document.createElement('div')
  private single = document.createElement('div')
  private tabButtons = new Map<CharacterCommand, HTMLButtonElement>()
  private active: CharacterCommand = '%'
  private desired: CharacterCommand | null = null
  private phase: 'off' | 'opening' | 'ready' | 'closing' = 'off'
  private acknowledgedClose = false
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
      : (this.ko ? ['상태 %', '능력·변이 A', '스킬 m', '가방 i', '주문 I', '암기 M']
        : ['Status %', 'Traits A', 'Skills m', 'Bag i', 'Spells I', 'Memorise M'])
    const keys: CharacterCommand[] = kind === 'use' ? ['q', 'r', 'V', 'F'] : ['%', 'A', 'm', 'i', 'I', 'M']
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
    this.body.append(this.single)
    this.element.append(this.tabs, this.notice, this.body)
  }
  private get ko(): boolean { return this.hooks.language() === 'ko' }
  get isOpen(): boolean { return this.phase !== 'off' }
  get busy(): boolean { return this.phase === 'opening' || this.phase === 'closing' }

  select(key: CharacterCommand): boolean {
    if (!(this.kind === 'use' ? USE_COMMANDS : CHARACTER_COMMANDS).includes(key)) return false
    if (!this.isOpen) {
      if (!this.hooks.idle()) return false
      this.element.hidden = false
      this.start(key)
      return true
    }
    if (key === this.active && this.phase === 'ready') return true
    this.desired = key
    if (this.phase === 'ready') {
      if (this.hooks.idle()) this.start(this.desired!)
      else this.beginClose()
    }
    // Opening/closing: retain the latest tab request without injecting more input.
    return true
  }
  close(): void {
    if (!this.isOpen) return
    this.desired = null
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
  private layout(): void {
    for (const [key, b] of this.tabButtons) {
      const selected = key === this.active
      b.classList.toggle('active', selected); b.setAttribute('aria-pressed', String(selected))
    }
    this.single.appendChild(this.overlay)
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
        this.layout()
        if (this.cancelOpening || this.desired !== null) this.beginClose()
      } else if ((msg.msg === 'msgs' || msg.msg === 'input_mode') && this.hooks.idle()) {
        if (msg.msg === 'msgs') this.responseText = (msg.messages ?? []).map(m => (m.text ?? '').replace(/<[^>]*>/g, '')).join('\n')
        const text = this.responseText || (this.ko ? '표시할 목록이 없습니다.' : 'No list available.')
        // These commands can return a message instead of a menu. Never infer
        // an empty menu merely from elapsed time or an unrelated message.
        if ((msg.msg === 'input_mode' && msg.mode === 1) || (this.kind === 'use' && /aren.t carrying|don.t have|have no|cannot (drink|read|evoke)|nothing to|없/.test(text)) || /don't know any spells|no spells|not carrying anything|memorise any|memorize any|주문.*없|마법.*없/.test(text)) {
          if (this.cancelOpening) { this.reset(); return }
          const next = this.desired
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
    }
  }
  reset(restore = true): void {
    clearTimeout(this.timer)
    this.phase = 'off'; this.desired = null; this.cancelOpening = false
    this.element.hidden = true; this.overlay.inert = false
    this.home.appendChild(this.overlay)
    if (restore) this.hooks.restore()
  }
}
