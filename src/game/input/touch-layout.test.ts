// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { buildTouchControls } from './touch'
import { setPref } from '../../prefs'

// This suite exercises the no-d-pad layout specifically (d-pad is on by default).
beforeEach(() => { localStorage.clear(); setPref('dpadEnabled', false) })

describe('layout v2: no d-pad, action strip present', () => {
  it('builds no d-pad element', () => {
    const tc = buildTouchControls(() => {})
    expect(tc.element.querySelector('.tc-dpad')).toBeNull()
    expect(tc.element.querySelector('.tc-dpad-btn')).toBeNull()
  })

  it('renders the action buttons in a single strip container', () => {
    const tc = buildTouchControls(() => {})
    const strips = tc.element.querySelectorAll('.tc-content .tc-strip')
    expect(strips.length).toBe(1)
    const btns = tc.element.querySelectorAll('.tc-content .tc-btn')
    expect(btns.length).toBeGreaterThanOrEqual(8) // the active tab's actions
  })

  it('action buttons still send their key on tap', () => {
    const sent: unknown[] = []
    const tc = buildTouchControls(m => sent.push(m))
    const skills = [...tc.element.querySelectorAll('.tc-content .tc-btn')]
      .find(b => b.textContent === '기술') as HTMLButtonElement
    skills.click()
    expect(sent).toContainEqual({ msg: 'input', text: 'm' })
  })
})
