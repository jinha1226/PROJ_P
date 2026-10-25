// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeStorage } from '../test/fake-storage'
import { openSettings } from './settings-view'
import { getPref, setPref } from '../prefs'
import { initScreenWakeLock } from '../screen-wake-lock'

let active: Element | null
let request: ReturnType<typeof vi.fn>
let exit: ReturnType<typeof vi.fn>
let wakeRequest: ReturnType<typeof vi.fn>
let release: ReturnType<typeof vi.fn>
let stopWakeLock: () => void
let mode: string

const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }
const fullscreenButton = () => document.querySelector<HTMLButtonElement>('.settings-fullscreen-btn')!
const wakeSwitch = () => document.querySelector<HTMLInputElement>('.settings-wake-lock')!
const wakeStatus = () => document.querySelector<HTMLElement>('.settings-wake-status')!
function setFullscreen(element: Element | null): void {
  active = element
  mode = element ? 'fullscreen' : 'browser'
  document.dispatchEvent(new Event('fullscreenchange'))
}
function closeSettings(): void {
  document.querySelector<HTMLButtonElement>('.settings-card .doc-close')?.click()
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
  active = null
  mode = 'browser'
  const matchMedia = window.matchMedia.bind(window)
  vi.spyOn(window, 'matchMedia').mockImplementation(query => {
    const result = matchMedia(query)
    if (query.includes('display-mode')) Object.defineProperty(result, 'matches', {
      value: query.includes(`(display-mode: ${mode})`),
    })
    return result
  })
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  request = vi.fn(async () => setFullscreen(document.documentElement))
  exit = vi.fn(async () => setFullscreen(null))
  Object.defineProperties(document, {
    fullscreenElement: { configurable: true, get: () => active },
    fullscreenEnabled: { configurable: true, value: true },
    exitFullscreen: { configurable: true, value: exit },
  })
  Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: request })
  release = vi.fn(async () => {})
  wakeRequest = vi.fn(async () => Object.assign(new EventTarget(), { released: false, release }))
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: wakeRequest } })
  stopWakeLock = initScreenWakeLock()
})

afterEach(() => {
  closeSettings()
  stopWakeLock()
  document.body.innerHTML = ''
  for (const key of ['fullscreenElement', 'fullscreenEnabled', 'exitFullscreen']) {
    Reflect.deleteProperty(document, key)
  }
  Reflect.deleteProperty(document.documentElement, 'requestFullscreen')
  Reflect.deleteProperty(navigator, 'standalone')
  Reflect.deleteProperty(navigator, 'wakeLock')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Settings fullscreen button', () => {
  it('is the last command in Settings when running in a browser tab', () => {
    openSettings()
    const buttons = document.querySelectorAll('.settings-body button')
    expect(buttons[buttons.length - 1]).toBe(fullscreenButton())
    expect(fullscreenButton().textContent).toBe('Use Fullscreen')
    expect(fullscreenButton().disabled).toBe(false)
  })

  it('enters fullscreen on the document root, then exits on the next click', async () => {
    openSettings()
    fullscreenButton().click()
    await flush()
    expect(request).toHaveBeenCalledExactlyOnceWith({ navigationUI: 'hide' })
    expect(active).toBe(document.documentElement)
    expect(fullscreenButton().textContent).toBe('Exit Fullscreen')
    fullscreenButton().click()
    await flush()
    expect(exit).toHaveBeenCalledOnce()
    expect(active).toBeNull()
    expect(fullscreenButton().textContent).toBe('Use Fullscreen')
  })

  it('updates after a browser-initiated fullscreen exit', async () => {
    openSettings()
    fullscreenButton().click()
    await flush()
    setFullscreen(null)
    expect(fullscreenButton().textContent).toBe('Use Fullscreen')
  })

  it('keeps Exit available on reopening Settings in API fullscreen', async () => {
    openSettings()
    fullscreenButton().click()
    await flush()
    closeSettings()
    expect(exit).not.toHaveBeenCalled()
    openSettings()
    expect(fullscreenButton().textContent).toBe('Exit Fullscreen')
    expect(fullscreenButton().disabled).toBe(false)
  })

  it.each(['standalone', 'minimal-ui', 'fullscreen'])('hides the button in installed %s mode', displayMode => {
    mode = displayMode
    openSettings()
    expect(fullscreenButton()).toBeNull()
    expect(wakeSwitch()).not.toBeNull()
  })

  it('recognises the legacy iOS standalone flag', () => {
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
    openSettings()
    expect(fullscreenButton()).toBeNull()
  })

  it('disables unsupported fullscreen with a reason', () => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false })
    openSettings()
    expect(fullscreenButton().disabled).toBe(true)
    expect(fullscreenButton().title).toContain('not supported')
    fullscreenButton().click()
    expect(request).not.toHaveBeenCalled()
  })

  it('reports rejected entry and leaves the control usable', async () => {
    request.mockRejectedValueOnce(new Error('Not allowed'))
    openSettings()
    fullscreenButton().click()
    await flush()
    const error = document.querySelector<HTMLElement>('.settings-body [role="alert"]')!
    expect(error.hidden).toBe(false)
    expect(error.textContent).toBe('Could not enter fullscreen.')
    expect(fullscreenButton().disabled).toBe(false)
    fullscreenButton().click()
    await flush()
    expect(error.hidden).toBe(true)
    expect(fullscreenButton().textContent).toBe('Exit Fullscreen')
  })

  it('reports an exit failure without falsely showing Use Fullscreen', async () => {
    setFullscreen(document.documentElement)
    exit.mockRejectedValueOnce(new Error('Exit failed'))
    openSettings()
    fullscreenButton().click()
    await flush()
    expect(fullscreenButton().textContent).toBe('Exit Fullscreen')
    expect(document.querySelector('.settings-body [role="alert"]')?.textContent).toBe('Could not exit fullscreen.')
  })

  it('ignores repeat clicks while a request is pending', async () => {
    let resolve!: () => void
    request.mockImplementationOnce(() => new Promise<void>(r => { resolve = r }))
    openSettings()
    fullscreenButton().click()
    fullscreenButton().click()
    expect(request).toHaveBeenCalledOnce()
    expect(fullscreenButton().disabled).toBe(true)
    setFullscreen(document.documentElement)
    resolve()
    await flush()
    expect(fullscreenButton().disabled).toBe(false)
  })

  it('removes its document listener when Settings closes', () => {
    openSettings()
    const previous = fullscreenButton()
    closeSettings()
    setFullscreen(document.documentElement)
    expect(previous.textContent).toBe('Use Fullscreen')
  })
})

describe('Settings screen wake lock', () => {
  it('shows Off by default, persists On, and reports Active after acquisition', async () => {
    openSettings()
    expect(wakeSwitch().checked).toBe(false)
    expect(document.querySelector('.settings-wake-state')?.textContent).toBe('Off')
    wakeSwitch().click()
    await flush()
    expect(getPref('keepScreenAwake')).toBe(true)
    expect(wakeSwitch().checked).toBe(true)
    expect(wakeStatus().textContent).toBe('Active')
    closeSettings()
    openSettings()
    expect(wakeSwitch().checked).toBe(true)
    expect(document.querySelector('.settings-wake-state')?.textContent).toBe('On')
    wakeSwitch().click()
    expect(release).toHaveBeenCalledOnce()
    expect(getPref('keepScreenAwake')).toBe(false)
    expect(wakeStatus().hidden).toBe(true)
  })

  it('works in installed mode independently of fullscreen', async () => {
    mode = 'standalone'
    openSettings()
    wakeSwitch().click()
    await flush()
    expect(wakeRequest).toHaveBeenCalledExactlyOnceWith('screen')
    expect(fullscreenButton()).toBeNull()
    expect(request).not.toHaveBeenCalled()
  })

  it('surfaces a rejected wake lock without claiming it is active', async () => {
    wakeRequest.mockRejectedValueOnce(new Error('Low battery'))
    openSettings()
    wakeSwitch().click()
    await flush()
    expect(wakeSwitch().checked).toBe(true)
    expect(wakeStatus().textContent).toContain('declined or released')
  })

  it('disables an unavailable API, but lets an existing On preference be turned off', () => {
    Reflect.deleteProperty(navigator, 'wakeLock')
    openSettings()
    expect(wakeSwitch().disabled).toBe(true)
    expect(wakeStatus().textContent).toContain('not supported')
    setPref('keepScreenAwake', true)
    expect(wakeSwitch().disabled).toBe(false)
    wakeSwitch().click()
    expect(getPref('keepScreenAwake')).toBe(false)
    expect(wakeSwitch().disabled).toBe(true)
  })
})
