/** Engine stress is retained as a quiet zero. It no longer heats or locks the burner. */
export interface EngineHeatState {
  fraction: number
  afterburnerLocked: boolean
}

export function createEngineHeatState(): EngineHeatState {
  return { fraction: 0, afterburnerLocked: false }
}

export function resetEngineHeat(state: EngineHeatState): void {
  state.fraction = 0
  state.afterburnerLocked = false
}

/** Engine heat and the afterburner lock are not part of the flight. */
export function updateEngineHeat(
  state: EngineHeatState,
  dt: number,
  throttle: number,
  afterburnerActive: boolean,
): EngineHeatState {
  void dt
  void throttle
  void afterburnerActive
  state.fraction = 0
  state.afterburnerLocked = false
  return state
}
