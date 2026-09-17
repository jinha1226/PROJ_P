// Cosmetic player artwork only. Server coordinates and combat remain authoritative.
export function pawnName(species = ''): string {
  const name = species.toLowerCase().trim()
  if (/elf|엘프/.test(name)) return 'elf'
  if (/dwarf|드워프/.test(name)) return 'dwarf'
  if (/orc|오크/.test(name)) return 'orc'
  if (/gnoll|놀|beastkin|수인/.test(name)) return 'beastkin'
  if (/goblin|고블린/.test(name)) return 'goblin'
  return 'human' // Placeholder appearance for species without dedicated pawn art.
}
export function pawnUrl(species = ''): string {
  return `${import.meta.env.BASE_URL}pawns/${pawnName(species)}.png`
}

export class PawnSprite {
  private image: HTMLImageElement | null = null
  private name = ''
  constructor(private repaint: () => void) { this.setSpecies('') }
  setSpecies(species: string): boolean {
    const name = pawnName(species)
    if (name === this.name) return false
    this.name = name
    const image = new Image()
    this.image = image
    image.onload = () => { if (this.image === image) this.repaint() }
    // Failure leaves the original DCSS actor visible; never clear it in advance.
    image.onerror = () => { if (this.image === image) this.repaint() }
    image.src = pawnUrl(species)
    return true
  }
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): boolean {
    const image = this.image
    if (!image?.complete || !image.naturalWidth) return false
    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, x, y, size, size)
    ctx.restore()
    return true
  }
}
