import { describe, expect, it } from 'vitest'
import { stageAllowance, stageAltitude, stageBoost, stageThrottle, stageWeights } from '../src/systems/operation/bands'

describe('operation bands', () => {
  it('keeps ingress fixed before either decision', () => {
    expect(stageAltitude('ingress', null, null)).toBe(stageAltitude('ingress', 'ridge', 'commit'))
    expect(stageAllowance('ingress', 'valley', 'conserve')).toBe(stageAllowance('ingress', 'ridge', 'commit'))
    expect(stageThrottle('ingress', 'valley', 'commit')).toBe(stageThrottle('ingress', 'ridge', 'conserve'))
    expect(stageBoost('ingress', 'commit')).toBe(false)
  })
})
