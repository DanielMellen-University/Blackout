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
    const result = operationResultModel(finished(48_516), best(48_516), null, true)
    expect(result.scoreLabel).toBe(formatOperationScore(48_516))
    expect(result.medalLabel).toBe('Gold')
    expect(result.medal).toBe('gold')
    expect(result.title).toBe('Ridge relay complete')
  })

})
