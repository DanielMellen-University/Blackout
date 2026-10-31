import { describe, expect, it } from 'vitest'
import { basinBedOffset, basinDistance, sampleHydrology, waterLandmarks, type WaterBasin } from '../src/world/Hydrology'
import { basinOpticalDepth } from '../src/world/BasinSurface'
import { setWorldSeed } from '../src/world/noise'

function firstLake(seed: number): WaterBasin {
  setWorldSeed(seed)
  for (let ring = 0; ring < 6; ring++) for (let dx = -ring; dx <= ring; dx++) for (let dz = -ring; dz <= ring; dz++) {
    const lake = waterLandmarks(dx, dz).find(b => !b.sea && !b.regionalSea && b.shoreRadii)
    if (lake) return lake as WaterBasin
  }
  throw new Error(`no lake for seed ${seed}`)
}

describe('lake optical depth', () => {
  it('tracks the carved bed from the shallow shelf to the centre', () => {
    for (const seed of [1, 73, 1337]) {
      const lake = firstLake(seed)
      const centre = basinOpticalDepth(lake, [], lake.x, lake.z)
      // The centre is the deepest carved point, not an unrelated constant.
      expect(centre).toBeCloseTo(-basinBedOffset(lake, basinDistance(lake, lake.x, lake.z)), 5)
      let previous = 0
      for (const t of [.98, .9, .75, .5, .25]) {
        // Walk inward along one spoke; depth must grow monotonically.
        let r = 10
        while (basinDistance(lake, lake.x + r, lake.z) < 0) r += 10
        const x = lake.x + (r - 10) * t, depth = basinOpticalDepth(lake, [], x, lake.z)
        expect(depth).toBeGreaterThanOrEqual(previous - 1e-6)
        previous = depth
        // Same depth as the actual carved terrain under the surface.
        const ground = sampleHydrology(x, lake.z, lake.level + 200)
        const carved = lake.level - ground.height
        // River channels carve their own beds and feed the optics separately.
        if (ground.river > 0) continue
        expect(Math.abs(depth - carved), `${seed} t=${t}`).toBeLessThan(Math.max(.25, carved * .02))
      }
      expect(previous).toBeLessThanOrEqual(centre + 1e-6)
    }
  })

  it('keeps a shallow shelf at the shore', () => {
    const lake = firstLake(1)
    expect(basinBedOffset(lake, -5)).toBeGreaterThan(-.5)
    expect(basinBedOffset(lake, -400)).toBeLessThan(-20)
    expect(basinBedOffset(lake, 10)).toBeGreaterThan(0)
  })
})
