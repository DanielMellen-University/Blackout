import { describe, expect, it } from 'vitest'
import {
  INLAND_WATER_LEVEL,
  SEA_LEVEL,
  terrainSurfaceFromClimate,
  waterBodyFromClimate,
} from '../src/world/terrainSample'

describe('resolved water surface with malformed levels', () => {
  it('falls back to the inland water level for a NaN water level', () => {
    const surface = terrainSurfaceFromClimate({ height: -4, biome: 'water', waterLevel: Number.NaN })
    expect(surface.height).toBe(INLAND_WATER_LEVEL)
    expect(surface.kind).toBe('water')
    expect(surface.waterBody).toBe('inland')
  })

  it('falls back to the inland water level when no water level is given', () => {
    const surface = terrainSurfaceFromClimate({ height: -4, biome: 'water' })
    expect(surface.height).toBe(INLAND_WATER_LEVEL)
  })

  it('keeps the ocean at sea level regardless of water level', () => {
    const surface = terrainSurfaceFromClimate({ height: -40, biome: 'ocean', waterLevel: Number.NaN })
    expect(surface.height).toBe(SEA_LEVEL)
    expect(surface.kind).toBe('water')
    expect(surface.waterBody).toBe('sea')
  })

  it('passes dry land height through untouched', () => {
    const surface = terrainSurfaceFromClimate({ height: 123, biome: 'plains', waterLevel: Number.NaN })
    expect(surface.height).toBe(123)
    expect(surface.kind).toBe('land')
  })

  it('names water bodies by the documented tie-breaks', () => {
    expect(waterBodyFromClimate({ biome: 'ocean' })).toBe('sea')
    expect(waterBodyFromClimate({ biome: 'plains' })).toBeUndefined()
    const features = { river: 0, lake: 0, ravine: 0, pond: 0, stream: 0 }
    expect(waterBodyFromClimate({ biome: 'water' })).toBe('inland')
    expect(waterBodyFromClimate({ biome: 'water', features: { ...features, stream: .5, river: .5 } })).toBe('stream')
    expect(waterBodyFromClimate({ biome: 'water', features: { ...features, river: .9, stream: .5 } })).toBe('river')
    expect(waterBodyFromClimate({ biome: 'water', features: { ...features, pond: .5, lake: .5 } })).toBe('pond')
    expect(waterBodyFromClimate({ biome: 'water', features: { ...features, lake: .5 } })).toBe('lake')
    expect(waterBodyFromClimate({ biome: 'water', features: { ...features, river: .44, lake: .44 } })).toBe('inland')
  })
})
