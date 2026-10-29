// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeStorage } from './test/fake-storage'

vi.stubGlobal('localStorage', fakeStorage())

import { getPref, setPref, KEEP_SCREEN_AWAKE_CHANGED_EVENT } from './prefs'

const KEY = 'pocketzot:prefs'

beforeEach(() => {
  localStorage.clear()
})

describe('prefs defaults', () => {
  it('serves defaults on an empty store', () => {
    expect(getPref('movementMode')).toBe('touch')
    expect(getPref('spdLayout')).toBe(true)
    expect(getPref('keepScreenAwake')).toBe(false)
    expect(getPref('monsterListMode')).toBe('full')
    expect(getPref('loginSprites')).toBe(true)
    expect(getPref('loginOnlineOpen')).toBeNull()
    expect(getPref('loginOfflineOpen')).toBeNull()
  })

  it('keeps an explicit Keypad choice over the Touch default', () => {
    localStorage.setItem(KEY, JSON.stringify({ mapRenderMode: 'tiles' }))
    expect(getPref('movementMode')).toBe('touch')
    setPref('movementMode', 'keypad')
    setPref('loginSprites', false)
    expect(getPref('movementMode')).toBe('keypad')
  })
})

describe('screen wake lock preference', () => {
  it('persists the choice and emits only real changes', () => {
    const changed = vi.fn()
    window.addEventListener(KEEP_SCREEN_AWAKE_CHANGED_EVENT, changed)
    try {
      setPref('keepScreenAwake', true)
      expect(getPref('keepScreenAwake')).toBe(true)
      expect(JSON.parse(localStorage.getItem(KEY)!).keepScreenAwake).toBe(true)
      setPref('keepScreenAwake', true)
      expect(changed).toHaveBeenCalledOnce()
      setPref('keepScreenAwake', false)
      expect(changed).toHaveBeenCalledTimes(2)
    } finally {
      window.removeEventListener(KEEP_SCREEN_AWAKE_CHANGED_EVENT, changed)
    }
  })
})

describe('monsterListCollapsed → monsterListMode migration', () => {
  it('maps the stored collapsed=true boolean to collapsed', () => {
    localStorage.setItem(KEY, JSON.stringify({ monsterListCollapsed: true }))
    expect(getPref('monsterListMode')).toBe('collapsed')
  })

  it('maps the stored collapsed=false boolean to full', () => {
    localStorage.setItem(KEY, JSON.stringify({ monsterListCollapsed: false }))
    expect(getPref('monsterListMode')).toBe('full')
  })

  it('never overrides an explicit monsterListMode with the stale boolean', () => {
    localStorage.setItem(KEY,
      JSON.stringify({ monsterListCollapsed: true, monsterListMode: 'full' }))
    expect(getPref('monsterListMode')).toBe('full')
  })

  it('survives a later write to an unrelated pref', () => {
    localStorage.setItem(KEY, JSON.stringify({ monsterListCollapsed: true }))
    setPref('loginSprites', false)
    expect(getPref('monsterListMode')).toBe('collapsed')
    expect(getPref('loginSprites')).toBe(false)
  })
})
