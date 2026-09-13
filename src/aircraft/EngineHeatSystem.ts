import { MathUtils } from 'three'

/** Small arcade engine-stress state. Heat informs the pilot without changing thrust. */
export interface EngineHeatState {
  fraction: number
}

const DRY_HEAT_RATE = 0.12
const AFTERBURNER_HEAT_RATE = 0.28
const COOL_RATE = 0.06

export function createEngineHeatState(): EngineHeatState {
  return { fraction: 0 }
}

export function resetEngineHeat(state: EngineHeatState): void {
  state.fraction = 0
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
  return state
}
