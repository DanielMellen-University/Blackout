import { describe, expect, it } from 'vitest'
import {
  atmosphereNeedsUpdate,
  lightningCooldown,
  lightningFlashEnvelope,
} from '../src/world/Atmosphere'

describe('lightning comfort', () => {
  it('uses a capped, eased single-flash envelope', () => {
    const peak = 0.44

    expect(lightningFlashEnvelope(0, peak)).toBe(0)
    expect(lightningFlashEnvelope(0.03, peak)).toBeGreaterThan(0)
    expect(lightningFlashEnvelope(0.03, peak)).toBeLessThan(peak * 0.3)
    expect(lightningFlashEnvelope(0.1, peak)).toBeCloseTo(peak)
    expect(lightningFlashEnvelope(0.35, peak)).toBeGreaterThan(0)
    expect(lightningFlashEnvelope(0.35, peak)).toBeLessThan(peak)
    expect(lightningFlashEnvelope(0.6, peak)).toBe(0)
    expect(lightningFlashEnvelope(0.1, 1)).toBeCloseTo(peak)
  })

  it('keeps mature-storm lightning infrequent', () => {
    expect(lightningCooldown(1, 0)).toBeGreaterThanOrEqual(8)
    expect(lightningCooldown(1, 1)).toBeLessThanOrEqual(17)
    expect(lightningCooldown(0.35, 0.5)).toBeGreaterThan(lightningCooldown(1, 0.5))
  })

  it('skips a frozen frame only when the world anchor is unchanged', () => {
    const anchor = { x: 10, y: 20, z: 30 }
    expect(atmosphereNeedsUpdate(0, 0, 10, 20, 30, anchor)).toBe(false)
    expect(atmosphereNeedsUpdate(0, 0, 10, 20, 31, anchor)).toBe(true)
    expect(atmosphereNeedsUpdate(0, 0, 10, 20, 30, null)).toBe(true)
    expect(atmosphereNeedsUpdate(0, 1 / 120, 10, 20, 30, anchor)).toBe(true)
  })
})
