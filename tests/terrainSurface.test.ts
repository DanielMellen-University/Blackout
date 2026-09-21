import { describe, expect, it } from 'vitest'
import {
  INLAND_WATER_LEVEL,
  SEA_LEVEL,
  terrainSurfaceFromClimate,
  waterBodyFromClimate,
} from '../src/world/terrainSample'

describe('terrainSurfaceFromClimate', () => {
  it('flattens ocean to sea level for both render and contact', () => {
    const surface = terrainSurfaceFromClimate({ height: 61.309, biome: 'ocean' })
    expect(surface.kind).toBe('water')
    expect(surface.height).toBe(SEA_LEVEL)
    expect(surface.waterBody).toBe('sea')
  })

  it('flattens inland water to the same 0.35 m deck the mesh uses', () => {
    const surface = terrainSurfaceFromClimate({ height: 61.309, biome: 'water' })
    expect(surface.kind).toBe('water')
    expect(surface.height).toBe(INLAND_WATER_LEVEL)
    expect(surface.waterBody).toBe('inland')
  })

  it('leaves land height unchanged', () => {
    const surface = terrainSurfaceFromClimate({ height: 42, biome: 'plains' })
    expect(surface.kind).toBe('land')
    expect(surface.height).toBe(42)
  })

  it('keeps one level water surface above a submerged basin', () => {
    expect(terrainSurfaceFromClimate({ height: -2, biome: 'water' }).height)
      .toBe(INLAND_WATER_LEVEL)
  })

  it('uses the basin elevation for highland lakes and river reaches', () => {
    expect(terrainSurfaceFromClimate({ height: 122, biome: 'water', waterLevel: 152 }).height)
      .toBe(152)
  })

  it('keeps hydrology body labels deterministic and mutually exclusive', () => {
    expect(waterBodyFromClimate({ biome: 'ocean' })).toBe('sea')
    expect(waterBodyFromClimate({ biome: 'water', features: { river: 1, stream: 1, lake: 0, pond: 0, ravine: 0 } })).toBe('stream')
    expect(waterBodyFromClimate({ biome: 'water', features: { river: 1, stream: 0, lake: 0, pond: 0, ravine: 0 } })).toBe('river')
    expect(waterBodyFromClimate({ biome: 'water', features: { river: 0, stream: 0, lake: 1, pond: 0, ravine: 0 } })).toBe('lake')
    expect(waterBodyFromClimate({ biome: 'water', features: { river: 0, stream: 0, lake: 0, pond: 1, ravine: 0 } })).toBe('pond')
    expect(waterBodyFromClimate({ biome: 'water' })).toBe('inland')
    expect(waterBodyFromClimate({ biome: 'plains', features: { river: 1, stream: 1, lake: 1, pond: 1, ravine: 0 } })).toBeUndefined()
  })
})
