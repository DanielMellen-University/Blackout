import { MathUtils } from 'three'

/** Small arcade engine-stress state. Heat informs the pilot without changing thrust. */
export interface EngineHeatState {
  fraction: number
  afterburnerLocked: boolean
}

export const ENGINE_HEAT_LOCKOUT_FRACTION = 0.98
export const ENGINE_HEAT_REENABLE_FRACTION = 0.58

const DRY_HEAT_RATE = 0.1
const AFTERBURNER_HEAT_RATE = 0.18
const COOL_RATE = 0.08

export function createEngineHeatState(): EngineHeatState {
  return { fraction: 0, afterburnerLocked: false }
}

export function resetEngineHeat(state: EngineHeatState): void {
  state.fraction = 0
  state.afterburnerLocked = false
}

/** Integrate bounded engine heat once per fixed step without allocations. */
export function updateEngineHeat(
  state: EngineHeatState,
  dt: number,
  throttle: number,
  afterburnerActive: boolean,
): EngineHeatState {
  const safeDt = Number.isFinite(dt) ? MathUtils.clamp(dt, 0, 0.25) : 0
  const lever = Number.isFinite(throttle) ? MathUtils.clamp(throttle, 0, 1) : 0
  const heatRate = lever * DRY_HEAT_RATE + (afterburnerActive ? AFTERBURNER_HEAT_RATE : 0)
  const next = Number.isFinite(state.fraction) ? state.fraction + (heatRate - COOL_RATE) * safeDt : 0
  state.fraction = MathUtils.clamp(next, 0, 1)
  if (state.afterburnerLocked) {
    if (state.fraction <= ENGINE_HEAT_REENABLE_FRACTION) state.afterburnerLocked = false
  } else if (state.fraction >= ENGINE_HEAT_LOCKOUT_FRACTION) {
    state.afterburnerLocked = true
  }
  return state
}
