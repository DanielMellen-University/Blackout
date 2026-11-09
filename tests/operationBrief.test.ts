import { describe, expect, it } from 'vitest'
import { operationBrief } from '../src/systems/operation/brief'
import { buildOperationPlan } from '../src/systems/operation/plan'

describe('operation brief', () => {
  it('names the stage count and an airborne finish', () => {
    const text = operationBrief(buildOperationPlan(42, null, null), 'ingress')
    expect(text).toContain('stage 1 of 3')
    expect(text).toContain('finish in the air')
    expect(text.toLowerCase()).not.toContain('land')
  })
})
