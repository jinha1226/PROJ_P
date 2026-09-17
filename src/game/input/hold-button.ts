export interface HoldAction { start: () => boolean; end: () => void }
// Momentary interaction only: a synthesized click must never latch the overview.
export function bindHold(button: HTMLButtonElement, action: HoldAction): { cancel: () => void; dispose: () => void } {
  let held = false
  let pointer: number | null = null
  const controller = new AbortController()
  const options = { signal: controller.signal }
  const cancel = () => {
    if (!held) return
    held = false; pointer = null
    button.classList.remove('active'); button.setAttribute('aria-pressed', 'false')
    action.end()
  }
  const start = () => {
    if (held || !action.start()) return false
    held = true; button.classList.add('active'); button.setAttribute('aria-pressed', 'true')
    return true
  }
  button.style.touchAction = 'none'
  button.setAttribute('aria-pressed', 'false')
  button.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation()
    if (e.button !== 0 || held) return
    if (start()) {
      pointer = e.pointerId
      try { button.setPointerCapture(e.pointerId) } catch { /* synthetic/test event */ }
    }
  }, options)
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'] as const) {
    button.addEventListener(type, e => { if (pointer === e.pointerId) cancel() }, options)
  }
  button.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) start() }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel() }
  }, options)
  button.addEventListener('keyup', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); cancel() }
  }, options)
  button.addEventListener('click', e => { e.preventDefault(); e.stopPropagation() }, options)
  button.addEventListener('contextmenu', e => e.preventDefault(), options)
  button.addEventListener('blur', cancel, options)
  window.addEventListener('blur', cancel, options)
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel() }, options)
  return { cancel, dispose: () => { cancel(); controller.abort() } }
}
