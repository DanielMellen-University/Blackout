import { describe, expect, it } from 'vitest'
import { createAttempt, type OperationAttempt } from '../src/systems/operation/attempt'
import type { OperationBest } from '../src/systems/operation/save'
import { operationResultModel } from '../src/ui/operation/results'
import { formatOperationMedal, formatOperationScore, operationChoiceLabel } from '../src/ui/operation/format'

function finished(score: number, route: 'valley' | 'ridge' = 'valley', energy: 'conserve' | 'commit' = 'commit'): OperationAttempt {
  const stage = {
    id: 'ingress' as const,
    passed: true,
    reason: 'complete' as const,
    elapsedSec: 12,
    distanceM: 2400,
    peakSpeedMps: 200,
    minAltitudeM: 300,
    minClearanceM: 100,
    endAltitudeM: 320,
    timeScore: 1,
    flyingScore: 1,
    gateScore: 1,
    pathDeviationM: 4,
    altitudeErrorM: 12,
    speedErrorMps: 0,
    meanSpeedMps: 200,
    fuelUsed: 0.4,
    nitroUsed: 0,
    disciplineScore: 4000,
    score: 1,
  }
  return {
    ...createAttempt(42),
    phase: 'complete',
    route,
    energy,
    score,
    stages: {
      ingress: { ...stage, id: 'ingress' },
      transit: { ...stage, id: 'transit', elapsedSec: 10 },
      egress: { ...stage, id: 'egress', elapsedSec: 8 },
    },
  }
}

function best(score: number): OperationBest {
  const attempt = finished(score)
  return {
    id: 'ridge-relay',
    seed: 42,
    route: 'valley',
    energy: 'commit',
    score,
    stages: {
      ingress: attempt.stages.ingress!,
      transit: attempt.stages.transit!,
      egress: attempt.stages.egress!,
    },
  }
}

describe('operation results', () => {
  it('shows the score and a gold medal', () => {
    const result = operationResultModel(finished(61_472), best(61_472), null, true)
    expect(result.scoreLabel).toBe(formatOperationScore(61_472))
    expect(result.medalLabel).toBe('Gold')
    expect(result.medal).toBe('gold')
    expect(result.title).toBe('Ridge relay complete')
  })

  it('shows silver and bronze from the score bands', () => {
    expect(operationResultModel(finished(57_741), null, null, true).medalLabel).toBe(formatOperationMedal('silver'))
    expect(operationResultModel(finished(42_947), null, null, true).medalLabel).toBe('Bronze')
  })

  it('names the flown path and the airborne finish', () => {
    const result = operationResultModel(finished(61_472, 'valley', 'commit'), null, null, true)
    expect(result.pathLabel).toBe(`${operationChoiceLabel('valley')} then ${operationChoiceLabel('commit').toLowerCase()}`)
    expect(result.summary).toContain('complete in the air')
    expect(result.summary.toLowerCase()).not.toContain('land')
    expect(result.timeLabel).toBe('30.0 s')
    expect(result.stages.map(stage => stage.id)).toEqual(['ingress', 'transit', 'egress'])
    expect(result.stages[0]?.text).toContain('path 4 m')
    expect(result.stages[0]?.text).toContain('alt 12 m')
    expect(result.stages[0]?.text).toContain('fuel 0.4')
  })

  it('calls the first finish the best', () => {
    const result = operationResultModel(finished(42_947), best(42_947), null, true)
    expect(result.bestLabel).toBe('Best 42,947')
  })

  it('calls a higher finish a new best', () => {
    const result = operationResultModel(finished(61_472), best(61_472), best(42_947), true)
    expect(result.bestLabel).toBe('New best 61,472')
  })

  it('keeps the stored best when the finish is lower', () => {
    const result = operationResultModel(finished(42_947), best(61_472), best(61_472), true)
    expect(result.bestLabel).toBe('Best 61,472')
    expect(result.bestLabel).not.toContain('New best')
  })

  it('keeps the previous best when the stored best is missing', () => {
    const result = operationResultModel(finished(42_947), null, best(61_472), true)
    expect(result.bestLabel).toBe('Best 61,472')
  })

  it('does not call an equal score a new best', () => {
    const result = operationResultModel(finished(44_097), best(44_097), best(44_097), true)
    expect(result.bestLabel).toBe('Best 44,097')
  })

  it('withholds a medal and a replay when the run stops', () => {
    const attempt = { ...createAttempt(42), phase: 'failed' as const, score: 10 }
    const result = operationResultModel(attempt, best(42_947), best(42_947), false)
    expect(result.medalLabel).toBe('No medal')
    expect(result.canReplay).toBe(false)
    expect(result.title).toBe('Ridge relay stopped')
    expect(result.pathLabel).toBe('Unfinished')
    expect(result.bestLabel).toBe('Best 42,947')
    expect(`${result.title} ${result.summary} ${result.pathLabel}`.toLowerCase()).not.toContain('land')
  })

  it('offers replay only when a transcript was stored', () => {
    expect(operationResultModel(finished(61_472), null, null, true).canReplay).toBe(true)
    expect(operationResultModel(finished(61_472), null, null, false).canReplay).toBe(false)
  })

  it('says there is no best yet when nothing has finished', () => {
    const attempt = { ...createAttempt(42), phase: 'failed' as const }
    expect(operationResultModel(attempt, null, null, false).bestLabel).toBe('No best yet')
  })
})
