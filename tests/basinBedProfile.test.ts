import { describe, expect, it } from 'vitest'
import { basinBedOffset } from '../src/world/Hydrology'

const lake = { sea: false }, sea = { sea: true }

describe('basin bed profile', () => {
  it('is continuous at the shoreline for lakes and seas', () => {
    for (const basin of [lake, sea]) {
      expect(basinBedOffset(basin, 0)).toBe(0)
      expect(Math.abs(basinBedOffset(basin, -1e-4))).toBeLessThan(1e-4)
      expect(Math.abs(basinBedOffset(basin, 1e-4))).toBeLessThan(1e-4)
    }
  })

  it('falls under lake water at least as fast as the dry bank rises', () => {
    // Near-shore terrain cells interpolate between a wet and a dry vertex. A
    // shelf shallower than the bank slope pushed that line above the water.
    for (const d of [1, 4, 10, 20, 24]) {
      expect(-basinBedOffset(lake, -d)).toBeGreaterThanOrEqual(basinBedOffset(lake, d) - 1e-9)
    }
  })

  it('deepens monotonically toward the lake centre', () => {
    let previous = 0
    for (let d = -1; d >= -3000; d -= 7) {
      const bed = basinBedOffset(lake, d)
      expect(bed).toBeLessThanOrEqual(previous + 1e-9)
      previous = bed
    }
    // Drop-off lip (about 1.3 m by 24 m) plus a 32 m bowl by 500 m in.
    expect(basinBedOffset(lake, -24)).toBeLessThan(-1.5)
    expect(basinBedOffset(lake, -500)).toBeLessThan(-32)
  })

  it('keeps the sea shelf separate and deeper offshore', () => {
    expect(basinBedOffset(sea, -2300)).toBeLessThan(-150)
    expect(basinBedOffset(sea, -100)).toBeGreaterThan(basinBedOffset(lake, -100))
  })

  it('rises gently and convexly on the dry bank', () => {
    expect(basinBedOffset(lake, 100)).toBeCloseTo(6.85, 6)
    const slopeNear = basinBedOffset(lake, 11) - basinBedOffset(lake, 10)
    const slopeFar = basinBedOffset(lake, 501) - basinBedOffset(lake, 500)
    expect(slopeFar).toBeGreaterThan(slopeNear)
  })
})
