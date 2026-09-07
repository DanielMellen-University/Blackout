import { describe, expect, it } from 'vitest'
import { planTerrainTiles, terrainBuildPriority, tileKey } from '../src/world/TerrainLayout'
import { CHUNK_SIZE, FOG_FAR, STREAM_RADIUS_M, VIEW_RADIUS } from '../src/world/TerrainSystem'

describe('long-range adaptive terrain coverage', () => {
  it('prioritizes contact detail and missing coverage over distant LOD rebuilds', () => {
    const contact = { dist: 2, size: 1, rebuild: true }
    const merge = { dist: 24, size: 8, rebuild: false }
    const split = { dist: 8, size: 1, rebuild: false }
    const demote = { dist: 5, size: 1, rebuild: true }
    expect([demote, split, merge, contact].sort((a, b) => terrainBuildPriority(a) - terrainBuildPriority(b)))
      .toEqual([contact, merge, split, demote])
  })

  it('doubles the previous render and fog envelope', () => {
    expect(STREAM_RADIUS_M).toBe(8400 * 2)
    expect(FOG_FAR).toBe(7560 * 2)
    expect(CHUNK_SIZE).toBe(420)
  })

  it('covers the full horizon without overlapping leaves or nine times the meshes', () => {
    for (const [x, z] of [[.5, .5], [-31.5, 47.5], [170.5, -280.5]]) {
      const tiles = planTerrainTiles(x!, z!, VIEW_RADIUS)
      expect(tiles.length).toBeLessThan(550)
      expect(new Set(tiles.map(t => t.size))).toEqual(new Set([1, 2, 4, 8]))
      const occupied = new Set<string>()
      for (const t of tiles) {
        for (let dx = 0; dx < t.size; dx++) for (let dz = 0; dz < t.size; dz++) {
          const key = tileKey(t.cx + dx, t.cz + dz)
          expect(occupied.has(key)).toBe(false)
          occupied.add(key)
        }
      }
      for (let dx = -39; dx <= 39; dx++) for (let dz = -39; dz <= 39; dz++) {
        if (Math.hypot(dx, dz) > 39) continue
        expect(occupied.has(tileKey(Math.floor(x!) + dx, Math.floor(z!) + dz))).toBe(true)
      }
    }
  })
})
