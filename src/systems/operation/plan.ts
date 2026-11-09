import {
  stageAllowance,
  stageAltitude,
  stageBoost,
  stageFuelBudget,
  stageSpeedBand,
  stageWeights,
  type SpeedBand,
  type StageWeights,
} from './bands'
import type { EnergyChoice, RouteChoice } from './choices'
import { buildStageGates, lateralForSeed, type StageGate } from './gates'
import { OPERATION_FINISH, OPERATION_ID, OPERATION_STAGES, stageIndex, type OperationStageId } from './identity'
import { stageEndZ } from './layout'
import { normalizeOperationSeed } from './seed'

export interface StageSpec {
  id: OperationStageId
  index: number
  altitudeM: number
  timeAllowanceSec: number
  weights: StageWeights
  lateralM: number
  gates: readonly StageGate[]
  endZ: number
  speedBand: SpeedBand
  fuelBudget: number
  boost: boolean
}

export interface OperationPlan {
  id: typeof OPERATION_ID
  seed: number
  finish: typeof OPERATION_FINISH
  route: RouteChoice | null
  energy: EnergyChoice | null
  stages: readonly [StageSpec, StageSpec, StageSpec]
}

/** Build the three-stage line. Decisions change later stages and leave ingress fixed. */
export function buildOperationPlan(
  seed: number,
  route: RouteChoice | null,
  energy: EnergyChoice | null,
): OperationPlan {
  const safe = normalizeOperationSeed(seed)
  const lateralM = lateralForSeed(safe)
  const stages = OPERATION_STAGES.map((id, index) => {
    const altitudeM = stageAltitude(id, route, energy)
    return {
      id,
      index,
      altitudeM,
      timeAllowanceSec: stageAllowance(id, route, energy),
      weights: stageWeights(id, route, energy),
      lateralM,
      gates: buildStageGates(index, altitudeM, lateralM),
      endZ: stageEndZ(index),
      speedBand: stageSpeedBand(id, route, energy),
      fuelBudget: stageFuelBudget(id, energy),
      boost: stageBoost(id, energy),
    }
  }) as unknown as readonly [StageSpec, StageSpec, StageSpec]
  return {
    id: OPERATION_ID,
    seed: safe,
    finish: OPERATION_FINISH,
    route,
    energy,
    stages,
  }
}

export function stageSpec(plan: OperationPlan, id: OperationStageId): StageSpec {
  return plan.stages[stageIndex(id)]!
}
