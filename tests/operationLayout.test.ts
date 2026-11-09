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

  it('abuts the three stages on z', () => {
    expect(stageStartZ(0)).toBe(0)
    expect(stageEndZ(0)).toBe(stageStartZ(1))
    expect(stageEndZ(1)).toBe(stageStartZ(2))
    expect(stageEndZ(2)).toBe(7200)
  })

  it('steps the harness at a fixed 60 Hz', () => {
    expect(OPERATION_DT_SEC).toBeCloseTo(1 / 60, 12)
  })
})
