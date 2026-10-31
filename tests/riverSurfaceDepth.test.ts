import { describe, expect, it } from 'vitest'
import type { RiverReach } from '../src/world/Hydrology'
import { riverSurface, riverSurfaceDepthAt, riverSurfaceHeightAt } from '../src/world/RiverSurface'

// Lake optics read river depth through riverSurfaceDepthAt to carry a channel
// across its mouth, so its inside/outside contract matters as much as height.
function reach(width: number): RiverReach {
  return { ax: 0, az: 5000, bx: 600, bz: 5000, dx: 600, dz: 0, length: 600, lengthSq: 360000,
    wa: width, wb: width, ya: 40, yb: 38, source: false, terminal: false,
    tangentAX: 1, tangentAZ: 0, tangentBX: 1, tangentBZ: 0 }
}

describe('river surface depth queries', () => {
  it('reads a finite positive depth inside the ribbon', () => {
    const surface = riverSurface(reach(80), [])
    const depth = riverSurfaceDepthAt(surface, 300, 5000)
    expect(Number.isFinite(depth)).toBe(true)
    expect(depth).toBeGreaterThan(0)
  })

  it('is deeper on the centreline than near the bank', () => {
    const surface = riverSurface(reach(120), [])
    const centre = riverSurfaceDepthAt(surface, 300, 5000)
    const bank = riverSurfaceDepthAt(surface, 300, 5000 + 120 * .45)
    expect(centre).toBeGreaterThan(bank)
  })

  it('returns -Infinity outside the ribbon and its bounds', () => {
    const surface = riverSurface(reach(60), [])
    expect(riverSurfaceDepthAt(surface, 300, 5000 + 400)).toBe(-Infinity)
    expect(riverSurfaceDepthAt(surface, -5000, -5000)).toBe(-Infinity)
    // Depth and height agree on which points the ribbon covers.
    for (const z of [4960, 4990, 5000, 5020, 5100]) {
      expect(Number.isFinite(riverSurfaceDepthAt(surface, 300, z))).toBe(Number.isFinite(riverSurfaceHeightAt(surface, 300, z)))
    }
  })
})
