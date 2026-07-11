// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { buildTouchControls } from './touch'

beforeEach(() => { localStorage.clear() })

function enterEdit(tc: ReturnType<typeof buildTouchControls>): void {
  ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
  ;(tc.element.querySelector('.tc-set-edit') as HTMLButtonElement).click()
}

describe('edit mode', () => {
  it('shows the banner and taps do not send to the game', () => {
    const sent: unknown[] = []
    const tc = buildTouchControls(m => sent.push(m))
    enterEdit(tc)
    expect(tc.element.querySelector('.tc-edit-banner')).not.toBeNull()
    ;(tc.element.querySelector('.tc-strip .tc-btn') as HTMLButtonElement).click()
    expect(sent).toEqual([])                                    // no key left the client
    const picker = tc.element.querySelector('.tc-picker-overlay') as HTMLElement
    expect(picker).not.toBeNull()
    expect(picker.style.display).not.toBe('none')
  })

  it('picking a command reassigns the slot and persists', () => {
    const tc = buildTouchControls(() => {})
    enterEdit(tc)
    ;(tc.element.querySelector('.tc-strip .tc-btn') as HTMLButtonElement).click() // slot 0,0 (quaff)
    ;(tc.element.querySelector('.tc-pick[data-id="evoke"]') as HTMLButtonElement).click()
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"cmd":"evoke"')
    const first = tc.element.querySelector('.tc-strip .tc-btn') as HTMLElement
    expect(first.textContent).toContain('(v)')
  })

  it('picking empty clears the slot', () => {
    const tc = buildTouchControls(() => {})
    enterEdit(tc)
    ;(tc.element.querySelector('.tc-strip .tc-btn') as HTMLButtonElement).click()
    ;(tc.element.querySelector('.tc-pick-empty') as HTMLButtonElement).click()
    const first = tc.element.querySelector('.tc-strip .tc-btn') as HTMLElement
    expect(first.classList.contains('tc-btn-spacer')).toBe(false) // editable placeholder, not dead
    expect(first.textContent).toBe('＋')
  })

  it('adds and removes rows within 1–4', () => {
    const tc = buildTouchControls(() => {})
    enterEdit(tc)
    const count = (): number => tc.element.querySelectorAll('.tc-strip .tc-btn').length
    expect(count()).toBe(12)
    ;(tc.element.querySelector('.tc-edit-addrow') as HTMLButtonElement).click()
    expect(count()).toBe(16)
    ;(tc.element.querySelector('.tc-edit-addrow') as HTMLButtonElement).click() // at max 4 → no-op
    expect(count()).toBe(16)
    const del = tc.element.querySelector('.tc-edit-delrow') as HTMLButtonElement
    del.click(); del.click(); del.click()
    expect(count()).toBe(4)
    del.click() // at min 1 → no-op
    expect(count()).toBe(4)
  })

  it('reset needs a confirm tap and restores defaults', () => {
    const tc = buildTouchControls(() => {})
    enterEdit(tc)
    ;(tc.element.querySelector('.tc-strip .tc-btn') as HTMLButtonElement).click()
    ;(tc.element.querySelector('.tc-pick[data-id="evoke"]') as HTMLButtonElement).click()
    const reset = tc.element.querySelector('.tc-edit-reset') as HTMLButtonElement
    reset.click()
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"cmd":"evoke"') // armed, not yet
    reset.click()
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"touchLayout":null')
  })

  it('done exits edit mode and taps send again', () => {
    const sent: unknown[] = []
    const tc = buildTouchControls(m => sent.push(m))
    enterEdit(tc)
    ;(tc.element.querySelector('.tc-edit-done') as HTMLButtonElement).click()
    expect(tc.element.classList.contains('tc-editing')).toBe(false)
    const banner = tc.element.querySelector('.tc-edit-banner') as HTMLElement
    expect(banner.style.display).toBe('none')
    ;(tc.element.querySelector('.tc-strip .tc-btn') as HTMLButtonElement).click()
    expect(sent.length).toBe(1)
  })
})
