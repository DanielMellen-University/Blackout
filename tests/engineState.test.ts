import { describe, expect, it } from 'vitest'
import { createEngineState, resolveEngineState } from '../src/aircraft/EngineState'
import { flightConfig as C } from '../src/aircraft/flightConfig'
import { FUEL_AFTERBURNER_RESERVE_FRACTION } from '../src/aircraft/FuelSystem'

describe('resolveEngineState', () => {
  it('does not light afterburner with a closed throttle', () => {
    const out = createEngineState()
    resolveEngineState({ throttle: 0, boost: true }, out)
    expect(out.afterburnerRequested).toBe(true)
    expect(out.afterburnerActive).toBe(false)
    expect(out.afterburnerHeatLocked).toBe(false)
    expect(out.targetSpeed).toBe(0)
    expect(out.maxSpeed).toBe(C.maxSpeed)
  })

  it('sets a level equilibrium from the lever instead of a 1543 m/s seek', () => {
    const out = createEngineState()
    resolveEngineState({ throttle: 0.5, boost: true }, out)
    expect(out.afterburnerActive).toBe(true)
    expect(out.targetSpeed).toBeCloseTo(Math.sqrt(0.5) * C.cruiseSpeedBoost)
    expect(out.targetSpeed).toBeLessThan(500)
    expect(out.maxSpeed).toBe(C.maxSpeed)
    expect(out.maxSpeed).toBeLessThan(1543)
    expect(C.cruiseSpeed).toBeLessThan(400)
    expect(C.cruiseSpeedBoost).toBeGreaterThan(C.cruiseSpeed)
    expect(C.cruiseSpeedBoost).toBeLessThan(C.maxSpeed)
  })

  it('contains malformed engine controls at a safe idle state', () => {
    const out = createEngineState()
    resolveEngineState({ throttle: Number.NaN, boost: 1 as unknown as boolean }, out)
    expect(out.lever).toBe(0)
    expect(out.afterburnerRequested).toBe(false)
    expect(out.afterburnerActive).toBe(false)
    expect(out.targetSpeed).toBe(0)
    expect(Number.isFinite(out.effectivePower)).toBe(true)
  })

  it('cuts afterburner and thrust demand when the tank is empty', () => {
    const out = createEngineState()
    resolveEngineState({ throttle: 1, boost: true }, out, 0)
    expect(out.afterburnerRequested).toBe(true)
    expect(out.afterburnerActive).toBe(false)
    expect(out.fuelAvailable).toBe(false)
    expect(out.targetSpeed).toBe(0)
    expect(out.maxAcceleration).toBe(0)
    expect(out.effectivePower).toBe(0)
  })

  it('keeps afterburner available in the old reserve band until the tank is empty', () => {
    const out = createEngineState()
    resolveEngineState({ throttle: 1, boost: true }, out, FUEL_AFTERBURNER_RESERVE_FRACTION)
    expect(out.afterburnerActive).toBe(true)
    expect(out.afterburnerHeatLocked).toBe(false)
    expect(out.fuelAvailable).toBe(true)
    expect(out.targetSpeed).toBeCloseTo(Math.sqrt(1) * C.cruiseSpeedBoost)
  })

  it('ignores an engine-heat lock and keeps the burner lit', () => {
    const out = createEngineState()
    resolveEngineState({ throttle: 1, boost: true }, out, 1, true)
    expect(out.afterburnerRequested).toBe(true)
    expect(out.afterburnerHeatLocked).toBe(false)
    expect(out.afterburnerActive).toBe(true)
    expect(out.targetSpeed).toBeCloseTo(C.cruiseSpeedBoost)
  })
})
