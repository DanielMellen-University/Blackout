import { describe, expect, it } from 'vitest'
import { stageAllowance, stageAltitude, stageBoost, stageThrottle, stageWeights } from '../src/systems/operation/bands'

describe('operation bands', () => {
  it('keeps ingress fixed before either decision', () => {
    expect(stageAltitude('ingress', null, null)).toBe(stageAltitude('ingress', 'ridge', 'commit'))
    expect(stageAllowance('ingress', 'valley', 'conserve')).toBe(stageAllowance('ingress', 'ridge', 'commit'))
    expect(stageThrottle('ingress', 'valley', 'commit')).toBe(stageThrottle('ingress', 'ridge', 'conserve'))
    expect(stageBoost('ingress', 'commit')).toBe(false)
  })

  it('puts the valley below the ridge and tightens its time', () => {
    expect(stageAltitude('transit', 'valley', null)).toBeLessThan(stageAltitude('transit', 'ridge', null))
    expect(stageAllowance('transit', 'valley', null)).toBeLessThan(stageAllowance('transit', 'ridge', null))
    expect(stageWeights('transit', 'valley', null).terrain).toBeGreaterThan(stageWeights('transit', 'ridge', null).terrain)
    expect(stageWeights('transit', 'ridge', null).speed).toBeGreaterThan(stageWeights('transit', 'valley', null).speed)
  })

  it('makes commit faster and tighter than conserve on the egress leg', () => {
    expect(stageThrottle('egress', 'valley', 'commit')).toBeGreaterThan(stageThrottle('egress', 'valley', 'conserve'))
    expect(stageAllowance('egress', 'ridge', 'commit')).toBeLessThan(stageAllowance('egress', 'ridge', 'conserve'))
    expect(stageWeights('egress', 'valley', 'commit').speed).toBeGreaterThan(stageWeights('egress', 'valley', 'conserve').speed)
    expect(stageBoost('egress', 'commit')).toBe(true)
    expect(stageBoost('egress', 'conserve')).toBe(false)
    expect(stageBoost('transit', 'commit')).toBe(false)
  })
})
