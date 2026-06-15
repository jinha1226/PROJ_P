// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { buildTouchControls } from './touch'
import type { RcControls } from '../rc/rc-options'

beforeEach(() => { localStorage.clear() })

function fakeRc(initial: Record<string, string> = {}): RcControls & { store: Record<string, string | null> } {
  const store: Record<string, string | null> = { ...initial }
  const listeners: Array<() => void> = []
  return {
    store,
    available: () => true,
    request: () => {},
    getOption: (k) => (k in store ? store[k] : null),
    setOption: (k, v) => { store[k] = v; for (const cb of listeners) cb() },
    onChange: (cb) => { listeners.push(cb) },
  }
}

describe('RC options in settings', () => {
  it('shows RC toggles when rc is available', () => {
    const tc = buildTouchControls(() => {}, { rc: fakeRc() })
    ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
    expect(tc.element.querySelectorAll('.tc-set-rc').length).toBeGreaterThanOrEqual(3)
  })

  it('toggling language writes translation_language=ko then null', () => {
    const rc = fakeRc()
    const tc = buildTouchControls(() => {}, { rc })
    ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
    // DCSS's Korean translation build (CNC/Nemelex) reads `translation_language`,
    // not the mainline `language` option (which only selects joke fake-languages).
    const langBtn = tc.element.querySelector('.tc-set-rc[data-rc-key="translation_language"]') as HTMLButtonElement
    langBtn.click()
    expect(rc.store['translation_language']).toBe('ko')
    langBtn.click()
    expect(rc.store['translation_language']).toBeNull()
  })

  it('shows a disabled note when rc is unavailable', () => {
    const tc = buildTouchControls(() => {}, { rc: { ...fakeRc(), available: () => false } })
    ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
    expect(tc.element.querySelectorAll('.tc-set-rc').length).toBe(0)
  })
})
