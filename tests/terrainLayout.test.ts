import { describe, expect, it } from 'vitest'
import { planTerrainTiles, terrainBuildPriority, tileKey } from '../src/world/TerrainLayout'
import { CHUNK_SIZE, FOG_FAR, STREAM_RADIUS_M, VIEW_RADIUS } from '../src/world/TerrainSystem'

describe('long-range adaptive terrain coverage', () => {
  it('prioritizes contact detail and missing coverage over distant LOD rebuilds', () => {
    const contact = { dist: 2, size: 1, rebuild: true }
    const merge = { dist: 70, size: 32, rebuild: false }
    const split = { dist: 8, size: 1, rebuild: false }
    const demote = { dist: 5, size: 1, rebuild: true }
    expect([demote, split, merge, contact].sort((a, b) => terrainBuildPriority(a) - terrainBuildPriority(b)))
      .toEqual([contact, split, merge, demote])
  })

  it('doubles the previous render and fog envelope', () => {
    expect(STREAM_RADIUS_M).toBe(16800 * 2)
    expect(FOG_FAR).toBe(15120 * 2)
    expect(CHUNK_SIZE).toBe(420)
    expect(VIEW_RADIUS).toBe(80)
  })

  it('covers the doubled horizon without overlapping leaves or unbounded mesh growth', () => {
    for (const [x, z] of [[.5, .5], [-31.5, 47.5], [170.5, -280.5]]) {
      const tiles = planTerrainTiles(x!, z!, 80)
      expect(tiles.length).toBeLessThan(650)
      expect(new Set(tiles.map(t => t.size))).toEqual(new Set([1, 2, 4, 8, 16, 32]))
      const occupied = new Set<string>()
      for (const t of tiles) {
        for (let dx = 0; dx < t.size; dx++) for (let dz = 0; dz < t.size; dz++) {
          const key = tileKey(t.cx + dx, t.cz + dz)
          expect(occupied.has(key)).toBe(false)
          occupied.add(key)
        }
      }
      for (let dx = -79; dx <= 79; dx++) for (let dz = -79; dz <= 79; dz++) {
        if (Math.hypot(dx, dz) > 79) continue
        expect(occupied.has(tileKey(Math.floor(x!) + dx, Math.floor(z!) + dz))).toBe(true)
      }
    }
  })

  it('preserves nearby contact detail and fills coverage in distance order', () => {
    for (const [x, z] of [[.5, .5], [-31.5, 47.5], [170.5, -280.5]]) {
      const tiles = planTerrainTiles(x!, z!, 80)
      expect(tiles.some(t => t.cx === Math.floor(x!) && t.cz === Math.floor(z!) && t.size === 1)).toBe(true)
      const nearby = tiles.filter(t => t.dist <= 8)
      expect(nearby.length).toBeGreaterThan(150)
      expect(nearby.every(t => t.size === 1)).toBe(true)
      expect(tiles.map(t => t.dist)).toEqual(tiles.map(t => t.dist).sort((a, b) => a - b))
    }
  })
})
