import { afterEach, describe, expect, it } from 'vitest'
import { createClimateSample, sampleGeography, sampleGeographyHeight, sampleGeographyInto,
  sampleGeographySurfaceHeight, sampleGeographySurfaceInto } from '../src/world/Geography'
import { setWorldSeed } from '../src/world/noise'

afterEach(() => setWorldSeed(1337.9182))
const points = [[0, 0], [5200, -3100], [-14000, 9000], [22000, 21000]] as const

describe('allocation-free geography paths', () => {
  it('sampleGeographyInto matches sampleGeography', () => {
    setWorldSeed(73)
    const out = createClimateSample()
    for (const [x, z] of points) {
      const fresh = sampleGeography(x, z), reused = sampleGeographyInto(out, x, z)
      expect(reused.height).toBe(fresh.height)
      expect(reused.biome).toBe(fresh.biome)
      expect(reused.waterLevel).toBe(fresh.waterLevel)
    }
  }, 60000)

  it('the scalar surface is the higher of bed and water and matches the height probes', () => {
    setWorldSeed(73)
    const out = { height: 0, bedHeight: 0, waterLevel: 0 }
    for (const [x, z] of points) {
      sampleGeographySurfaceInto(out, x, z)
      expect(out.height).toBe(Math.max(out.bedHeight, out.waterLevel))
      expect(out.bedHeight).toBe(sampleGeographyHeight(x, z))
      expect(sampleGeographySurfaceHeight(x, z)).toBe(out.height)
    }
  }, 60000)
})
