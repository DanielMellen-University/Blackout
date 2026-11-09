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

  it('walks stages in order and stops after egress', () => {
    expect(stageIndex('ingress')).toBe(0)
    expect(stageIndex('transit')).toBe(1)
    expect(stageIndex('egress')).toBe(2)
    expect(nextStage('ingress')).toBe('transit')
    expect(nextStage('transit')).toBe('egress')
    expect(nextStage('egress')).toBeNull()
  })
})
