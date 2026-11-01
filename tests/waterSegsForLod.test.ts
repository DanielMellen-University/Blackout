import { describe, expect, it } from 'vitest'
import { CHUNK_SIZE, segsForLod, waterSegsForLod, type TerrainLod } from '../src/world/TerrainGeometry'

describe('terrain and water grid budgets', () => {
  it('uses coarser terrain grids for farther LODs', () => {
    expect(segsForLod(0)).toBeGreaterThan(segsForLod(1))
    expect(segsForLod(1)).toBeGreaterThan(segsForLod(2))
  })

  it('never gives water fewer segments than the terrain under it', () => {
    for (const lod of [0, 1, 2] as TerrainLod[]) for (const span of [CHUNK_SIZE, CHUNK_SIZE * 4, CHUNK_SIZE * 32])
      expect(waterSegsForLod(lod, span)).toBeGreaterThanOrEqual(segsForLod(lod))
  })

  it('grows with span but stays under its per-LOD cap', () => {
    for (const lod of [0, 1, 2] as TerrainLod[]) {
      const small = waterSegsForLod(lod, CHUNK_SIZE), huge = waterSegsForLod(lod, CHUNK_SIZE * 64)
      expect(huge).toBeGreaterThanOrEqual(small)
      expect(waterSegsForLod(lod, CHUNK_SIZE * 128)).toBe(huge)
    }
  })
})
