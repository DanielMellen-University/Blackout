import { describe, expect, it } from 'vitest'
import {
  GATE_SPACING_M,
  GATES_PER_STAGE,
  OPERATION_DT_SEC,
  STAGE_LENGTH_M,
  stageEndZ,
  stageStartZ,
} from '../src/systems/operation/layout'

describe('operation layout', () => {
  it('gives each stage three gates at 800 m', () => {
    expect(GATES_PER_STAGE).toBe(3)
    expect(GATE_SPACING_M).toBe(800)
    expect(STAGE_LENGTH_M).toBe(2400)
  })
})
