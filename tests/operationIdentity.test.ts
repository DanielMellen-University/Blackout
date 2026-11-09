import { describe, expect, it } from 'vitest'
import {
  OPERATION_FINISH,
  OPERATION_ID,
  OPERATION_LABEL,
  OPERATION_STAGE_COUNT,
  OPERATION_STAGES,
  isOperationStageId,
  nextStage,
  stageIndex,
} from '../src/systems/operation/identity'

describe('operation identity', () => {
  it('names one three-stage operation', () => {
    expect(OPERATION_ID).toBe('ridge-relay')
    expect(OPERATION_LABEL).toBe('Ridge relay')
    expect(OPERATION_STAGE_COUNT).toBe(3)
    expect([...OPERATION_STAGES]).toEqual(['ingress', 'transit', 'egress'])
  })
})
