import type { Aircraft } from '../aircraft/Aircraft'
import type { LandingMetrics } from './ChallengeRun'
import { MS_TO_KTS } from '../core/airspeed'

export type LandingKinematics = Pick<LandingMetrics, 'verticalSpeed' | 'groundSpeed' | 'pitchRad' | 'rollRad'>
export type LandingFocus = 'sink' | 'speed' | 'bank' | 'pitch' | 'runway' | 'heading' | 'smooth'
export interface LandingDebrief {
  focus: LandingFocus
  correction: string
  telemetry: string
}

const finite = (value: number): number => Number.isFinite(value) ? value : 0
const sinkLoss = (vy: number): number => Math.max(0, -finite(vy) - 1.2) / 5 * .45
const speedLoss = (speed: number): number => Math.max(0, finite(speed) - 32) / 38 * .3
const bankLoss = (roll: number): number => Math.abs(finite(roll)) / (Math.PI / 5) * .2
const pitchLoss = (pitch: number): number => Math.max(0, Math.abs(finite(pitch)) - .22) / .65 * .05

/** Shared scoring and coaching thresholds, with no allocation in the live preview. */
export function landingQualityForMetrics(metrics: LandingKinematics): number {
  return Math.max(0, Math.min(1, 1 - sinkLoss(metrics.verticalSpeed) - speedLoss(metrics.groundSpeed)
    - bankLoss(metrics.rollRad) - pitchLoss(metrics.pitchRad)))
}

/** Capture first contact, not the velocity changed by ground resolution. */
export function touchdownKinematics(
  aircraft: Pick<Aircraft, 'impact' | 'impactVy' | 'velocity'>,
  pitchRad: number,
  rollRad: number,
): LandingKinematics {
  const velocity = aircraft.impact?.preImpactVelocity ?? aircraft.velocity
  return {
    verticalSpeed: aircraft.impact?.verticalVelocity ?? (aircraft.impactVy < 0 ? aircraft.impactVy : aircraft.velocity.y),
    groundSpeed: Math.hypot(velocity.x, velocity.z),
    pitchRad,
    rollRad,
  }
}

/** One correction from the largest score loss, never a pile of competing tips. */
export function assessLanding(metrics: LandingMetrics): LandingDebrief | undefined {
  if (![metrics.verticalSpeed, metrics.groundSpeed, metrics.pitchRad, metrics.rollRad].every(Number.isFinite)) {
    return undefined
  }
  const candidates: { focus: LandingFocus; loss: number; correction: string }[] = [
    { focus: 'sink', loss: sinkLoss(metrics.verticalSpeed), correction: 'Soften the flare: reduce descent before contact.' },
    { focus: 'speed', loss: speedLoss(metrics.groundSpeed), correction: 'Slow earlier: ease the throttle and use the speed brake before the flare.' },
    { focus: 'bank', loss: bankLoss(metrics.rollRad), correction: 'Level the wings before touching down.' },
    { focus: 'pitch', loss: pitchLoss(metrics.pitchRad), correction: 'Use a shallower touchdown attitude and flare gently.' },
  ]
  let strongest = candidates[0]!
  for (const candidate of candidates) if (candidate.loss > strongest.loss) strongest = candidate
  let focus: LandingFocus = strongest.focus
  let correction = strongest.correction
  if (strongest.loss < .02) {
    if (Number.isFinite(metrics.baseDistanceM) && metrics.baseDistanceM! > 180) {
      focus = 'runway'
      correction = 'Aim for the home runway to earn approach credit.'
    } else if (Number.isFinite(metrics.runwayLateralM) && Math.abs(metrics.runwayLateralM!) > 18) {
      focus = 'runway'
      correction = 'Line up with the runway center before the flare.'
    } else if (Number.isFinite(metrics.headingErrorRad) && Math.abs(metrics.headingErrorRad!) > Math.PI / 18) {
      focus = 'heading'
      correction = 'Match the runway heading before touching down.'
    } else {
      focus = 'smooth'
      correction = 'Controlled touchdown. Repeat that flare on your next approach.'
    }
  }
  const sink = Math.max(0, -metrics.verticalSpeed)
  const knots = Math.max(0, metrics.groundSpeed) * MS_TO_KTS
  // Bound display values even when debug/replay callers supply extreme telemetry.
  const telemetry = `Sink ${Math.min(999, sink).toFixed(1)} m/s · ${Math.min(9999, Math.round(knots))} kt` +
    ` · Bank ${Math.min(180, Math.round(Math.abs(metrics.rollRad) * 180 / Math.PI))}°` +
    ` · Pitch ${Math.min(180, Math.round(Math.abs(metrics.pitchRad) * 180 / Math.PI))}°`
  return { focus, correction, telemetry }
}

/** Crash labels come from CollisionSystem; unknown or old records get a safe fallback. */
export function failedLandingCorrection(reason: string | undefined, ditched = false): string {
  if (ditched || reason === 'WATER CONTACT') return 'Choose dry ground or the runway; water contact ends the sortie.'
  switch (reason) {
    case 'SINK RATE':
    case 'IMPACT LOAD': return 'Reduce descent earlier. Go around if the approach is still steep near the ground.'
    case 'GEAR UP': return 'Lower the landing gear before your final approach.'
    case 'OVERSPEED': return 'Slow down before final approach; use the speed brake well above the runway.'
    case 'BANK LIMIT': return 'Level the wings before ground contact.'
    case 'PITCH LIMIT':
    case 'ATTITUDE': return 'Keep the jet upright and use a shallow flare before touchdown.'
    case 'SLOPE': return 'Choose flatter ground or return to the home runway.'
    case 'OBSTACLE': return 'Climb clear of buildings and terrain before lining up again.'
    default: return 'Set up a stable approach, then try again.'
  }
}
