import { describe, expect, it } from 'vitest'
import { lightningCooldown, lightningFlashEnvelope } from '../src/world/StormEvents'

describe('lightning envelope and cooldown edges', () => {
  it('is dark at the exact start and end of a flash', () => {
    expect(lightningFlashEnvelope(0, .18)).toBe(0)
    expect(lightningFlashEnvelope(.6, .18)).toBe(0)
    expect(lightningFlashEnvelope(.61, .18)).toBe(0)
    expect(lightningFlashEnvelope(-.1, .18)).toBe(0)
  })

  it('peaks at the end of the rise and never exceeds the .18 cap', () => {
    expect(lightningFlashEnvelope(.1, .18)).toBeCloseTo(.18, 12)
    expect(lightningFlashEnvelope(.1, 1)).toBeCloseTo(.18, 12)
    expect(lightningFlashEnvelope(.3, .18)).toBeGreaterThan(0)
    expect(lightningFlashEnvelope(.3, .18)).toBeLessThanOrEqual(.18)
  })

  it('stays dark for a zero or negative peak', () => {
    expect(lightningFlashEnvelope(.1, 0)).toBe(0)
    expect(lightningFlashEnvelope(.1, -1)).toBe(0)
    expect(lightningFlashEnvelope(.1, Number.NaN)).toBe(0)
  })

  it('keeps the cooldown inside its documented range', () => {
    // Weakest storm, slowest pulse: (18 + 0) / (.5 + .35 * .5) = 26.67.
    expect(lightningCooldown(.35, 0)).toBeCloseTo(26.6667, 3)
    // Strongest storm, fastest pulse: (18 + 18) / 1 = 36.
    expect(lightningCooldown(1, 1)).toBeCloseTo(36, 12)
    // Out-of-range inputs clamp to the same bounds.
    expect(lightningCooldown(0, 0)).toBeCloseTo(lightningCooldown(.35, 0), 12)
    expect(lightningCooldown(5, 5)).toBeCloseTo(lightningCooldown(1, 1), 12)
    expect(lightningCooldown(Number.NaN, Number.NaN)).toBeCloseTo(40, 12)
  })
})
