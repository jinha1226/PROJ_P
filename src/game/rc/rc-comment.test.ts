import { describe, it, expect } from 'vitest'
import { getRcComment, setRcComment, getRcOption } from './rc-options'

describe('managed pocketzot comment lines', () => {
  it('round-trips a value', () => {
    const out = setRcComment('hp_warning = 50\n', 'layout', 'AAAA')
    expect(out).toContain('# pocketzot:layout AAAA')
    expect(getRcComment(out, 'layout')).toBe('AAAA')
    expect(getRcOption(out, 'hp_warning')).toBe('50') // options untouched
  })

  it('replaces an existing line instead of appending a second', () => {
    let text = setRcComment('', 'layout', 'AAAA')
    text = setRcComment(text, 'layout', 'BBBB')
    expect(text.match(/pocketzot:layout/g)?.length).toBe(1)
    expect(getRcComment(text, 'layout')).toBe('BBBB')
  })

  it('removes the line when value is null', () => {
    const text = setRcComment('a = 1\n', 'layout', 'AAAA')
    const out = setRcComment(text, 'layout', null)
    expect(out).not.toContain('pocketzot:layout')
    expect(getRcOption(out, 'a')).toBe('1')
  })

  it('returns null when absent and ignores ordinary comments', () => {
    expect(getRcComment('# just a note\nx = 1\n', 'layout')).toBeNull()
  })

  it('does not collide across keys', () => {
    let text = setRcComment('', 'layout', 'AAAA')
    text = setRcComment(text, 'other', 'ZZZZ')
    expect(getRcComment(text, 'layout')).toBe('AAAA')
    expect(getRcComment(text, 'other')).toBe('ZZZZ')
  })
})
