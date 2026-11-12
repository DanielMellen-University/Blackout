/** Fixed world grid with larger tiles toward the horizon. Units are 420 m cells. */
export interface TerrainTile {
  cx: number
  cz: number
  /** Side length in cells (1, 2, 4, 8, 16 or 32). */
  size: number
  /** Distance from the player to the tile centre, in cells, including warm-up plans. */
  dist: number
}

/** Aligned root span shared by the planner and streamed ownership indexes. */
export const TERRAIN_ROOT_SIZE = 32

/** Stable map key for a tile. Single cells keep the short historical form. */
export function tileKey(cx: number, cz: number, size = 1): string {
  return size === 1 ? `${cx},${cz}` : `${cx},${cz}:${size}`
}

/** Keep contact detail first, then restore the nearest missing coverage before LOD work. */
export function terrainBuildPriority(job: { dist: number; size: number; rebuild: boolean }): number {
  if (job.dist <= 4) return job.dist
  return job.rebuild ? 1000 + job.dist : 10 + job.dist
}

/** Distance in cells from a point to the nearest edge of a tile; 0 inside. */
export function tileDistance(cx: number, cz: number, size: number, x: number, z: number): number {
  return Math.hypot(
    Math.max(cx - x, 0, x - cx - size),
    Math.max(cz - z, 0, z - cz - size),
  )
}

/** Non-overlapping quadtree leaves; no far ring of thousands of tiny meshes. */
export function planTerrainTiles(
  x: number,
  z: number,
  radius: number,
  out?: TerrainTile[],
  previousSplits?: Set<string>,
  scratchSplits?: Set<string>,
  /** Extra refinement/coverage points in cells; density and priority still use x/z. */
  warmFocuses: readonly { x: number; z: number }[] = [],
): TerrainTile[] {
  const tiles = out ?? []
  const nextSplits = previousSplits ? scratchSplits ?? new Set<string>() : null
  nextSplits?.clear()
  let count = 0
  function visit(cx: number, cz: number, size: number): void {
    let edgeDistance = tileDistance(cx, cz, size, x, z)
    for (const focus of warmFocuses) {
      edgeDistance = Math.min(edgeDistance, tileDistance(cx, cz, size, focus.x, focus.z))
    }
    if (edgeDistance > radius) return
    const splitAt = size === 32 ? 48 : size === 16 ? 32 : size === 8 ? 20 : size === 4 ? 12 : 8
    // Refine at the normal boundary, but do not merge again after a tiny
    // reversal. Keep history only for visited nodes, so flight cannot grow it.
    const node = size > 1 && previousSplits ? tileKey(cx, cz, size) : ''
    const mergeMargin = node && previousSplits!.has(node) ? 2 : 0
    if (size > 1 && edgeDistance < splitAt + mergeMargin) {
      if (node) nextSplits!.add(node)
      const half = size / 2
      // Keep the recursive planner allocation-free. The old nested array
      // literals created two short-lived arrays at every quadtree split,
      // which multiplied during rapid stream reschedules.
      visit(cx, cz, half)
      visit(cx, cz + half, half)
      visit(cx + half, cz, half)
      visit(cx + half, cz + half, half)
    } else {
      const tile = tiles[count] ?? { cx: 0, cz: 0, size: 1, dist: 0 }
      tile.cx = cx
      tile.cz = cz
      tile.size = size
      tile.dist = Math.hypot(cx + size / 2 - x, cz + size / 2 - z)
      tiles[count] = tile
      count++
    }
  }
  const rootSize = TERRAIN_ROOT_SIZE
  let minFocusX = x, maxFocusX = x, minFocusZ = z, maxFocusZ = z
  for (const focus of warmFocuses) {
    minFocusX = Math.min(minFocusX, focus.x)
    maxFocusX = Math.max(maxFocusX, focus.x)
    minFocusZ = Math.min(minFocusZ, focus.z)
    maxFocusZ = Math.max(maxFocusZ, focus.z)
  }
  const minX = Math.floor((minFocusX - radius) / rootSize) * rootSize
  const minZ = Math.floor((minFocusZ - radius) / rootSize) * rootSize
  for (let cx = minX; cx <= maxFocusX + radius; cx += rootSize) {
    for (let cz = minZ; cz <= maxFocusZ + radius; cz += rootSize) visit(cx, cz, rootSize)
  }
  tiles.length = count
  if (previousSplits) {
    previousSplits.clear()
    for (const node of nextSplits!) previousSplits.add(node)
  }
  return tiles.sort((a, b) => a.dist - b.dist)
}
