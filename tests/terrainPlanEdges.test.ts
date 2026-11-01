import { describe, expect, it } from 'vitest'
import { planTerrainTiles, tileDistance } from '../src/world/TerrainLayout'

describe('planTerrainTiles edge cases', () => {
  it('plans nothing for a negative radius', () => {
    expect(planTerrainTiles(0, 0, -1)).toHaveLength(0)
  })

  it('always includes the single cell under the camera, with dist measured to its centre', () => {
    for (const [x, z] of [[.5, .5], [-3.2, 7.9], [100.1, -64.4]] as const) {
      const tiles = planTerrainTiles(x, z, 12)
      const under = tiles.filter(t => x >= t.cx && x < t.cx + t.size && z >= t.cz && z < t.cz + t.size)
      expect(under).toHaveLength(1)
      expect(under[0]!.size).toBe(1)
      expect(under[0]!.dist).toBeLessThan(Math.SQRT1_2 + 1e-9)
    }
  })

  it('clears and reuses a provided output array', () => {
    const out = planTerrainTiles(0, 0, 10)
    const again = planTerrainTiles(50, 50, 6, out)
    expect(again).toBe(out)
    expect(again.every(t => tileDistance(t.cx, t.cz, t.size, 50, 50) <= 6)).toBe(true)
  })
})
