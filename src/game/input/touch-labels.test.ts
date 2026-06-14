// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { buildTouchControls } from './touch'

beforeEach(() => {
  localStorage.clear()
})

function labels(root: HTMLElement): string[] {
  return [...root.querySelectorAll('.tc-content .tc-btn')].map(b => b.textContent ?? '')
}

describe('semantic labels in the touch HUD', () => {
  it('renders Korean action labels by default (uiLang default ko)', () => {
    const tc = buildTouchControls(() => {})
    const texts = labels(tc.element)
    expect(texts).toContain('자동탐색') // Auto-explore
    expect(texts).toContain('휴식')     // Rest
    expect(texts).not.toContain('o')    // raw key no longer shown
  })

  it('named buttons get the "named" class for text styling', () => {
    const tc = buildTouchControls(() => {})
    const explore = [...tc.element.querySelectorAll('.tc-content .tc-btn')]
      .find(b => b.textContent === '자동탐색')!
    expect(explore.classList.contains('named')).toBe(true)
  })

  it('still sends the original key when a semantic button is tapped', () => {
    const sent: unknown[] = []
    const tc = buildTouchControls(m => sent.push(m))
    const explore = [...tc.element.querySelectorAll('.tc-content .tc-btn')]
      .find(b => b.textContent === '자동탐색') as HTMLButtonElement
    explore.click()
    expect(sent).toContainEqual({ msg: 'input', text: 'o' })
  })
})
