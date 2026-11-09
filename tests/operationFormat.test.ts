import { describe, expect, it } from 'vitest'
import {
  formatOperationClearance,
  formatOperationMedal,
  formatOperationScore,
  formatOperationSpeed,
  operationChoiceLabel,
} from '../src/ui/operation/format'
import { operationLegProgress, operationHudModel } from '../src/ui/operation/hud'
import { createAttempt } from '../src/systems/operation/attempt'
import type { FlightSample } from '../src/systems/operation/samples'
import { operationStepsPerFrame, operationReplayStepsPerFrame } from '../src/ui/operation/pace'

const sample = (z: number, airborne = true): FlightSample => ({
  t: 1, x: 0, y: 400, z, speed: 10.4, clearance: 40.6, airborne,
})

describe('operation formatting', () => {
  it('groups a finished score', () => {
    expect(formatOperationScore(48516)).toBe('48,516')
  })

})
