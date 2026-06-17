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
    expect(texts).toContain('기술')     // Skills (m)
    expect(texts).toContain('휴식')     // Rest (5)
    expect(texts).not.toContain('m')    // raw key no longer shown
  })

  it('pins autofight (⇥) and auto-explore (O) in the header', () => {
    const tc = buildTouchControls(() => {})
    const pins = [...tc.element.querySelectorAll('.tc-pin')].map(b => b.textContent)
    expect(pins).toContain('⇥')
    expect(pins).toContain('O')
  })

  it('relabels each button in place under Shift (q → 화살집, same slot)', () => {
    const tc = buildTouchControls(() => {})
    expect(labels(tc.element)).toContain('물약')   // q = quaff in play
    ;(tc.element.querySelector('.tc-shift') as HTMLButtonElement).click()
    const l = labels(tc.element)
    expect(l).toContain('화살집')   // Shift+q → Q = quiver (in q's slot)
    expect(l).toContain('지도')     // Shift+x → X = level map
    expect(l).not.toContain('물약') // q's slot is now 화살집
  })

  it('relabels in place under Ctrl (x → 저장/종료)', () => {
    const tc = buildTouchControls(() => {})
    ;(tc.element.querySelector('.tc-ctrl') as HTMLButtonElement).click()
    const l = labels(tc.element)
    expect(l).toContain('저장/종료') // Ctrl+x → ^X = save & exit
    expect(l).not.toContain('물약')  // Ctrl+q is a dead key → empty slot
  })

  it('swaps to menu meta-keys (페이지 / !) in menu mode', () => {
    const tc = buildTouchControls(() => {})
    expect(labels(tc.element)).toContain('물약')      // a play action
    expect(labels(tc.element)).not.toContain('페이지')
    tc.setMenuMode(true)
    expect(labels(tc.element)).toContain('페이지')   // Tab = page in a menu
    expect(labels(tc.element)).toContain('!')        // describe/toggle button
    expect(labels(tc.element)).not.toContain('물약')
    tc.setMenuMode(false)
    expect(labels(tc.element)).toContain('물약')
    expect(labels(tc.element)).not.toContain('!')
  })

  it('named buttons get the "named" class for text styling', () => {
    const tc = buildTouchControls(() => {})
    const skills = [...tc.element.querySelectorAll('.tc-content .tc-btn')]
      .find(b => b.textContent === '기술')!
    expect(skills.classList.contains('named')).toBe(true)
  })

  it('still sends the original key when a semantic button is tapped', () => {
    const sent: unknown[] = []
    const tc = buildTouchControls(m => sent.push(m))
    const skills = [...tc.element.querySelectorAll('.tc-content .tc-btn')]
      .find(b => b.textContent === '기술') as HTMLButtonElement
    skills.click()
    expect(sent).toContainEqual({ msg: 'input', text: 'm' })
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
    expect(texts).toContain('Skills')
    expect(texts).not.toContain('기술')
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
    expect(tabTexts).toContain('기타') // merged 운영+정보
  })
})

describe('settings toggles persist (single fire per tap)', () => {
  it('persists Beginner Coach = off to prefs', () => {
    const tc = buildTouchControls(() => {})
    ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
    const toggle = tc.element.querySelector('.tc-set-coach') as HTMLButtonElement
    expect(toggle.textContent).toBe('켬/On')   // default on
    toggle.click()
    expect(toggle.textContent).toBe('끔/Off')
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"coachEnabled":false')
  })

  it('a real tap (touchstart THEN click) toggles exactly once — not back to on', () => {
    const tc = buildTouchControls(() => {})
    ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
    const toggle = tc.element.querySelector('.tc-set-coach') as HTMLButtonElement
    // A device tap fires touchstart and then a synthesized click. If the button
    // handled BOTH, the coach would flip twice (off→on) and never stick — the
    // bug this guards. Only `click` is bound now, so this nets a single toggle.
    toggle.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }))
    toggle.dispatchEvent(new Event('click', { bubbles: true }))
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"coachEnabled":false')
  })
})
