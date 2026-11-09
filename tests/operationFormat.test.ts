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

  it('renders a non-finite score as zero', () => {
    expect(formatOperationScore(Number.NaN)).toBe('0')
    expect(formatOperationScore(Number.POSITIVE_INFINITY)).toBe('0')
  })

  it('rounds speed to whole metres per second', () => {
    expect(formatOperationSpeed(231.8)).toBe('232 m/s')
  })

  it('leaves speed blank when the sample is missing a number', () => {
    expect(formatOperationSpeed(Number.NaN)).toBe('—')
  })

  it('rounds clearance to whole metres', () => {
    expect(formatOperationClearance(121.2)).toBe('121 m')
  })

  it('leaves clearance blank when it is not a number', () => {
    expect(formatOperationClearance(Number.NaN)).toBe('—')
  })

  it('names gold, silver and bronze', () => {
    expect(formatOperationMedal('gold')).toBe('Gold')
    expect(formatOperationMedal('silver')).toBe('Silver')
    expect(formatOperationMedal('bronze')).toBe('Bronze')
  })

  it('names a missing medal', () => {
    expect(formatOperationMedal('none')).toBe('No medal')
  })

  it('names valley', () => {
    expect(operationChoiceLabel('valley')).toBe('Valley')
  })

  it('names ridge', () => {
    expect(operationChoiceLabel('ridge')).toBe('Ridge')
  })

  it('names conserve', () => {
    expect(operationChoiceLabel('conserve')).toBe('Conserve')
  })

})
