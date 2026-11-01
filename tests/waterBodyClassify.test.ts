import { describe, expect, it } from 'vitest'
import { INLAND_WATER_LEVEL, SEA_LEVEL, terrainSurfaceFromClimate, waterBodyFromClimate } from '../src/world/terrainSample'

const f = (o: Partial<Record<'river' | 'ravine' | 'pond' | 'lake' | 'stream', number>>) =>
  ({ river: 0, ravine: 0, pond: 0, lake: 0, stream: 0, ...o })

describe('waterBodyFromClimate', () => {
  it('names oceans sea and dry biomes nothing', () => {
    expect(waterBodyFromClimate({ biome: 'ocean' })).toBe('sea')
    expect(waterBodyFromClimate({ biome: 'plains' })).toBeUndefined()
  })

  it('prefers streams over rivers when they tie, and rivers over still water', () => {
    expect(waterBodyFromClimate({ biome: 'water', features: f({ stream: .6, river: .6 }) })).toBe('stream')
    expect(waterBodyFromClimate({ biome: 'water', features: f({ stream: .5, river: .7 }) })).toBe('river')
    expect(waterBodyFromClimate({ biome: 'water', features: f({ river: .5, lake: .9 }) })).toBe('river')
  })

  it('splits ponds from lakes and falls back to inland', () => {
    expect(waterBodyFromClimate({ biome: 'water', features: f({ pond: .6, lake: .5 }) })).toBe('pond')
    expect(waterBodyFromClimate({ biome: 'water', features: f({ pond: .5, lake: .6 }) })).toBe('lake')
    expect(waterBodyFromClimate({ biome: 'water', features: f({ lake: .3 }) })).toBe('inland')
    expect(waterBodyFromClimate({ biome: 'water' })).toBe('inland')
  })
})

describe('terrainSurfaceFromClimate', () => {
  it('puts seas at sea level and inland water at its level or the default', () => {
    expect(terrainSurfaceFromClimate({ biome: 'ocean', height: -40 }).height).toBe(SEA_LEVEL)
    expect(terrainSurfaceFromClimate({ biome: 'water', height: 3, waterLevel: 12 }).height).toBe(12)
    expect(terrainSurfaceFromClimate({ biome: 'water', height: 3 }).height).toBe(INLAND_WATER_LEVEL)
  })

  it('keeps land at its ground height', () => {
    expect(terrainSurfaceFromClimate({ biome: 'forest', height: 210 })).toEqual({ height: 210, kind: 'land', biome: 'forest' })
  })
})
