/** Fixed world grid with larger tiles toward the horizon. Units are 420 m cells. */
export interface TerrainTile {
  cx: number
  cz: number
  size: number
  dist: number
}

export function tileKey(cx: number, cz: number, size = 1): string {
  return size === 1 ? `${cx},${cz}` : `${cx},${cz}:${size}`
}

export function tileDistance(cx: number, cz: number, size: number, x: number, z: number): number {
  return Math.hypot(
    Math.max(cx - x, 0, x - cx - size),
    Math.max(cz - z, 0, z - cz - size),
  )
}

/** Non-overlapping quadtree leaves; no far ring of thousands of tiny meshes. */
export function planTerrainTiles(x: number, z: number, radius: number): TerrainTile[] {
  const tiles: TerrainTile[] = []
  function visit(cx: number, cz: number, size: number): void {
    const edgeDistance = tileDistance(cx, cz, size, x, z)
    if (edgeDistance > radius) return
    const splitAt = size === 8 ? 20 : size === 4 ? 12 : 8
    if (size > 1 && edgeDistance < splitAt) {
      const half = size / 2
      for (const dx of [0, half]) for (const dz of [0, half]) visit(cx + dx, cz + dz, half)
    } else {
      tiles.push({ cx, cz, size, dist: Math.hypot(cx + size / 2 - x, cz + size / 2 - z) })
    }
  }
  const minX = Math.floor((x - radius) / 8) * 8
  const minZ = Math.floor((z - radius) / 8) * 8
  for (let cx = minX; cx <= x + radius; cx += 8) {
    for (let cz = minZ; cz <= z + radius; cz += 8) visit(cx, cz, 8)
  }
  return tiles.sort((a, b) => a.dist - b.dist)
}
