import { describe, expect, it } from 'vitest'
import { wrap } from '../src/world/SnowField'

describe('snow wrap', () => {
  it('maps a point onto the opposite side of the follow volume', () => {
    expect(wrap(110, 0)).toBeCloseTo(-110, 5)
    expect(wrap(-110, 0)).toBeCloseTo(-110, 5)
    expect(wrap(0, 0)).toBeCloseTo(0, 5)
    expect(wrap(50, 40)).toBeCloseTo(50, 5)
    expect(wrap(40 + 110 + 1, 40)).toBeCloseTo(40 - 110 + 1, 5)
  })
})
