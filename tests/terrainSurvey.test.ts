import { Scene } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { TerrainSystem } from '../src/world/TerrainSystem'
import { hydrologyPreparedAt, prepareHydrologyInBoundsSteps } from '../src/world/Hydrology'
import type { TerrainSurface } from '../src/world/terrainSample'

vi.mock('../src/world/Hydrology', async importOriginal => ({
  ...await importOriginal<object>(),
  hydrologyPreparedAt: vi.fn(() => false),
  prepareHydrologyInBoundsSteps: vi.fn(function* () {
    for (let i = 0; i < 6; i++) yield 'routing'
  }),
}))

describe('cooperative biome survey', () => {
  it('waits for cold preparation while preserving exact resident surface classification', () => {
    const terrain = new TerrainSystem(new Scene(), 0)
    const surface: TerrainSurface = { kind: 'water', height: 100, biome: 'water', waterBody: 'river' }
    const sample = vi.spyOn(terrain, 'sampleMeshSurface').mockReturnValue(surface)
    let clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock += 2)
    try {
      for (let i = 0; i < 6; i++) expect(terrain.sampleSurveySurface(500, 600)).toBeNull()
      expect(sample).not.toHaveBeenCalled()
      expect(terrain.sampleSurveySurface(500, 600)).toBe(surface)
      expect(prepareHydrologyInBoundsSteps).toHaveBeenLastCalledWith(500, 600, 500, 600)
      expect(sample).toHaveBeenCalledExactlyOnceWith(500, 600)
    } finally { terrain.dispose(); vi.restoreAllMocks() }
  })

  it('samples a warm catchment without constructing another iterator and retries after eviction', () => {
    const terrain = new TerrainSystem(new Scene(), 0)
    const surface: TerrainSurface = { kind: 'land', height: 100, biome: 'plains' }
    const warm = vi.mocked(hydrologyPreparedAt), prepare = vi.mocked(prepareHydrologyInBoundsSteps)
    vi.spyOn(terrain, 'sampleMeshSurface').mockReturnValue(surface)
    prepare.mockClear(); warm.mockReturnValue(true)
    try {
      for (let i = 0; i < 20; i++) expect(terrain.sampleSurveySurface(500, 600)).toBe(surface)
      expect(prepare).not.toHaveBeenCalled()
      warm.mockReturnValue(false)
      let clock = 0
      vi.spyOn(performance, 'now').mockImplementation(() => clock += 2)
      expect(terrain.sampleSurveySurface(500, 600)).toBeNull()
      expect(prepare).toHaveBeenCalledOnce()
    } finally { warm.mockReturnValue(false); terrain.dispose(); vi.restoreAllMocks() }
  })

  it('abandons departed or reseeded preparation and rejects invalid/disposed probes', () => {
    const terrain = new TerrainSystem(new Scene(), 0)
    let clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock += 2)
    const prepare = vi.mocked(prepareHydrologyInBoundsSteps)
    prepare.mockClear()
    try {
      expect(terrain.sampleSurveySurface(0, 0)).toBeNull()
      expect(terrain.sampleSurveySurface(10000, 0)).toBeNull()
      expect(prepare).toHaveBeenCalledTimes(1)
      expect(terrain.sampleSurveySurface(100000, 0)).toBeNull()
      expect(prepare).toHaveBeenCalledTimes(2)
      terrain.clearAll()
      expect(terrain.sampleSurveySurface(100000, 0)).toBeNull()
      expect(prepare).toHaveBeenCalledTimes(3)
      expect(terrain.sampleSurveySurface(NaN, 0)).toBeNull()
      terrain.dispose()
      expect(terrain.sampleSurveySurface(100000, 0)).toBeNull()
      expect(prepare).toHaveBeenCalledTimes(3)
    } finally { terrain.dispose(); vi.restoreAllMocks() }
  })
})
