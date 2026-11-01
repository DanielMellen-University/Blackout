import { describe, expect, it } from 'vitest'
import { coastalRelief } from '../src/world/Coastline'

describe('coastalRelief', () => {
  it('puts the shoreline at sea level and the seabed below it', () => {
    expect(coastalRelief(500, 0)).toBe(0)
    expect(coastalRelief(500, -.05)).toBe(-90)
  })

  it('keeps low inland ground on the coastal shelf', () => {
    expect(coastalRelief(60, .2)).toBeCloseTo(360, 9)
  })

  it('adds full inland relief above 90 m once well inland', () => {
    expect(coastalRelief(1090, .2) - coastalRelief(90, .2)).toBeCloseTo(1000, 9)
  })

  it('rises monotonically across the coast for fixed relief', () => {
    let previous = -Infinity
    for (let f = -.2; f <= .3; f += .01) {
      const y = coastalRelief(400, f)
      expect(y).toBeGreaterThan(previous)
      previous = y
    }
  })
})
