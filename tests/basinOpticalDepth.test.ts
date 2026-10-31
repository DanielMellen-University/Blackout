import { describe, expect, it } from 'vitest'
import { basinBedOffset, type RiverReach, type WaterBasin } from '../src/world/Hydrology'
import { basinOpticalDepth } from '../src/world/BasinSurface'
import { riverSurface, riverSurfaceDepthAt } from '../src/world/RiverSurface'

const lake: WaterBasin = { x: 1000, z: 0, radius: 500, aspect: 1, angle: 0, phase: 0,
  level: 100, sea: false, pond: false, shoreRadii: new Float32Array(128).fill(500) }
// A level outlet leaving the lake's west shore at x = 500.
const outlet: RiverReach = { ax: 500, az: 0, bx: 100, bz: 0, dx: -400, dz: 0, length: 400, lengthSq: 160000,
  wa: 120, wb: 120, ya: 100, yb: 100, source: false, terminal: false,
  tangentAX: -1, tangentAZ: 0, tangentBX: -1, tangentBZ: 0 }

describe('basin optical depth', () => {
  it('follows the carved bed when no river touches the basin', () => {
    expect(basinOpticalDepth(lake, [], 1000, 0)).toBeCloseTo(-basinBedOffset(lake, -500), 6)
    // Shore and dry points keep the shallow floor instead of zero or negative.
    expect(basinOpticalDepth(lake, [], 500.5, 0)).toBeCloseTo(.1, 6)
    expect(basinOpticalDepth(lake, [], 0, 0)).toBe(.08)
  })

  it('carries the channel depth onto shore vertices across a mouth', () => {
    const surface = riverSurface(outlet, [lake])
    for (const z of [-30, 0, 30]) {
      // Points exactly on the shore chord, where the clipped ribbon ends.
      const theta = Math.atan2(z, -500), x = 1000 + Math.cos(theta) * 500, sz = Math.sin(theta) * 500
      const channel = riverSurfaceDepthAt(surface, x - 2.5, sz)
      expect(channel).toBeGreaterThan(.5)
      expect(basinOpticalDepth(lake, [surface], x, sz)).toBeGreaterThanOrEqual(channel - .05)
    }
  })

  it('leaves the rest of the shore shallow and never lowers depth', () => {
    const surface = riverSurface(outlet, [lake])
    expect(basinOpticalDepth(lake, [surface], 1000, 500)).toBeCloseTo(basinOpticalDepth(lake, [], 1000, 500), 6)
    for (const [x, z] of [[1000, 0], [700, 100], [520, 0], [1400, -200]]) {
      expect(basinOpticalDepth(lake, [surface], x!, z!)).toBeGreaterThanOrEqual(basinOpticalDepth(lake, [], x!, z!))
    }
  })
})
