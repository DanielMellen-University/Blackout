import { describe, expect, it } from 'vitest'
import {
  THERMAL_FADE_ALTITUDE_M,
  THERMAL_MIN_ALTITUDE_M,
  thermalLiftIntensity,
} from '../src/systems/ThermalLift'

describe('deterministic thermal lift', () => {
  it('is repeatable and finite for the same seeded world sample', () => {
    const first = thermalLiftIntensity(42, 270, 420, -330, 0.9, 0.1, 0.02)
    const second = thermalLiftIntensity(42, 270, 420, -330, 0.9, 0.1, 0.02)
    expect(first).toBe(second)
    expect(Number.isFinite(first)).toBe(true)
    expect(first).toBeGreaterThanOrEqual(0)
    expect(first).toBeLessThanOrEqual(1)
  })

  it('fails closed for ground, malformed, and out-of-envelope samples', () => {
    expect(thermalLiftIntensity(42, 270, 420, -330, 1, 0, 0, false)).toBe(0)
    expect(thermalLiftIntensity(Number.NaN, 270, 420, -330)).toBe(0)
    expect(thermalLiftIntensity(42, Number.NaN, 420, -330)).toBe(0)
    expect(thermalLiftIntensity(42, 270, THERMAL_MIN_ALTITUDE_M - 1, -330)).toBe(0)
    expect(thermalLiftIntensity(42, 270, THERMAL_FADE_ALTITUDE_M + 1, -330)).toBe(0)
  })

  it('damps the same pocket during precipitation and darkness', () => {
    const clear = thermalLiftIntensity(7, 900, 420, 900, 1, 0, 0)
    const storm = thermalLiftIntensity(7, 900, 420, 900, 0.25, 0.9, 0.4)
    expect(storm).toBeLessThanOrEqual(clear)
  })

  it('keeps a seeded world populated with reachable pockets', () => {
    let peak = 0
    for (let x = -1_800; x <= 1_800; x += 120) {
      for (let z = -1_800; z <= 1_800; z += 120) {
        peak = Math.max(peak, thermalLiftIntensity(42, x, 420, z))
      }
    }
    expect(peak).toBeGreaterThan(0.2)
  })
})
