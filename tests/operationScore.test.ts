import { describe, expect, it } from 'vitest'
import { buildOperationPlan, stageSpec } from '../src/systems/operation/plan'
import {
  COMMIT_BONUS,
  COMMIT_SPEED_MPS,
  VALLEY_BONUS,
  VALLEY_CLEARANCE_M,
  decisionBonus,
  flyingScoreFor,
  scoreStage,
  timeScoreFor,
} from '../src/systems/operation/score'
import type { FlightSample } from '../src/systems/operation/samples'
import type { StageResult } from '../src/systems/operation/score'

function line(spec: ReturnType<typeof stageSpec>, overrides: Partial<FlightSample> = {}): FlightSample[] {
  return Array.from({ length: 11 }, (_, index) => ({
    t: index * 0.4,
    x: spec.lateralM,
    y: spec.altitudeM,
    z: index * (spec.endZ / 10),
    speed: 180,
    clearance: spec.altitudeM - 200,
    airborne: true,
    ...overrides,
  }))
}

function result(partial: Partial<StageResult>): StageResult {
  return {
    id: 'transit',
    passed: true,
    reason: 'complete',
    elapsedSec: 10,
    distanceM: 2400,
    peakSpeedMps: 200,
    minAltitudeM: 300,
    minClearanceM: 100,
    endAltitudeM: 300,
    timeScore: 1,
    flyingScore: 1,
    gateScore: 1,
    score: 3,
    ...partial,
  }
}

describe('operation scoring', () => {
  it('pays remaining time and clamps the extremes', () => {
    expect(timeScoreFor(10, 16)).toBe(600)
    expect(timeScoreFor(20, 16)).toBe(-400)
    expect(timeScoreFor(0, 1000)).toBe(8000)
    expect(timeScoreFor(1000, 0)).toBe(-5000)
    expect(timeScoreFor(Number.NaN, 10)).toBe(0)
  })

  it('scores a low trace above a high trace', () => {
    const weights = { low: 1.6, terrain: 1.5, speed: 0.6 }
    const low = line(stageSpec(buildOperationPlan(42, 'valley', null), 'transit'))
    const high = low.map(sample => ({ ...sample, y: 900, clearance: 700 }))
    expect(flyingScoreFor(low, weights)).toBeGreaterThan(flyingScoreFor(high, weights))
  })

  it('passes an airborne trace that reaches the stage end inside the allowance', () => {
    const spec = stageSpec(buildOperationPlan(42, 'valley', 'conserve'), 'ingress')
    const scored = scoreStage(spec, line(spec))
    expect(scored.passed).toBe(true)
    expect(scored.reason).toBe('complete')
    expect(scored.score).toBeGreaterThan(0)
  })

  it('banks nothing for ground contact', () => {
    const spec = stageSpec(buildOperationPlan(42, null, null), 'ingress')
    const scored = scoreStage(spec, line(spec, { airborne: false }))
    expect(scored.reason).toBe('ground')
    expect(scored.score).toBe(0)
  })

  it('fails a trace that drops through the clearance floor', () => {
    const spec = stageSpec(buildOperationPlan(42, null, null), 'ingress')
    expect(scoreStage(spec, line(spec, { clearance: 10 })).reason).toBe('clearance')
  })

  it('fails a trace that leaves the corridor', () => {
    const spec = stageSpec(buildOperationPlan(42, null, null), 'ingress')
    expect(scoreStage(spec, line(spec, { x: spec.lateralM + 400 })).reason).toBe('off-corridor')
  })

  it('fails a trace that stops short of the stage end', () => {
    const spec = stageSpec(buildOperationPlan(42, null, null), 'ingress')
    const short = line(spec).map(sample => ({ ...sample, z: sample.z * 0.2 }))
    expect(scoreStage(spec, short).reason).toBe('incomplete')
  })

  it('fails a trace that overruns the allowance', () => {
    const spec = stageSpec(buildOperationPlan(42, 'valley', null), 'transit')
    const slow = line(spec).map((sample, index) => ({ ...sample, t: index * 3 }))
    expect(scoreStage(spec, slow).reason).toBe('timeout')
    expect(scoreStage(spec, slow).score).toBe(0)
  })

  it('pays the valley bonus only for a low transit', () => {
    const low = result({ minClearanceM: VALLEY_CLEARANCE_M })
    const high = result({ minClearanceM: VALLEY_CLEARANCE_M + 1 })
    expect(decisionBonus('valley', null, low, undefined)).toBe(VALLEY_BONUS)
    expect(decisionBonus('valley', null, high, undefined)).toBe(0)
    expect(decisionBonus('ridge', null, low, undefined)).toBe(0)
    expect(decisionBonus('valley', null, result({ passed: false }), undefined)).toBe(0)
  })

  it('pays the commit bonus only when egress actually carried speed', () => {
    const fast = result({ id: 'egress', peakSpeedMps: COMMIT_SPEED_MPS })
    const slow = result({ id: 'egress', peakSpeedMps: COMMIT_SPEED_MPS - 1 })
    expect(decisionBonus(null, 'commit', undefined, fast)).toBe(COMMIT_BONUS)
    expect(decisionBonus(null, 'commit', undefined, slow)).toBe(0)
    expect(decisionBonus(null, 'conserve', undefined, fast)).toBe(0)
    expect(decisionBonus('valley', 'commit', result({ minClearanceM: 100 }), fast)).toBe(VALLEY_BONUS + COMMIT_BONUS)
  })
})
