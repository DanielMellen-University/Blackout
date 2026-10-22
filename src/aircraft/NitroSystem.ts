import { BASELINE_GATE_AWARDS, MAX_MISSION_GATES } from '../systems/MissionGates'
import { flightConfig as C } from './flightConfig'

export interface NitroState {
  fraction: number
  depleted: boolean
  gateRefills: number
}
export function createNitroState(): NitroState {
  return { fraction: 1, depleted: false, gateRefills: 0 }
}
export function resetNitro(state: NitroState): void {
  Object.assign(state, createNitroState())
}
/** Returns the resolved burner command. Only actual burning consumes reserve. */
export function updateNitro(state: NitroState, dt: number, requested: boolean): boolean {
  if (!Number.isFinite(dt) || dt < 0) return false
  state.fraction = Number.isFinite(state.fraction) ? Math.max(0, Math.min(1, state.fraction)) : 0
  if (state.fraction <= 0) state.depleted = true
  if (state.depleted && state.fraction >= C.nitroRestartFraction) state.depleted = false
  const burning = requested && !state.depleted
  if (dt === 0) return burning
  state.fraction = Math.max(0, Math.min(1, state.fraction + dt *
    (burning ? -C.nitroDrainPerSecond : C.nitroRefillPerSecond)))
  if (burning && state.fraction <= 1e-10) {
    state.fraction = 0
    state.depleted = true
    return false
  }
  return burning
}
/** Called only by an accepted gate crossing, including the final gate. */
export function refillNitroAtGate(state: NitroState, totalGates = BASELINE_GATE_AWARDS): void {
  const count = Number.isFinite(totalGates) ? Math.max(1, Math.min(MAX_MISSION_GATES, totalGates)) : BASELINE_GATE_AWARDS
  state.fraction = Math.min(1, Math.max(0, state.fraction) + C.nitroGateRefill * BASELINE_GATE_AWARDS / count)
  if (state.fraction >= C.nitroRestartFraction) state.depleted = false
  state.gateRefills += 1
}
