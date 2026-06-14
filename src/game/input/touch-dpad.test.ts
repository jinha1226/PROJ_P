// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { buildTouchControls } from './touch'
import { setPref } from '../../prefs'

beforeEach(() => { localStorage.clear() })

describe('d-pad toggle', () => {
  it('omits the d-pad by default (dpadEnabled false)', () => {
    const tc = buildTouchControls(() => {})
    expect(tc.element.querySelector('.tc-dpad')).toBeNull()
    expect(tc.element.classList.contains('dpad-on')).toBe(false)
  })

  it('renders the d-pad when dpadEnabled is true', () => {
    setPref('dpadEnabled', true)
    const tc = buildTouchControls(() => {})
    expect(tc.element.querySelector('.tc-dpad')).not.toBeNull()
    expect(tc.element.querySelectorAll('.tc-dpad-btn').length).toBe(9)
    expect(tc.element.classList.contains('dpad-on')).toBe(true)
  })

  it('a d-pad direction sends a key when tapped', () => {
    setPref('dpadEnabled', true)
    const sent: unknown[] = []
    const tc = buildTouchControls(m => sent.push(m))
    const up = [...tc.element.querySelectorAll('.tc-dpad-btn')].find(b => b.textContent === '↑') as HTMLButtonElement
    up.click()
    expect(sent.some((m: any) => m.msg === 'key')).toBe(true)
  })
})
