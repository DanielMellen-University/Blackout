import { describe, expect, it } from 'vitest'
import { riverSourceWidth } from '../src/world/RegionalDrainage'

describe('riverSourceWidth', () => {
  it('starts every channel at 10 m and reaches full width after 8 km', () => {
    expect(riverSourceWidth(180, 0)).toBe(10)
    expect(riverSourceWidth(180, 8000)).toBe(180)
    expect(riverSourceWidth(180, 20000)).toBe(180)
  })

  it('grows monotonically in between', () => {
    let previous = 0
    for (let d = 0; d <= 8000; d += 250) {
      const w = riverSourceWidth(240, d)
      expect(w).toBeGreaterThanOrEqual(previous)
      previous = w
    }
    expect(riverSourceWidth(240, 4000)).toBeCloseTo(125, 6)
  })
})
