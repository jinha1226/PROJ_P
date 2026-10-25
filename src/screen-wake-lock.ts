import { getPref, KEEP_SCREEN_AWAKE_CHANGED_EVENT } from './prefs'

export const SCREEN_WAKE_LOCK_STATUS_EVENT = 'pocketzot:screen-wake-lock-status'
export type ScreenWakeLockStatus = 'off' | 'pending' | 'active' | 'paused' | 'blocked' | 'unsupported'

let status: ScreenWakeLockStatus = 'off'
let stopCurrent: (() => void) | undefined

export function supportsScreenWakeLock(): boolean {
  return typeof navigator.wakeLock?.request === 'function'
}

export function getScreenWakeLockStatus(): ScreenWakeLockStatus {
  return supportsScreenWakeLock() ? status : 'unsupported'
}

function setStatus(next: ScreenWakeLockStatus): void {
  if (next === status) return
  status = next
  window.dispatchEvent(new Event(SCREEN_WAKE_LOCK_STATUS_EVENT))
}

export function initScreenWakeLock(): () => void {
  stopCurrent?.()
  const listeners = new AbortController()
  let lock: WakeLockSentinel | null = null
  let pending = false
  let stopped = false
  let pageHidden = false
  let revision = 0

  const wanted = (): boolean => !stopped && !pageHidden
    && document.visibilityState === 'visible' && getPref('keepScreenAwake') === true
  const idleStatus = (): ScreenWakeLockStatus => getPref('keepScreenAwake') ? 'paused' : 'off'
  const release = (): void => {
    const previous = lock
    lock = null
    if (previous) void previous.release().catch(() => {})
  }

  async function sync(): Promise<void> {
    if (!wanted()) {
      release()
      if (!stopped) setStatus(idleStatus())
      return
    }
    if (!supportsScreenWakeLock()) { setStatus('unsupported'); return }
    if (lock && !lock.released) { setStatus('active'); return }
    if (pending) return
    pending = true
    const startedAt = revision
    setStatus('pending')
    try {
      const acquired = await navigator.wakeLock.request('screen')
      if (!wanted()) {
        await acquired.release()
        return
      }
      if (acquired.released) { setStatus('blocked'); return }
      lock = acquired
      acquired.addEventListener('release', () => {
        if (lock !== acquired) return
        lock = null
        // A visible-page release can be a low-battery/policy decision.
        // Do not fight it with an immediate request loop.
        setStatus(wanted() ? 'blocked' : idleStatus())
      }, { once: true })
      setStatus('active')
    } catch {
      if (!stopped) setStatus(wanted() ? 'blocked' : idleStatus())
    } finally {
      pending = false
      // Visibility or On/Off may change while the browser is answering.
      if (!stopped && revision !== startedAt) void sync()
    }
  }

  const refresh = (): void => { revision++; void sync() }
  const { signal } = listeners
  window.addEventListener(KEEP_SCREEN_AWAKE_CHANGED_EVENT, refresh, { signal })
  document.addEventListener('visibilitychange', refresh, { signal })
  window.addEventListener('pagehide', () => { pageHidden = true; refresh() }, { signal })
  window.addEventListener('pageshow', () => { pageHidden = false; refresh() }, { signal })
  stopCurrent = () => {
    if (stopped) return
    stopped = true
    listeners.abort()
    release()
    setStatus('off')
  }
  refresh()
  return stopCurrent
}
