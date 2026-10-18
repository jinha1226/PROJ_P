export const MIN_MAP_ZOOM = 0.5
export const MAX_MAP_ZOOM = 3

interface MapPinchOptions {
  enabled(): boolean
  getZoom(): number
  setZoom(scale: number): void
  onStart(): void
}

export function attachMapPinch(el: HTMLElement, opts: MapPinchOptions): {
  cancel(): void
  destroy(): void
} {
  const points = new Map<number, { x: number; y: number }>()
  let start: { ids: [number, number]; distance: number; zoom: number } | null = null
  const cancel = (): void => {
    start = null
    const ids = [...points.keys()]
    points.clear()
    for (const id of ids) {
      try { el.releasePointerCapture(id) } catch { /* already released */ }
    }
  }

  const begin = (e: PointerEvent): void => {
    if (!opts.enabled() || e.pointerType !== 'touch') return
    if (!(e.target instanceof Element) || !e.target.closest('#map-grid')) return
    points.set(e.pointerId, { x: e.clientX, y: e.clientY })
    // ASCII zoom rebuilds the cells under the fingers. Capture to their
    // stable ancestor so subsequent moves survive that DOM replacement.
    try { el.setPointerCapture(e.pointerId) } catch { /* detached test DOM */ }
    start = null
    if (points.size !== 2) return
    opts.onStart()
    e.preventDefault()
    const [a, b] = [...points.entries()]
    const distance = Math.hypot(a[1].x - b[1].x, a[1].y - b[1].y)
    if (distance < 1) return
    start = { ids: [a[0], b[0]], distance, zoom: opts.getZoom() }
  }

  const move = (e: PointerEvent): void => {
    if (!points.has(e.pointerId)) return
    if (!opts.enabled()) { cancel(); return }
    points.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (!start) return
    const a = points.get(start.ids[0])!
    const b = points.get(start.ids[1])!
    e.preventDefault()
    const distance = Math.hypot(a.x - b.x, a.y - b.y)
    opts.setZoom(Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, start.zoom * distance / start.distance)))
  }

  const end = (e: PointerEvent): void => {
    if (points.delete(e.pointerId)) start = null
  }

  el.addEventListener('pointerdown', begin)
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', end)
  el.addEventListener('pointercancel', end)
  el.addEventListener('lostpointercapture', end)
  return {
    cancel,
    destroy(): void {
      cancel()
      el.removeEventListener('pointerdown', begin)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
      el.removeEventListener('lostpointercapture', end)
    },
  }
}
