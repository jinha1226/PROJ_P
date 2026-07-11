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
  it('renders a replaced slot, a raw slot, and an empty slot', () => {
    saveLayout(l => {
      l.tabs.micro[0][0] = { cmd: 'evoke' }   // default was quaff
      l.tabs.micro[0][1] = { raw: '&' }
      l.tabs.micro[0][2] = null                // default was inventory
    })
    const tc = buildTouchControls(() => {})
    const strip = tc.element.querySelector('.tc-strip')!
    const cells = strip.querySelectorAll('.tc-btn')
    expect(cells[0].textContent).toContain('(v)')          // 발동(v)/Evoke(v)
    expect(cells[1].textContent).toBe('&')
    expect(cells[2].classList.contains('tc-btn-spacer')).toBe(true)
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
    expect(tc.element.style.getPropertyValue('--tc-dpad')).toBe('3rem')
  })

  it('defaults stay identical with no stored layout', () => {
    const tc = buildTouchControls(() => {})
    expect(tc.element.classList.contains('dpad-right')).toBe(false)
    const cells = tc.element.querySelectorAll('.tc-strip .tc-btn')
    expect(cells.length).toBe(12)
  })
})
