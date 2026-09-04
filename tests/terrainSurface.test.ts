import { describe, expect, it } from 'vitest'
import {
  INLAND_WATER_LEVEL,
  SEA_LEVEL,
  terrainSurfaceFromClimate,
} from '../src/world/terrainSample'

describe('terrainSurfaceFromClimate', () => {
  it('flattens ocean to sea level for both render and contact', () => {
    const surface = terrainSurfaceFromClimate({ height: 61.309, biome: 'ocean' })
    expect(surface.kind).toBe('water')
    expect(surface.height).toBe(SEA_LEVEL)
  })

  it('flattens inland water to the same 0.35 m deck the mesh uses', () => {
    const surface = terrainSurfaceFromClimate({ height: 61.309, biome: 'water' })
    expect(surface.kind).toBe('water')
    expect(surface.height).toBe(INLAND_WATER_LEVEL)
  })

  it('leaves land height unchanged', () => {
    const surface = terrainSurfaceFromClimate({ height: 42, biome: 'plains' })
    expect(surface.kind).toBe('land')
    expect(surface.height).toBe(42)
  })
})
