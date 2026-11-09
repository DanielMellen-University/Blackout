/** One replayable operation. Three stages, in this order, and no others. */
export const OPERATION_ID = 'ridge-relay' as const
export const OPERATION_LABEL = 'Ridge relay'
export const OPERATION_STAGE_COUNT = 3 as const
export const OPERATION_STAGES = ['ingress', 'transit', 'egress'] as const
export type OperationStageId = typeof OPERATION_STAGES[number]
/** Gated stages finish in the air. The operation never requires a landing. */
export const OPERATION_FINISH = 'airborne' as const

export function isOperationStageId(value: unknown): value is OperationStageId {
  return typeof value === 'string' && OPERATION_STAGES.some(stage => stage === value)
}

export function stageIndex(id: OperationStageId): number {
  return OPERATION_STAGES.indexOf(id)
}

/** The stage that follows `id`, or null after egress. */
export function nextStage(id: OperationStageId): OperationStageId | null {
  return OPERATION_STAGES[stageIndex(id) + 1] ?? null
}
