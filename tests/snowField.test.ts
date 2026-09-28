import { describe, expect, it, vi } from 'vitest'
import { precipitationParticleCount, SnowField, snowWave, wrap } from '../src/world/SnowField'

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

  it('keeps pooled sway finite and periodic without per-flake trig', () => {
    expect(snowWave(0)).toBeCloseTo(0, 2)
    expect(snowWave(Math.PI / 2)).toBeCloseTo(1, 2)
    expect(snowWave(1.17 + Math.PI * 2)).toBeCloseTo(snowWave(1.17), 2)
    expect(snowWave(Number.NaN)).toBe(0)
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

  it('makes particle teardown idempotent and ignores late weather updates', () => {
    const field = new SnowField()
    const geometryDispose = vi.spyOn(field.points.geometry, 'dispose')
    field.dispose()
    expect(() => field.dispose()).not.toThrow()
    expect(() => field.setDensityScale(.5)).not.toThrow()
    expect(() => field.update(.016, 0, 100, 0, 1, 4, -2)).not.toThrow()
    expect(field.points.visible).toBe(false)
    expect(geometryDispose).toHaveBeenCalledOnce()
  })
})
