import { describe, expect, it } from 'vitest'
import { sortieStyleForResult } from '../src/systems/FlightStyle'

describe('sortie style debrief classifier', () => {
  it('prioritizes deadstick recovery over other telemetry', () => {
    expect(sortieStyleForResult({
      landingQuality: 0.95,
      bestPrecisionStreak: 4,
      deadstickScore: 1_500,
      peakSpeedKts: 980,
    })).toEqual({ id: 'survivor', label: 'SURVIVOR', detail: 'DEADSTICK RECOVERY' })
  })

  it('recognizes precise and exploratory sorties from bounded records', () => {
    expect(sortieStyleForResult({
      landingQuality: 0.94,
      landingLabel: 'butter',
      bestPrecisionStreak: 3,
      approachScore: 450,
    })).toEqual({ id: 'precision', label: 'PRECISION', detail: 'BUTTER TOUCHDOWN' })
    expect(sortieStyleForResult({
      landingQuality: 0.7,
      destinationCount: 2,
      biomeCount: 2,
    })).toEqual({ id: 'explorer', label: 'EXPLORER', detail: 'DEST X2' })
  })

  it('keeps speed and fallback labels finite when fields are malformed', () => {
    expect(sortieStyleForResult({
      landingQuality: Number.NaN,
      peakSpeedKts: 900,
    })).toEqual({ id: 'speed', label: 'SPEED', detail: 'TOP 900KT' })
    expect(sortieStyleForResult({
      landingQuality: Number.NaN,
      peakSpeedKts: Number.NaN,
      timeScore: 50_000,
      scoringFocus: 'pace',
    })).toEqual({ id: 'speed', label: 'SPEED', detail: 'PACE PUSH' })
    expect(sortieStyleForResult({
      landingQuality: Number.NaN,
      fuelRemainingPercent: Number.NaN,
    })).toEqual({ id: 'balanced', label: 'BALANCED', detail: 'HARD CIRCUIT' })
  })
})
