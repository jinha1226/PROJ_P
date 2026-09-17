// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PawnSprite, pawnName, pawnUrl } from './pawn-sprite'
import { MapStore } from './map-store'
import { TileMapView } from './tile-map-view'

class FakeImage {
  static all: FakeImage[] = []
  complete = false
  naturalWidth = 0
  src = ''
  onload = () => {}
  onerror = () => {}
  constructor() { FakeImage.all.push(this) }
  load() { this.complete = true; this.naturalWidth = 128; this.onload() }
}
let ctx: CanvasRenderingContext2D
beforeEach(() => {
  FakeImage.all = []
  vi.stubGlobal('Image', FakeImage)
  ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(target, key) {
      const obj = target as unknown as Record<PropertyKey, unknown>
      if (!(key in obj)) obj[key] = vi.fn()
      return obj[key]
    },
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('pawn rendering', () => {
  it('maps known art and never constructs paths from arbitrary server text', () => {
    expect(pawnName('Deep Elf')).toBe('elf')
    expect(pawnName('Mountain Dwarf')).toBe('dwarf')
    expect(pawnName('Gnoll')).toBe('beastkin')
    expect(pawnName('../../x')).toBe('human')
    expect(pawnUrl('Human')).toBe(`${import.meta.env.BASE_URL}pawns/human.png`)
  })
  it('keeps original art until loaded, and on load failure', () => {
    const repaint = vi.fn()
    const pawn = new PawnSprite(repaint)
    expect(pawn.draw(ctx, 0, 0, 32)).toBe(false)
    FakeImage.all[0].onerror()
    expect(pawn.draw(ctx, 0, 0, 32)).toBe(false)
    FakeImage.all[0].load()
    expect(pawn.draw(ctx, 0, 0, 32)).toBe(true)
    expect(ctx.drawImage).toHaveBeenCalledWith(FakeImage.all[0], 0, 0, 32, 32)
  })
  it('ignores stale species loads and does not reload unchanged art', () => {
    const repaint = vi.fn()
    const pawn = new PawnSprite(repaint)
    pawn.setSpecies('Deep Elf')
    FakeImage.all[0].load()
    expect(repaint).not.toHaveBeenCalled()
    expect(pawn.draw(ctx, 0, 0, 32)).toBe(false)
    FakeImage.all[1].load()
    expect(repaint).toHaveBeenCalledOnce()
    expect(pawn.setSpecies('Deep Elf')).toBe(false)
    expect(FakeImage.all).toHaveLength(2)
  })
  it('replaces only the server player cell, including atlas fallback and movement', () => {
    const store = new MapStore()
    store.playerPos = { x: 1, y: 1 }
    store.merge([{ x: 1, y: 1, g: '@', col: 15 }, { x: 2, y: 1, g: '@', col: 15 }])
    const view = new TileMapView(store)
    view.setViewCenter({ x: 1, y: 1 })
    FakeImage.all[0].load()
    vi.mocked(ctx.drawImage).mockClear()
    view.fullRender()
    expect(ctx.drawImage).toHaveBeenCalledOnce()
    const first = vi.mocked(ctx.drawImage).mock.calls[0]
    store.playerPos = { x: 2, y: 1 }
    vi.mocked(ctx.drawImage).mockClear()
    view.fullRender()
    expect(ctx.drawImage).toHaveBeenCalledOnce()
    expect(vi.mocked(ctx.drawImage).mock.calls[0][1]).toBe(Number(first[1]) + 32)
    expect(store.get(1, 1)?.g).toBe('@') // renderer never rewrites server state
  })
  it('retains foreground ordering and player bars in the loaded tile path', () => {
    const store = new MapStore()
    store.playerPos = { x: 0, y: 0 }
    store.merge([{ x: 0, y: 0, g: '@', col: 15, t: { fg: 1, bg: 0 } }])
    const view = new TileMapView(store)
    FakeImage.all[0].load()
    // Drive the loaded-atlas branch with an empty atlas: pawn is local artwork.
    Object.assign(view, { ready: true })
    view.setPlayerStats({ hp: 4, hp_max: 10, mp: 2, mp_max: 5 })
    vi.mocked(ctx.drawImage).mockClear()
    vi.mocked(ctx.fillRect).mockClear()
    view.fullRender()
    expect(ctx.drawImage).toHaveBeenCalledOnce()
    const pawnOrder = vi.mocked(ctx.drawImage).mock.invocationCallOrder[0]
    expect(vi.mocked(ctx.fillRect).mock.invocationCallOrder.some(n => n > pawnOrder)).toBe(true)
    view.setPlayerStats({ species: 'Deep Elf' })
    expect(FakeImage.all.at(-1)?.src).toBe(`${import.meta.env.BASE_URL}pawns/elf.png`)
  })
})
