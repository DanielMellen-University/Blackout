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
})
