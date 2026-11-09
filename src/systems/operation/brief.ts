import type { OperationPhase } from './attempt'
import { OPERATION_LABEL, OPERATION_STAGE_COUNT, stageIndex, type OperationStageId } from './identity'
import { stageSpec, type OperationPlan } from './plan'
import { OPERATION_TERRAIN } from './terrain'

function stageForPhase(phase: OperationPhase): OperationStageId {
  if (phase === 'route-choice' || phase === 'transit') return 'transit'
  if (phase === 'energy-choice' || phase === 'egress' || phase === 'complete') return 'egress'
  return 'ingress'
}

/** Short brief. The run finishes in the air. */
export function operationBrief(plan: OperationPlan, phase: OperationPhase): string {
  if (phase === 'failed') return `${OPERATION_LABEL} stopped before the last gate. The run did not finish.`
  if (phase === 'complete') {
    return `${OPERATION_LABEL} complete in the air. ${plan.route} then ${plan.energy}.`
  }
  const id = stageForPhase(phase)
  const spec = stageSpec(plan, id)
  const aboveFloor = Math.round(spec.altitudeM - OPERATION_TERRAIN.baseHeight)
  const prompt = phase === 'route-choice'
    ? ' Choose valley or ridge before the next stage.'
    : phase === 'energy-choice'
      ? ' Choose conserve or commit before the next stage.'
      : ''
  return `${OPERATION_LABEL}, stage ${stageIndex(id) + 1} of ${OPERATION_STAGE_COUNT}. ${id} at ${aboveFloor} m above the floor, ${spec.gates.length} gates, finish in the air.${prompt}`
}
