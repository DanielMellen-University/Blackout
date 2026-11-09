/** Each stage is a straight leg. Three gates sit on the 800 m spacing used by gated runs. */
export const STAGE_LENGTH_M = 2400
export const GATE_SPACING_M = 800
export const GATES_PER_STAGE = 3
export const CORRIDOR_HALF_WIDTH_M = 180
export const MIN_CLEARANCE_M = 40
/** Fixed physics step for the harness. Simulated time does not follow the wall clock. */
export const OPERATION_DT_SEC = 1 / 60

export function stageStartZ(index: number): number {
  return index * STAGE_LENGTH_M
}

export function stageEndZ(index: number): number {
  return (index + 1) * STAGE_LENGTH_M
}
