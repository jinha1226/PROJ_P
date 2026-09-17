// DCSS player.cc update_vision_range; dat/species/{barachi,kobold}.yaml.
// WebTiles does not transmit current_vision. Do not infer reduced vision from walls.
export function speciesSightRadius(species = ''): number {
  const name = species.toLowerCase()
  if (/barachi|바라키|바라치/.test(name)) return 8
  if (/kobold|코볼트/.test(name)) return 4
  return 7
}
export function sightAxis(species: string, observedRadius = 0): number {
  return 2 * (Math.max(speciesSightRadius(species), observedRadius) + 1) + 1
}
