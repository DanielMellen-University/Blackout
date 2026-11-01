import { describe, expect, it } from 'vitest'
import { waterBasinBoundsRadius } from '../src/world/Hydrology'

describe('waterBasinBoundsRadius', () => {
  it('uses the cached bounds when present', () => {
    expect(waterBasinBoundsRadius({ radius: 800, boundsRadius: 1210 })).toBe(1210)
  })

  it('falls back to 1.75 times the radius for authored basins', () => {
    expect(waterBasinBoundsRadius({ radius: 800 })).toBe(1400)
    expect(waterBasinBoundsRadius({ radius: 800, boundsRadius: 0 })).toBe(1400)
    expect(waterBasinBoundsRadius({ radius: 800, boundsRadius: Number.NaN })).toBe(1400)
  })

  it('never returns a negative or non-finite bound', () => {
    expect(waterBasinBoundsRadius({ radius: -5 })).toBe(0)
    expect(waterBasinBoundsRadius({ radius: Number.POSITIVE_INFINITY })).toBe(0)
  })
})
