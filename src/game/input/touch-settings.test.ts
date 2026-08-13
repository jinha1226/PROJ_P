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
    // d-pad is on by default, so one toggle turns it off.
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"dpadEnabled":false')
    expect(rebuilds).toBe(1)
  })
})

describe('layout settings rows', () => {
  it('has dpad side/size rows and an edit-mode row', () => {
    const tc = buildTouchControls(() => {})
    ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
    expect(tc.element.querySelector('.tc-set-dpad-side')).not.toBeNull()
    expect(tc.element.querySelector('.tc-set-dpad-size')).not.toBeNull()
    expect(tc.element.querySelector('.tc-set-edit')).not.toBeNull()
  })

  it('side toggle persists and requests a rebuild', () => {
    let rebuilds = 0
    const tc = buildTouchControls(() => {}, { onRequestRebuild: () => { rebuilds++ } })
    ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
    ;(tc.element.querySelector('.tc-set-dpad-side') as HTMLButtonElement).click()
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"side":"right"')
    expect(rebuilds).toBe(1)
  })

  it('size cycles sm → md → lg → sm and persists', () => {
    let rebuilds = 0
    const tc = buildTouchControls(() => {}, { onRequestRebuild: () => { rebuilds++ } })
    ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
    const btn = tc.element.querySelector('.tc-set-dpad-size') as HTMLButtonElement
    btn.click() // sm → md (default is sm)
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"size":"md"')
    btn.click() // md → lg
    expect(localStorage.getItem('pocketzot:prefs')).toContain('"size":"lg"')
    expect(rebuilds).toBe(2)
  })

  it('edit row closes the settings overlay and enters edit mode', () => {
    const tc = buildTouchControls(() => {})
    ;(tc.element.querySelector('.tc-settings') as HTMLButtonElement).click()
    ;(tc.element.querySelector('.tc-set-edit') as HTMLButtonElement).click()
    const overlay = tc.element.querySelector('.tc-settings-overlay') as HTMLElement
    expect(overlay.style.display).toBe('none')
    expect(tc.element.classList.contains('tc-editing')).toBe(true)
  })
})
