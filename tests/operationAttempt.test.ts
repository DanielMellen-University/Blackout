import { describe, expect, it } from 'vitest'
import { chooseEnergy, chooseRoute, createAttempt, recordStage } from '../src/systems/operation/attempt'
import { buildOperationPlan, stageSpec } from '../src/systems/operation/plan'
import type { FlightSample } from '../src/systems/operation/samples'

function line(seed: number, route: 'valley' | 'ridge' | null, energy: 'conserve' | 'commit' | null, stage: 'ingress' | 'transit' | 'egress'): FlightSample[] {
  const spec = stageSpec(buildOperationPlan(seed, route, energy), stage)
  return Array.from({ length: 11 }, (_, index) => ({
    t: index * 0.4,
    x: spec.lateralM,
    y: spec.altitudeM,
    z: index * (spec.endZ / 10),
    speed: stage === 'egress' && energy === 'commit' ? 400 : 180,
    clearance: Math.max(50, spec.altitudeM - 200),
    airborne: true,
  }))
}

describe('operation attempt', () => {
  it('starts on ingress with no decisions', () => {
    const attempt = createAttempt(42)
    expect(attempt.phase).toBe('ingress')
    expect(attempt.route).toBeNull()
    expect(attempt.energy).toBeNull()
    expect(attempt.score).toBe(0)
  })
})
