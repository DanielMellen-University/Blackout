import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import type { AircraftImpact } from '../src/aircraft/Aircraft'
import { ChallengeRun, type LandingMetrics } from '../src/systems/ChallengeRun'
import { assessLanding, failedLandingCorrection, landingQualityForMetrics, touchdownKinematics } from '../src/systems/LandingAssessment'

const smooth: LandingMetrics = { verticalSpeed: -1, groundSpeed: 30, pitchRad: .12, rollRad: 0 }

describe('landing assessment', () => {
  it('keeps quality scores equivalent to the original scoring formula', () => {
    const finite = (value: number) => Number.isFinite(value) ? value : 0
    for (const verticalSpeed of [-12, -6, -1.2, 0, 3, Number.NaN]) {
      for (const groundSpeed of [-10, 32, 55, 100, Infinity]) {
        for (const rollRad of [0, .1, -.5, Number.NaN]) {
          const metrics = { verticalSpeed, groundSpeed, rollRad, pitchRad: .3 }
          const original = Math.max(0, Math.min(1,
            1 - Math.max(0, -finite(verticalSpeed) - 1.2) / 5 * .45
              - Math.max(0, finite(groundSpeed) - 32) / 38 * .3
              - Math.abs(finite(rollRad)) / (Math.PI / 5) * .2
              - (.3 - .22) / .65 * .05))
          expect(landingQualityForMetrics(metrics)).toBe(original)
        }
      }
    }
  })

  it('selects one correction from the largest weighted quality loss', () => {
    expect(assessLanding({ ...smooth, verticalSpeed: -6, groundSpeed: 50, rollRad: .2 })?.focus).toBe('sink')
    expect(assessLanding({ ...smooth, groundSpeed: 70, rollRad: .1 })?.focus).toBe('speed')
    expect(assessLanding({ ...smooth, rollRad: -.4 })?.focus).toBe('bank')
    expect(assessLanding({ ...smooth, pitchRad: -.6 })?.focus).toBe('pitch')
    expect(assessLanding(smooth)?.focus).toBe('smooth')
  })

  it('coaches runway placement only after touchdown control is clean', () => {
    expect(assessLanding({ ...smooth, baseDistanceM: 250 })?.focus).toBe('runway')
    expect(assessLanding({ ...smooth, baseDistanceM: 30, runwayLateralM: -25 })?.correction).toContain('runway center')
    expect(assessLanding({ ...smooth, headingErrorRad: .4 })?.focus).toBe('heading')
    expect(assessLanding({ ...smooth, baseDistanceM: 250, verticalSpeed: -6 })?.focus).toBe('sink')
    expect(assessLanding({ ...smooth, baseDistanceM: NaN, headingErrorRad: Infinity })?.focus).toBe('smooth')
  })

  it('reports contact metrics with correct units and no malformed praise', () => {
    expect(assessLanding({ ...smooth, verticalSpeed: -3.25, groundSpeed: 50, rollRad: -.2, pitchRad: .1 })?.telemetry)
      .toBe('Sink 3.3 m/s · 97 kt · Bank 11° · Pitch 6°')
    for (const field of ['verticalSpeed', 'groundSpeed', 'rollRad', 'pitchRad'] as const) {
      expect(assessLanding({ ...smooth, [field]: Number.NaN })).toBeUndefined()
    }
    expect(assessLanding({ ...smooth, verticalSpeed: -1e308, groundSpeed: 1e308 })?.telemetry)
      .toBe('Sink 999.0 m/s · 9999 kt · Bank 0° · Pitch 7°')
  })

  it('reads pre-impact horizontal speed rather than the resolved rollout velocity', () => {
    const impact: AircraftImpact = {
      point: new Vector3(), surfacePoint: new Vector3(), surfaceNormal: new Vector3(0, 1, 0),
      preImpactVelocity: new Vector3(30, -5, 40), verticalVelocity: -5,
      normalVelocity: -5, tangentialSpeed: 50, surface: 'land', gearDown: true, startedAirborne: true,
    }
    const aircraft = { impact, impactVy: -5, velocity: new Vector3(0, 0, 51) }
    const metrics = touchdownKinematics(aircraft, .1, -.05)
    expect(metrics).toEqual({ verticalSpeed: -5, groundSpeed: 50, pitchRad: .1, rollRad: -.05 })
    aircraft.velocity.set(0, 0, 10)
    impact.preImpactVelocity.set(0, 0, 0)
    expect(metrics.groundSpeed).toBe(50)
    expect(touchdownKinematics({ ...aircraft, impact: null, impactVy: -2 }, 0, 0).verticalSpeed).toBe(-2)
    expect(touchdownKinematics({ impact: null, impactVy: 0, velocity: new Vector3(3, -1, 4) }, 0, 0))
      .toEqual({ verticalSpeed: -1, groundSpeed: 5, pitchRad: 0, rollRad: 0 })
  })

  it('retains coaching for completed results without expanding persisted course history', () => {
    const entries = new Map<string, string>()
    const run = new ChallengeRun({ getItem: key => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value) } })
    run.reset('seed:landing-coach', 1)
    run.update(.1, 8)
    run.recordGate(1)
    const result = run.finishLanding({ ...smooth, verticalSpeed: -5 })!
    expect(result.landingDebrief?.focus).toBe('sink')
    expect(result.landingQuality).toBe(landingQualityForMetrics({ ...smooth, verticalSpeed: -5 }))
    for (const value of entries.values()) {
      expect(value).not.toContain('landingDebrief')
      expect(value).not.toContain('Soften the flare')
    }
  })

  it('gives specific recovery advice for each collision failure', () => {
    for (const reason of ['SINK RATE', 'IMPACT LOAD', 'GEAR UP', 'OVERSPEED', 'BANK LIMIT', 'PITCH LIMIT', 'ATTITUDE', 'SLOPE', 'OBSTACLE', 'WATER CONTACT']) {
      expect(failedLandingCorrection(reason)).not.toBe(failedLandingCorrection(undefined))
    }
    expect(failedLandingCorrection('GEAR UP')).toContain('landing gear')
    expect(failedLandingCorrection(undefined, true)).toContain('water contact')
    expect(failedLandingCorrection('<script>')).toBe(failedLandingCorrection(undefined))
  })
})
