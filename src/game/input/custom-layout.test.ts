import { describe, it, expect } from 'vitest'
import { validateLayout, encodeLayout, decodeLayout, planLayoutSync, type TouchLayout } from './custom-layout'

const known = (id: string): boolean => id === 'quaff' || id === 'fire'

function goodLayout(): TouchLayout {
  return {
    v: 1,
    dpad: { side: 'left', size: 'md' },
    tabs: {
      micro: [[{ cmd: 'quaff' }, { raw: 'x' }, null, { cmd: 'fire' }]],
      macro: [[null, null, null, null]],
    },
  }
}

describe('validateLayout', () => {
  it('accepts a well-formed layout', () => {
    expect(validateLayout(goodLayout(), known)).toEqual(goodLayout())
  })

  it('rejects garbage, wrong version, and bad dpad values', () => {
    expect(validateLayout(null, known)).toBeNull()
    expect(validateLayout({ ...goodLayout(), v: 2 }, known)).toBeNull()
    expect(validateLayout({ ...goodLayout(), dpad: { side: 'up', size: 'md' } }, known)).toBeNull()
    expect(validateLayout({ ...goodLayout(), dpad: { side: 'left', size: 'xl' } }, known)).toBeNull()
  })

  it('rejects row counts outside 1–4 and rows not exactly 4 wide', () => {
    const l = goodLayout()
    l.tabs.micro = []
    expect(validateLayout(l, known)).toBeNull()
    const l2 = goodLayout()
    l2.tabs.macro = [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]]
    expect(validateLayout(l2, known)).toBeNull()
    const l3 = goodLayout()
    l3.tabs.micro = [[null, null, null]]
    expect(validateLayout(l3, known)).toBeNull()
  })

  it('degrades an unknown cmd to an empty slot, not a rejection', () => {
    const l = goodLayout()
    l.tabs.micro[0][0] = { cmd: 'no-such' }
    const out = validateLayout(l, known)
    expect(out).not.toBeNull()
    expect(out!.tabs.micro[0][0]).toBeNull()
  })

  it('rejects raw slots that are not one printable ASCII char', () => {
    const bad = (raw: string): unknown => {
      const l = goodLayout()
      l.tabs.micro[0][1] = { raw }
      return l
    }
    expect(validateLayout(bad(''), known)).toBeNull()
    expect(validateLayout(bad('ab'), known)).toBeNull()
    expect(validateLayout(bad('한'), known)).toBeNull()
    expect(validateLayout(bad('~'), known)).not.toBeNull()
  })
})

describe('encode/decode round-trip', () => {
  it('round-trips through base64', () => {
    const b64 = encodeLayout(goodLayout())
    expect(b64).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(decodeLayout(b64, known)).toEqual(goodLayout())
  })

  it('returns null on corrupt base64 or non-layout JSON', () => {
    expect(decodeLayout('%%%', known)).toBeNull()
    expect(decodeLayout(btoa('{"v":9}'), known)).toBeNull()
  })
})

describe('planLayoutSync', () => {
  it('backs up when local exists and differs from remote', () => {
    expect(planLayoutSync(goodLayout(), null)).toBe('backup')
    const remote = goodLayout()
    remote.dpad.side = 'right'
    expect(planLayoutSync(goodLayout(), remote)).toBe('backup')
  })

  it('restores when local is empty and remote exists', () => {
    expect(planLayoutSync(null, goodLayout())).toBe('restore')
  })

  it('does nothing when both empty or identical', () => {
    expect(planLayoutSync(null, null)).toBe('none')
    expect(planLayoutSync(goodLayout(), goodLayout())).toBe('none')
  })
})
