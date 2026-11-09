import { GATE_SPACING_M, GATES_PER_STAGE, stageStartZ } from './layout'
import { normalizeOperationSeed } from './seed'

export interface StageGate {
  x: number
  y: number
  z: number
  fwdX: number
  fwdZ: number
}

/** Seeded lateral line, in metres. The same seed always returns the same offset. */
export function lateralForSeed(seed: number): number {
  const safe = normalizeOperationSeed(seed)
  return ((safe % 9) - 4) * 25
}

/** Three gates facing down-track, spaced evenly through the stage. */
export function buildStageGates(index: number, altitude: number, lateral: number): StageGate[] {
  const gates: StageGate[] = []
  for (let gate = 1; gate <= GATES_PER_STAGE; gate += 1) {
    gates.push({
      x: lateral,
      y: altitude,
      z: stageStartZ(index) + gate * GATE_SPACING_M,
      fwdX: 0,
      fwdZ: 1,
    })
  }
  return gates
}
