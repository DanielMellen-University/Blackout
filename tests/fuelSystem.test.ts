import { describe, expect, it } from 'vitest'
import {
  FUEL_CRITICAL_FRACTION,
  FUEL_LOW_FRACTION,
  createFuelState,
  fuelPercent,
  fuelWarningLevel,
  resetFuel,
  updateFuel,
} from '../src/aircraft/FuelSystem'

describe('arcade fuel system', () => {
  it('burns substantially more fuel with afterburner than dry power', () => {
    const dry = createFuelState()
    const boost = createFuelState()
    updateFuel(dry, 10, 1, false)
    updateFuel(boost, 10, 1, true)
    expect(dry.remaining).toBeGreaterThan(boost.remaining)
    expect(boost.remaining).toBeGreaterThan(0)
    expect(dry.fraction).toBeCloseTo(dry.remaining / dry.capacity)
  })

  it('clamps malformed steps and can reset the tank', () => {
    const state = createFuelState()
    state.remaining = Number.NaN
    state.capacity = 0
    updateFuel(state, Number.NaN, Number.NaN, true)
    expect(state.remaining).toBe(state.capacity)
    expect(state.fraction).toBe(1)
    state.remaining = 0
    state.fraction = 0
    resetFuel(state)
    expect(state.remaining).toBe(100)
    expect(state.fraction).toBe(1)
  })

  it('exposes stable warning bands for the HUD', () => {
    expect(fuelWarningLevel({ fraction: 1 })).toBe('normal')
    expect(fuelWarningLevel({ fraction: FUEL_LOW_FRACTION })).toBe('low')
    expect(fuelWarningLevel({ fraction: FUEL_CRITICAL_FRACTION })).toBe('critical')
    expect(fuelWarningLevel({ fraction: Number.NaN })).toBe('critical')
    expect(fuelPercent({ fraction: 0.735 })).toBe(74)
    expect(fuelPercent({ fraction: Number.POSITIVE_INFINITY })).toBe(0)
  })
})
