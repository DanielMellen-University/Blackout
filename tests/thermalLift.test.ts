import { describe, expect, it } from 'vitest'
import {
  THERMAL_FADE_ALTITUDE_M,
  THERMAL_MIN_ALTITUDE_M,
  nearestThermalPocket,
  thermalPocketForCell,
  thermalLiftIntensity,
} from '../src/systems/ThermalLift'

describe('deterministic thermal lift', () => {
  it('shares stable pocket geometry with route planning', () => {
    const pocket = thermalPocketForCell(27, 0, 0)
    expect(pocket).not.toBeNull()
    expect(pocket!.radius).toBeGreaterThanOrEqual(360)
    expect(pocket!.radius).toBeLessThanOrEqual(580)
    expect(pocket!.strength).toBeGreaterThanOrEqual(0.58)
    expect(pocket!.strength).toBeLessThanOrEqual(1)
    expect(nearestThermalPocket(27, pocket!.x, pocket!.z)).toEqual(pocket)
    expect(nearestThermalPocket(Number.NaN, 0, 0)).toBeNull()
  })

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
    expect(thermalLiftIntensity(42, 270, 420, -330, 1, 0, 0, 'true' as unknown as boolean)).toBe(0)
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

  it('keeps diagonal pockets alive at streamed-cell corners', () => {
    const diagonal = thermalLiftIntensity(44_767, 1_780, 420, 1_780)
    expect(diagonal).toBeGreaterThan(0.1)
    expect(nearestThermalPocket(44_767, 1_780, 1_780)?.cellX).toBe(1)
    expect(nearestThermalPocket(44_767, 1_780, 1_780)?.cellZ).toBe(1)
  })
})
