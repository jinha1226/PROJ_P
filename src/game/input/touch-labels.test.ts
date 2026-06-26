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
    expect(texts).toContain('기술(m)')  // Skills (m) — name + key
    expect(texts).toContain('휴식(5)')  // Rest (5)
    expect(texts).not.toContain('m')    // bare raw key never shown alone
  })

  it('pins autofight (⇥) and auto-explore (O) in the header', () => {
    const tc = buildTouchControls(() => {})
    const pins = [...tc.element.querySelectorAll('.tc-pin')].map(b => b.textContent)
    expect(pins).toContain('⇥')
    expect(pins).toContain('O')
  })

  it('relabels each button in place under Shift (q → 화살집, same slot)', () => {
    const tc = buildTouchControls(() => {})
    expect(labels(tc.element)).toContain('물약(q)')   // q = quaff in play
    ;(tc.element.querySelector('.tc-shift') as HTMLButtonElement).click()
    const l = labels(tc.element)
    expect(l).toContain('화살집(Q)')     // Shift+q → Q = quiver (in q's slot)
    expect(l).toContain('능력·변이(A)')  // Shift+a → A = abilities/mutations
    expect(l).not.toContain('물약(q)')   // q's slot is now 화살집
  })

  it('relabels in place under Ctrl (f → 지형찾기)', () => {
    const tc = buildTouchControls(() => {})
    ;(tc.element.querySelector('.tc-ctrl') as HTMLButtonElement).click()
    const l = labels(tc.element)
    expect(l).toContain('지형찾기(^F)')  // Ctrl+f → ^F = find feature
    expect(l).not.toContain('물약(q)')   // Ctrl+q is a dead key → empty slot
  })

  it('backfills dead Ctrl slots with the exit/save commands', () => {
    const tc = buildTouchControls(() => {})
    ;(tc.element.querySelector('.tc-ctrl') as HTMLButtonElement).click()
    const l = labels(tc.element)
    expect(l).toContain('저장/종료') // Ctrl+X
    expect(l).toContain('저장')      // Ctrl+S
    expect(l).toContain('포기')      // Ctrl+Q
  })

  it('sends the raw control keycode when a backfilled slot is tapped', () => {
    const sent: unknown[] = []
    const tc = buildTouchControls(m => sent.push(m))
    ;(tc.element.querySelector('.tc-ctrl') as HTMLButtonElement).click()
    const save = [...tc.element.querySelectorAll('.tc-content .tc-btn')]
      .find(b => b.textContent === '저장/종료') as HTMLButtonElement
    save.click()
    expect(sent).toContainEqual({ msg: 'key', keycode: 'X'.charCodeAt(0) - 64 }) // ^X = 24
  })

  it('swaps to menu meta-keys (페이지 / !) in menu mode', () => {
    const tc = buildTouchControls(() => {})
    expect(labels(tc.element)).toContain('물약(q)')      // a play action
    expect(labels(tc.element)).not.toContain('페이지(⇥)')
    tc.setMenuMode(true)
    expect(labels(tc.element)).toContain('페이지(⇥)')   // Tab = page in a menu
    expect(labels(tc.element)).toContain('!')           // describe/toggle button (unnamed key)
    expect(labels(tc.element)).not.toContain('물약(q)')
    tc.setMenuMode(false)
    expect(labels(tc.element)).toContain('물약(q)')
    expect(labels(tc.element)).not.toContain('!')
  })

  it('named buttons get the "named" class for text styling', () => {
    const tc = buildTouchControls(() => {})
    const skills = [...tc.element.querySelectorAll('.tc-content .tc-btn')]
      .find(b => b.textContent === '기술(m)')!
    expect(skills.classList.contains('named')).toBe(true)
  })

  it('still sends the original key when a semantic button is tapped', () => {
    const sent: unknown[] = []
    const tc = buildTouchControls(m => sent.push(m))
    const skills = [...tc.element.querySelectorAll('.tc-content .tc-btn')]
      .find(b => b.textContent === '기술(m)') as HTMLButtonElement
    skills.click()
    expect(sent).toContainEqual({ msg: 'input', text: 'm' })
  })
})

describe('keyboard numpad layer', () => {
  function kbdKeys(root: HTMLElement): string[] {
    return [...root.querySelectorAll('.kbd-key')].map(b => b.textContent ?? '')
  }

  it('openKbd({numpad}) shows digits, no letters', () => {
    const tc = buildTouchControls(() => {})
    tc.openKbd({ numpad: true })
    const keys = kbdKeys(tc.element)
    for (const d of ['0', '1', '5', '9']) expect(keys).toContain(d)
    expect(keys).not.toContain('q')  // numpad layer has no letter keys
    expect(keys).toContain('ABC')    // …but can switch to them
  })

  it('plain openKbd() still opens the letter layer', () => {
    const tc = buildTouchControls(() => {})
    tc.openKbd()
    expect(kbdKeys(tc.element)).toContain('q')
  })

  it('a numpad digit sends its keystroke when no input is focused', () => {
    const sent: unknown[] = []
    const tc = buildTouchControls(m => sent.push(m))
    tc.openKbd({ numpad: true })
    const seven = [...tc.element.querySelectorAll('.kbd-key')]
      .find(b => b.textContent === '7') as HTMLButtonElement
    seven.click()
    expect(sent).toContainEqual({ msg: 'input', text: '7' })
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
    expect(texts).toContain('Skills(m)')
    expect(texts).not.toContain('기술(m)')
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
