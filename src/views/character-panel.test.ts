// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { CharacterPanel } from './character-panel'
import type { ServerMsg } from '../ws/types'

function setup() {
  const home = document.createElement('div'), overlay = document.createElement('div')
  home.appendChild(overlay); document.body.appendChild(home)
  const state = { idle: true, depth: 0 }
  const send = vi.fn(), restore = vi.fn()
  const panel = new CharacterPanel(overlay, home, {
    send, restore, idle: () => state.idle, depth: () => state.depth,
    hasOverlay: () => state.depth > 0, language: () => 'ko',
  })
  home.appendChild(panel.element)
  const menu = (text = 'Menu') => {
    state.idle = false; state.depth = 1; overlay.textContent = text
    panel.observe({ msg: 'menu' })
  }
  const closed = () => {
    state.depth = 0
    panel.observe({ msg: 'close_menu' })
    state.idle = true
    panel.observe({ msg: 'input_mode', mode: 1 })
  }
  return { home, overlay, state, send, restore, panel, menu, closed }
}
afterEach(() => { vi.useRealTimers(); document.body.replaceChildren() })

describe('character panel command ownership', () => {
  it('opens % and waits for close acknowledgment AND command mode before another tab', () => {
    const h = setup()
    h.panel.openButton.click()
    expect(h.send).toHaveBeenLastCalledWith({ msg: 'input', text: '%' })
    h.menu(); h.panel.select('m')
    expect(h.send).toHaveBeenLastCalledWith({ msg: 'key', keycode: 27 })
    h.state.depth = 0; h.panel.observe({ msg: 'close_menu' })
    expect(h.send).toHaveBeenCalledTimes(2)
    h.state.idle = true; h.panel.observe({ msg: 'input_mode', mode: 1 })
    expect(h.send).toHaveBeenLastCalledWith({ msg: 'input', text: 'm' })
    h.panel.reset()
  })
  it('never opens from targeting, a prompt, or another menu', () => {
    const h = setup(); h.state.idle = false
    expect(h.panel.select('%')).toBe(false)
    expect(h.send).not.toHaveBeenCalled()
  })
  it('coalesces rapid tab taps without sending command strings into a menu', () => {
    const h = setup(); h.panel.select('%')
    h.panel.select('A'); h.panel.select('m'); h.panel.select('i')
    expect(h.send).toHaveBeenCalledTimes(1)
    h.menu(); expect(h.send).toHaveBeenCalledTimes(2)
    h.closed(); expect(h.send).toHaveBeenLastCalledWith({ msg: 'input', text: 'i' })
    h.panel.reset()
  })
  it('loads I then M into two panes and retains only one live interactive menu', () => {
    const h = setup(); h.panel.select('I'); h.menu('Magic Dart')
    expect(h.send.mock.calls).toEqual([[{ msg: 'input', text: 'I' }], [{ msg: 'key', keycode: 27 }]])
    h.closed(); expect(h.send).toHaveBeenLastCalledWith({ msg: 'input', text: 'M' })
    h.menu('Fireball')
    const top = h.panel.element.querySelector('section[data-command="I"]')!
    const bottom = h.panel.element.querySelector('section[data-command="M"]')!
    expect(top.textContent).toContain('Magic Dart')
    expect(bottom.contains(h.overlay)).toBe(true)
    expect(top.querySelector('.character-snapshot')?.hasAttribute('inert')).toBe(true)
    h.panel.select('I'); h.closed(); h.menu('Magic Dart refreshed')
    expect(top.contains(h.overlay)).toBe(true)
    expect(bottom.textContent).toContain('Fireball')
    h.panel.reset()
  })
  it('empty I does not deadlock and an empty M can be closed without sending Escape', () => {
    const h = setup(); h.panel.select('I')
    h.panel.observe({ msg: 'msgs', messages: [{ text: "You don't know any spells." }] })
    expect(h.send).toHaveBeenLastCalledWith({ msg: 'input', text: 'M' })
    h.panel.observe({ msg: 'input_mode', mode: 1 })
    expect(h.panel.busy).toBe(false)
    const count = h.send.mock.calls.length
    h.panel.close()
    expect(h.send).toHaveBeenCalledTimes(count)
    expect(h.panel.isOpen).toBe(false)
  })
  it('close while opening waits for the late menu and never fires a queued tab', () => {
    const h = setup(); h.panel.select('%'); h.panel.select('i'); h.panel.close()
    expect(h.send).toHaveBeenCalledTimes(1)
    h.menu(); h.closed()
    expect(h.send.mock.calls).toEqual([[{ msg: 'input', text: '%' }], [{ msg: 'key', keycode: 27 }]])
    expect(h.panel.isOpen).toBe(false)
    expect(h.overlay.parentElement).toBe(h.home)
  })
  it('never sends a second speculative Escape after a nested detail closes', () => {
    const h = setup(); h.panel.select('i'); h.menu()
    h.state.depth = 2; h.panel.select('m')
    h.state.depth = 1; h.panel.observe({ msg: 'ui-pop' })
    expect(h.send).toHaveBeenCalledTimes(2)
    expect(h.panel.busy).toBe(false)
    h.panel.reset()
  })
  it('retains native menu click handlers rather than rebuilding interactive copies', () => {
    const h = setup(); h.panel.select('i'); h.menu()
    const button = document.createElement('button'), clicked = vi.fn()
    button.addEventListener('click', clicked); h.overlay.appendChild(button)
    button.click(); expect(clicked).toHaveBeenCalledOnce()
    h.panel.reset()
  })
  it('timeouts only explain the wait; disconnect cleans up without sending gameplay input', () => {
    vi.useFakeTimers()
    const h = setup(); h.panel.select('%')
    vi.advanceTimersByTime(10000)
    expect(h.send).toHaveBeenCalledTimes(1)
    expect(h.panel.element.textContent).toContain('서버 응답이 늦습니다')
    h.panel.observe({ msg: 'close', reason: 'lost' } as ServerMsg)
    expect(h.panel.isOpen).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    expect(h.restore).not.toHaveBeenCalled()
  })
})
