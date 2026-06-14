// Converts a screen point to a dungeon cell given the rendered grid geometry.
// rectLeft/rectTop: map element's client rect origin. shiftX/shiftY: pixel
// offset of the grid content within the element (0 if none). cellW/cellH:
// rendered pixel size of one cell. offX/offY: dungeon coord of the top-left
// rendered cell. cols/rows: rendered viewport size. Returns absolute dungeon
// coords, or null if the point falls outside the rendered grid.
export function cellFromPoint(
  clientX: number, clientY: number,
  rectLeft: number, rectTop: number,
  shiftX: number, shiftY: number,
  cellW: number, cellH: number,
  offX: number, offY: number,
  cols: number, rows: number,
): { x: number; y: number } | null {
  if (cellW <= 0 || cellH <= 0) return null
  const col = Math.floor((clientX - rectLeft - shiftX) / cellW)
  const row = Math.floor((clientY - rectTop - shiftY) / cellH)
  if (col < 0 || row < 0 || col >= cols || row >= rows) return null
  return { x: offX + col, y: offY + row }
}
