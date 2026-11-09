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

  it('moves from ingress to the route choice after a pass', () => {
    const started = createAttempt(42)
    const step = recordStage(started, line(42, null, null, 'ingress'))
    expect(step.ok).toBe(true)
    expect(step.attempt.phase).toBe('route-choice')
    expect(step.attempt.stages.ingress?.passed).toBe(true)
  })

  it('stops the run when a stage fails', () => {
    const step = recordStage(createAttempt(42), line(42, null, null, 'ingress').map(sample => ({ ...sample, airborne: false })))
    expect(step.attempt.phase).toBe('failed')
    expect(step.attempt.failure).toBe('ground')
    expect(chooseRoute(step.attempt, 'valley').ok).toBe(false)
  })

  it('rejects a route choice before ingress is complete', () => {
    expect(chooseRoute(createAttempt(42), 'valley')).toMatchObject({ ok: false, reason: 'route-not-open' })
  })

  it('rejects an unknown route', () => {
    const ready = recordStage(createAttempt(42), line(42, null, null, 'ingress')).attempt
    expect(chooseRoute(ready, 'commit')).toMatchObject({ ok: false, reason: 'bad-route' })
  })

  it('rejects a second route choice', () => {
    const ready = recordStage(createAttempt(42), line(42, null, null, 'ingress')).attempt
    const chosen = chooseRoute(ready, 'valley').attempt
    expect(chooseRoute(chosen, 'ridge').ok).toBe(false)
  })

  it('runs all three stages and banks the decision bonuses', () => {
    let attempt = createAttempt(42)
    attempt = recordStage(attempt, line(42, null, null, 'ingress')).attempt
    attempt = chooseRoute(attempt, 'valley').attempt
    attempt = recordStage(attempt, line(42, 'valley', null, 'transit')).attempt
    expect(attempt.phase).toBe('energy-choice')
    attempt = chooseEnergy(attempt, 'commit').attempt
    const beforeEgress = attempt.score
    attempt = recordStage(attempt, line(42, 'valley', 'commit', 'egress')).attempt
    expect(attempt.phase).toBe('complete')
    expect(attempt.score).toBeGreaterThan(beforeEgress)
    expect(attempt.failure).toBeNull()
    const stageSum = (attempt.stages.ingress?.score ?? 0) + (attempt.stages.transit?.score ?? 0) + (attempt.stages.egress?.score ?? 0)
    expect(attempt.score).toBeGreaterThan(stageSum)
  })
})
