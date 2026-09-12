import { describe, expect, it } from 'vitest'
import { precipitationParticleCount, SnowField, wrap } from '../src/world/SnowField'

describe('snow wrap', () => {
  it('maps a point onto the opposite side of the follow volume', () => {
    expect(wrap(110, 0)).toBeCloseTo(-110, 5)
    expect(wrap(-110, 0)).toBeCloseTo(-110, 5)
    expect(wrap(0, 0)).toBeCloseTo(0, 5)
    expect(wrap(50, 40)).toBeCloseTo(50, 5)
    expect(wrap(40 + 110 + 1, 40)).toBeCloseTo(40 - 110 + 1, 5)
  })

  it('keeps preset particle budgets bounded and nonzero', () => {
    expect(precipitationParticleCount(4200, 0.42)).toBe(1764)
    expect(precipitationParticleCount(4200, 1.4)).toBe(4200)
    expect(precipitationParticleCount(4200, 0)).toBe(1)
    expect(precipitationParticleCount(0, 0.4)).toBe(0)
  })

  it('changes the pooled draw range without rebuilding the field', () => {
    const field = new SnowField()
    field.setDensityScale(0.42)
    expect(field.activeCount).toBe(1764)
    expect(field.points.geometry.drawRange.count).toBe(1764)
    field.setDensityScale(1)
    expect(field.activeCount).toBe(4200)
    expect(field.points.geometry.drawRange.count).toBe(4200)
    field.dispose()
  })
})
