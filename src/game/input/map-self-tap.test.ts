import { describe, expect, it } from 'vitest'
import { selfTapKey } from './map-self-tap'

const cell = (f: number) => ({ g: '@', col: 15, f })

describe('self tap', () => {
  it.each([46, 47, 48, 49, 60, 62, 67, 87, 88, 93, 102, 134, 149, 158, 159, 175, 194, 198, 201])(
    'ascends up stairs, branch exits and portal exits (f=%s)', f => {
      expect(selfTapKey(cell(f))).toBe('<')
    },
  )
  it.each([37, 40, 42, 43, 44, 45, 50, 53, 54, 55, 57, 58, 59, 61, 63, 64, 66,
    70, 71, 76, 85, 132, 135, 138, 139, 148, 171, 174, 193])(
    'uses down stairs, shops, portals and transporters (f=%s)', f => {
      expect(selfTapKey(cell(f))).toBe('>')
    },
  )
  it.each([103, 104, 108, 111, 121, 160, 161, 162, 165, 166, 167, 168, 170, 195])(
    'interacts with an altar before picking up its items (f=%s)', f => {
      expect(selfTapKey({ ...cell(f), mf: 6 })).toBe('>')
    },
  )
  it.each([40, 42, 46, 60, 138, 171])('prioritizes terrain over items (f=%s)', f => {
    expect(selfTapKey({ ...cell(f), mf: 6 })).toBe(selfTapKey(cell(f)))
  })
  it.each([0, 19, 33, 41, 56, 68, 122, 123, 124, 128, 130, 131, 172, 203, 207, 255])(
    'does not guess an interaction on non-interactive or unknown terrain (f=%s)', f => {
      expect(selfTapKey({ ...cell(f), mf: 15 })).toBe(',')
    },
  )
  it('delegates pickup to the engine even when the player hides the item marker', () => {
    expect(selfTapKey({ ...cell(33), mf: 6 })).toBe(',')
    expect(selfTapKey({ ...cell(33), fg: 0 })).toBe(',')
    expect(selfTapKey({ ...cell(122), mf: 15, fg: 531768 })).toBe(',')
    expect(selfTapKey({ g: '@', col: 15 })).toBe(',')
    expect(selfTapKey(undefined)).toBeNull()
  })
})
