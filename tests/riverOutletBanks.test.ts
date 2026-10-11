import { describe, expect, it } from 'vitest'
import { basinDistance, type RiverReach, type WaterBasin } from '../src/world/Hydrology'
import { riverSurface, riverSurfaceHeightAt } from '../src/world/RiverSurface'

const lake: WaterBasin = { x: 1000, z: 0, radius: 500, aspect: 1, angle: 0, phase: 0,
  level: 100, sea: false, pond: false, shoreRadii: new Float32Array(128).fill(500) }
function outlet(width = 100, level = 100): RiverReach {
  return { ax: 500, az: 0, bx: 100, bz: 0, dx: -400, dz: 0, length: 400, lengthSq: 160000,
    wa: width, wb: width, ya: level, yb: level, source: false, terminal: false,
    tangentAX: -1, tangentAZ: 0, tangentBX: -1, tangentBZ: 0 }
}

describe('source lake bank connections', () => {
  it('fills the dry wedge between a centreline-only outlet and its curved source shore', () => {
    const surface = riverSurface(outlet(), [lake])
    expect(basinDistance(lake, 503, 75)).toBeGreaterThan(0) // Not owned by the lake.
    expect(riverSurfaceHeightAt(surface, 503, 75)).toBeCloseTo(100, 8)
    expect(riverSurfaceHeightAt(surface, 450, 75)).toBeCloseTo(100, 8)
    expect(riverSurfaceHeightAt(surface, 450, 110)).toBe(-Infinity)
    expect(surface.triangles).toBeDefined() // Inside water is clipped, not doubled.
  })

  it('bounds the overlap for a very broad outlet', () => {
    const reach = outlet(880), surface = riverSurface(reach, [lake])
    expect(surface.maxX).toBe(reach.ax + 620)
    expect(surface.minX).toBe(reach.bx)
    expect(riverSurfaceHeightAt(surface, 1100, 700)).toBe(-Infinity)
  })

  it('does not extend unrelated spans or a differently graded source', () => {
    expect(riverSurface(outlet(100, 150), [lake]).maxX).toBe(500)
    const dry = outlet(); dry.ax = 400; dry.dx = -300; dry.length = 300; dry.lengthSq = 90000
    expect(riverSurface(dry, [lake]).maxX).toBe(400)
  })
})
