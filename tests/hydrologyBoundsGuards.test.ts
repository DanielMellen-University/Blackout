import { afterEach, describe, expect, it } from 'vitest'
import { hydrologyIntersectsBounds, riverReachesInBounds, waterBasinsInBounds, waterLandmarks } from '../src/world/Hydrology'
import { setWorldSeed } from '../src/world/noise'

afterEach(() => setWorldSeed(1337.9182))

describe('hydrology bounds queries with bad input', () => {
  it('reports nothing for non-finite bounds', () => {
    setWorldSeed(73)
    expect(hydrologyIntersectsBounds(Number.NaN, 0, 100, 100)).toBe(false)
    expect(hydrologyIntersectsBounds(0, 0, Number.POSITIVE_INFINITY, 100)).toBe(false)
    expect(riverReachesInBounds(Number.NaN, 0, 100, 100)).toHaveLength(0)
  })

  it('finds a known lake but returns nothing for inverted or oversized boxes', () => {
    setWorldSeed(73)
    const lake = waterLandmarks(0, 0).find(b => !b.sea && !b.regionalSea)!
    expect(lake).toBeDefined()
    const ids = (minX: number, minZ: number, maxX: number, maxZ: number) => waterBasinsInBounds(minX, minZ, maxX, maxZ).map(b => b.id)
    expect(ids(lake.x - 10, lake.z - 10, lake.x + 10, lake.z + 10)).toContain(lake.id)
    expect(ids(lake.x + 10, lake.z + 10, lake.x - 10, lake.z - 10)).toHaveLength(0)
    expect(ids(lake.x - 70000, lake.z - 10, lake.x + 70000, lake.z + 10)).toHaveLength(0)
  }, 60000)
})
