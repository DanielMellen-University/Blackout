import { describe, expect, it } from 'vitest'
import {
  buildPerfectLine,
  perfectLineCenter,
  perfectLineFloor,
  perfectLineHeight,
} from '../src/world/PerfectLine'

describe('perfect line corridor edges', () => {
  it('clamps the centre to the first and last bends outside the corridor', () => {
    expect(perfectLineCenter(0)).toBe(0)
    expect(perfectLineCenter(-500)).toBe(0)
    expect(perfectLineCenter(12000)).toBe(700)
    expect(perfectLineCenter(99999)).toBe(700)
  })

  it('passes through every authored bend', () => {
    expect(perfectLineCenter(1800)).toBeCloseTo(-500, 8)
    expect(perfectLineCenter(3400)).toBeCloseTo(650, 8)
    expect(perfectLineCenter(7000)).toBeCloseTo(-650, 8)
  })

  it('keeps the floor at its base height far from both saddles', () => {
    expect(perfectLineFloor(0)).toBeCloseTo(180, 4)
    expect(perfectLineFloor(4900)).toBeCloseTo(270, 4)
    expect(perfectLineFloor(8900)).toBeCloseTo(290, 4)
  })

  it('rises from the floor at the centre to a full wall outside the corridor', () => {
    const z = 5000
    const centre = perfectLineCenter(z)
    const floor = perfectLineHeight(centre, z)
    expect(floor).toBeCloseTo(perfectLineFloor(z), 8)
    const far = perfectLineHeight(centre + 2000, z)
    expect(far - floor).toBeGreaterThan(450)
    const mid = perfectLineHeight(centre + 400, z)
    expect(mid).toBeGreaterThan(floor)
    expect(mid).toBeLessThan(far)
  })

  it('builds a 15-point course that follows the centre line', () => {
    const line = buildPerfectLine()
    expect(line.course).toHaveLength(15)
    for (const point of line.course) {
      expect(point.x).toBeCloseTo(perfectLineCenter(point.z), 8)
      expect(point.y).toBeCloseTo(perfectLineFloor(point.z) + 160, 8)
      expect(Math.hypot(point.fwdX, point.fwdZ)).toBeCloseTo(1, 8)
    }
    expect(line.course[14]!.z).toBeCloseTo(11200, 8)
  })
})
