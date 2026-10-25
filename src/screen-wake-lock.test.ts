// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeStorage } from './test/fake-storage'
import { setPref } from './prefs'
import {
  getScreenWakeLockStatus, initScreenWakeLock, SCREEN_WAKE_LOCK_STATUS_EVENT,
} from './screen-wake-lock'

class Sentinel extends EventTarget {
  released = false
  release = vi.fn(async () => {
    if (this.released) return
    this.released = true
    this.dispatchEvent(new Event('release'))
  })
}

let request: ReturnType<typeof vi.fn>
let locks: Sentinel[]
let stop: (() => void) | undefined
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }
function visibility(value: 'visible' | 'hidden'): void {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(value)
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
  locks = []
  request = vi.fn(async () => {
    const lock = new Sentinel()
    locks.push(lock)
    return lock
  })
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
  visibility('visible')
})

afterEach(() => {
  stop?.()
  stop = undefined
  delete (navigator as unknown as { wakeLock?: unknown }).wakeLock
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('screen wake lock', () => {
  it('defaults to Off without requesting a lock', () => {
    stop = initScreenWakeLock()
    expect(request).not.toHaveBeenCalled()
    expect(getScreenWakeLockStatus()).toBe('off')
  })

  it('acquires on enabling, then releases on disabling', async () => {
    stop = initScreenWakeLock()
    setPref('keepScreenAwake', true)
    expect(getScreenWakeLockStatus()).toBe('pending')
    await flush()
    expect(request).toHaveBeenCalledExactlyOnceWith('screen')
    expect(getScreenWakeLockStatus()).toBe('active')
    setPref('keepScreenAwake', false)
    expect(locks[0].release).toHaveBeenCalledOnce()
    expect(getScreenWakeLockStatus()).toBe('off')
  })

  it('restores an enabled preference on page startup', async () => {
    setPref('keepScreenAwake', true)
    stop = initScreenWakeLock()
    await flush()
    expect(request).toHaveBeenCalledOnce()
    expect(getScreenWakeLockStatus()).toBe('active')
  })

  it('releases when hidden and reacquires on returning, without duplicates', async () => {
    setPref('keepScreenAwake', true)
    stop = initScreenWakeLock()
    await flush()
    visibility('hidden')
    expect(locks[0].released).toBe(true)
    expect(getScreenWakeLockStatus()).toBe('paused')
    visibility('visible')
    visibility('visible')
    await flush()
    expect(request).toHaveBeenCalledTimes(2)
    expect(getScreenWakeLockStatus()).toBe('active')
    visibility('visible')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('does not acquire on a hidden-page startup', async () => {
    setPref('keepScreenAwake', true)
    visibility('hidden')
    stop = initScreenWakeLock()
    await flush()
    expect(request).not.toHaveBeenCalled()
    visibility('visible')
    await flush()
    expect(getScreenWakeLockStatus()).toBe('active')
  })

  it('releases for pagehide and restores after a bfcache pageshow', async () => {
    setPref('keepScreenAwake', true)
    stop = initScreenWakeLock()
    await flush()
    window.dispatchEvent(new Event('pagehide'))
    expect(locks[0].released).toBe(true)
    window.dispatchEvent(new Event('pageshow'))
    await flush()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('releases a late response if turned off while the request is pending', async () => {
    const lock = new Sentinel()
    let resolve!: (value: Sentinel) => void
    request.mockReturnValueOnce(new Promise<Sentinel>(r => { resolve = r }))
    setPref('keepScreenAwake', true)
    stop = initScreenWakeLock()
    setPref('keepScreenAwake', false)
    resolve(lock)
    await flush()
    expect(lock.released).toBe(true)
    expect(getScreenWakeLockStatus()).toBe('off')
  })

  it('retries once after a visibility change races with a pending rejection', async () => {
    let reject!: (error: Error) => void
    request.mockReturnValueOnce(new Promise<Sentinel>((_resolve, r) => { reject = r }))
    setPref('keepScreenAwake', true)
    stop = initScreenWakeLock()
    visibility('hidden')
    visibility('visible')
    expect(request).toHaveBeenCalledOnce()
    reject(new Error('Document was hidden'))
    await flush()
    expect(request).toHaveBeenCalledTimes(2)
    expect(getScreenWakeLockStatus()).toBe('active')
  })

  it('does not leave a lock held when hidden before a pending response', async () => {
    const lock = new Sentinel()
    let resolve!: (value: Sentinel) => void
    request.mockReturnValueOnce(new Promise<Sentinel>(r => { resolve = r }))
    setPref('keepScreenAwake', true)
    stop = initScreenWakeLock()
    visibility('hidden')
    resolve(lock)
    await flush()
    expect(lock.released).toBe(true)
    expect(getScreenWakeLockStatus()).toBe('paused')
    expect(request).toHaveBeenCalledOnce()
  })

  it('shows policy rejection without a request loop, and can retry after Off/On', async () => {
    request.mockRejectedValueOnce(new Error('Power saving'))
    setPref('keepScreenAwake', true)
    stop = initScreenWakeLock()
    await flush()
    expect(getScreenWakeLockStatus()).toBe('blocked')
    expect(request).toHaveBeenCalledOnce()
    setPref('keepScreenAwake', false)
    setPref('keepScreenAwake', true)
    await flush()
    expect(getScreenWakeLockStatus()).toBe('active')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('reports a system release without immediately reacquiring it', async () => {
    setPref('keepScreenAwake', true)
    stop = initScreenWakeLock()
    await flush()
    await locks[0].release()
    await flush()
    expect(getScreenWakeLockStatus()).toBe('blocked')
    expect(request).toHaveBeenCalledOnce()
    visibility('hidden')
    visibility('visible')
    await flush()
    expect(getScreenWakeLockStatus()).toBe('active')
  })

  it('handles unsupported browsers without throwing', () => {
    delete (navigator as unknown as { wakeLock?: unknown }).wakeLock
    setPref('keepScreenAwake', true)
    stop = initScreenWakeLock()
    expect(getScreenWakeLockStatus()).toBe('unsupported')
  })

  it('cleans up listeners and a late acquisition on disposal', async () => {
    const lock = new Sentinel()
    let resolve!: (value: Sentinel) => void
    request.mockReturnValueOnce(new Promise<Sentinel>(r => { resolve = r }))
    setPref('keepScreenAwake', true)
    stop = initScreenWakeLock()
    stop()
    resolve(lock)
    await flush()
    expect(lock.released).toBe(true)
    visibility('visible')
    expect(request).toHaveBeenCalledOnce()
    expect(getScreenWakeLockStatus()).toBe('off')
  })

  it('publishes active-state changes for an open Settings view', async () => {
    const changed = vi.fn()
    window.addEventListener(SCREEN_WAKE_LOCK_STATUS_EVENT, changed)
    try {
      stop = initScreenWakeLock()
      setPref('keepScreenAwake', true)
      await flush()
      expect(changed).toHaveBeenCalledTimes(2)
      await locks[0].release()
      expect(changed).toHaveBeenCalledTimes(3)
    } finally {
      window.removeEventListener(SCREEN_WAKE_LOCK_STATUS_EVENT, changed)
    }
  })
})
