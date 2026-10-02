import { describe, expect, it } from 'vitest'
import { planTerrainTiles, terrainBuildPriority, tileKey } from '../src/world/TerrainLayout'
import { CHUNK_SIZE, fogFarForViewRadius, fogNearForViewRadius, FOG_FAR, STREAM_RADIUS_M, terrainFadeTargetAlpha, VIEW_RADIUS } from '../src/world/TerrainSystem'

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

  it('keeps the Low terrain horizon inside its reduced stream envelope', () => {
    expect(fogFarForViewRadius(52)).toBe(44 * CHUNK_SIZE)
    expect(fogNearForViewRadius(52)).toBe(Math.round(44 * CHUNK_SIZE * 0.34))
    expect(fogFarForViewRadius(Number.NaN)).toBe(FOG_FAR)
  })

  it('fades the active quality horizon instead of using the High radius', () => {
    expect(terrainFadeTargetAlpha(51, 52)).toBeLessThan(1)
    expect(terrainFadeTargetAlpha(51, 52)).toBeLessThan(terrainFadeTargetAlpha(51, 80))
    expect(terrainFadeTargetAlpha(51, Number.NaN)).toBe(1)
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

  it('keeps the quadtree plan deterministic across repeated stream reschedules', () => {
    const first = planTerrainTiles(170.5, -280.5, 80)
    const second = planTerrainTiles(170.5, -280.5, 80)
    expect(second).toEqual(first)
  })

  it('reuses caller-owned tile records when a planner buffer is provided', () => {
    const output = planTerrainTiles(0.5, 0.5, 40)
    const firstRecord = output[0]
    expect(firstRecord).toBeDefined()
    const reused = planTerrainTiles(8.5, 3.5, 40, output)
    expect(reused).toBe(output)
    expect(reused).toContain(firstRecord)
    expect(reused).toEqual(planTerrainTiles(8.5, 3.5, 40))
  })
})
