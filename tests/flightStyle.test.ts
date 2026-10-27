import { describe, expect, it } from 'vitest'
import {
  normalizeSortieStyle,
  sortieStyleForResult,
  sortieStyleLabel,
} from '../src/systems/FlightStyle'

describe('sortie style debrief classifier', () => {
  it('uses gate precision instead of touchdown telemetry for gated runs', () => {
    expect(sortieStyleForResult({
      landingQuality: 0.95,
      bestPrecisionStreak: 4,
      deadstickScore: 1_500,
      peakSpeedKts: 980,
    })).toEqual({ id: 'precision', label: 'PRECISION', detail: 'GATE STREAK X4' })
  })

  it('recognizes precise and exploratory sorties from bounded records', () => {
    expect(sortieStyleForResult({
      landingQuality: 0.94,
      landingLabel: 'butter',
      bestPrecisionStreak: 3,
      approachScore: 450,
    })).toEqual({ id: 'precision', label: 'PRECISION', detail: 'GATE STREAK X3' })
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
    })).toEqual({ id: 'balanced', label: 'BALANCED', detail: 'GATE RUN' })
  })

  it('preserves the free-flight touchdown style', () => {
    expect(sortieStyleForResult({ freeFlight: true, landingQuality: 0.94, bestPrecisionStreak: 3 }))
      .toEqual({ id: 'precision', label: 'PRECISION', detail: 'BUTTER TOUCHDOWN' })
  })

  it('normalizes persisted style identifiers without leaking unknown values', () => {
    expect(normalizeSortieStyle('explorer')).toBe('explorer')
    expect(sortieStyleLabel('survivor')).toBe('SURVIVOR')
    expect(normalizeSortieStyle('unknown')).toBeUndefined()
    expect(normalizeSortieStyle(null)).toBeUndefined()
  })
})
