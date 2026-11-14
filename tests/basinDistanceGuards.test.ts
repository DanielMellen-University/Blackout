import { describe, expect, it } from 'vitest'
import { basinDistance, type WaterBasin } from '../src/world/Hydrology'

const lake = (extra: Partial<WaterBasin> = {}): WaterBasin => ({ x: 100, z: -50, radius: 400, aspect: 1, angle: 0, phase: 0,
  level: 20, sea: false, pond: false, shoreRadii: new Float32Array(64).fill(400), ...extra })

describe('basinDistance guards and islands', () => {
  it('reads a cached circular shore as radial distance', () => {
    const b = lake()
    expect(basinDistance(b, 100, -50)).toBeCloseTo(-400, 3)
    expect(basinDistance(b, 600, -50)).toBeCloseTo(100, 3)
  })

  it('returns +Infinity for non-finite points and broken basins', () => {
    expect(basinDistance(lake(), Number.NaN, 0)).toBe(Number.POSITIVE_INFINITY)
    expect(basinDistance(lake({ radius: 0 }), 100, -50)).toBe(Number.POSITIVE_INFINITY)
    expect(basinDistance(lake({ level: Number.NaN }), 100, -50)).toBe(Number.POSITIVE_INFINITY)
  })

  it('cuts islands out as dry land', () => {
    const b = lake({ islands: [{ x: 200, z: -50, radius: 60 }] })
    expect(basinDistance(b, 200, -50)).toBeGreaterThan(50)
    expect(basinDistance(b, 300, -50)).toBeLessThan(0)
  })

  it('treats an empty cached shoreline as outside the basin', () => {
    const b = lake({ shoreRadii: new Float32Array(0) })
    expect(basinDistance(b, 100, -50)).toBe(Number.POSITIVE_INFINITY)
    expect(basinDistance(b, 600, -50)).toBe(Number.POSITIVE_INFINITY)
  })

  it('stays finite on a chord between two zero cached radii', () => {
    const radii = new Float32Array(8).fill(400)
    radii[0] = 0
    radii[1] = 0
    const b = lake({ shoreRadii: radii })
    // Halfway between the two zero radii the chord collapses to the centre,
    // so the distance is the full centre distance, not NaN.
    const d = basinDistance(b, 100 + 200, -50)
    expect(Number.isFinite(d)).toBe(true)
    expect(d).toBeCloseTo(200, 3)
  })
})
