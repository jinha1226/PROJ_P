// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { buildTouchControls } from './touch'
import { defaultLayout } from './touch-catalog'

beforeEach(() => { localStorage.clear() })

function saveLayout(mut: (l: ReturnType<typeof defaultLayout>) => void): void {
  const l = defaultLayout()
  mut(l)
  localStorage.setItem('pocketzot:prefs', JSON.stringify({ touchLayout: l }))
}

describe('custom layout rendering', () => {
  it('renders a replaced slot and a raw slot, and compacts an empty slot away', () => {
    saveLayout(l => {
      l.tabs.micro[0][0] = { cmd: 'wield' } // replace the default Use button
      l.tabs.micro[0][1] = { raw: '&' }
      l.tabs.micro[0][2] = null                // clear the rest slot
    })
    const tc = buildTouchControls(() => {})
    const strip = tc.element.querySelector('.tc-strip')!
    const cells = strip.querySelectorAll('.tc-btn')
    expect(cells[0].textContent).toContain('(w)')
    expect(cells[1].textContent).toBe('&')
    // Outside edit mode the cleared slot leaves no gap: the next button
    // (pickup, slot 3) moves up and no spacer is rendered.
    expect(cells[2].textContent).toContain('(,)')
    expect(strip.querySelector('.tc-btn-spacer')).toBeNull()
    expect(cells.length).toBe(7)
  })

  it('narrows the grid to fit the remaining buttons in the reserved rows', () => {
    // 6 of 8 slots kept over 2 rows → 3 columns; buttons get wider.
    saveLayout(l => { l.tabs.micro[0][3] = null; l.tabs.micro[1][3] = null })
    const tc = buildTouchControls(() => {})
    const strip = tc.element.querySelector<HTMLElement>('.tc-strip')!
    expect(strip.style.getPropertyValue('--tc-cols')).toBe('3')
    expect(strip.querySelectorAll('.tc-btn').length).toBe(6)
  })

  it('keeps four columns for a full grid and never exceeds four', () => {
    const tc = buildTouchControls(() => {})
    const strip = tc.element.querySelector<HTMLElement>('.tc-strip')!
    expect(strip.style.getPropertyValue('--tc-cols')).toBe('4')
  })

  it('renders a custom row count', () => {
    saveLayout(l => { l.tabs.micro = [l.tabs.micro[0]] })
    const tc = buildTouchControls(() => {})
    expect(tc.element.querySelectorAll('.tc-strip .tc-btn').length).toBe(4)
  })

  it('applies dpad side and size', () => {
    saveLayout(l => { l.dpad = { side: 'right', size: 'lg' } })
    const tc = buildTouchControls(() => {})
    expect(tc.element.classList.contains('dpad-right')).toBe(true)
    expect(tc.element.style.getPropertyValue('--tc-dpad')).toBe('2.2rem')
  })

  it('defaults stay identical with no stored layout', () => {
    const tc = buildTouchControls(() => {})
    expect(tc.element.classList.contains('dpad-right')).toBe(false)
    const cells = tc.element.querySelectorAll('.tc-strip .tc-btn')
    expect(cells.length).toBe(8)  // 행동 tab is now 2 rows of 4
  })
})
