import { describe, expect, it } from 'vitest'
import { riverSourceWidth } from '../src/world/RegionalDrainage'
import { riverReaches, riverReachesInBounds } from '../src/world/Hydrology'
import { setWorldSeed } from '../src/world/noise'
import { riverSurfaceHeightAt, type RiverSurface } from '../src/world/RiverSurface'

describe('gradual river source profile', () => {
  it('keeps sub-millimetre triangle edge rounding on the upper drawn water surface', () => {
    const surface: RiverSurface = {
      sections: new Float64Array(0), caps: new Float64Array(0),
      minX: 0, minZ: 0, maxX: 2000, maxZ: 2000,
      triangles: new Float64Array([
        0, 100, 0, 10, 1000, 100, 0, 10, 0, 100, 1000, 10,
        0, 50, 0, 10, 2000, 50, 0, 10, 0, 50, 2000, 10,
      ]),
    }
    expect(riverSurfaceHeightAt(surface, 500, 500.0006)).toBeCloseTo(100, 8)
    expect(riverSurfaceHeightAt(surface, 500, 500.002)).toBeCloseTo(50, 8)
  })

  it('spreads the source transition across 8 km rather than one 2 km edge', () => {
    expect(riverSourceWidth(410, 0)).toBe(10)
    expect(riverSourceWidth(410, 2000)).toBeCloseTo(72.5)
    expect(riverSourceWidth(410, 4000)).toBeCloseTo(210)
    expect(riverSourceWidth(410, 6000)).toBeCloseTo(347.5)
    expect(riverSourceWidth(410, 8000)).toBe(410)
    expect(riverSourceWidth(410, 12000)).toBe(410)
    let previous = 10
    for (let distance = 0; distance <= 10000; distance += 20) {
      const width = riverSourceWidth(410, distance)
      expect(width).toBeGreaterThanOrEqual(previous)
      expect(width - previous).toBeLessThan(1.51)
      previous = width
    }
  })

  it('keeps generated shared cross-sections matched after source narrowing', () => {
    setWorldSeed(42)
    let sources = 0, joined = 0
    for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) {
      for (const reach of riverReaches(cx, cz)) {
        if (reach.source) { expect(reach.wa).toBe(10); sources++ }
        if (reach.mouth || reach.branch) continue
        const next = riverReachesInBounds(reach.bx - 1, reach.bz - 1, reach.bx + 1, reach.bz + 1)
          .find(q => q.id !== reach.id && !q.branch && Math.hypot(q.ax - reach.bx, q.az - reach.bz) < .001)
        if (!next) continue
        expect(next.wa).toBeCloseTo(reach.wb, 6)
        // Sea mouths retain their existing one-centimetre surface bias.
        expect(Math.abs(next.ya - reach.yb)).toBeLessThanOrEqual(.011)
        joined++
      }
    }
    expect(sources).toBeGreaterThan(5)
    expect(joined).toBeGreaterThan(1000)
  })
})
