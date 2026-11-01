import { describe, expect, it } from 'vitest'
import type { RiverReach } from '../src/world/Hydrology'
import { riverSurface, riverSurfaceHeightAt } from '../src/world/RiverSurface'

const reach = (): RiverReach => ({ ax: 0, az: 9000, bx: 500, bz: 9000, dx: 500, dz: 0, length: 500, lengthSq: 250000,
  wa: 60, wb: 60, ya: 30, yb: 28, source: false, terminal: false,
  tangentAX: 1, tangentAZ: 0, tangentBX: 1, tangentBZ: 0 })

describe('river surface cache', () => {
  it('returns the same surface object for repeated queries of one reach', () => {
    const r = reach()
    expect(riverSurface(r, [])).toBe(riverSurface(r, []))
  })

  it('builds separate surfaces for equal but distinct reaches', () => {
    expect(riverSurface(reach(), [])).not.toBe(riverSurface(reach(), []))
  })

  it('grades the surface between the reach end heights', () => {
    const surface = riverSurface(reach(), [])
    const upstream = riverSurfaceHeightAt(surface, 50, 9000), downstream = riverSurfaceHeightAt(surface, 450, 9000)
    expect(upstream).toBeGreaterThan(downstream)
    expect(upstream).toBeLessThanOrEqual(30 + 1e-6)
    expect(downstream).toBeGreaterThanOrEqual(28 - 1e-6)
  })

  it('keeps its bounds around the ribbon', () => {
    const surface = riverSurface(reach(), [])
    expect(surface.minX).toBeLessThanOrEqual(0)
    expect(surface.maxX).toBeGreaterThanOrEqual(500)
    expect(surface.minZ).toBeLessThan(9000 - 25)
    expect(surface.maxZ).toBeGreaterThan(9000 + 25)
  })
})
