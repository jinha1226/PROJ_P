// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { buildTouchControls } from './touch'

beforeEach(() => { localStorage.clear() })

describe('settings panel', () => {
  it('has a gear button and no standalone lang button', () => {
    const tc = buildTouchControls(() => {})
    expect(tc.element.querySelector('.tc-settings')).not.toBeNull()
    expect(tc.element.querySelector('.tc-lang')).toBeNull()
  })

  it('gear opens the settings overlay with language + d-pad toggles', () => {
    const tc = buildTouchControls(() => {})
    const gear = tc.element.querySelector('.tc-settings') as HTMLButtonElement
    gear.click()
    const overlay = tc.element.querySelector('.tc-settings-overlay') as HTMLElement
    expect(overlay).not.toBeNull()
    expect(overlay.style.display).not.toBe('none')
    expect(overlay.querySelector('.tc-set-lang')).not.toBeNull()
    expect(overlay.querySelector('.tc-set-dpad')).not.toBeNull()
  })

  it('d-pad toggle persists the pref and requests a rebuild', () => {
    let rebuilds = 0
    const tc = buildTouchControls(() => {}, { onRequestRebuild: () => { rebuilds++ } })
    ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
    ;(tc.element.querySelector('.tc-set-dpad') as HTMLButtonElement).click()
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"dpadEnabled":true')
    expect(rebuilds).toBe(1)
  })
})
