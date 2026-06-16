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

  it('relabels the Tab button to 페이지 in menu mode, back to 자동전투 in play', () => {
    const tc = buildTouchControls(() => {})
    expect(labels(tc.element)).toContain('자동전투') // Tab = autofight in play
    tc.setMenuMode(true)
    expect(labels(tc.element)).toContain('페이지')   // Tab = page in a menu
    expect(labels(tc.element)).not.toContain('자동전투')
    tc.setMenuMode(false)
    expect(labels(tc.element)).toContain('자동전투')
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

describe('language toggle', () => {
  it('flips labels KO -> EN when the toggle is tapped', () => {
    const tc = buildTouchControls(() => {})
    ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
    const toggle = tc.element.querySelector('.tc-set-lang') as HTMLButtonElement
    expect(toggle).toBeTruthy()
    toggle.click()
    const texts = [...tc.element.querySelectorAll('.tc-content .tc-btn')].map(b => b.textContent)
    expect(texts).toContain('Explore')
    expect(texts).not.toContain('자동탐색')
  })

  it('persists the chosen language to prefs', () => {
    const tc = buildTouchControls(() => {})
    ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
    const toggle = tc.element.querySelector('.tc-set-lang') as HTMLButtonElement
    toggle.click()
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"uiLang":"en"')
  })

  it('shows semantic tab names', () => {
    const tc = buildTouchControls(() => {})
    const tabTexts = [...tc.element.querySelectorAll('.tc-tab')].map(b => b.textContent)
    expect(tabTexts).toContain('행동') // micro
    expect(tabTexts).toContain('정보') // info
  })
})
