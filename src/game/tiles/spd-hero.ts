// Player avatar from Shattered Pixel Dungeon's hero sprites, drawn in place of
// the DCSS doll/mcache composition on the player's own cell (see
// TileMapView.drawCell). The PNGs under public/tiles/spd/ are the idle frame
// (frame 0) of each hero sheet in SPD's core/src/main/assets/sprites/, taken
// from an armoured row so the classes read as dressed adventurers (warrior:
// mail, rogue/huntress/duelist: leather, mage/cleric: cloth). 12×15 px at
// their native resolution; we scale them 2× nearest-neighbour into the 32×32
// atlas cell. GPL-3.0-or-later — see ATTRIBUTION.md.
//
// Which hero stands in for the character is a user preference (settings
// overlay), not derived from the DCSS background: the `player` message carries
// only the level title, and mapping every job's title ladder to six sprites
// is more table than it is worth. 'dcss' keeps the server doll.

export const SPD_HEROES = ['warrior', 'mage', 'rogue', 'huntress', 'duelist', 'cleric'] as const
export type SpdHero = typeof SPD_HEROES[number]
export type PlayerSprite = 'dcss' | SpdHero

// Native frame size of every SPD hero sheet.
export const HERO_W = 12
export const HERO_H = 15

export const HERO_LABELS: Record<PlayerSprite, { ko: string; en: string }> = {
  dcss: { ko: '원본', en: 'DCSS' },
  warrior: { ko: '전사', en: 'Warrior' },
  mage: { ko: '마법사', en: 'Mage' },
  rogue: { ko: '도적', en: 'Rogue' },
  huntress: { ko: '사냥꾼', en: 'Huntress' },
  duelist: { ko: '결투가', en: 'Duelist' },
  cleric: { ko: '성직자', en: 'Cleric' },
}

export function isPlayerSprite(v: unknown): v is PlayerSprite {
  return v === 'dcss' || (SPD_HEROES as readonly string[]).includes(v as string)
}

export function nextPlayerSprite(cur: PlayerSprite): PlayerSprite {
  const order: PlayerSprite[] = [...SPD_HEROES, 'dcss']
  return order[(order.indexOf(cur) + 1) % order.length]
}

export function heroSpriteUrl(hero: SpdHero): string {
  return `${import.meta.env.BASE_URL}tiles/spd/hero-${hero}.png`
}

// Decoded images by hero. `loaded` holds only images whose onload fired, so
// heroSpriteSync never hands the canvas a still-empty element (drawImage on
// one throws in some browsers and paints nothing in the rest).
const pending = new Map<SpdHero, HTMLImageElement>()
const loaded = new Map<SpdHero, HTMLImageElement>()

// Starts (or reuses) the load; `onload` fires once the image is paintable so
// the caller can repaint the player cell that fell back to the doll meanwhile.
export function loadHeroSprite(hero: SpdHero, onload?: () => void): void {
  if (loaded.has(hero)) { onload?.(); return }
  let img = pending.get(hero)
  if (!img) {
    img = new Image()
    img.decoding = 'async'
    img.addEventListener('load', () => { loaded.set(hero, img!); pending.delete(hero) })
    // A failed fetch simply leaves the doll fallback in place; drop the entry
    // so a later call retries rather than waiting on a dead element forever.
    img.addEventListener('error', () => pending.delete(hero))
    img.src = heroSpriteUrl(hero)
    pending.set(hero, img)
  }
  if (onload) img.addEventListener('load', onload, { once: true })
}

export function heroSpriteSync(hero: SpdHero): HTMLImageElement | null {
  return loaded.get(hero) ?? null
}

// Test seam: register an already-decoded image (or clear the caches).
export function _setHeroSpriteForTest(hero: SpdHero, img: HTMLImageElement | null): void {
  if (img) loaded.set(hero, img); else { loaded.delete(hero); pending.delete(hero) }
}
