// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { createCoachHint } from './coach-hint'

describe('coach hint banner', () => {
  it('is hidden initially', () => {
    const h = createCoachHint()
    expect(h.element.style.display).toBe('none')
  })
  it('show() displays the localized text for the hint id', () => {
    const h = createCoachHint()
    h.show('nasty_monster', 'ko')
    expect(h.element.style.display).not.toBe('none')
    expect(h.element.textContent).toContain('적')
    h.show('nasty_monster', 'en')
    expect(h.element.textContent?.toLowerCase()).toContain('enemy')
  })
  it('hide() hides it', () => {
    const h = createCoachHint()
    h.show('poison_lethal', 'ko')
    h.hide()
    expect(h.element.style.display).toBe('none')
  })
  it('dismiss button hides and fires onDismiss with the current hint id', () => {
    const h = createCoachHint()
    let dismissed: string | null = null
    h.onDismiss((id) => { dismissed = id })
    h.show('nasty_monster', 'en')
    ;(h.element.querySelector('.coach-dismiss') as HTMLButtonElement).click()
    expect(dismissed).toBe('nasty_monster')
    expect(h.element.style.display).toBe('none')
  })
})
