import { MathUtils } from 'three'

/** Lightweight arcade fuel state. Values are normalized to a 0..100 tank. */
export interface FuelState {
  capacity: number
  remaining: number
  fraction: number
}

export const FUEL_CAPACITY = 100
export const FUEL_LOW_FRACTION = 0.25
export const FUEL_CRITICAL_FRACTION = 0.1
/** Keep a small reserve so afterburner cannot strand the aircraft at zero. */
export const FUEL_AFTERBURNER_RESERVE_FRACTION = 0.05
/** Arcade refuel rate when the aircraft is stationary on the home strip. */
export const AIRFIELD_REFUEL_RATE = 8

/** Fuel units per second at idle, before throttle and afterburner multipliers. */
const IDLE_BURN_RATE = 0.008
const THROTTLE_BURN_RATE = 0.07
const AFTERBURNER_BURN_RATE = 0.38
const AFTERBURNER_MIN_THROTTLE = 0.05

export function createFuelState(): FuelState {
  return {
    capacity: FUEL_CAPACITY,
    remaining: FUEL_CAPACITY,
    fraction: 1,
  }
}

export function resetFuel(state: FuelState): void {
  state.capacity = FUEL_CAPACITY
  state.remaining = FUEL_CAPACITY
  state.fraction = 1
}

/** Consume fuel once per fixed simulation step and keep every field finite. */
export function updateFuel(
  state: FuelState,
  dt: number,
  throttle: number,
  boostRequested: boolean,
): FuelState {
  const safeDt = Number.isFinite(dt) ? MathUtils.clamp(dt, 0, 0.25) : 0
  const lever = Number.isFinite(throttle) ? MathUtils.clamp(throttle, 0, 1) : 0
  const safeCapacity = Number.isFinite(state.capacity) && state.capacity > 0
    ? state.capacity
    : FUEL_CAPACITY
  const safeRemaining = Number.isFinite(state.remaining)
    ? MathUtils.clamp(state.remaining, 0, safeCapacity)
    : safeCapacity
  const afterburner = boostRequested === true && lever >= AFTERBURNER_MIN_THROTTLE
  const burnRate = IDLE_BURN_RATE + lever * THROTTLE_BURN_RATE +
    (afterburner ? AFTERBURNER_BURN_RATE : 0)
  state.capacity = safeCapacity
  state.remaining = MathUtils.clamp(safeRemaining - burnRate * safeDt, 0, safeCapacity)
  state.fraction = safeCapacity > 0 ? state.remaining / safeCapacity : 0
  return state
}

/** Refill a grounded sortie without allowing malformed state to leak forward. */
export function refuelFuel(
  state: FuelState,
  dt: number,
  rate = AIRFIELD_REFUEL_RATE,
): FuelState {
  const safeDt = Number.isFinite(dt) ? MathUtils.clamp(dt, 0, 0.25) : 0
  const safeRate = Number.isFinite(rate) ? Math.max(0, rate) : AIRFIELD_REFUEL_RATE
  const safeCapacity = Number.isFinite(state.capacity) && state.capacity > 0
    ? state.capacity
    : FUEL_CAPACITY
  const safeRemaining = Number.isFinite(state.remaining)
    ? MathUtils.clamp(state.remaining, 0, safeCapacity)
    : safeCapacity
  state.capacity = safeCapacity
  state.remaining = MathUtils.clamp(safeRemaining + safeRate * safeDt, 0, safeCapacity)
  state.fraction = safeCapacity > 0 ? state.remaining / safeCapacity : 0
  return state
}

export function fuelPercent(state: Pick<FuelState, 'fraction'>): number {
  const fraction = Number.isFinite(state.fraction) ? MathUtils.clamp(state.fraction, 0, 1) : 0
  return Math.round(fraction * 100)
}

export function fuelWarningLevel(
  state: Pick<FuelState, 'fraction'>,
): 'normal' | 'low' | 'critical' {
  const fraction = Number.isFinite(state.fraction) ? MathUtils.clamp(state.fraction, 0, 1) : 0
  if (fraction <= FUEL_CRITICAL_FRACTION) return 'critical'
  if (fraction <= FUEL_LOW_FRACTION) return 'low'
  return 'normal'
}
