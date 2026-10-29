// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { relabel, tr, trText, trTitle } from './spd-i18n'

describe('spd chrome language', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('speaks Korean on a Korean device', () => {
    vi.stubGlobal('navigator', { language: 'ko-KR' })
    expect(tr('Bag')).toBe('가방')
    expect(tr('Pick up')).toBe('줍기')
    expect(tr('no such label')).toBe('no such label')
  })

  it('relabels marked elements after a language change', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    const root = document.createElement('div')
    const b = trTitle(document.createElement('button'), 'Backpack')
    b.appendChild(trText(document.createElement('span'), 'Bag'))
    root.appendChild(b)
    expect(b.textContent).toBe('Bag')
    vi.stubGlobal('navigator', { language: 'ko-KR' })
    relabel(root)
    expect(b.textContent).toBe('가방')
    expect(b.title).toBe('배낭')
  })

  it('stays English elsewhere', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    expect(tr('Bag')).toBe('Bag')
  })
})
