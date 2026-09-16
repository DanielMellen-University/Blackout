import { MAX_STUNT_ROLLS } from './StuntTracker'
import { MAX_COMBO_COUNT } from './FlightCombo'
import { SortieContractTracker, type SortieContractKind } from './SortieContract'
import type { Biome } from '../world/terrainSample'

export type ChallengePhase =
  | 'ready'
  | 'running'
  | 'returning'
  | 'complete'
  | 'failed'

export type Medal = 'gold' | 'silver' | 'bronze' | 'complete'
export type ChallengeScoringFocus = 'balanced' | 'gates' | 'pace' | 'landing'
export type MasteryBadgeId = 'first-flight' | 'gate-master' | 'landing-ace' | 'approach-ace' | 'streak-hunter' | 'gold-run'
export type LandingQualityLabel = 'BUTTER' | 'SMOOTH' | 'FIRM' | 'HARD'

export interface LandingMetrics {
  /** Downward speed at first contact, in m/s (negative = descending). */
  verticalSpeed: number
  /** Horizontal speed at first contact, in m/s. */
  groundSpeed: number
  pitchRad: number
  rollRad: number
  /** Horizontal distance from the home-strip center at touchdown. */
  baseDistanceM?: number
  /** Signed runway-local lateral offset at touchdown. */
  runwayLateralM?: number
  /** Absolute heading error from the runway centerline at touchdown. */
  headingErrorRad?: number
  /** Normalized precipitation and gust risk at touchdown. */
  weatherRisk?: number
  /** Atmosphere daylight at touchdown: 0 night … 1 day. */
  daylight?: number
}

export const MAX_NIGHT_SCORE = 500

/** Reward a clean night or dusk touchdown using the shared daylight envelope. */
export function nightLandingScore(daylight: number, landingQuality = 1): number {
  if (!Number.isFinite(daylight) || !Number.isFinite(landingQuality)) return 0
  const nightFactor = Math.max(0, Math.min(1, (0.42 - daylight) / 0.42))
  return Math.round(MAX_NIGHT_SCORE * nightFactor * Math.max(0, Math.min(1, landingQuality)))
}
