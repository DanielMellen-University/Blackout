import { describe, expect, it } from 'vitest'
import { waterLandmarks } from '../src/world/Hydrology'
import { setWorldSeed } from '../src/world/noise'

// Hydrology sampling culls each generated lake with a box of half-size
// boundsRadius + shelf margin. That is exact only while every cached shore
// radius stays inside boundsRadius; a lake growing past it would lose its
// outer shelf and shoreline carving without any other test noticing.
describe('generated lake bounds', () => {
  it('keeps every cached shore radius within the bounds radius', () => {
    let checked = 0
    for (const seed of [1, 73, 1337]) {
      setWorldSeed(seed)
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        for (const basin of waterLandmarks(dx, dz)) {
          if (!basin.shoreRadii || basin.regionalSea) continue
          expect(Number.isFinite(basin.boundsRadius)).toBe(true)
          let outer = 0
          for (const r of basin.shoreRadii) outer = Math.max(outer, r)
          for (const island of basin.islands ?? [])
            outer = Math.max(outer, Math.hypot(island.x - basin.x, island.z - basin.z) + island.radius)
          expect(outer, `${seed} ${basin.id}`).toBeLessThanOrEqual(basin.boundsRadius!)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(5)
    // Cold catchment generation for 75 regions is slow on shared CI runners.
  }, 60000)
})
