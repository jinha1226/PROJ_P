import { COACH_HINTS, type CoachHintId } from './coach'
import type { UiLang } from '../../prefs'

export interface CoachHint {
  element: HTMLElement
  show(id: CoachHintId, lang: UiLang): void
  hide(): void
  onDismiss(cb: (id: CoachHintId) => void): void
}

export function createCoachHint(): CoachHint {
  let current: CoachHintId | null = null
  let dismissCb: ((id: CoachHintId) => void) | null = null

  const element = document.createElement('div')
  element.id = 'coach-hint'
  element.style.display = 'none'

  const icon = document.createElement('span')
  icon.className = 'coach-icon'
  icon.textContent = '💡'

  const text = document.createElement('span')
  text.className = 'coach-text'

  const dismiss = document.createElement('button')
  dismiss.className = 'coach-dismiss'
  dismiss.textContent = '✕'
  dismiss.setAttribute('aria-label', 'Dismiss')
  const fireDismiss = (): void => {
    const id = current
    hide()
    if (id && dismissCb) dismissCb(id)
  }
  dismiss.addEventListener('click', fireDismiss)
  dismiss.addEventListener('touchstart', e => { e.preventDefault(); fireDismiss() }, { passive: false })

  element.appendChild(icon)
  element.appendChild(text)
  element.appendChild(dismiss)

  function show(id: CoachHintId, lang: UiLang): void {
    current = id
    text.textContent = COACH_HINTS[id][lang]
    element.style.display = ''
  }
  function hide(): void {
    current = null
    element.style.display = 'none'
  }
  function onDismiss(cb: (id: CoachHintId) => void): void { dismissCb = cb }

  return { element, show, hide, onDismiss }
}
