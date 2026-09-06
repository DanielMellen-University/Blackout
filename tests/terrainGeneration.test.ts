import { afterEach, describe, expect, it } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, INLAND_WATER_LEVEL, sampleClimate } from '../src/world/terrainSample'

describe('continuous terrain generation', () => {
  afterEach(clearOpsPad)

  it('only labels submerged basins as inland water across seeds and distant coordinates', () => {
    clearOpsPad()
    let water = 0
    for (const seed of [1, 2, 1337]) {
      setWorldSeed(seed)
      for (let i = -40; i <= 40; i++) for (let j = -20; j <= 20; j++) {
        const climate = sampleClimate(i * 427, j * 619)
        expect(Number.isFinite(climate.height)).toBe(true)
        if (climate.biome === 'water') {
          water++
          expect(climate.height).toBeLessThanOrEqual(climate.waterLevel ?? INLAND_WATER_LEVEL)
        }
      }
    }
    expect(water).toBeGreaterThan(0)
  })

  it('remains deterministic when returning to a seed at far coordinates', () => {
    clearOpsPad()
    setWorldSeed(73)
    const before = sampleClimate(-120032.5, 308467.25)
    setWorldSeed(92)
    sampleClimate(-120032.5, 308467.25)
    setWorldSeed(73)
    expect(sampleClimate(-120032.5, 308467.25)).toEqual(before)
  })
})
