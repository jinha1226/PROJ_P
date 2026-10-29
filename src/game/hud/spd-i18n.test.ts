import { afterEach, describe, expect, it, vi } from 'vitest'
import { tr } from './spd-i18n'

describe('spd chrome language', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('speaks Korean on a Korean device', () => {
    vi.stubGlobal('navigator', { language: 'ko-KR' })
    expect(tr('Bag')).toBe('가방')
    expect(tr('Pick up')).toBe('줍기')
    expect(tr('no such label')).toBe('no such label')
  })

  it('stays English elsewhere', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    expect(tr('Bag')).toBe('Bag')
  })
})
