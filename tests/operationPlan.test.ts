import { describe, expect, it } from 'vitest'
import { buildOperationPlan, stageSpec } from '../src/systems/operation/plan'
import { OPERATION_FINISH, OPERATION_STAGES } from '../src/systems/operation/identity'

describe('operation plan', () => {
  it('builds exactly three airborne stages', () => {
    const plan = buildOperationPlan(42, null, null)
    expect(plan.finish).toBe(OPERATION_FINISH)
    expect(plan.stages.map(stage => stage.id)).toEqual([...OPERATION_STAGES])
    expect(plan.stages).toHaveLength(3)
    for (const stage of plan.stages) expect(stage.gates).toHaveLength(3)
  })

  it('replays the same seed as the same plan', () => {
    expect(buildOperationPlan(42, 'valley', 'conserve')).toEqual(buildOperationPlan(42, 'valley', 'conserve'))
  })

  it('leaves ingress unchanged when later decisions change', () => {
    const valley = stageSpec(buildOperationPlan(42, 'valley', 'conserve'), 'ingress')
    const ridge = stageSpec(buildOperationPlan(42, 'ridge', 'commit'), 'ingress')
    expect(valley).toEqual(ridge)
  })

  it('changes the later stages across the four decision paths', () => {
    const paths = [
      buildOperationPlan(42, 'valley', 'conserve'),
      buildOperationPlan(42, 'valley', 'commit'),
      buildOperationPlan(42, 'ridge', 'conserve'),
      buildOperationPlan(42, 'ridge', 'commit'),
    ]
    const signatures = paths.map(plan => JSON.stringify(plan.stages.slice(1)))
    expect(new Set(signatures).size).toBe(4)
  })
})
