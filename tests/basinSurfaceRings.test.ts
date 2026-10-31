import { describe, expect, it } from 'vitest'
import { basinDistance, waterBasinsInBounds, waterLandmarks, type WaterBasin } from '../src/world/Hydrology'
import { basinSurfaceSteps } from '../src/world/BasinSurface'
import { setWorldSeed } from '../src/world/noise'

function finish<T>(steps: Generator<unknown, T, void>): T {
  let result = steps.next()
  while (!result.done) result = steps.next()
  return result.value
}

describe('basin surface rings', () => {
  it('keeps the shore ring ordered, unique and on the shared outline', () => {
    setWorldSeed(73)
    // The seed-73 wetland pond has many inlet crossings inserted into its ring.
    const pond = waterBasinsInBounds(-7000, -20000, -6000, -19000).find(b => b.id === 'lake:-3:-10')!
    const surface = finish(basinSurfaceSteps(pond, []))
    expect(surface.boundary.length).toBeGreaterThan(pond.shoreRadii!.length)
    let previous = -1
    for (let i = 0; i < surface.boundary.length; i++) {
      const p = surface.boundary[i]!, q = surface.boundary[(i + 1) % surface.boundary.length]!
      const angle = (Math.atan2(p.z, p.x) + Math.PI * 2) % (Math.PI * 2)
      expect(angle).toBeGreaterThanOrEqual(previous)
      previous = angle
      expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThanOrEqual(.05)
      expect(Math.abs(basinDistance(pond, pond.x + p.x, pond.z + p.z))).toBeLessThan(.05)
    }
  })

  it('puts the inner ring under water inside the shore ring', () => {
    let checked = 0
    for (const seed of [1, 73, 1337]) {
      setWorldSeed(seed)
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        for (const lake of waterLandmarks(dx, dz)) {
          if (lake.sea || lake.regionalSea || !lake.shoreRadii || lake.islands) continue
          const surface = finish(basinSurfaceSteps(lake as WaterBasin, []))
          expect(surface.inner).toHaveLength(surface.boundary.length)
          for (let i = 0; i < surface.inner.length; i++) {
            const p = surface.inner[i]!, edge = surface.boundary[i]!
            // Inner vertices sit on the spoke toward the centre, never outside.
            expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(Math.hypot(edge.x, edge.z) + 1e-6)
            expect(p.depth).toBeGreaterThanOrEqual(edge.depth - 1e-6)
            // Radial contours are star-shaped about the centre, so the spoke
            // point is always under the same lake.
            expect(basinDistance(lake, lake.x + p.x, lake.z + p.z)).toBeLessThan(0)
          }
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(3)
  })
})
