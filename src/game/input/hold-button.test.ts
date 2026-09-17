// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { bindHold } from './hold-button'

describe('momentary overview button', () => {
  for (const finish of ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture']) {
    it(`restores once on ${finish} and ignores the following click`, () => {
      const b = document.createElement('button'), start = vi.fn(() => true), end = vi.fn()
      const hold = bindHold(b, { start, end })
      b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0 }))
      b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, button: 0 }))
      expect(start).toHaveBeenCalledOnce()
      b.dispatchEvent(new PointerEvent(finish, { pointerId: 1 }))
      b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 })); b.click()
      expect(end).toHaveBeenCalledOnce(); expect(b.getAttribute('aria-pressed')).toBe('false')
      hold.dispose()
    })
  }
  it('restores on app blur and cleanup, including a keyboard hold', () => {
    const b = document.createElement('button'), end = vi.fn()
    const hold = bindHold(b, { start: () => true, end })
    b.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    window.dispatchEvent(new Event('blur'))
    expect(end).toHaveBeenCalledOnce()
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    hold.dispose(); expect(end).toHaveBeenCalledTimes(2)
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(b.getAttribute('aria-pressed')).toBe('false')
  })
})
